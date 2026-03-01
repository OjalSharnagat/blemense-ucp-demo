import { HSN_CODES } from "@/data/gst";
import { Input } from "../../../ui/input";

interface HSNSearchProps {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onRateSelect?: (rate: number) => void;
}

export default function HSNSearch({ value, disabled, onChange, onRateSelect }: HSNSearchProps) {
  return (
    <>
      <Input
        list="hsn-codes-shared"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const normalized = event.target.value.toUpperCase();
          onChange(normalized);
          const matched = HSN_CODES.find((code) => code.code === normalized);
          if (matched) onRateSelect?.(matched.defaultGstRate);
        }}
      />
      <datalist id="hsn-codes-shared">
        {HSN_CODES.map((code) => (
          <option key={code.code} value={code.code}>
            {code.description}
          </option>
        ))}
      </datalist>
    </>
  );
}
