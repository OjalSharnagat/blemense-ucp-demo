import type { TaxBreakdown } from "@/data/billing";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import AmountInWords from "./AmountInWords";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

interface TaxRateRow {
  rate: number;
  cgst: number;
  sgst: number;
  igst: number;
}

interface TaxSummaryPanelProps {
  subtotal: number;
  discountTotal: number;
  totals: TaxBreakdown;
  supplyType: "B2B" | "B2CL" | "B2CS";
  isInterState: boolean;
  taxByRate: TaxRateRow[];
  onSaveDraft: () => void;
  onFinalize: () => void;
  disableActions?: boolean;
}

export default function TaxSummaryPanel({
  subtotal,
  discountTotal,
  totals,
  supplyType,
  isInterState,
  taxByRate,
  onSaveDraft,
  onFinalize,
  disableActions,
}: TaxSummaryPanelProps) {
  return (
    <div className="rounded-lg border bg-white p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold">Live Summary</p>
        <Badge variant="secondary">{supplyType}</Badge>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{MONEY.format(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Discount Total</span>
          <span>- {MONEY.format(discountTotal)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Taxable Value</span>
          <span>{MONEY.format(totals.taxableValue)}</span>
        </div>
        <div className="rounded-md border p-2 text-xs">
          {taxByRate.map((row) =>
            isInterState ? (
              <div key={`igst-${row.rate}`} className="flex justify-between">
                <span>IGST @ {row.rate}%</span>
                <span>{MONEY.format(row.igst)}</span>
              </div>
            ) : (
              <div key={`cgst-sgst-${row.rate}`} className="space-y-1">
                <div className="flex justify-between">
                  <span>CGST @ {row.rate / 2}%</span>
                  <span>{MONEY.format(row.cgst)}</span>
                </div>
                <div className="flex justify-between">
                  <span>SGST @ {row.rate / 2}%</span>
                  <span>{MONEY.format(row.sgst)}</span>
                </div>
              </div>
            ),
          )}
        </div>
        <div className="flex justify-between border-t pt-2 text-lg font-semibold">
          <span>Grand Total</span>
          <span>{MONEY.format(totals.grandTotal)}</span>
        </div>
      </div>
      <AmountInWords amount={totals.grandTotal} className="mt-2 rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground" />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Button onClick={onSaveDraft} disabled={disableActions}>
          Save Draft
        </Button>
        <Button variant="secondary" onClick={onFinalize} disabled={disableActions}>
          Finalize & Issue
        </Button>
      </div>
    </div>
  );
}
