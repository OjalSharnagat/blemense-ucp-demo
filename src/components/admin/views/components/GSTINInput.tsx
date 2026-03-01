import { useMemo } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { validateGSTIN } from "@/lib/gst";
import { Input } from "../../../ui/input";

interface GSTINInputProps {
  value: string;
  disabled?: boolean;
  placeholder?: string;
  onChange: (value: string) => void;
  onValidation?: (result: { valid: boolean; stateCode: string; stateName: string; pan: string }) => void;
}

export default function GSTINInput({ value, disabled, placeholder, onChange, onValidation }: GSTINInputProps) {
  const validation = useMemo(() => validateGSTIN(value || ""), [value]);

  return (
    <div>
      <Input
        value={value}
        disabled={disabled}
        placeholder={placeholder ?? "15-character GSTIN"}
        onChange={(event) => {
          const next = event.target.value.toUpperCase();
          onChange(next);
          const result = validateGSTIN(next);
          onValidation?.(result);
        }}
      />
      {value ? (
        validation.valid ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid GSTIN ({validation.stateCode} - {validation.stateName})
          </p>
        ) : (
          <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
            <AlertCircle className="h-3.5 w-3.5" />
            Invalid GSTIN format or state code
          </p>
        )
      ) : null}
    </div>
  );
}
