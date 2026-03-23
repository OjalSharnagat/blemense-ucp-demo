import type { InvoiceStatus } from "@/data/billing";
import { Badge } from "../../../ui/badge";

const statusClass: Record<InvoiceStatus, string> = {
  DRAFT: "border-slate-200 bg-slate-100 text-slate-700",
  FINALIZED: "border-blue-200 bg-blue-100 text-blue-700",
  PAID: "border-emerald-200 bg-emerald-100 text-emerald-700",
  PARTIALLY_PAID: "border-amber-200 bg-amber-100 text-amber-800",
  OVERDUE: "border-rose-200 bg-rose-100 text-rose-700",
  CANCELLED: "border-zinc-200 bg-zinc-100 text-zinc-700",
};

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <Badge variant="secondary" className={statusClass[status]}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
