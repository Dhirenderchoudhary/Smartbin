// Read-only numbers for the admin dashboard: where people search, which bins they use,
// which fill fastest, and what needs cleaning now. Everything is computed per request.
// ponytail: fine for thousands of rows; move to a nightly rollup table if these get slow.
import { getDb, sql } from "@smartbin/db";
import { getImageViewUrl } from "../../common/storage/s3.js";
import { APP_TIMEZONE } from "../../common/time.js";
import { issuesSql, openIssue, type BinIssueSummary } from "../dustbin/service.js";

const TZ = APP_TIMEZONE;
const since = (days: number) => sql`now() - make_interval(days => ${days})`;

// Searches grouped by ~100 m cell, for the demand heatmap. unserved = no bin within 500 m.
export async function getDemand(days: number) {
  const rows = await getDb().execute<{ lat: number; lng: number; searches: number; unserved: number }>(sql`
    select lat_cell as lat, lng_cell as lng, count(*)::int as searches,
      count(*) filter (where bins_nearby = 0)::int as unserved
    from search_logs
    where created_at > ${since(days)}
    group by lat_cell, lng_cell
    order by searches desc
    limit 5000
  `);
  const cells = rows.map((r) => ({ lat: Number(r.lat), lng: Number(r.lng), searches: Number(r.searches), unserved: Number(r.unserved) }));
  return {
    days,
    totalSearches: cells.reduce((n, c) => n + c.searches, 0),
    unservedSearches: cells.reduce((n, c) => n + c.unserved, 0),
    cells,
  };
}

type BinRef = { id: string; name: string | null; type: string; latitude: number; longitude: number };

export async function getInsights(days: number) {
  const db = getDb();
  const [busiest, fastestFilling, slowestToFix, byType, fullByHour] = await Promise.all([
    // Most wanted: opened and navigated to
    db.execute<BinRef & { views: number; directions: number; arrivals: number }>(sql`
      select b.id, b.name, b.type, b.latitude, b.longitude,
        count(*) filter (where i.type = 'VIEW')::int as views,
        count(*) filter (where i.type = 'DIRECTIONS')::int as directions,
        count(*) filter (where i.type = 'ARRIVED')::int as arrivals
      from bin_interactions i join bins b on b.id = i.bin_id
      where i.created_at > ${since(days)}
      group by b.id
      order by count(*) filter (where i.type = 'VIEW') + 2 * count(*) filter (where i.type = 'DIRECTIONS') desc
      limit 10
    `),

    // Hours from "emptied" (last FULL marked sorted, or when the bin was added) to the first
    // FULL report after it; median per bin. ponytail: a FULL that lapsed without anyone marking
    // it emptied doesn't start a new cycle, so those bins look slower than they are.
    db.execute<BinRef & { cycles: number; median_hours: number }>(sql`
      with reports as (
        select i.bin_id, i.created_at,
          coalesce(
            (select max(j.resolved_at) from bin_issues j
              where j.bin_id = i.bin_id and j.type = 'FULL' and j.resolved_at <= i.created_at),
            b.created_at) as emptied_at
        from bin_issues i join bins b on b.id = i.bin_id
        where i.type = 'FULL' and i.created_at > ${since(days)}
      ),
      cycles as (
        select bin_id, emptied_at, min(created_at) as full_at from reports group by bin_id, emptied_at
      )
      select b.id, b.name, b.type, b.latitude, b.longitude, count(*)::int as cycles,
        percentile_cont(0.5) within group (order by extract(epoch from c.full_at - c.emptied_at) / 3600) as median_hours
      from cycles c join bins b on b.id = c.bin_id
      group by b.id
      order by median_hours asc
      limit 10
    `),

    // Slowest to get sorted once reported
    db.execute<BinRef & { fixed: number; avg_hours: number }>(sql`
      select b.id, b.name, b.type, b.latitude, b.longitude, count(*)::int as fixed,
        avg(extract(epoch from i.resolved_at - i.created_at) / 3600) as avg_hours
      from bin_issues i join bins b on b.id = i.bin_id
      where i.resolved_at is not null and i.created_at > ${since(days)}
      group by b.id
      order by avg_hours desc
      limit 10
    `),

    db.execute<{ type: string; reports: number }>(sql`
      select type, count(*)::int as reports from bin_issues where created_at > ${since(days)} group by type
    `),

    // When bins fill up during the day (Indian time), to plan collection rounds
    db.execute<{ hour: number; reports: number }>(sql`
      select h.hour::int as hour, count(i.id)::int as reports
      from generate_series(0, 23) as h(hour)
      left join bin_issues i
        on i.type = 'FULL' and i.created_at > ${since(days)}
        and extract(hour from i.created_at at time zone ${TZ}) = h.hour
      group by h.hour
      order by h.hour
    `),
  ]);

  const ref = (r: BinRef) => ({ id: r.id, name: r.name, type: r.type, latitude: Number(r.latitude), longitude: Number(r.longitude) });
  return {
    days,
    busiest: busiest.map((r) => ({ ...ref(r), views: Number(r.views), directions: Number(r.directions), arrivals: Number(r.arrivals) })),
    fastestFilling: fastestFilling.map((r) => ({ ...ref(r), cycles: Number(r.cycles), medianHoursToFull: round1(r.median_hours) })),
    slowestToFix: slowestToFix.map((r) => ({ ...ref(r), fixed: Number(r.fixed), avgHoursToFix: round1(r.avg_hours) })),
    issuesByType: Object.fromEntries(["FULL", "BROKEN", "DIRTY", "OTHER"].map((t) => [t, Number(byType.find((r) => r.type === t)?.reports ?? 0)])),
    fullReportsByHour: fullByHour.map((r) => ({ hour: Number(r.hour), reports: Number(r.reports) })),
  };
}

const round1 = (n: unknown) => Math.round(Number(n) * 10) / 10;

// Bins with open problems, most urgent first: more reports, older, and busier bins rank higher
export async function getCleaningQueue() {
  const rows = await getDb().execute<{
    id: string; name: string | null; type: string; latitude: number; longitude: number; image_key: string;
    missing_reports: number; issues: BinIssueSummary[]; oldest: string; reports: number; demand7: number;
  }>(sql`
    select id, name, type, latitude, longitude, image_key, missing_reports,
      ${issuesSql()} as issues,
      (select min(created_at) from bin_issues where bin_id = "bins"."id" and ${openIssue}) as oldest,
      (select count(*) from bin_issues where bin_id = "bins"."id" and ${openIssue})::int as reports,
      (select count(*) from bin_interactions where bin_id = "bins"."id" and created_at > ${since(7)})::int as demand7
    from bins
    where exists (select 1 from bin_issues where bin_id = "bins"."id" and ${openIssue})
  `);

  const now = Date.now();
  const items = await Promise.all(
    rows.map(async (r) => {
      const hoursOpen = (now - new Date(r.oldest).getTime()) / 3_600_000;
      const reports = Number(r.reports);
      const demand7 = Number(r.demand7);
      return {
        id: r.id,
        name: r.name,
        type: r.type,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        imageUrl: await getImageViewUrl(r.image_key),
        missingReports: Number(r.missing_reports),
        issues: r.issues,
        reports,
        demand7,
        oldestReportAt: new Date(r.oldest).toISOString(),
        hoursOpen: round1(hoursOpen),
        // ponytail: hand-tuned weights; each report ~ 3 h waiting ~ 6 people looking for it
        priority: round1(reports * 3 + hoursOpen + demand7 / 2),
      };
    })
  );
  return items.sort((a, b) => b.priority - a.priority);
}
