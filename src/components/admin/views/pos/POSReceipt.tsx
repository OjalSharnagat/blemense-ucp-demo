import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { BusinessProfile } from "@/data/billing";
import type { POSOrder, POSSettings } from "@/data/pos";
import { resolveTaxCode } from "@/lib/gst";
import { cn } from "@/lib/utils";
import { fmt } from "@/utils";

const money = (value: number) => fmt.format(Number(value || 0));

const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

const formatQuantity = (value: number) => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.00$/, "");
};

function Divider() {
  return <div className="my-1 border-t border-dashed border-slate-300/80" />;
}

function Row({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-[0.5px]">
      <span className="text-[8.5px] uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <span className={cn("text-right leading-none", emphasis ? "text-[12px] font-extrabold text-slate-900" : "text-[9.5px] font-semibold text-slate-700")}>{value}</span>
    </div>
  );
}

export default function POSReceipt({
  order,
  businessProfile,
  settings,
  operatorName,
  invoiceNumber,
  className,
}: {
  order: POSOrder;
  businessProfile: BusinessProfile;
  settings: POSSettings;
  operatorName: string;
  invoiceNumber?: string;
  className?: string;
}) {
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);
  const isRegistered = businessProfile.gstRegistrationStatus === "REGISTERED";
  const compositionDealer = isRegistered && Boolean(businessProfile.compositionScheme);
  const gstRegistered = isRegistered && !compositionDealer;
  const showTaxColumns = gstRegistered && order.taxBreakdown.totalTax > 0;
  const showGstin = isRegistered && settings.showGstinOnReceipt;
  const showHsn = gstRegistered;
  const showOrderNumber = settings.showOrderNumberOnReceipt;
  const showOperatorName = settings.showOperatorNameOnReceipt;
  const customerName = order.customerName?.trim() || "";
  const customerPhone = order.customerPhone?.trim() || "";
  const showCustomerDetails = Boolean(customerName || customerPhone);
  const storeName = businessProfile.tradeName || businessProfile.legalName;
  const addressLines = [
    businessProfile.address,
    businessProfile.addressLine2,
    [businessProfile.city, businessProfile.state, businessProfile.pincode].filter(Boolean).join(", "),
  ].filter(Boolean);
  const hasSplitPayment = order.paymentMode === "SPLIT";
  const paymentBreakdown = order.paymentBreakdown;

  useEffect(() => {
    if (typeof document === "undefined") return;

    let root = document.getElementById("pos-receipt-print-root") as HTMLElement | null;
    if (!root) {
      root = document.createElement("div");
      root.id = "pos-receipt-print-root";
      document.body.appendChild(root);
    }
    setPortalRoot(root);
  }, []);

  if (!portalRoot) {
    return null;
  }

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

          #pos-receipt-print-root {
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

          #pos-receipt-print-shell {
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

      <div id="pos-receipt-print-root" className="pointer-events-none fixed left-[-10000px] top-0 w-[302px] max-w-[302px]">
        <div
          id="pos-receipt-print-shell"
          className={cn(
            "mx-auto hidden w-[302px] max-w-[302px] bg-white px-3 py-2 font-mono text-[9.5px] leading-[1.18] text-slate-900",
            className,
          )}
        >
          <div className="text-center">
            <h1 className="text-[15px] font-extrabold leading-tight tracking-[0.18em] text-slate-950">{storeName}</h1>
            {settings.receiptHeader ? (
              <p className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.22em] text-slate-500">{settings.receiptHeader}</p>
            ) : null}
            <div className="mt-1 space-y-[1px] text-[8.5px] text-slate-600">
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>Phone: {businessProfile.phone}</p>
              {showGstin ? <p className="font-medium text-slate-700">GSTIN: {businessProfile.gstin || "Not provided"}</p> : null}
              {compositionDealer ? <p className="font-medium text-slate-700">Composition Dealer</p> : null}
            </div>
          </div>

          <Divider />

          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            <Row label="Date" value={formatDate(order.completedAt)} />
            <Row label="Time" value={formatTime(order.completedAt)} />
            {showOrderNumber ? <Row label="Order No." value={order.orderNumber} /> : null}
            {showOperatorName ? <Row label="Operator" value={operatorName} /> : null}
          </div>

          {showCustomerDetails ? (
            <>
              <Divider />
              <div className="space-y-0.5">
                {customerName ? <Row label="Customer" value={customerName} /> : null}
                {customerPhone ? <Row label="Mobile" value={customerPhone} /> : null}
              </div>
              <Divider />
            </>
          ) : null}

          <div className="space-y-1.5">
            {order.items.map((item, index) => (
              <div key={item.id} className={cn("pb-1.5", index !== order.items.length - 1 && "border-b border-dashed border-slate-200")}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[9.5px] font-semibold leading-tight text-slate-900">{item.name}</p>
                    {showHsn ? (() => {
                      const resolution = resolveTaxCode(item);
                      return resolution.code ? (
                        <p className="mt-[1px] text-[7.5px] font-medium uppercase tracking-[0.18em] text-slate-500">
                          {resolution.codeType} {resolution.code}
                        </p>
                      ) : null;
                    })() : null}
                    {gstRegistered && item.gstRate ? (
                      <p className="mt-[1px] text-[7.5px] font-medium uppercase tracking-[0.18em] text-slate-500">GST @ {item.gstRate}%</p>
                    ) : null}
                    <p className="mt-[1px] text-[8.5px] text-slate-600">
                      {formatQuantity(item.quantity)} x {money(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-right text-[9.5px] font-semibold text-slate-900">{money(item.total)}</p>
                </div>
              </div>
            ))}
          </div>

          <Divider />

          <div className="space-y-0.5">
            <Row label="Subtotal" value={money(order.subtotal)} />
            {order.discountAmount > 0 ? <Row label="Discount" value={`- ${money(order.discountAmount)}`} /> : null}
            {showTaxColumns ? (
              <>
                {order.taxBreakdown.cgstAmount > 0 ? <Row label={`CGST ${order.taxBreakdown.cgstRate}%`} value={money(order.taxBreakdown.cgstAmount)} /> : null}
                {order.taxBreakdown.sgstAmount > 0 ? <Row label={`SGST ${order.taxBreakdown.sgstRate}%`} value={money(order.taxBreakdown.sgstAmount)} /> : null}
                {order.taxBreakdown.igstAmount > 0 ? <Row label={`IGST ${order.taxBreakdown.igstRate}%`} value={money(order.taxBreakdown.igstAmount)} /> : null}
                {order.taxBreakdown.cessAmount > 0 ? <Row label={`CESS ${order.taxBreakdown.cessRate}%`} value={money(order.taxBreakdown.cessAmount)} /> : null}
              </>
            ) : null}
            <Row label="Round-off" value={money(order.roundOffAmount ?? 0)} />
            <div className="mt-0.5 border-t border-slate-300 pt-0.5">
              <Row label="TOTAL" value={money(order.total)} emphasis />
            </div>
          </div>

          <Divider />

          <div className="space-y-0.5">
            <Row label="Payment Mode" value={order.paymentMode} />
            <Row label="Amount Tendered" value={money(order.amountTendered)} />
            {order.changeReturned > 0 ? <Row label="Change due" value={money(order.changeReturned)} /> : null}
            {hasSplitPayment ? (
              <div className="mt-0.5 space-y-[1px] border border-slate-200 bg-slate-50 px-2 py-1">
                <p className="text-[8.5px] font-semibold uppercase tracking-[0.16em] text-slate-500">Split breakdown</p>
                <p className="text-[8.5px] text-slate-600">Cash: {money(paymentBreakdown.cash)}</p>
                <p className="text-[8.5px] text-slate-600">UPI: {money(paymentBreakdown.upi)}</p>
                <p className="text-[8.5px] text-slate-600">Card: {money(paymentBreakdown.card)}</p>
              </div>
            ) : null}
          </div>

          <Divider />

          <div className="space-y-0.5 text-center">
            <p className="text-[8.5px] font-medium uppercase tracking-[0.16em] leading-tight text-slate-700">{settings.receiptFooter || "Thank you for your visit!"}</p>
            {gstRegistered && invoiceNumber ? <p className="text-[8.5px] font-semibold text-slate-900">GST Invoice No: {invoiceNumber}</p> : null}
          </div>
        </div>
      </div>
    </>,
    portalRoot,
  );
}
