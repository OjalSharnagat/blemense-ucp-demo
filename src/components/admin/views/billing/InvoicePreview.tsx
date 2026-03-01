import { useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Copy, Download, Share2 } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { computeLineItemTax, amountInWords } from "@/lib/gst";
import { copyCurrentUrl, printCurrentPage } from "@/lib/pdfExport";
import { useBillingStore } from "@/lib/billingStore";
import { cn } from "@/lib/utils";
import { Button } from "../../../ui/button";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const INVOICE_TITLES = {
  TAX_INVOICE: "TAX INVOICE",
  PROFORMA: "PROFORMA INVOICE",
  CREDIT_NOTE: "CREDIT NOTE",
  DEBIT_NOTE: "DEBIT NOTE",
} as const;

export default function InvoicePreview() {
  const { id } = useParams();
  const { invoices } = useBillingStore();
  const [copied, setCopied] = useState(false);

  const invoice = invoices.find((item) => item.id === id);
  const linkedInvoice = useMemo(
    () => (invoice?.linkedInvoiceId ? invoices.find((item) => item.id === invoice.linkedInvoiceId) : undefined),
    [invoice?.linkedInvoiceId, invoices],
  );

  if (!invoice) {
    return (
      <div className="dash-view space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Invoice not found</h1>
        <Button asChild variant="outline">
          <Link to="/admin/billing">Back to billing</Link>
        </Button>
      </div>
    );
  }

  const lineRows = invoice.lineItems.map((item) => {
    const tax = computeLineItemTax(item, invoice.isInterState);
    const gross = item.quantity * item.unitPrice;
    const total = tax.taxableValue + tax.cgstAmount + tax.sgstAmount + tax.igstAmount;
    return { item, tax, gross, total };
  });

  const copyShareLink = async () => {
    try {
      await copyCurrentUrl();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="dash-view min-h-screen bg-slate-200/60 p-4 md:p-6">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body * { visibility: hidden !important; }
          #invoice-print-shell, #invoice-print-shell * { visibility: visible !important; }
          #invoice-print-shell {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
          }
          .no-print { display: none !important; }
          #invoice-page {
            width: 100% !important;
            min-height: auto !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: 0 !important;
          }
        }
      `}</style>

      <div className="no-print mx-auto mb-4 flex w-full max-w-[900px] flex-wrap items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild className="gap-1">
            <Link to={`/admin/billing/${invoice.id}`}>
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <InvoiceStatusBadge status={invoice.status} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={printCurrentPage}>
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" onClick={copyShareLink}>
            {copied ? <CheckCircle2 className="mr-2 h-4 w-4 text-emerald-600" /> : <Share2 className="mr-2 h-4 w-4" />}
            {copied ? "Link Copied" : "Share"}
          </Button>
          <Button variant="outline" onClick={copyShareLink}>
            <Copy className="mr-2 h-4 w-4" />
            Copy Link
          </Button>
        </div>
      </div>

      <div id="invoice-print-shell" className="mx-auto max-w-[900px]">
        <div
          id="invoice-page"
          className="mx-auto min-h-[1123px] w-full max-w-[794px] border border-slate-300 bg-white p-8 text-[12px] leading-relaxed text-slate-900 shadow-sm"
        >
          {(invoice.type === "CREDIT_NOTE" || invoice.type === "DEBIT_NOTE") && (
            <div
              className={cn(
                "mb-4 rounded-md px-4 py-2 text-sm font-semibold text-white",
                invoice.type === "CREDIT_NOTE" ? "bg-rose-600" : "bg-blue-600",
              )}
            >
              {invoice.type === "CREDIT_NOTE" ? "Credit Note Reference" : "Debit Note Reference"}
            </div>
          )}

          <div className="mb-4 flex items-start justify-between gap-4 border-b pb-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-wide">{INVOICE_TITLES[invoice.type]}</h1>
              <p className="mt-1 text-xs text-slate-600">This document is generated under GST compliant format.</p>
            </div>
            <div className="text-right text-xs">
              <p className="font-semibold">Invoice No: {invoice.invoiceNumber}</p>
              <p>Invoice Date: {new Date(invoice.issueDate).toLocaleDateString("en-IN")}</p>
              <p>Supply Date: {new Date(invoice.supplyDate).toLocaleDateString("en-IN")}</p>
              <p>Place of Supply: {invoice.placeOfSupply}</p>
            </div>
          </div>

          {linkedInvoice ? (
            <div className="mb-4 rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium">
              Against Invoice No. {linkedInvoice.invoiceNumber} dated{" "}
              {new Date(linkedInvoice.issueDate).toLocaleDateString("en-IN")}
            </div>
          ) : null}

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div className="rounded-md border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Seller</p>
              <p className="font-semibold">{invoice.seller.legalName}</p>
              <p>{invoice.seller.address}</p>
              <p>
                {invoice.seller.city}, {invoice.seller.state} - {invoice.seller.pincode}
              </p>
              <p>GSTIN: {invoice.seller.gstin}</p>
              <p>State: {invoice.seller.state}</p>
              <p>State Code: {invoice.seller.stateCode}</p>
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Buyer</p>
              <p className="font-semibold">{invoice.buyer.name}</p>
              <p>{invoice.buyer.address}</p>
              <p>
                {invoice.buyer.city}, {invoice.buyer.state} - {invoice.buyer.pincode}
              </p>
              <p>GSTIN: {invoice.buyer.gstin || "Unregistered"}</p>
              <p>State: {invoice.buyer.state}</p>
              <p>State Code: {invoice.buyer.stateCode}</p>
              <p>Place of Supply: {invoice.placeOfSupply}</p>
            </div>
          </div>

          <table className="mb-4 w-full border-collapse border text-[11px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border px-2 py-1 text-left">#</th>
                <th className="border px-2 py-1 text-left">Description</th>
                <th className="border px-2 py-1 text-left">HSN/SAC</th>
                <th className="border px-2 py-1 text-right">Qty</th>
                <th className="border px-2 py-1 text-left">Unit</th>
                <th className="border px-2 py-1 text-right">Rate</th>
                <th className="border px-2 py-1 text-right">Taxable Value</th>
                <th className="border px-2 py-1 text-right">GST %</th>
                {invoice.isInterState ? (
                  <th className="border px-2 py-1 text-right">IGST Amt</th>
                ) : (
                  <>
                    <th className="border px-2 py-1 text-right">CGST Amt</th>
                    <th className="border px-2 py-1 text-right">SGST Amt</th>
                  </>
                )}
                <th className="border px-2 py-1 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {lineRows.map((row, idx) => (
                <tr key={row.item.id}>
                  <td className="border px-2 py-1">{idx + 1}</td>
                  <td className="border px-2 py-1">{row.item.description}</td>
                  <td className="border px-2 py-1">{row.item.hsn || "-"}</td>
                  <td className="border px-2 py-1 text-right">{row.item.quantity}</td>
                  <td className="border px-2 py-1">{row.item.unit}</td>
                  <td className="border px-2 py-1 text-right">{MONEY.format(row.item.unitPrice)}</td>
                  <td className="border px-2 py-1 text-right">{MONEY.format(row.tax.taxableValue)}</td>
                  <td className="border px-2 py-1 text-right">{row.item.gstRate}%</td>
                  {invoice.isInterState ? (
                    <td className="border px-2 py-1 text-right">{MONEY.format(row.tax.igstAmount)}</td>
                  ) : (
                    <>
                      <td className="border px-2 py-1 text-right">{MONEY.format(row.tax.cgstAmount)}</td>
                      <td className="border px-2 py-1 text-right">{MONEY.format(row.tax.sgstAmount)}</td>
                    </>
                  )}
                  <td className="border px-2 py-1 text-right">{MONEY.format(row.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mb-4 ml-auto w-full max-w-[360px] space-y-1 rounded-md border p-3 text-[11px]">
            <div className="flex justify-between">
              <span>Total Taxable Value</span>
              <span>{MONEY.format(invoice.taxBreakdown.taxableValue)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total CGST</span>
              <span>{MONEY.format(invoice.taxBreakdown.cgstAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total SGST</span>
              <span>{MONEY.format(invoice.taxBreakdown.sgstAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total IGST</span>
              <span>{MONEY.format(invoice.taxBreakdown.igstAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total Tax</span>
              <span>{MONEY.format(invoice.taxBreakdown.totalTax)}</span>
            </div>
            <div className="flex justify-between text-base font-bold">
              <span>Grand Total</span>
              <span>{MONEY.format(invoice.taxBreakdown.grandTotal)}</span>
            </div>
          </div>

          <div className="mb-4 rounded-md bg-slate-50 px-3 py-2 text-[11px]">
            Amount in Words: <span className="font-semibold">{amountInWords(invoice.taxBreakdown.grandTotal)}</span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-4 text-[11px]">
            <div className="rounded-md border p-3">
              <p>Reverse Charge: {invoice.isRCM ? "Yes" : "No"}</p>
              <p>Bank: {invoice.seller.bankName}</p>
              <p>A/C No: {invoice.seller.accountNumber}</p>
              <p>IFSC: {invoice.seller.ifsc}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="mb-2 font-semibold">Authorized Signatory</p>
              {invoice.seller.signatureUrl ? (
                <img src={invoice.seller.signatureUrl} alt="Signature" className="h-12 object-contain" />
              ) : (
                <div className="h-12 border-b border-dashed" />
              )}
              {!invoice.seller.signatureUrl ? (
                <p className="mt-2 text-[10px] text-slate-500">This is a computer-generated invoice.</p>
              ) : null}
            </div>
          </div>

          <div className="mt-8 border-t pt-2 text-center text-[10px] text-slate-500">
            Generated on {new Date().toLocaleDateString("en-IN")} • {invoice.invoiceNumber}
          </div>
        </div>
      </div>
    </div>
  );
}
