import { amountInWords } from "@/lib/gst";

export default function AmountInWords({ amount, className = "" }: { amount: number; className?: string }) {
  return <p className={className}>{amountInWords(amount)}</p>;
}
