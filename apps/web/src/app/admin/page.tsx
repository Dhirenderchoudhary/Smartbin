"use client";

import { useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AdminPage } from "@/components/admin/AdminShell";
import { Empty, ErrorNote, Kpi, Loading, Panel, RangePicker, RankList, type Range } from "@/components/admin/parts";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { hoursLabel, num, useAdminData, type Insights, type Stats, type Timeseries } from "@/lib/admin";
import { ISSUE_LABEL, TYPE_LABEL, type IssueType } from "@/lib/bins";

const usageConfig = {
  searches: { label: "Searches", color: "var(--chart-1)" },
  views: { label: "Bins opened", color: "var(--chart-2)" },
  directions: { label: "Directions", color: "var(--chart-3)" },
} satisfies ChartConfig;

const healthConfig = {
  issueReports: { label: "Problems reported", color: "var(--chart-4)" },
  issuesResolved: { label: "Sorted", color: "var(--chart-3)" },
  missingReports: { label: "Missing reports", color: "var(--chart-5)" },
} satisfies ChartConfig;

const growthConfig = {
  registrations: { label: "Bins added", color: "var(--chart-1)" },
  removals: { label: "Removed", color: "var(--chart-5)" },
} satisfies ChartConfig;

const hourConfig = { reports: { label: "Full reports", color: "var(--chart-4)" } } satisfies ChartConfig;
const typeConfig = { reports: { label: "Reports", color: "var(--chart-1)" } } satisfies ChartConfig;

const dayTick = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
const hourTick = (h: number) => (h === 0 ? "12a" : h < 12 ? `${h}a` : h === 12 ? "12p" : `${h - 12}p`);

