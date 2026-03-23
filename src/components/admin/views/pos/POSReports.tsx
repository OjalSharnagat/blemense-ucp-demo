import { type ComponentType, type ReactNode, useMemo, useState } from "react";
import { BarChart3, CalendarRange, CircleDollarSign, Clock3, PieChart, ShoppingBag, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useBillingStore } from "@/lib/billingStore";
import type { POSOrder, POSPaymentMode, POSSession, POSSettings } from "@/data/pos";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/lib/posStore";
import { fmt } from "@/utils";
import { Badge } from "../../../ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";

const money = (value: number): string => fmt.format(Number(value || 0));

const formatDate = (value: string): string =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (value: string): string =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatDateTime = (value: string): string => `${formatDate(value)} · ${formatTime(value)}`;

type PaymentModeKey = "cash" | "upi" | "card";

type ProductPerformanceRow = {
  productId: string;
  name: string;
  unitsSold: number;
  revenue: number;
  refundedUnits: number;
  returnRate: number;
};

type ModeTotals = Record<PaymentModeKey, number>;

const paymentModeMeta: Record<PaymentModeKey, { label: string; color: string; bg: string }> = {
  cash: { label: "Cash", color: "#f97316", bg: "bg-orange-500" },
  upi: { label: "UPI", color: "#22c55e", bg: "bg-emerald-500" },
  card: { label: "Card", color: "#3b82f6", bg: "bg-blue-500" },
};

function clampDateString(value: string): string {
  return value.slice(0, 10);
}

function parseDateInput(value: string, endOfDay = false): number | null {
  if (!value) return null;
  const suffix = endOfDay ? "T23:59:59" : "T00:00:00";
  const time = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(time) ? time : null;
}

function inRange(value: string, from: number | null, to: number | null): boolean {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  if (from !== null && time < from) return false;
  if (to !== null && time > to) return false;
  return true;
}

function monthKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

function makeMonthSequence(start: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const next = new Date(start.getFullYear(), start.getMonth() + index, 1);
    return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  });
}

