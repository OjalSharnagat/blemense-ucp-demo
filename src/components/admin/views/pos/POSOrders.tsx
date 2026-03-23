import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Banknote,
  Ban,
  CalendarRange,
  CreditCard,
  Eye,
  Printer,
  RotateCcw,
  Smartphone,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import type { BusinessProfile } from "@/data/billing";
import type { POSOrder, POSOrderStatus, POSPaymentMode, POSRefundItemInput, POSRefundRecord, POSSession, POSSettings } from "@/data/pos";
import { useBillingStore } from "@/lib/billingStore";
import { resolveTaxCode } from "@/lib/gst";
import { cn } from "@/lib/utils";
import { usePosStore } from "@/lib/posStore";
import { fmt } from "@/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";
import POSReceipt from "./POSReceipt";

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

const formatShortDateTime = (value: string): string =>
  `${formatDate(value)} · ${formatTime(value)}`;

type FilterStatus = "ALL" | POSOrderStatus;
type FilterPaymentMode = "ALL" | POSPaymentMode;
type PrintTarget =
  | { kind: "order"; order: POSOrder }
  | { kind: "refund"; order: POSOrder; refund: POSRefundRecord };

const paymentModeMeta: Record<POSPaymentMode, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Cash", icon: Banknote },
  UPI: { label: "UPI", icon: Smartphone },
  CARD: { label: "Card", icon: CreditCard },
  SPLIT: { label: "Split", icon: ArrowLeftRight },
};

