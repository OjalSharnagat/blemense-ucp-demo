import { Fragment, useMemo, useState } from "react";
import {
  Banknote,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CreditCard,
  Landmark,
  ScrollText,
  Smartphone,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAdminStore } from "@/lib/store";
import { useBillingStore } from "@/lib/billingStore";
import { uid } from "@/utils";
import { Button } from "../../../ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";
import InvoiceStatusBadge from "../components/InvoiceStatusBadge";
import PaymentModal, { type PaymentFormState, type PaymentMode } from "../components/PaymentModal";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

type PaymentTab = "ALL" | "OVERDUE" | "UPCOMING";

const paymentModeMeta: Record<PaymentMode, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Cash", icon: Banknote },
  BANK_TRANSFER: { label: "Bank Transfer", icon: Landmark },
  UPI: { label: "UPI", icon: Smartphone },
  CHEQUE: { label: "Cheque", icon: ScrollText },
  CARD: { label: "Card", icon: CreditCard },
};

export default function PaymentsView() {
  const { invoices, payments, addPayment, getInvoicePaymentMeta } = useBillingStore();
  const { customers } = useAdminStore();

  const [activeTab, setActiveTab] = useState<PaymentTab>("ALL");
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [recordingInvoiceId, setRecordingInvoiceId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState<PaymentFormState>({
    date: new Date().toISOString().slice(0, 10),
    amount: "",
    mode: "UPI",
    reference: "",
    notes: "",
  });

  const rows = useMemo(() => {
    const now = new Date();
    return invoices
      .map((invoice) => {
        const meta = getInvoicePaymentMeta(invoice, now);
        return {
          invoice,
          displayStatus: meta.displayStatus,
          isOverdue: meta.isOverdue,
        };
      })
      .filter(({ invoice }) => invoice.status !== "CANCELLED")
      .sort((a, b) => new Date(b.invoice.issueDate).getTime() - new Date(a.invoice.issueDate).getTime());
  }, [invoices, getInvoicePaymentMeta]);

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const filteredRows = useMemo(() => {
    if (activeTab === "OVERDUE") return rows.filter((row) => row.isOverdue);
    if (activeTab === "UPCOMING") {
      return rows.filter(
        (row) => !row.isOverdue && row.invoice.balanceDue > 0 && row.displayStatus !== "PAID" && row.displayStatus !== "DRAFT",
      );
    }
    return rows;
  }, [rows, activeTab]);

  const summary = useMemo(() => {
    const totalOutstanding = rows.reduce((sum, row) => sum + Math.max(0, row.invoice.balanceDue), 0);
    const totalOverdue = rows
      .filter((row) => row.isOverdue)
      .reduce((sum, row) => sum + Math.max(0, row.invoice.balanceDue), 0);

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const collectedThisMonth = payments
      .filter((payment) => {
        const date = new Date(payment.date);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      })
      .reduce((sum, payment) => sum + payment.amount, 0);

    return { totalOutstanding, totalOverdue, collectedThisMonth };
  }, [rows, payments]);

  const recordingInvoice = useMemo(
    () => (recordingInvoiceId ? invoices.find((invoice) => invoice.id === recordingInvoiceId) : undefined),
    [recordingInvoiceId, invoices],
  );

  const openRecordPayment = (invoiceId: string) => {
    const invoice = invoices.find((item) => item.id === invoiceId);
    if (!invoice) return;
    setRecordingInvoiceId(invoiceId);
    setPaymentForm({
      date: new Date().toISOString().slice(0, 10),
      amount: invoice.balanceDue.toFixed(2),
      mode: "UPI",
      reference: "",
      notes: "",
    });
  };

  const submitPayment = () => {
    if (!recordingInvoice) return;
    const amount = Number(paymentForm.amount);
    if (!Number.isFinite(amount) || amount <= 0) return;

    addPayment({
      id: uid("pay"),
      invoiceId: recordingInvoice.id,
      date: paymentForm.date,
      amount: Math.min(amount, recordingInvoice.balanceDue),
      mode: paymentForm.mode,
      reference: paymentForm.reference || "-",
      notes: paymentForm.notes,
    });
    setRecordingInvoiceId(null);
  };

  return (
    <div className="dash-view space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-sm text-muted-foreground">Invoice collection desk with overdue tracking and payment history.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["ALL", "OVERDUE", "UPCOMING"] as PaymentTab[]).map((tab) => (
          <Button
            key={tab}
            type="button"
            size="sm"
            variant={activeTab === tab ? "default" : "outline"}
            onClick={() => setActiveTab(tab)}
          >
            {tab === "ALL" ? "All" : tab === "OVERDUE" ? "Overdue" : "Upcoming"}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">Total Outstanding</p>
          <p className="mt-1 text-xl font-semibold">{MONEY.format(summary.totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">Total Overdue</p>
          <p className="mt-1 text-xl font-semibold text-rose-700">{MONEY.format(summary.totalOverdue)}</p>
        </div>
        <div className="rounded-lg border bg-white p-4">
          <p className="text-xs text-muted-foreground">Collected This Month</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{MONEY.format(summary.collectedThisMonth)}</p>
        </div>
      </div>

      <div className="rounded-lg border bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice No.</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Order</TableHead>
              <TableHead>Invoice Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Invoice Amount</TableHead>
              <TableHead className="text-right">Amount Paid</TableHead>
              <TableHead className="text-right">Balance Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(({ invoice, displayStatus, isOverdue }) => {
              const expanded = expandedInvoiceId === invoice.id;
              return (
                <Fragment key={invoice.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedInvoiceId((prev) => (prev === invoice.id ? null : invoice.id))}
                  >
                    <TableCell className="font-medium">
                      <Link className="text-primary hover:underline" to={`/admin/billing/${invoice.id}`} onClick={(event) => event.stopPropagation()}>
                        {invoice.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {invoice.customerId ? (
                          <Link
                            className="font-medium text-primary hover:underline"
                            to={`/admin/billing?customer=${invoice.customerId}`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {customerById.get(invoice.customerId || "")?.name || invoice.buyer.name}
                          </Link>
                        ) : (
                          <p className="font-medium">{invoice.buyer.name}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{invoice.customerId || "Customer ref missing"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {invoice.orderId ? (
                        <Link className="font-medium text-primary hover:underline" to={`/admin/orders?order=${invoice.orderId}`} onClick={(event) => event.stopPropagation()}>
                          {invoice.orderId}
                        </Link>
                      ) : (
                        "Not linked"
                      )}
                    </TableCell>
                    <TableCell>{new Date(invoice.issueDate).toLocaleDateString("en-IN")}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {new Date(invoice.dueDate).toLocaleDateString("en-IN")}
                        {isOverdue ? <CircleAlert className="h-4 w-4 text-rose-600" /> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{MONEY.format(invoice.taxBreakdown.grandTotal)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(invoice.amountPaid)}</TableCell>
                    <TableCell className="text-right font-medium">{MONEY.format(invoice.balanceDue)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge status={displayStatus} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={displayStatus === "PAID" || displayStatus === "CANCELLED" || displayStatus === "DRAFT"}
                        onClick={(event) => {
                          event.stopPropagation();
                          openRecordPayment(invoice.id);
                        }}
                      >
                        Record Payment
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expanded ? (
                    <TableRow>
                      <TableCell colSpan={10} className="bg-slate-50">
                        <div className="flex items-center justify-between pb-2">
                          <p className="text-sm font-medium">Payment history</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => setExpandedInvoiceId((prev) => (prev === invoice.id ? null : invoice.id))}
                          >
                            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {invoice.paymentHistory.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No payments recorded yet.</p>
                          ) : (
                            invoice.paymentHistory
                              .slice()
                              .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                              .map((payment) => {
                                const meta = paymentModeMeta[payment.mode];
                                const Icon = meta.icon;
                                return (
                                  <div
                                    key={payment.id}
                                    className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-center gap-3 rounded-md border bg-white px-3 py-2 text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <Icon className="h-4 w-4 text-slate-600" />
                                      <span>{new Date(payment.date).toLocaleDateString("en-IN")}</span>
                                    </div>
                                    <span>{meta.label}</span>
                                    <span className="truncate">{payment.reference || "-"}</span>
                                    <span className="text-right font-medium">{MONEY.format(payment.amount)}</span>
                                  </div>
                                );
                              })
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            {filteredRows.length === 0 ? (
                      <TableRow>
                <TableCell colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No invoices in this tab.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <PaymentModal
        open={Boolean(recordingInvoiceId)}
        invoice={recordingInvoice}
        form={paymentForm}
        onOpenChange={(open) => (!open ? setRecordingInvoiceId(null) : null)}
        onFormChange={setPaymentForm}
        onSave={submitPayment}
      />

      <div className="flex items-center gap-2 rounded-md border bg-slate-50 px-3 py-2 text-xs text-muted-foreground">
        <CalendarClock className="h-4 w-4" />
        Overdue logic uses due date compared to today and auto-maps unpaid invoices to OVERDUE in store-derived display.
      </div>
    </div>
  );
}