function currencyShareBar({ totals, total }: { totals: ModeTotals; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full border border-slate-200 bg-slate-100">
        {(Object.entries(paymentModeMeta) as Array<[PaymentModeKey, (typeof paymentModeMeta)[PaymentModeKey]]>).map(([mode, meta]) => {
          const value = totals[mode];
          const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 4 : 0) : 0;
          return (
            <div
              key={mode}
              className={meta.bg}
              style={{ width: `${width}%` }}
              aria-label={`${meta.label} ${money(value)}`}
              title={`${meta.label}: ${money(value)}`}
            />
          );
        })}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.entries(paymentModeMeta) as Array<[PaymentModeKey, (typeof paymentModeMeta)[PaymentModeKey]]>).map(([mode, meta]) => (
          <div key={mode} className="rounded-2xl border border-slate-200 bg-white px-3 py-3 shadow-sm shadow-slate-200/40">
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{meta.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{money(totals[mode])}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function getPaymentModeLabel(mode: POSOrder["paymentMode"]): string {
  if (mode === "SPLIT") return "Split";
  return paymentModeMeta[mode.toLowerCase() as PaymentModeKey].label;
}

function DonutChart({
  segments,
  total,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  const size = 220;
  const strokeWidth = 24;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total <= 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <PieChart className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-2 text-sm text-slate-500">No payment activity in the selected period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_1fr] lg:items-center">
      <div className="relative mx-auto h-[220px] w-[220px]">
        <svg viewBox={`0 0 ${size} ${size}`} className="h-[220px] w-[220px] -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.18)"
            strokeWidth={strokeWidth}
          />
          {segments.map((segment) => {
            const length = total > 0 ? (segment.value / total) * circumference : 0;
            const dash = `${Math.max(length, 0)} ${circumference - Math.max(length, 0)}`;
            const currentOffset = offset;
            offset += Math.max(length, 0);
            return (
              <circle
                key={segment.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={dash}
                strokeDashoffset={-currentOffset}
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Payment mix</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{money(total)}</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                <p className="text-sm font-medium text-slate-900">{segment.label}</p>
              </div>
              <p className="text-sm font-semibold text-slate-900">{money(segment.value)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max((segment.value / total) * 100, segment.value > 0 ? 4 : 0)}%`,
                  backgroundColor: segment.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function POSReports() {
  const { businessProfile } = useBillingStore();
  const { orders, refunds, sessions } = usePosStore();
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return clampDateString(date.toISOString());
  });
  const [endDate, setEndDate] = useState(() => clampDateString(new Date().toISOString()));
  const [sessionId, setSessionId] = useState("ALL");

  const fromTs = useMemo(() => parseDateInput(startDate, false), [startDate]);
  const toTs = useMemo(() => parseDateInput(endDate, true), [endDate]);

  const closedSessions = useMemo(
    () => [...sessions].filter((session) => session.status === "CLOSED").sort((a, b) => new Date(b.closedAt || b.openedAt).getTime() - new Date(a.closedAt || a.openedAt).getTime()),
    [sessions],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (order.status === "VOIDED") return false;
        if (!inRange(order.completedAt, fromTs, toTs)) return false;
        if (sessionId !== "ALL" && order.sessionId !== sessionId) return false;
        return true;
      }),
    [orders, fromTs, toTs, sessionId],
  );

  const filteredRefunds = useMemo(
    () =>
      refunds.filter((refund) => {
        if (!inRange(refund.refundedAt, fromTs, toTs)) return false;
        if (sessionId !== "ALL" && refund.sessionId !== sessionId) return false;
        return true;
      }),
    [refunds, fromTs, toTs, sessionId],
  );

  const paymentTotals = useMemo<ModeTotals>(() => {
    const totals: ModeTotals = { cash: 0, upi: 0, card: 0 };
    for (const order of filteredOrders) {
      totals.cash += order.paymentBreakdown.cash;
      totals.upi += order.paymentBreakdown.upi;
      totals.card += order.paymentBreakdown.card;
    }
    for (const refund of filteredRefunds) {
      totals.cash -= refund.paymentBreakdown.cash;
      totals.upi -= refund.paymentBreakdown.upi;
      totals.card -= refund.paymentBreakdown.card;
    }
    return {
      cash: Math.max(0, Number(totals.cash.toFixed(2))),
      upi: Math.max(0, Number(totals.upi.toFixed(2))),
      card: Math.max(0, Number(totals.card.toFixed(2))),
    };
  }, [filteredOrders, filteredRefunds]);

  const paymentTotal = paymentTotals.cash + paymentTotals.upi + paymentTotals.card;
  const totalOrders = filteredOrders.length;
  const totalRefunds = filteredRefunds.reduce((sum, refund) => sum + refund.total, 0);
  const grossSales = filteredOrders.reduce((sum, order) => sum + order.total, 0);
  const netSales = Math.max(0, Number((grossSales - totalRefunds).toFixed(2)));
  const averageOrderValue = totalOrders > 0 ? Number((netSales / totalOrders).toFixed(2)) : 0;

  const productMap = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        unitsSold: number;
        revenue: number;
        refundedUnits: number;
        refundedRevenue: number;
      }
    >();

    for (const order of filteredOrders) {
      for (const item of order.items) {
        const key = item.productId || item.name;
        const entry = map.get(key) ?? {
          name: item.name,
          unitsSold: 0,
          revenue: 0,
          refundedUnits: 0,
          refundedRevenue: 0,
        };
        entry.unitsSold += item.quantity;
        entry.revenue += item.total;
        map.set(key, entry);
      }
    }

    for (const refund of filteredRefunds) {
      for (const item of refund.items) {
        const key = item.productId || item.name;
        const entry = map.get(key) ?? {
          name: item.name,
          unitsSold: 0,
          revenue: 0,
          refundedUnits: 0,
          refundedRevenue: 0,
        };
        entry.refundedUnits += item.quantity;
        entry.refundedRevenue += item.total;
        map.set(key, entry);
      }
    }

    return map;
  }, [filteredOrders, filteredRefunds]);

  const productPerformance = useMemo<ProductPerformanceRow[]>(() => {
    return [...productMap.entries()]
      .map(([productId, entry]) => {
        const netUnits = Math.max(0, Number((entry.unitsSold - entry.refundedUnits).toFixed(2)));
        const netRevenue = Math.max(0, Number((entry.revenue - entry.refundedRevenue).toFixed(2)));
        const returnRate = entry.unitsSold > 0 ? Number(((entry.refundedUnits / entry.unitsSold) * 100).toFixed(1)) : 0;
        return {
          productId,
          name: entry.name,
          unitsSold: netUnits,
          revenue: netRevenue,
          refundedUnits: entry.refundedUnits,
          returnRate,
        };
      })
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue);
  }, [productMap]);

  const topProducts = productPerformance.slice(0, 5);
  const topProductTotal = topProducts.reduce((sum, item) => sum + item.unitsSold, 0);

  const selectedSession = useMemo(() => {
    if (sessionId === "ALL") return null;
    return closedSessions.find((session) => session.id === sessionId) ?? null;
  }, [closedSessions, sessionId]);

  const selectedSessionOrders = useMemo(
    () => (selectedSession ? orders.filter((order) => order.sessionId === selectedSession.id && order.status !== "VOIDED") : []),
    [orders, selectedSession],
  );
  const selectedSessionRefunds = useMemo(
    () => (selectedSession ? refunds.filter((refund) => refund.sessionId === selectedSession.id) : []),
    [refunds, selectedSession],
  );

  const selectedSessionSnapshot = useMemo(() => {
    if (!selectedSession) return null;
    const gross = selectedSessionOrders.reduce((sum, order) => sum + order.total, 0);
    const refundTotal = selectedSessionRefunds.reduce((sum, refund) => sum + refund.total, 0);
    const net = Number((gross - refundTotal).toFixed(2));
    return {
      refundTotal,
      net,
    };
  }, [selectedSession, selectedSessionOrders, selectedSessionRefunds]);

  const daySequence = useMemo(() => {
    if (fromTs === null || toTs === null) return [] as string[];
    const days: string[] = [];
    const cursor = new Date(fromTs);
    const end = new Date(toTs);
    while (cursor.getTime() <= end.getTime() && days.length < 31) {
      days.push(cursor.toISOString().slice(0, 10));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  }, [fromTs, toTs]);

  const paymentTrend = useMemo(() => {
    if (!daySequence.length) {
      const monthBuckets = new Map<string, ModeTotals>();
      for (const order of filteredOrders) {
        const key = monthKey(order.completedAt);
        const bucket = monthBuckets.get(key) ?? { cash: 0, upi: 0, card: 0 };
        bucket.cash += order.paymentBreakdown.cash;
        bucket.upi += order.paymentBreakdown.upi;
        bucket.card += order.paymentBreakdown.card;
        monthBuckets.set(key, bucket);
      }
      for (const refund of filteredRefunds) {
        const key = monthKey(refund.refundedAt);
        const bucket = monthBuckets.get(key) ?? { cash: 0, upi: 0, card: 0 };
        bucket.cash -= refund.paymentBreakdown.cash;
        bucket.upi -= refund.paymentBreakdown.upi;
        bucket.card -= refund.paymentBreakdown.card;
        monthBuckets.set(key, bucket);
      }
      return [...monthBuckets.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, totals]) => ({
          label: key,
          totals: {
            cash: Math.max(0, Number(totals.cash.toFixed(2))),
            upi: Math.max(0, Number(totals.upi.toFixed(2))),
            card: Math.max(0, Number(totals.card.toFixed(2))),
          },
        }));
    }

    return daySequence.map((day) => {
      const dayOrders = filteredOrders.filter((order) => order.completedAt.slice(0, 10) === day);
      const dayRefunds = filteredRefunds.filter((refund) => refund.refundedAt.slice(0, 10) === day);
      const totals: ModeTotals = { cash: 0, upi: 0, card: 0 };
      for (const order of dayOrders) {
        totals.cash += order.paymentBreakdown.cash;
        totals.upi += order.paymentBreakdown.upi;
        totals.card += order.paymentBreakdown.card;
      }
      for (const refund of dayRefunds) {
        totals.cash -= refund.paymentBreakdown.cash;
        totals.upi -= refund.paymentBreakdown.upi;
        totals.card -= refund.paymentBreakdown.card;
      }
      return {
        label: day,
        totals: {
          cash: Math.max(0, Number(totals.cash.toFixed(2))),
          upi: Math.max(0, Number(totals.upi.toFixed(2))),
          card: Math.max(0, Number(totals.card.toFixed(2))),
        },
      };
    });
  }, [daySequence, filteredOrders, filteredRefunds]);

  const paymentChartSegments = [
    { label: "Cash", value: paymentTotals.cash, color: paymentModeMeta.cash.color },
    { label: "UPI", value: paymentTotals.upi, color: paymentModeMeta.upi.color },
    { label: "Card", value: paymentTotals.card, color: paymentModeMeta.card.color },
  ];

  return (
    <div className="space-y-6 rounded-[24px] border border-slate-200 bg-slate-100/70 p-4 text-slate-900 shadow-sm shadow-slate-200/70">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">POS reports</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Register intelligence</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Daily sales, closed session reconciliation, product movement, and payment mix for the point-of-sale desk.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-700">
            {formatDateTime(startDate)}
          </Badge>
          <Badge className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-700">
            {formatDateTime(endDate)}
          </Badge>
        </div>
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
        <CardHeader className="border-b border-slate-200 pb-4">
          <CardTitle className="text-base text-slate-900">Report window</CardTitle>
          <p className="text-sm text-slate-600">Use the same range for daily, product, and payment reports. Session reports use a closed session selector.</p>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 lg:grid-cols-[1fr_1fr_1.1fr]">
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Start date</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white text-slate-900" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">End date</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white text-slate-900" />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Closed session</label>
            <Select
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
            >
              <option value="ALL">All closed sessions</option>
              {closedSessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.operatorName} · {formatDate(session.openedAt)} · {session.status}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Total sales" value={money(netSales)} />
        <MetricCard icon={ShoppingBag} label="Orders" value={String(totalOrders)} />
        <MetricCard icon={Wallet} label="Average order value" value={money(averageOrderValue)} />
        <MetricCard icon={Clock3} label="Refunds" value={money(totalRefunds)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Daily Summary
            </CardTitle>
            <p className="text-sm text-slate-600">Total sales, total orders, average order value, payment mode breakdown, and top products.</p>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Total sales" value={money(netSales)} />
              <MiniStat label="Total orders" value={String(totalOrders)} />
              <MiniStat label="Avg order value" value={money(averageOrderValue)} />
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Payment mode breakdown</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{money(paymentTotal)}</p>
              </div>
              {currencyShareBar({ totals: paymentTotals, total: paymentTotal })}
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Top 5 products sold</p>
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Net units</p>
              </div>
              {topProducts.length ? (
                <div className="space-y-3">
                  {topProducts.map((item, index) => (
                    <div key={`${item.productId}-${item.name}`} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-500">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.unitsSold} units · {money(item.revenue)} revenue
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-900">{Math.round((item.unitsSold / Math.max(topProductTotal, 1)) * 100)}%</p>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-300"
                          style={{ width: `${Math.max((item.unitsSold / Math.max(topProductTotal, 1)) * 100, 6)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState text="No sold products in the selected range." />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="flex items-center gap-2 text-base text-slate-900">
              <PieChart className="h-4 w-4 text-slate-400" />
              Payment Analytics
            </CardTitle>
            <p className="text-sm text-slate-600">Cash vs UPI vs Card mix over the selected reporting period.</p>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            <DonutChart segments={paymentChartSegments} total={paymentTotal} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Trend</p>
              <div className="mt-4 space-y-3">
                {paymentTrend.length ? (
                  paymentTrend.map((point) => {
                    const pointTotal = point.totals.cash + point.totals.upi + point.totals.card;
                    return (
                      <div key={point.label} className="grid gap-2 md:grid-cols-[8rem_1fr] md:items-center">
                        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{monthLabel(point.label)}</p>
                        <div className="flex h-3 overflow-hidden rounded-full border border-slate-200 bg-white">
                          {(Object.entries(paymentModeMeta) as Array<[PaymentModeKey, (typeof paymentModeMeta)[PaymentModeKey]]>).map(([mode, meta]) => {
                            const value = point.totals[mode];
                            const width = pointTotal > 0 ? Math.max((value / pointTotal) * 100, value > 0 ? 4 : 0) : 0;
                            return <div key={mode} className={meta.bg} style={{ width: `${width}%` }} />;
                          })}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <EmptyState text="No payment trend available for this range." />
                )}
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["cash", "upi", "card"] as PaymentModeKey[]).map((mode) => (
                <div key={mode} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm shadow-slate-200/40">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{paymentModeMeta[mode].label}</p>
                  <p className="mt-1 text-base font-semibold text-slate-900">{money(paymentTotals[mode])}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-base text-slate-900">Session Report</CardTitle>
            <p className="text-sm text-slate-600">Select a closed session to review drawer reconciliation and the full order list.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            {selectedSession && selectedSessionSnapshot ? (
              <>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <MiniStat label="Operator" value={selectedSession.operatorName} />
                  <MiniStat label="Opened" value={formatDateTime(selectedSession.openedAt)} />
                  <MiniStat label="Closed" value={selectedSession.closedAt ? formatDateTime(selectedSession.closedAt) : "Open"} />
                  <MiniStat label="Orders" value={String(selectedSession.totalOrders)} />
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <MiniStat label="Opening cash" value={money(selectedSession.openingCash)} />
                  <MiniStat label="Expected cash" value={money(selectedSession.expectedCash ?? selectedSession.openingCash)} />
                  <MiniStat
                    label="Closing cash"
                    value={money(selectedSession.closingCash ?? 0)}
                    tone={selectedSession.hasDiscrepancy ? "warning" : "default"}
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Reconciliation</p>
                    <Badge
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]",
                        selectedSession.hasDiscrepancy ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700",
                      )}
                    >
                      {selectedSession.hasDiscrepancy
                        ? `${(selectedSession.cashDifference ?? 0) >= 0 ? "Surplus" : "Shortage"} ${money(Math.abs(selectedSession.cashDifference ?? 0))}`
                        : "Balanced"}
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <MiniStat label="Net sales" value={money(selectedSessionSnapshot.net)} />
                    <MiniStat label="Cash sales" value={money(selectedSession.paymentBreakdown.cash)} />
                    <MiniStat label="Refunds" value={money(selectedSessionSnapshot.refundTotal)} />
                  </div>
                  {selectedSession.notes ? <p className="mt-3 text-sm text-slate-600">Notes: {selectedSession.notes}</p> : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Order list</p>
                  <div className="mt-3 overflow-x-auto">
                    <Table className="min-w-[720px]">
                      <TableHeader>
                        <TableRow className="border-slate-200 hover:bg-transparent">
                          <TableHead className="text-slate-500">Order</TableHead>
                          <TableHead className="text-slate-500">Time</TableHead>
                          <TableHead className="text-slate-500">Payment</TableHead>
                          <TableHead className="text-right text-slate-500">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedSessionOrders.map((order) => (
                          <TableRow key={order.id} className="border-slate-200 hover:bg-slate-50/80">
                            <TableCell className="font-medium text-slate-900">
                              <Link to={`/admin/pos/orders?order=${order.id}`} className="text-sky-700 hover:underline">
                                {order.orderNumber}
                              </Link>
                            </TableCell>
                            <TableCell className="text-slate-600">{formatTime(order.completedAt)}</TableCell>
                            <TableCell className="text-slate-600">{getPaymentModeLabel(order.paymentMode)}</TableCell>
                            <TableCell className="text-right font-semibold text-slate-900">{money(order.total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </>
            ) : (
              <EmptyState text={closedSessions.length ? "Choose a closed session to inspect cash reconciliation and order flow." : "No closed sessions yet."} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-base text-slate-900">Product Performance</CardTitle>
            <p className="text-sm text-slate-600">Which products sold most in the selected date range, including return rate.</p>
          </CardHeader>
          <CardContent className="pt-4">
            {productPerformance.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[780px]">
                  <TableHeader>
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableHead className="text-slate-500">Product name</TableHead>
                      <TableHead className="text-slate-500">Units sold</TableHead>
                      <TableHead className="text-slate-500">Revenue</TableHead>
                      <TableHead className="text-right text-slate-500">Return rate</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productPerformance.slice(0, 12).map((row) => (
                      <TableRow key={row.productId} className="border-slate-200 hover:bg-slate-50/80">
                        <TableCell className="font-medium text-slate-900">{row.name}</TableCell>
                        <TableCell className="text-slate-600">{row.unitsSold}</TableCell>
                        <TableCell className="text-slate-600">{money(row.revenue)}</TableCell>
                        <TableCell className="text-right">
                          <Badge className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]", row.returnRate > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
                            {row.returnRate.toFixed(1)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <EmptyState text="No product movement in the selected date range." />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/50">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warning";
}) {
  return (
    <div className={cn("rounded-2xl border px-4 py-3 shadow-sm", tone === "warning" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-white")}>
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className={cn("mt-1 text-sm font-semibold", tone === "warning" ? "text-amber-700" : "text-slate-900")}>{value}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <p className="text-sm text-slate-600">{text}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm shadow-slate-200/40">
      <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
