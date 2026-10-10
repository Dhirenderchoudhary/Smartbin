import {
  getDb,
  bins,
  users,
  binEvents,
  eq,
  and,
  sql,
  desc,
  asc,
  gt,
  ilike,
  count,
  getTableColumns,
} from "@smartbin/db";
import { ApiError } from "../../common/http/ApiError.js";
import { deleteImageObject, getImageViewUrl } from "../../common/storage/s3.js";
import { logBinEvent } from "../../common/events.js";
import { APP_TIMEZONE } from "../../common/time.js";
import { issuesSql, openIssue, openIssuesOf, resolveBinIssues } from "../dustbin/service.js";
import type { BinIssueType } from "@smartbin/db";
import type { BinPatchBody, BinsListQuery, EventsQuery } from "./schemas.js";

// "Today" and daily buckets follow Indian time, not UTC
const TZ = APP_TIMEZONE;
const todayStart = sql`(date_trunc('day', now() at time zone ${TZ}) at time zone ${TZ})`;

function paged<T>(items: T[], page: number, pageSize: number, total: number) {
  return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

export async function getStats() {
  const db = getDb();

  const [binTotals, eventTotals, userTotals, [usage]] = await Promise.all([
    db
      .select({
        active: count(),
        wet: sql<number>`count(*) filter (where ${bins.type} = 'WET')`.mapWith(Number),
        dry: sql<number>`count(*) filter (where ${bins.type} = 'DRY')`.mapWith(Number),
        both: sql<number>`count(*) filter (where ${bins.type} = 'BOTH')`.mapWith(Number),
        atRisk: sql<number>`count(*) filter (where ${bins.missingReports} > 0)`.mapWith(Number),
      })
      .from(bins),

    db
      .select({
        newToday: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        new7: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        new30: sql<number>`count(*) filter (where ${binEvents.type} = 'REGISTERED' and ${binEvents.createdAt} >= now() - interval '30 days')`.mapWith(Number),
        reportsToday: sql<number>`count(*) filter (where ${binEvents.type} = 'MISSING_REPORT' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        reports7: sql<number>`count(*) filter (where ${binEvents.type} = 'MISSING_REPORT' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        removedToday: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED' and ${binEvents.createdAt} >= ${todayStart})`.mapWith(Number),
        removed7: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED' and ${binEvents.createdAt} >= now() - interval '7 days')`.mapWith(Number),
        removedTotal: sql<number>`count(*) filter (where ${binEvents.type} = 'REMOVED')`.mapWith(Number),
        adminDeletedTotal: sql<number>`count(*) filter (where ${binEvents.type} = 'ADMIN_DELETE')`.mapWith(Number),
      })
      .from(binEvents),

    db
      .select({
        total: count(),
        new7: sql<number>`count(*) filter (where ${users.createdAt} >= now() - interval '7 days')`.mapWith(Number),
      })
      .from(users),

    db.execute<Record<string, number | null>>(sql`
      select
        (select count(distinct bin_id) from bin_issues where ${openIssue})::int as needs_cleaning,
        (select count(*) from bin_issues where ${openIssue} and type = 'FULL')::int as open_full,
        (select count(*) from bin_issues where ${openIssue} and type = 'BROKEN')::int as open_broken,
        (select count(*) from bin_issues where ${openIssue} and type = 'DIRTY')::int as open_dirty,
        (select count(*) from bin_issues where ${openIssue} and type = 'OTHER')::int as open_other,
        (select count(*) from bin_issues where created_at >= ${todayStart})::int as issues_today,
        (select avg(extract(epoch from resolved_at - created_at)) / 3600 from bin_issues
          where resolved_at > now() - interval '30 days') as avg_fix_hours,
        (select count(*) from search_logs where created_at >= ${todayStart})::int as searches_today,
        (select count(*) from search_logs where created_at > now() - interval '7 days')::int as searches_7,
        (select count(*) from search_logs where created_at > now() - interval '7 days' and bins_nearby = 0)::int as unserved_7,
        (select count(*) from bin_interactions where type = 'VIEW' and created_at >= ${todayStart})::int as views_today,
        (select count(*) from bin_interactions where type = 'DIRECTIONS' and created_at >= ${todayStart})::int as directions_today,
        (select count(*) from bin_interactions where type = 'DIRECTIONS' and created_at > now() - interval '7 days')::int as directions_7
    `),
  ]);

  const b = binTotals[0]!;
  const e = eventTotals[0]!;
  const u = userTotals[0]!;

  return {
    bins: { active: b.active, byType: { WET: b.wet, DRY: b.dry, BOTH: b.both }, atRisk: b.atRisk },
    new: { today: e.newToday, last7Days: e.new7, last30Days: e.new30 },
    reports: { today: e.reportsToday, last7Days: e.reports7 },
    removed: { today: e.removedToday, last7Days: e.removed7, total: e.removedTotal, byAdmin: e.adminDeletedTotal },
    users: { total: u.total, newLast7Days: u.new7 },
    issues: {
      needsCleaning: Number(usage!.needs_cleaning),
      open: {
        FULL: Number(usage!.open_full),
        BROKEN: Number(usage!.open_broken),
        DIRTY: Number(usage!.open_dirty),
        OTHER: Number(usage!.open_other),
      },
      today: Number(usage!.issues_today),
      avgHoursToFix: usage!.avg_fix_hours === null ? null : Math.round(Number(usage!.avg_fix_hours) * 10) / 10,
    },
    demand: {
      searchesToday: Number(usage!.searches_today),
      searchesLast7Days: Number(usage!.searches_7),
      unservedLast7Days: Number(usage!.unserved_7),
      viewsToday: Number(usage!.views_today),
      directionsToday: Number(usage!.directions_today),
      directionsLast7Days: Number(usage!.directions_7),
    },
  };
}

export async function getTimeseries(days: number) {
  const db = getDb();

  const onDay = (column: string) => sql.raw(`(${column} at time zone '${TZ}')::date = d.day::date`);
  const rows = await db.execute<Record<string, string | number>>(sql`
    select
      to_char(d.day, 'YYYY-MM-DD') as day,
      count(e.id) filter (where e.type = 'REGISTERED')::int as registrations,
      count(e.id) filter (where e.type = 'MISSING_REPORT')::int as missing_reports,
      count(e.id) filter (where e.type = 'REMOVED')::int as removals,
      count(e.id) filter (where e.type = 'ISSUE_REPORT')::int as issue_reports,
      count(e.id) filter (where e.type = 'ISSUE_RESOLVED')::int as issues_resolved,
      (select count(*) from search_logs s where ${onDay("s.created_at")})::int as searches,
      (select count(*) from bin_interactions i where i.type = 'VIEW' and ${onDay("i.created_at")})::int as views,
      (select count(*) from bin_interactions i where i.type = 'DIRECTIONS' and ${onDay("i.created_at")})::int as directions
    from generate_series(
      (now() at time zone ${TZ})::date - ${days - 1}::int,
      (now() at time zone ${TZ})::date,
      interval '1 day'
    ) as d(day)
    left join ${binEvents} e
      on (e.created_at at time zone ${TZ})::date = d.day::date
    group by d.day
    order by d.day
  `);

  return {
    days,
    timezone: TZ,
    series: rows.map((r) => ({
      day: String(r.day),
      registrations: Number(r.registrations),
      missingReports: Number(r.missing_reports),
      removals: Number(r.removals),
      issueReports: Number(r.issue_reports),
      issuesResolved: Number(r.issues_resolved),
      searches: Number(r.searches),
      views: Number(r.views),
      directions: Number(r.directions),
    })),
  };
}

// Opened + navigated to in the last 30 days
const demand30 = sql<number>`(select count(*) from bin_interactions
  where bin_id = "bins"."id" and type in ('VIEW', 'DIRECTIONS') and created_at > now() - interval '30 days')::int`;

const binListColumns = {
  ...getTableColumns(bins),
  creatorEmail: users.email,
  issues: issuesSql(),
  demand30,
};

const hasOpenIssue = (type?: BinIssueType) =>
  sql`exists (select 1 from bin_issues where bin_id = "bins"."id" and ${openIssue}${type ? sql` and type = ${type}` : sql``})`;

async function withImageUrl<T extends { imageKey: string }>(bin: T) {
  const { imageKey, ...rest } = bin;
  return { ...rest, imageUrl: await getImageViewUrl(imageKey) };
}

export async function listBins(query: BinsListQuery) {
  const db = getDb();

  const where = and(
    query.type ? eq(bins.type, query.type) : undefined,
    query.reported === true ? gt(bins.missingReports, 0) : undefined,
    query.reported === false ? eq(bins.missingReports, 0) : undefined,
    query.q ? ilike(bins.name, `%${query.q}%`) : undefined,
    query.issue ? hasOpenIssue(query.issue === "ANY" ? undefined : query.issue) : undefined
  );

  const orderBy =
    query.sort === "oldest"
      ? [asc(bins.createdAt)]
      : query.sort === "mostReported"
        ? [desc(bins.missingReports), desc(bins.createdAt)]
        : query.sort === "demand"
          ? [desc(demand30), desc(bins.createdAt)]
          : [desc(bins.createdAt)];

  const [rows, [totalRow]] = await Promise.all([
    db
      .select(binListColumns)
      .from(bins)
      .leftJoin(users, eq(bins.createdBy, users.id))
      .where(where)
      .orderBy(...orderBy)
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(bins).where(where),
  ]);

  const items = await Promise.all(rows.map(withImageUrl));
  return paged(items, query.page, query.pageSize, totalRow!.total);
}

export async function getBinsForMap() {
  const db = getDb();
  return db
    .select({
      id: bins.id,
      name: bins.name,
      type: bins.type,
      latitude: bins.latitude,
      longitude: bins.longitude,
      missingReports: bins.missingReports,
      createdAt: bins.createdAt,
      issues: issuesSql(),
      demand30,
    })
    .from(bins);
}

export async function getBinDetails(binId: string) {
  const db = getDb();

  const [bin] = await db
    .select(binListColumns)
    .from(bins)
    .leftJoin(users, eq(bins.createdBy, users.id))
    .where(eq(bins.id, binId))
    .limit(1);

  if (!bin) {
    throw ApiError.notFound("Dustbin not found");
  }

  const timeline = await db
    .select({ ...getTableColumns(binEvents), userEmail: users.email })
    .from(binEvents)
    .leftJoin(users, eq(binEvents.userId, users.id))
    .where(eq(binEvents.binId, binId))
    .orderBy(desc(binEvents.createdAt))
    .limit(100);

  // Last 30 days of use, and how often it fills / how fast it gets sorted (all time)
  const [usage, [figures]] = await Promise.all([
    db.execute<{ day: string; views: number; directions: number; arrivals: number }>(sql`
      select to_char(d.day, 'YYYY-MM-DD') as day,
        count(i.id) filter (where i.type = 'VIEW')::int as views,
        count(i.id) filter (where i.type = 'DIRECTIONS')::int as directions,
        count(i.id) filter (where i.type = 'ARRIVED')::int as arrivals
      from generate_series((now() at time zone ${TZ})::date - 29, (now() at time zone ${TZ})::date, interval '1 day') as d(day)
      left join bin_interactions i
        on i.bin_id = ${binId} and (i.created_at at time zone ${TZ})::date = d.day::date
      group by d.day
      order by d.day
    `),
    db.execute<Record<string, number | null>>(sql`
      with reports as (
        select i.created_at,
          coalesce((select max(j.resolved_at) from bin_issues j
            where j.bin_id = i.bin_id and j.type = 'FULL' and j.resolved_at <= i.created_at), ${new Date(bin.createdAt).toISOString()}::timestamptz) as emptied_at
        from bin_issues i where i.bin_id = ${binId} and i.type = 'FULL'
      ),
      cycles as (select emptied_at, min(created_at) as full_at from reports group by emptied_at)
      select
        (select count(*) from cycles)::int as full_cycles,
        (select percentile_cont(0.5) within group (order by extract(epoch from full_at - emptied_at) / 3600) from cycles) as median_hours_to_full,
        (select count(*) from bin_issues where bin_id = ${binId} and resolved_at is not null)::int as issues_sorted,
        (select avg(extract(epoch from resolved_at - created_at)) / 3600 from bin_issues where bin_id = ${binId} and resolved_at is not null) as avg_hours_to_fix,
        (select count(*) from bin_interactions where bin_id = ${binId} and type = 'VIEW')::int as views,
        (select count(*) from bin_interactions where bin_id = ${binId} and type = 'DIRECTIONS')::int as directions,
        (select count(*) from bin_interactions where bin_id = ${binId} and type = 'ARRIVED')::int as arrivals
    `),
  ]);
  const hours = (v: unknown) => (v === null || v === undefined ? null : Math.round(Number(v) * 10) / 10);

  return {
    ...(await withImageUrl(bin)),
    issues: await openIssuesOf(db, binId),
    usage: usage.map((u) => ({ day: u.day, views: Number(u.views), directions: Number(u.directions), arrivals: Number(u.arrivals) })),
    figures: {
      fullCycles: Number(figures!.full_cycles),
      medianHoursToFull: hours(figures!.median_hours_to_full),
      issuesSorted: Number(figures!.issues_sorted),
      avgHoursToFix: hours(figures!.avg_hours_to_fix),
      views: Number(figures!.views),
      directions: Number(figures!.directions),
      arrivals: Number(figures!.arrivals),
    },
    timeline,
  };
}

export async function updateBin(adminId: string, binId: string, body: BinPatchBody) {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [before] = await tx.select().from(bins).where(eq(bins.id, binId)).for("update");
    if (!before) {
      throw ApiError.notFound("Dustbin not found");
    }

    const changes: Partial<typeof bins.$inferInsert> = {};
    if (body.name !== undefined) changes.name = body.name;
    if (body.type !== undefined) changes.type = body.type;
    if (body.resetReports) changes.missingReports = 0;

    const [updated] = Object.keys(changes).length
      ? await tx.update(bins).set(changes).where(eq(bins.id, binId)).returning()
      : [before];
    if (body.resolveIssues) {
      await resolveBinIssues(adminId, binId, body.resolveIssues === true ? {} : { type: body.resolveIssues }, tx);
    }

    if (body.name !== undefined || body.type !== undefined) {
      await logBinEvent(tx, {
        binId,
        userId: adminId,
        type: "ADMIN_EDIT",
        meta: {
          before: { name: before.name, type: before.type },
          after: { name: updated!.name, type: updated!.type },
        },
      });
    }
    if (body.resetReports) {
      await logBinEvent(tx, {
        binId,
        userId: adminId,
        type: "ADMIN_RESET_REPORTS",
        meta: { previousMissingReports: before.missingReports },
      });
    }

    return withImageUrl(updated!);
  });
}