const statusMeta: Record<POSOrderStatus, { label: string; className: string }> = {
  COMPLETED: {
    label: "Completed",
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  REFUNDED: {
    label: "Refunded",
    className: "border-sky-200 bg-sky-50 text-sky-700",
  },
  PARTIALLY_REFUNDED: {
    label: "Partial refund",
    className: "border-amber-200 bg-amber-50 text-amber-700",
  },
  VOIDED: {
    label: "Voided",
    className: "border-rose-200 bg-rose-50 text-rose-700",
  },
};

const refundReasons = ["Customer Return", "Wrong Item", "Damaged Goods", "Other"] as const;

function statusBadgeClass(status: POSOrderStatus): string {
  return statusMeta[status].className;
}

function orderSessionLabel(session?: POSSession | null): string {
  if (!session) return "Unknown session";
  return `${session.operatorName} · ${formatDate(session.openedAt)} · ${session.status}`;
}

function buildRefundTotals(order: POSOrder, refundList: POSRefundRecord[]) {
  const refundedByProduct = new Map<string, number>();

  for (const refund of refundList) {
    for (const item of refund.items) {
      refundedByProduct.set(item.productId, (refundedByProduct.get(item.productId) ?? 0) + item.quantity);
    }
  }

  return order.items.map((item) => {
    const refundedQuantity = refundedByProduct.get(item.productId) ?? 0;
    const remainingQuantity = Math.max(0, Number((item.quantity - refundedQuantity).toFixed(2)));
    return {
      item,
      refundedQuantity,
      remainingQuantity,
    };
  });
}

function estimateRefundTotal(order: POSOrder, quantities: Record<string, number>): number {
  return order.items.reduce((sum, item) => {
    const qty = quantities[item.id] ?? 0;
    if (qty <= 0) return sum;
    const share = item.quantity > 0 ? item.total / item.quantity : item.unitPrice;
    return Number((sum + share * qty).toFixed(2));
  }, 0);
}

function POSRefundReceipt({
  order,
  refund,
  businessProfile,
  settings,
  operatorName,
}: {
  order: POSOrder;
  refund: POSRefundRecord;
  businessProfile: BusinessProfile;
  settings: POSSettings;
  operatorName: string;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const isRegistered = businessProfile.gstRegistrationStatus === "REGISTERED";
  const compositionDealer = isRegistered && Boolean(businessProfile.compositionScheme);
  const gstRegistered = isRegistered && !compositionDealer;
  const storeName = businessProfile.tradeName || businessProfile.legalName;
  const addressLines = [
    businessProfile.address,
    businessProfile.addressLine2,
    [businessProfile.city, businessProfile.state, businessProfile.pincode].filter(Boolean).join(", "),
  ].filter(Boolean);

  useEffect(() => {
    if (typeof document === "undefined") return;

    let root = document.getElementById("pos-refund-receipt-print-root") as HTMLElement | null;
    if (!root) {
      root = document.createElement("div");
      root.id = "pos-refund-receipt-print-root";
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, []);

  if (!portalRoot) return null;

  return createPortal(
    <>
      <style>{`
        @page {
          size: 80mm 200mm;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            width: 80mm !important;
            min-width: 80mm !important;
            height: auto !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            overflow: visible !important;
          }

          body > * {
            display: none !important;
          }

          #pos-refund-receipt-print-root {
            display: block !important;
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }

          #pos-refund-receipt-print-shell {
            position: static !important;
            left: 0 !important;
            top: 0 !important;
            width: 302px !important;
            display: block !important;
            min-height: auto !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
          }
        }
      `}</style>

      <div id="pos-refund-receipt-print-root" className="pointer-events-none fixed left-[-10000px] top-0 w-[302px] max-w-[302px]">
        <div
          id="pos-refund-receipt-print-shell"
          className="mx-auto hidden w-[302px] max-w-[302px] bg-white px-3 py-2 font-mono text-[9.5px] leading-[1.18] text-slate-900"
        >
          <div className="text-center">
            <h1 className="text-[15px] font-extrabold leading-tight tracking-[0.18em] text-slate-950">{storeName}</h1>
            {settings.receiptHeader ? (
              <p className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-slate-500">{settings.receiptHeader}</p>
            ) : null}
            <p className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-800">Refund Slip</p>
            <div className="mt-1 space-y-[1px] text-[8.5px] text-slate-600">
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>Phone: {businessProfile.phone}</p>
              {isRegistered ? <p className="font-medium text-slate-700">GSTIN: {businessProfile.gstin || "Not provided"}</p> : null}
              {compositionDealer ? <p className="font-medium text-slate-700">Composition Dealer</p> : null}
            </div>
          </div>

          <div className="my-1 border-t border-dashed border-slate-300/80" />

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Order No.</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{order.orderNumber}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Refund No.</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{refund.id.slice(-8).toUpperCase()}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Date</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{formatDate(refund.refundedAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Time</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{formatTime(refund.refundedAt)}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Operator</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{operatorName}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Reason</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">{refund.reason}</span>
            </div>
          </div>

          <div className="my-1 border-t border-dashed border-slate-300/80" />

          <div className="space-y-1.5">
            {refund.items.map((item, index) => (
              <div key={item.id} className={cn("pb-1.5", index !== refund.items.length - 1 && "border-b border-dashed border-slate-200")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-semibold leading-tight text-slate-900">{item.name}</p>
                    {gstRegistered && item.gstRate ? (
                      <p className="mt-[1px] text-[7.5px] font-medium uppercase tracking-[0.18em] text-slate-500">GST @ {item.gstRate}%</p>
                    ) : null}
                    <p className="mt-[1px] text-[8.5px] text-slate-600">
                      {item.quantity} x {money(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[9.5px] font-semibold text-slate-900">{money(item.total)}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="my-1 border-t border-dashed border-slate-300/80" />

          <div className="space-y-0.5">
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Refund total</span>
              <span className="text-right text-[12px] font-extrabold text-slate-900">{money(refund.total)}</span>
            </div>
            <div className="flex items-start justify-between gap-3 py-[0.5px]">
              <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">Method</span>
              <span className="text-right text-[9.5px] font-semibold text-slate-700">
                {refund.paymentBreakdown.cash > 0
                  ? "Cash"
                  : refund.paymentBreakdown.upi > 0
                    ? "UPI"
                    : refund.paymentBreakdown.card > 0
                      ? "Card"
                      : "Mixed"}
              </span>
            </div>
          </div>

          <div className="my-1 border-t border-dashed border-slate-300/80" />

          <div className="space-y-0.5 text-center">
            <p className="text-[8.5px] font-medium uppercase tracking-[0.16em] leading-tight text-slate-700">
              {settings.receiptFooter || "Refund processed at the counter."}
            </p>
            <p className="text-[8.5px] font-semibold text-slate-900">Returned against POS sale {order.orderNumber}</p>
          </div>
        </div>
      </div>
    </>,
    portalRoot,
  );
}

export default function POSOrders() {
  const { businessProfile } = useBillingStore();
  const gstRegistered = businessProfile.gstRegistrationStatus === "REGISTERED" && !businessProfile.compositionScheme;
  const {
    orders,
    refunds,
    sessions,
    currentSession,
    settings,
    refundOrder,
    voidOrder,
  } = usePosStore();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sessionFilter, setSessionFilter] = useState<string>("ALL");
  const [paymentModeFilter, setPaymentModeFilter] = useState<FilterPaymentMode>("ALL");
  const [statusFilter, setStatusFilter] = useState<FilterStatus>("ALL");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<PrintTarget | null>(null);
  const [refundDialogOrderId, setRefundDialogOrderId] = useState<string | null>(null);
  const [refundSelection, setRefundSelection] = useState<Record<string, number>>({});
  const [refundReason, setRefundReason] = useState<(typeof refundReasons)[number] | "">("");
  const [voidDialogOrderId, setVoidDialogOrderId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [lastRefund, setLastRefund] = useState<{ order: POSOrder; refund: POSRefundRecord } | null>(null);

  const sessionById = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return [...orders]
      .filter((order) => {
        const session = sessionById.get(order.sessionId);
        const completedAt = new Date(order.completedAt).getTime();

        if (query) {
          const haystack = [
            order.orderNumber,
            order.id,
            order.customerName || "",
            order.customerPhone || "",
            session?.operatorName || "",
            order.status,
            order.paymentMode,
          ]
            .join(" ")
            .toLowerCase();
          if (!haystack.includes(query)) return false;
        }

        if (sessionFilter !== "ALL" && order.sessionId !== sessionFilter) return false;
        if (paymentModeFilter !== "ALL" && order.paymentMode !== paymentModeFilter) return false;
        if (statusFilter !== "ALL" && order.status !== statusFilter) return false;
        if (fromTs !== null && completedAt < fromTs) return false;
        if (toTs !== null && completedAt > toTs) return false;

        return true;
      })
      .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [orders, sessionById, search, dateFrom, dateTo, sessionFilter, paymentModeFilter, statusFilter]);

  const selectedOrder = useMemo(
    () => (selectedOrderId ? orders.find((order) => order.id === selectedOrderId) ?? null : null),
    [selectedOrderId, orders],
  );

  const selectedOrderSession = selectedOrder ? sessionById.get(selectedOrder.sessionId) ?? null : null;
  const selectedOrderRefunds = useMemo(
    () => (selectedOrder ? refunds.filter((refund) => refund.orderId === selectedOrder.id) : []),
    [selectedOrder, refunds],
  );

  const sessionOptions = useMemo(
    () =>
      [...sessions].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()),
    [sessions],
  );

  const summary = useMemo(() => {
    const totalSales = rows.reduce((sum, order) => sum + order.total, 0);
    const completedCount = rows.filter((order) => order.status === "COMPLETED").length;
    const refundedCount = rows.filter((order) => order.status === "REFUNDED").length;
    const voidedCount = rows.filter((order) => order.status === "VOIDED").length;
    return { totalSales, completedCount, refundedCount, voidedCount };
  }, [rows]);

  const refundDialogOrder = refundDialogOrderId ? orders.find((order) => order.id === refundDialogOrderId) ?? null : null;
  const refundDialogOrderRefunds = useMemo(
    () => (refundDialogOrder ? refunds.filter((refund) => refund.orderId === refundDialogOrder.id) : []),
    [refundDialogOrder, refunds],
  );
  const refundableLines = useMemo(
    () => (refundDialogOrder ? buildRefundTotals(refundDialogOrder, refundDialogOrderRefunds) : []),
    [refundDialogOrder, refundDialogOrderRefunds],
  );
  const selectedRefundTotal = refundDialogOrder ? estimateRefundTotal(refundDialogOrder, refundSelection) : 0;
  const selectedRefundCount = Object.values(refundSelection).filter((value) => value > 0).length;

  const canVoidSelected =
    Boolean(voidDialogOrderId && currentSession && orders.find((order) => order.id === voidDialogOrderId)?.sessionId === currentSession.id);

  useEffect(() => {
    const orderParam = searchParams.get("order");
    if (orderParam) {
      setSelectedOrderId(orderParam);
      return;
    }
    if (selectedOrderId) {
      setSelectedOrderId(null);
    }
  }, [searchParams, selectedOrderId]);

  useEffect(() => {
    if (!printTarget) return;
    const timer = window.setTimeout(() => window.print(), 0);
    const onAfterPrint = () => setPrintTarget(null);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [printTarget]);

  useEffect(() => {
    if (!refundDialogOrderId || !refundDialogOrder) return;
    const initialSelection: Record<string, number> = {};
    for (const line of refundableLines) {
      initialSelection[line.item.id] = 0;
    }
    setRefundSelection(initialSelection);
    setRefundReason("");
  }, [refundDialogOrderId, refundDialogOrder, refundableLines]);

  const openDetails = (orderId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("order", orderId);
    setSearchParams(next, { replace: true });
    setSelectedOrderId(orderId);
  };

  const closeDetails = () => {
    const next = new URLSearchParams(searchParams);
    next.delete("order");
    setSearchParams(next, { replace: true });
    setSelectedOrderId(null);
  };

  const startRefund = (orderId: string) => {
    setRefundDialogOrderId(orderId);
  };

  const submitRefund = () => {
    if (!refundDialogOrder) return;
    if (!refundReason) return;

    const items: POSRefundItemInput[] = refundableLines
      .map(({ item }) => ({
        productId: item.productId,
        quantity: Number(refundSelection[item.id] ?? 0),
      }))
      .filter((item) => item.quantity > 0);

    if (!items.length) return;

    const refund = refundOrder(refundDialogOrder.id, items, refundReason);
    if (!refund) return;

    setLastRefund({ order: refundDialogOrder, refund });
    setRefundDialogOrderId(null);
    setRefundSelection({});
    setRefundReason("");
    openDetails(refundDialogOrder.id);
  };

  const submitVoid = () => {
    if (!voidDialogOrderId || !voidReason.trim()) return;
    const updated = voidOrder(voidDialogOrderId, voidReason.trim());
    if (!updated) return;

    setVoidDialogOrderId(null);
    setVoidReason("");
    if (selectedOrderId === updated.id) {
      setSelectedOrderId(updated.id);
    }
  };

  const canRefundOrder = (order: POSOrder) => {
    const orderRefunds = refunds.filter((refund) => refund.orderId === order.id);
    const refundable = buildRefundTotals(order, orderRefunds);
    return refundable.some((entry) => entry.remainingQuantity > 0) && order.status !== "VOIDED";
  };

  const canVoidOrder = (order: POSOrder) => Boolean(currentSession && currentSession.id === order.sessionId && order.status === "COMPLETED");

  return (
    <div className="min-h-[calc(100vh-2rem)] rounded-2xl border border-slate-200 bg-slate-50 p-4 text-slate-900 shadow-sm shadow-slate-200/70">
      {lastRefund ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Refund posted</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">{lastRefund.order.orderNumber}</h2>
              <p className="mt-1 text-sm text-slate-600">
                {lastRefund.refund.items.length} item lines refunded for {money(lastRefund.refund.total)}.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                onClick={() => setPrintTarget({ kind: "refund", order: lastRefund.order, refund: lastRefund.refund })}
              >
                <Printer className="mr-2 h-4 w-4" />
                Print refund slip
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="h-10 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                onClick={() => setLastRefund(null)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {printTarget?.kind === "order" ? (
        <POSReceipt
          order={printTarget.order}
          businessProfile={businessProfile}
          settings={settings}
          operatorName={sessionById.get(printTarget.order.sessionId)?.operatorName || currentSession?.operatorName || "Cashier"}
        />
      ) : null}

      {printTarget?.kind === "refund" ? (
        <POSRefundReceipt
          order={printTarget.order}
          refund={printTarget.refund}
          businessProfile={businessProfile}
          settings={settings}
          operatorName={sessionById.get(printTarget.order.sessionId)?.operatorName || currentSession?.operatorName || "Cashier"}
        />
      ) : null}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-slate-500">POS orders</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Transaction history</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Review every counter sale, print slips, restore stock through refunds, and void only the orders from the active drawer.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
              {rows.length} filtered
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
              {summary.completedCount} completed
            </span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
              {summary.refundedCount} refunded
            </span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-slate-500">Sales value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{money(summary.totalSales)}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-slate-500">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{summary.completedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-slate-500">Refunded</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{summary.refundedCount}</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase tracking-[0.24em] text-slate-500">Voided</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold text-slate-900">{summary.voidedCount}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-base text-slate-900">Filters</CardTitle>
            <p className="text-sm text-slate-600">Filter by date, session, payment mode, and transaction status.</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <div className="grid gap-3 xl:grid-cols-5">
              <div className="relative xl:col-span-2">
                <CalendarRange className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search order, session, customer, or phone"
                  className="h-11 rounded-xl border-slate-200 bg-white pl-10 text-slate-900 placeholder:text-slate-400"
                />
              </div>
              <Input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              />
              <Select
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              >
                <option value="ALL">All sessions</option>
                {sessionOptions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.operatorName} · {formatDate(session.openedAt)} · {session.status}
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <Select
                value={paymentModeFilter}
                onChange={(event) => setPaymentModeFilter(event.target.value as FilterPaymentMode)}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              >
                <option value="ALL">All payment modes</option>
                <option value="CASH">Cash</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="SPLIT">Split</option>
              </Select>
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
              >
                <option value="ALL">All statuses</option>
                <option value="COMPLETED">Completed</option>
                <option value="REFUNDED">Refunded</option>
                <option value="PARTIALLY_REFUNDED">Partially refunded</option>
                <option value="VOIDED">Voided</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
          <CardHeader className="border-b border-slate-200 pb-4">
            <CardTitle className="text-base text-slate-900">Orders Desk</CardTitle>
            <p className="text-sm text-slate-600">Order number, time, items, payment mode, total, status, and actions.</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table className="min-w-[1280px]">
                <TableHeader>
                  <TableRow className="border-slate-200 hover:bg-transparent">
                    <TableHead className="text-slate-500">Order No.</TableHead>
                    <TableHead className="text-slate-500">Time</TableHead>
                    <TableHead className="text-slate-500">Items</TableHead>
                    <TableHead className="text-slate-500">Payment Mode</TableHead>
                    <TableHead className="text-right text-slate-500">Total</TableHead>
                    <TableHead className="text-slate-500">Status</TableHead>
                    <TableHead className="text-right text-slate-500">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length ? (
                    rows.map((order) => {
                      const session = sessionById.get(order.sessionId) ?? null;
                      const mode = paymentModeMeta[order.paymentMode];
                      const ModeIcon = mode.icon;
                      const orderRefunds = refunds.filter((refund) => refund.orderId === order.id);
                      const refundable = buildRefundTotals(order, orderRefunds);
                      const remainingRefundable = refundable.some((entry) => entry.remainingQuantity > 0);
                      const currentSessionOnlyVoid = canVoidOrder(order);
                      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                      return (
                        <TableRow key={order.id} className="border-slate-200 hover:bg-slate-50/80">
                          <TableCell className="font-medium text-slate-900">
                            <div className="space-y-1">
                              <p>{order.orderNumber}</p>
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{orderSessionLabel(session)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{formatTime(order.completedAt)}</p>
                              <p className="text-xs text-slate-500">{formatDate(order.completedAt)}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium text-slate-900">{itemCount}</p>
                              <p className="text-xs text-slate-500">{order.items.length} line items</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
                              <ModeIcon className="h-4 w-4" />
                              <span>{mode.label}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-base font-semibold text-slate-900">{money(order.total)}</TableCell>
                          <TableCell>
                            <Badge className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]", statusBadgeClass(order.status))}>
                              {statusMeta[order.status].label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-slate-200 bg-white px-3 text-slate-900 hover:bg-slate-50"
                                onClick={() => openDetails(order.id)}
                              >
                                <Eye className="mr-1 h-4 w-4" />
                                View
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 rounded-xl border-slate-200 bg-white px-3 text-slate-900 hover:bg-slate-50"
                                onClick={() => setPrintTarget({ kind: "order", order })}
                              >
                                <Printer className="mr-1 h-4 w-4" />
                                Print
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8 rounded-xl bg-slate-200 px-3 text-slate-950 hover:bg-slate-100"
                                disabled={!remainingRefundable}
                                onClick={() => startRefund(order.id)}
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                Refund
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                className="h-8 rounded-xl px-3"
                                disabled={!currentSessionOnlyVoid}
                                onClick={() => setVoidDialogOrderId(order.id)}
                              >
                                <Ban className="mr-1 h-4 w-4" />
                                Void
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="border-slate-200 hover:bg-transparent">
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="mx-auto max-w-md space-y-3">
                          <p className="text-lg font-semibold text-slate-900">No POS orders match the current filters.</p>
                          <p className="text-sm text-slate-600">Widen the date range or switch to another session to reveal more transactions.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => (open ? null : closeDetails())}>
        <DialogOverlay />
        <DialogContent className="!left-auto !right-0 !top-0 !h-full !w-[min(92vw,48rem)] !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-l border-slate-200 bg-white p-0 shadow-2xl">
          {selectedOrder ? (
            <div className="flex h-full flex-col">
              <div className="border-b border-slate-200 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <DialogHeader>
                      <DialogTitle className="text-2xl text-slate-900">{selectedOrder.orderNumber}</DialogTitle>
                      <DialogDescription className="text-slate-600">
                        {selectedOrderSession ? orderSessionLabel(selectedOrderSession) : "No session found"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge className={cn("rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.24em]", statusBadgeClass(selectedOrder.status))}>
                        {statusMeta[selectedOrder.status].label}
                      </Badge>
                      <Badge className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-slate-700">
                        {paymentModeMeta[selectedOrder.paymentMode].label}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    onClick={closeDetails}
                  >
                    Close
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <InfoTile label="Completed" value={formatShortDateTime(selectedOrder.completedAt)} />
                  <InfoTile label="Items" value={`${selectedOrder.items.reduce((sum, item) => sum + item.quantity, 0)}`} />
                  <InfoTile label="Total" value={money(selectedOrder.total)} />
                  <InfoTile label="Refunds" value={money(selectedOrderRefunds.reduce((sum, refund) => sum + refund.total, 0))} />
                </div>

                <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                  <CardHeader className="border-b border-slate-200 pb-3">
                    <CardTitle className="text-base text-slate-900">Order items</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-hidden">
                      <Table className="min-w-0">
                        <TableHeader>
                          <TableRow className="border-slate-200 hover:bg-transparent">
                            <TableHead className="text-slate-500">Item</TableHead>
                            <TableHead className="text-slate-500">Qty</TableHead>
                            <TableHead className="text-slate-500">Rate</TableHead>
                            <TableHead className="text-right text-slate-500">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.items.map((item) => (
                            <TableRow key={item.id} className="border-slate-200 hover:bg-slate-50/80">
                              <TableCell>
                                <div className="space-y-1">
                                  <p className="font-medium text-slate-900">{item.name}</p>
                                  {gstRegistered ? (() => {
                                    const resolution = resolveTaxCode(item);
                                    return resolution.code ? (
                                      <p className="text-xs text-slate-500">
                                        {resolution.codeType} {resolution.code}
                                      </p>
                                    ) : null;
                                  })() : null}
                                </div>
                              </TableCell>
                              <TableCell className="text-slate-600">{item.quantity}</TableCell>
                              <TableCell className="text-slate-600">{money(item.unitPrice)}</TableCell>
                              <TableCell className="text-right font-medium text-slate-900">{money(item.total)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 lg:grid-cols-2">
                  <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                    <CardHeader className="border-b border-slate-200 pb-3">
                      <CardTitle className="text-base text-slate-900">Totals</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-4">
                      <KeyValue label="Subtotal" value={money(selectedOrder.subtotal)} />
                      <KeyValue label="Discount" value={`- ${money(selectedOrder.discountAmount)}`} />
                      {gstRegistered ? <KeyValue label="Tax" value={money(selectedOrder.taxBreakdown.totalTax)} /> : null}
                      <KeyValue label="Round-off" value={money(selectedOrder.roundOffAmount ?? 0)} />
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Grand Total</span>
                        <span className="text-xl font-semibold text-slate-900">{money(selectedOrder.total)}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                    <CardHeader className="border-b border-slate-200 pb-3">
                      <CardTitle className="text-base text-slate-900">Payment</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pt-4">
                      <KeyValue label="Mode" value={selectedOrder.paymentMode} />
                      <KeyValue label="Amount tendered" value={money(selectedOrder.amountTendered)} />
                      <KeyValue label="Change due" value={money(selectedOrder.changeReturned)} />
                      <KeyValue
                        label="Linked invoice"
                        value={
                          selectedOrder.linkedInvoiceId ? (
                            <Link className="font-semibold text-sky-700 hover:underline" to={`/admin/billing/${selectedOrder.linkedInvoiceId}/preview`}>
                              Open invoice
                            </Link>
                          ) : (
                            "Not linked"
                          )
                        }
                      />
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Payment breakdown</p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                          <KeyChip label="Cash" value={money(selectedOrder.paymentBreakdown.cash)} />
                          <KeyChip label="UPI" value={money(selectedOrder.paymentBreakdown.upi)} />
                          <KeyChip label="Card" value={money(selectedOrder.paymentBreakdown.card)} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {selectedOrderRefunds.length ? (
                  <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                    <CardHeader className="border-b border-slate-200 pb-3">
                      <CardTitle className="text-base text-slate-900">Refund history</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      {selectedOrderRefunds.map((refund) => (
                        <div key={refund.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-900">{money(refund.total)}</p>
                              <p className="mt-1 text-sm text-slate-500">{formatShortDateTime(refund.refundedAt)}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="h-9 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                              onClick={() => setPrintTarget({ kind: "refund", order: selectedOrder, refund })}
                            >
                              <Printer className="mr-2 h-4 w-4" />
                              Print
                            </Button>
                          </div>
                          <p className="mt-3 text-sm text-slate-600">{refund.reason}</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {refund.items.map((item) => (
                              <Badge key={item.id} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-slate-700">
                                {item.name} x {item.quantity}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>

              <div className="border-t border-slate-200 p-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                    onClick={() => setPrintTarget({ kind: "order", order: selectedOrder })}
                  >
                    <Printer className="mr-2 h-4 w-4" />
                    Print Receipt
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                    disabled={!canRefundOrder(selectedOrder)}
                    onClick={() => startRefund(selectedOrder.id)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Refund
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="h-11 rounded-xl"
                    disabled={!canVoidOrder(selectedOrder)}
                    onClick={() => setVoidDialogOrderId(selectedOrder.id)}
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Void
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(refundDialogOrder)} onOpenChange={(open) => (open ? null : setRefundDialogOrderId(null))}>
        <DialogOverlay />
        <DialogContent className="w-[min(92vw,64rem)] border-slate-200 bg-white text-slate-900">
          {refundDialogOrder ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-slate-900">Refund {refundDialogOrder.orderNumber}</DialogTitle>
                <DialogDescription className="text-slate-600">
                  Select the items and quantities to refund. Stock will be restored automatically after confirmation.
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
                <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                  <CardHeader className="border-b border-slate-200 pb-3">
                    <CardTitle className="text-base text-slate-900">Refund items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-4">
                    {refundableLines.map(({ item, remainingQuantity, refundedQuantity }) => {
                      const selectedQty = refundSelection[item.id] ?? 0;
                      return (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                Ordered {item.quantity} · Already refunded {refundedQuantity} · Remaining {remainingQuantity}
                              </p>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-slate-700">
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 bg-white text-slate-900"
                                checked={selectedQty > 0}
                                onChange={(event) => {
                                  setRefundSelection((prev) => ({
                                    ...prev,
                                    [item.id]: event.target.checked ? Math.min(1, remainingQuantity) : 0,
                                  }));
                                }}
                              />
                              Select
                            </label>
                          </div>
                          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_180px]">
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Rate</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{money(item.unitPrice)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Refund qty</p>
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={remainingQuantity}
                                value={selectedQty}
                                onChange={(event) => {
                                  const next = Number(event.target.value || 0);
                                  setRefundSelection((prev) => ({
                                    ...prev,
                                    [item.id]: Number.isFinite(next) ? Math.max(0, Math.min(remainingQuantity, next)) : 0,
                                  }));
                                }}
                                className="mt-2 h-10 rounded-xl border-slate-200 bg-white text-slate-900"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card className="border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                  <CardHeader className="border-b border-slate-200 pb-3">
                    <CardTitle className="text-base text-slate-900">Refund summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Estimated refund</p>
                      <p className="mt-2 text-3xl font-semibold text-slate-900">{money(selectedRefundTotal)}</p>
                    </div>
                    <KeyValue label="Items selected" value={String(selectedRefundCount)} />
                    <KeyValue label="Original total" value={money(refundDialogOrder.total)} />
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Reason</label>
                      <Select
                        value={refundReason}
                        onChange={(event) => setRefundReason(event.target.value as (typeof refundReasons)[number] | "")}
                        className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                      >
                        <option value="">Select reason</option>
                        {refundReasons.map((reason) => (
                          <option key={reason} value={reason}>
                            {reason}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
                        onClick={() => setRefundDialogOrderId(null)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        className="h-11 rounded-xl bg-slate-900 text-white hover:bg-slate-800"
                        disabled={!refundReason || selectedRefundCount === 0}
                        onClick={submitRefund}
                      >
                        Confirm refund
                      </Button>
                    </DialogFooter>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(voidDialogOrderId)} onOpenChange={(open) => (open ? null : setVoidDialogOrderId(null))}>
        <DialogOverlay />
        <DialogContent className="w-[min(92vw,32rem)] border-slate-200 bg-white text-slate-900">
          <DialogHeader>
            <DialogTitle className="text-slate-900">Void order</DialogTitle>
            <DialogDescription className="text-slate-600">
              Voiding is allowed only for orders from the current open session. Stock will be restored when the order is voided.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={voidReason}
              onChange={(event) => setVoidReason(event.target.value)}
              placeholder="Enter void reason"
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
            />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {canVoidSelected ? "This void will restore stock and mark the order as voided." : "Only current session orders can be voided."}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50"
              onClick={() => setVoidDialogOrderId(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-11 rounded-xl"
              disabled={!canVoidSelected || !voidReason.trim()}
              onClick={submitVoid}
            >
              Void order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
      <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function KeyChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}
