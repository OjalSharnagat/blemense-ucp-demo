import { TAX_CODE_MASTER, type TaxCodeType } from "@/data/gst";
import { Input } from "../../../ui/input";

interface HSNSearchProps {
  value: string;
  disabled?: boolean;
  codeType?: TaxCodeType | "BOTH";
  onChange: (value: string) => void;
  onRateSelect?: (rate: number) => void;
  onCodeTypeChange?: (codeType: TaxCodeType) => void;
}

export default function HSNSearch({ value, disabled, codeType = "BOTH", onChange, onRateSelect, onCodeTypeChange }: HSNSearchProps) {
  const codes = TAX_CODE_MASTER.filter((entry) => codeType === "BOTH" || entry.codeType === codeType);

  return (
    <>
      <Input
        list="tax-codes-shared"
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const normalized = event.target.value.toUpperCase();
          onChange(normalized);
          const matched = TAX_CODE_MASTER.find((code) => code.code === normalized);
          if (matched) {
            onRateSelect?.(matched.defaultGstRate);
            onCodeTypeChange?.(matched.codeType);
          }
        }}
      />
      <datalist id="tax-codes-shared">
        {codes.map((code) => (
          <option key={code.code} value={code.code}>
            {code.codeType} {code.code} - {code.description}
          </option>
        ))}
      </datalist>
    </>
  );
}