export async function deleteBin(adminId: string, binId: string) {
  const db = getDb();

  const removed = await db.transaction(async (tx) => {
    const [bin] = await tx.delete(bins).where(eq(bins.id, binId)).returning();
    if (!bin) {
      throw ApiError.notFound("Dustbin not found");
    }

    await logBinEvent(tx, {
      binId,
      userId: adminId,
      type: "ADMIN_DELETE",
      latitude: bin.latitude,
      longitude: bin.longitude,
      meta: {
        name: bin.name,
        type: bin.type,
        createdBy: bin.createdBy,
        registeredAt: bin.createdAt,
        missingReports: bin.missingReports,
      },
    });

    return bin;
  });

  await deleteImageObject(removed.imageKey);
  return { id: removed.id, deleted: true };
}

export async function listEvents(query: EventsQuery) {
  const db = getDb();

  const where = and(
    query.type ? eq(binEvents.type, query.type) : undefined,
    query.binId ? eq(binEvents.binId, query.binId) : undefined
  );

  const [items, [totalRow]] = await Promise.all([
    db
      .select({ ...getTableColumns(binEvents), userEmail: users.email })
      .from(binEvents)
      .leftJoin(users, eq(binEvents.userId, users.id))
      .where(where)
      .orderBy(desc(binEvents.createdAt))
      .limit(query.pageSize)
      .offset((query.page - 1) * query.pageSize),
    db.select({ total: count() }).from(binEvents).where(where),
  ]);

  return paged(items, query.page, query.pageSize, totalRow!.total);
}

export async function listUsers(page: number, pageSize: number) {
  const db = getDb();

  const [items, [totalRow]] = await Promise.all([
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        points: users.points,
        createdAt: users.createdAt,
        // Drizzle drops table prefixes in single-table selects, so these
        // correlated subqueries use explicit aliases to reach the outer users row
        registrations: sql<number>`(select count(*) from bin_events e where e.user_id = "users"."id" and e.type = 'REGISTERED')`.mapWith(Number),
        missingReports: sql<number>`(select count(*) from bin_events e where e.user_id = "users"."id" and e.type = 'MISSING_REPORT')`.mapWith(Number),
        activeBins: sql<number>`(select count(*) from bins b where b.created_by = "users"."id")`.mapWith(Number),
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(users),
  ]);

  return paged(items, page, pageSize, totalRow!.total);
}

// Cleaning queue "mark done" for many bins at once
export async function resolveIssuesForBins(adminId: string, binIds: string[], type?: BinIssueType) {
  return getDb().transaction(async (tx) => {
    let resolved = 0;
    for (const binId of binIds) {
      resolved += (await resolveBinIssues(adminId, binId, type ? { type } : {}, tx)).resolved;
    }
    return { bins: binIds.length, resolved };
  });
}
