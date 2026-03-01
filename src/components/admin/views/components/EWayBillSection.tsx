import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";

export interface EWayBillFormValue {
  eWayBillNumber: string;
  eWayBillDate: string;
  transporterName: string;
  transporterId: string;
  vehicleNumber: string;
  transportMode: "ROAD" | "RAIL" | "AIR" | "SHIP";
  distanceKm: number;
}

interface EWayBillSectionProps {
  open: boolean;
  disabled?: boolean;
  value: EWayBillFormValue;
  onToggle: () => void;
  onChange: (next: EWayBillFormValue) => void;
}

export default function EWayBillSection({ open, disabled, value, onToggle, onChange }: EWayBillSectionProps) {
  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Section 6 - E-Way Bill Fields</CardTitle>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </CardHeader>
      {open ? (
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input value={value.eWayBillNumber} disabled={disabled} placeholder="E-Way Bill Number" onChange={(e) => onChange({ ...value, eWayBillNumber: e.target.value })} />
          <Input type="date" value={value.eWayBillDate} disabled={disabled} onChange={(e) => onChange({ ...value, eWayBillDate: e.target.value })} />
          <Input value={value.transporterName} disabled={disabled} placeholder="Transporter Name" onChange={(e) => onChange({ ...value, transporterName: e.target.value })} />
          <Input value={value.transporterId} disabled={disabled} placeholder="Transporter GSTIN" onChange={(e) => onChange({ ...value, transporterId: e.target.value })} />
          <Input value={value.vehicleNumber} disabled={disabled} placeholder="Vehicle Number" onChange={(e) => onChange({ ...value, vehicleNumber: e.target.value })} />
          <Select value={value.transportMode} disabled={disabled} onChange={(e) => onChange({ ...value, transportMode: e.target.value as EWayBillFormValue["transportMode"] })}>
            <option value="ROAD">ROAD</option>
            <option value="RAIL">RAIL</option>
            <option value="AIR">AIR</option>
            <option value="SHIP">SHIP</option>
          </Select>
          <Input type="number" value={value.distanceKm} disabled={disabled} placeholder="Distance (km)" onChange={(e) => onChange({ ...value, distanceKm: Number(e.target.value) || 0 })} />
        </CardContent>
      ) : null}
    </Card>
  );
}