export default function Overview() {
  const [range, setRange] = useState<Range>(30);
  const stats = useAdminData<Stats>("/admin/stats");
  const series = useAdminData<Timeseries>(`/admin/stats/timeseries?days=${range}`);
  const insights = useAdminData<Insights>(`/admin/insights?days=${range}`);
  const s = stats.data;
  const unservedShare = s && s.demand.searchesLast7Days ? Math.round((s.demand.unservedLast7Days / s.demand.searchesLast7Days) * 100) : 0;
  const byType = insights.data
    ? (Object.entries(insights.data.issuesByType) as [IssueType, number][]).map(([type, reports]) => ({ type: type === "OTHER" ? "Other" : ISSUE_LABEL[type], reports }))
    : [];

  return (
    <AdminPage title="Overview" description="How bins are being used, what needs attention, and where." actions={<RangePicker value={range} onChange={setRange} />}>
      <ErrorNote error={stats.error ?? series.error ?? insights.error} />

      {/* Today */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {!s ? (
          Array.from({ length: 6 }, (_, i) => <Loading key={i} className="h-32" />)
        ) : (
          <>
            <Kpi
              strong
              href="/admin/cleaning"
              label="Need cleaning"
              value={num(s.issues.needsCleaning)}
              note={s.issues.needsCleaning ? `${s.issues.open.FULL} full, ${s.issues.open.BROKEN} broken` : "All clear"}
            />
            <Kpi label="Active bins" value={num(s.bins.active)} note={`${s.bins.atRisk} may be missing`} href="/admin/bins" />
            <Kpi label="Searches today" value={num(s.demand.searchesToday)} note={`${unservedShare}% found no bin (7 days)`} href="/admin/map" />
            <Kpi label="Directions today" value={num(s.demand.directionsToday)} note={`${num(s.demand.viewsToday)} bins opened`} />
            <Kpi label="Problems today" value={num(s.issues.today)} note={`${s.reports.today} missing reports`} href="/admin/activity" />
            <Kpi label="Time to sort" value={hoursLabel(s.issues.avgHoursToFix)} note="average, 30 days" />
          </>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="How people use SmartBin" description="Bin searches, bins opened and directions started, per day." className="xl:col-span-2">
          {!series.data ? (
            <Loading />
          ) : (
            <ChartContainer config={usageConfig} className="aspect-auto h-64 w-full">
              <AreaChart data={series.data.series} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayTick} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayTick(String(d))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                {(["searches", "views", "directions"] as const).map((k) => (
                  <Area isAnimationActive={false} key={k} dataKey={k} type="monotone" stroke={`var(--color-${k})`} fill={`var(--color-${k})`} fillOpacity={0.12} strokeWidth={2} />
                ))}
              </AreaChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Most wanted bins" description="Opened and navigated to most.">
          {!insights.data ? (
            <Loading />
          ) : (
            <RankList
              items={insights.data.busiest.slice(0, 6)}
              value={(b) => num(b.views + b.directions)}
              detail={(b) => `${b.views} opened, ${b.directions} directions, ${b.arrivals} arrived`}
              empty="No one has opened a bin in this period."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel title="Bin health" description="Problems reported against problems sorted, and missing reports." className="xl:col-span-2">
          {!series.data ? (
            <Loading />
          ) : (
            <ChartContainer config={healthConfig} className="aspect-auto h-64 w-full">
              <BarChart data={series.data.series} margin={{ left: 0, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayTick} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayTick(String(d))} />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar isAnimationActive={false} dataKey="issueReports" fill="var(--color-issueReports)" radius={3} />
                <Bar isAnimationActive={false} dataKey="issuesResolved" fill="var(--color-issuesResolved)" radius={3} />
                <Bar isAnimationActive={false} dataKey="missingReports" fill="var(--color-missingReports)" radius={3} />
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Fill up fastest" description="Median time from emptied to reported full.">
          {!insights.data ? (
            <Loading />
          ) : (
            <RankList
              items={insights.data.fastestFilling.slice(0, 6)}
              value={(b) => hoursLabel(b.medianHoursToFull)}
              detail={(b) => `${TYPE_LABEL[b.type]}, full ${b.cycles} ${b.cycles === 1 ? "time" : "times"}`}
              empty="No bins reported full in this period."
            />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="When bins fill up" description="Full reports by hour of day, Indian time. Plan collection rounds before the peak.">
          {!insights.data ? (
            <Loading className="h-52" />
          ) : insights.data.fullReportsByHour.every((h) => !h.reports) ? (
            <Empty>No full reports in this period.</Empty>
          ) : (
            <ChartContainer config={hourConfig} className="aspect-auto h-52 w-full">
              <BarChart data={insights.data.fullReportsByHour} margin={{ left: 0, right: 4 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="hour" tickLine={false} axisLine={false} interval={2} tickFormatter={hourTick} />
                <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent labelFormatter={(_, p) => hourTick(Number(p?.[0]?.payload?.hour))} />} />
                <Bar isAnimationActive={false} dataKey="reports" fill="var(--color-reports)" radius={3} />
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Problems by type" description="All reports in this period.">
          {!insights.data ? (
            <Loading className="h-52" />
          ) : (
            <ChartContainer config={typeConfig} className="aspect-auto h-52 w-full">
              <BarChart data={byType} layout="vertical" margin={{ left: 8, right: 16 }}>
                <XAxis type="number" hide allowDecimals={false} />
                <YAxis type="category" dataKey="type" tickLine={false} axisLine={false} width={72} />
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                <Bar isAnimationActive={false} dataKey="reports" fill="var(--color-reports)" radius={4} />
              </BarChart>
            </ChartContainer>
          )}
        </Panel>

        <Panel title="Slowest to sort" description="Average time from report to sorted.">
          {!insights.data ? (
            <Loading className="h-52" />
          ) : (
            <RankList
              items={insights.data.slowestToFix.slice(0, 5)}
              value={(b) => hoursLabel(b.avgHoursToFix)}
              detail={(b) => `${b.fixed} sorted`}
              empty="Nothing has been sorted in this period."
            />
          )}
        </Panel>
      </div>

      <Panel title="Map growth" description="Bins added by people, and bins removed after missing reports.">
        {!series.data ? (
          <Loading className="h-48" />
        ) : (
          <ChartContainer config={growthConfig} className="aspect-auto h-48 w-full">
            <BarChart data={series.data.series} margin={{ left: 0, right: 8 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} tickFormatter={dayTick} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={36} />
              <ChartTooltip content={<ChartTooltipContent labelFormatter={(d) => dayTick(String(d))} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar isAnimationActive={false} dataKey="registrations" fill="var(--color-registrations)" radius={3} />
              <Bar isAnimationActive={false} dataKey="removals" fill="var(--color-removals)" radius={3} />
            </BarChart>
          </ChartContainer>
        )}
      </Panel>
    </AdminPage>
  );
}
