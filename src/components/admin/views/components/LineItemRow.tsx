import { GripVertical, Trash2 } from "lucide-react";
import type { DragEvent } from "react";
import type { LineItem } from "@/data/billing";
import { computeLineItemTax } from "@/lib/gst";
import { Button } from "../../../ui/button";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";
import HSNSearch from "./HSNSearch";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

interface LineItemRowProps {
  index: number;
  item: LineItem;
  isEditable: boolean;
  isInterState: boolean;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: DragEvent<HTMLTableRowElement>) => void;
  onDrop?: () => void;
  onUpdate: (patch: Partial<LineItem>) => void;
  onDelete: () => void;
}

export default function LineItemRow({
  index,
  item,
  isEditable,
  isInterState,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onUpdate,
  onDelete,
}: LineItemRowProps) {
  const tax = computeLineItemTax(item, isInterState);
  const rowTotal = tax.taxableValue + tax.cgstAmount + tax.sgstAmount + tax.igstAmount;

  return (
    <tr draggable={draggable} onDragStart={onDragStart} onDragOver={onDragOver} onDrop={onDrop} className="align-top">
      <td className="w-10">
        <div className="flex items-center gap-2">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
          {index + 1}
        </div>
      </td>
      <td className="min-w-48">
        <Input value={item.description} disabled={!isEditable} onChange={(e) => onUpdate({ description: e.target.value })} />
      </td>
      <td className="min-w-28">
        <HSNSearch value={item.hsn} disabled={!isEditable} onChange={(value) => onUpdate({ hsn: value })} onRateSelect={(rate) => onUpdate({ gstRate: rate })} />
      </td>
      <td className="min-w-20">
        <Input type="number" value={item.quantity} disabled={!isEditable} onChange={(e) => onUpdate({ quantity: Number(e.target.value) || 0 })} />
      </td>
      <td className="min-w-20">
        <Select value={item.unit} disabled={!isEditable} onChange={(e) => onUpdate({ unit: e.target.value as LineItem["unit"] })}>
          <option value="NOS">NOS</option>
          <option value="KGS">KGS</option>
          <option value="MTR">MTR</option>
          <option value="LTR">LTR</option>
          <option value="HRS">HRS</option>
          <option value="PCS">PCS</option>
        </Select>
      </td>
      <td className="min-w-24">
        <Input type="number" value={item.unitPrice} disabled={!isEditable} onChange={(e) => onUpdate({ unitPrice: Number(e.target.value) || 0 })} />
      </td>
      <td className="min-w-28">
        <div className="grid grid-cols-[1fr_84px] gap-1">
          <Input type="number" value={item.discount} disabled={!isEditable} onChange={(e) => onUpdate({ discount: Number(e.target.value) || 0 })} />
          <Select value={item.discountType} disabled={!isEditable} onChange={(e) => onUpdate({ discountType: e.target.value as LineItem["discountType"] })}>
            <option value="flat">Flat</option>
            <option value="percent">%</option>
          </Select>
        </div>
      </td>
      <td>{MONEY.format(tax.taxableValue)}</td>
      <td className="min-w-20">
        <Input type="number" value={item.gstRate} disabled={!isEditable} onChange={(e) => onUpdate({ gstRate: Number(e.target.value) || 0 })} />
      </td>
      {isInterState ? <td>{MONEY.format(tax.igstAmount)}</td> : <>
        <td>{MONEY.format(tax.cgstAmount)}</td>
        <td>{MONEY.format(tax.sgstAmount)}</td>
      </>}
      <td className="font-medium">{MONEY.format(rowTotal)}</td>
      <td>
        <Button type="button" variant="ghost" size="icon" disabled={!isEditable} onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
