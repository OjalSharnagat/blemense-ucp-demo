import { Banknote, CreditCard, Landmark, ReceiptText, ScrollText, Smartphone } from "lucide-react";
import type { Invoice } from "@/data/billing";
import { Button } from "../../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export type PaymentMode = "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CARD";

const paymentModeMeta: Record<PaymentMode, { label: string; icon: typeof Banknote }> = {
  CASH: { label: "Cash", icon: Banknote },
  BANK_TRANSFER: { label: "Bank Transfer", icon: Landmark },
  UPI: { label: "UPI", icon: Smartphone },
  CHEQUE: { label: "Cheque", icon: ScrollText },
  CARD: { label: "Card", icon: CreditCard },
};

export interface PaymentFormState {
  date: string;
  amount: string;
  mode: PaymentMode;
  reference: string;
  notes: string;
}

interface PaymentModalProps {
  open: boolean;
  invoice?: Invoice;
  form: PaymentFormState;
  onOpenChange: (open: boolean) => void;
  onFormChange: (next: PaymentFormState) => void;
  onSave: () => void;
}

export default function PaymentModal({ open, invoice, form, onOpenChange, onFormChange, onSave }: PaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogOverlay />
      <DialogContent className="w-[min(94vw,38rem)]">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
          <DialogDescription>Enter payment details and post receipt against invoice.</DialogDescription>
        </DialogHeader>

        {invoice ? (
          <>
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p className="font-semibold">{invoice.invoiceNumber}</p>
              <p className="text-xs text-muted-foreground">{invoice.buyer.name}</p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                <p>Invoice: <span className="font-medium">{MONEY.format(invoice.taxBreakdown.grandTotal)}</span></p>
                <p>Paid: <span className="font-medium">{MONEY.format(invoice.amountPaid)}</span></p>
                <p>Balance: <span className="font-medium">{MONEY.format(invoice.balanceDue)}</span></p>
              </div>
            </div>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={form.date} onChange={(e) => onFormChange({ ...form, date: e.target.value })} />
                <Input type="number" value={form.amount} onChange={(e) => onFormChange({ ...form, amount: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {(Object.keys(paymentModeMeta) as PaymentMode[]).map((mode) => {
                  const meta = paymentModeMeta[mode];
                  const Icon = meta.icon;
                  const active = form.mode === mode;
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onFormChange({ ...form, mode })}
                      className={`flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs ${
                        active ? "border-slate-900 bg-slate-900 text-white" : "bg-white hover:bg-slate-50"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <Input value={form.reference} onChange={(e) => onFormChange({ ...form, reference: e.target.value })} placeholder="UTR / Txn / Cheque no." />
              <textarea
                className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.notes}
                onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
                placeholder="Optional note"
              />
            </div>
          </>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSave}>
            <ReceiptText className="mr-2 h-4 w-4" />
            Save Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
