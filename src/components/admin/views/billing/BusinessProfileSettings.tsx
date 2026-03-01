import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Save, TriangleAlert } from "lucide-react";
import type { BusinessProfile, BusinessType, GSTRegistrationType } from "@/data/billing";
import { INDIAN_STATES } from "@/data/gst";
import { useBillingStore } from "@/lib/billingStore";
import { validateGSTIN } from "@/lib/gst";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";

const maskAccountNumber = (value: string): string => {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const termOptions: Array<7 | 15 | 30 | 45 | 60> = [7, 15, 30, 45, 60];

export default function BusinessProfileSettings() {
  const { businessProfile, updateBusinessProfile } = useBillingStore();
  const [form, setForm] = useState<BusinessProfile>(businessProfile);
  const [gstinError, setGstinError] = useState("");
  const [gstinHint, setGstinHint] = useState("");
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [saved, setSaved] = useState(false);

  const stateFromCode = useMemo(
    () => INDIAN_STATES.find((state) => state.tinCode === form.stateCode || state.name === form.state),
    [form.stateCode, form.state],
  );

  const onGSTINChange = (value: string) => {
    const normalized = value.toUpperCase();
    setForm((prev) => ({ ...prev, gstin: normalized }));
    const result = validateGSTIN(normalized);
    if (!normalized) {
      setGstinError("");
      setGstinHint("");
      return;
    }
    if (!result.valid) {
      setGstinError("Invalid GSTIN format or state code.");
      setGstinHint("");
      return;
    }
    const matchState = INDIAN_STATES.find((state) => state.tinCode === result.stateCode);
    setForm((prev) => ({
      ...prev,
      stateCode: result.stateCode,
      state: matchState?.name ?? prev.state,
      pan: result.pan || prev.pan,
    }));
    setGstinError("");
    setGstinHint(`${result.stateCode} - ${result.stateName}`);
  };

  const save = () => {
    updateBusinessProfile(form);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="dash-view space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business & GST</h1>
          <p className="text-sm text-muted-foreground">Manage legal profile, GST registration, banking and invoice defaults.</p>
        </div>
        <Button onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          Save Profile
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Legal Name</p>
            <Input value={form.legalName} onChange={(e) => setForm((p) => ({ ...p, legalName: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Trade Name</p>
            <Input value={form.tradeName} onChange={(e) => setForm((p) => ({ ...p, tradeName: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">PAN</p>
            <Input value={form.pan} onChange={(e) => setForm((p) => ({ ...p, pan: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Type of Business</p>
            <Select
              value={form.businessType ?? "OTHER"}
              onChange={(e) => setForm((p) => ({ ...p, businessType: e.target.value as BusinessType }))}
            >
              <option value="PROPRIETORSHIP">Proprietorship</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="PRIVATE_LIMITED">Private Limited</option>
              <option value="LLP">LLP</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Financial Year Start</p>
            <Input value="April (Locked for India)" disabled />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">GST Registration</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">GSTIN</p>
            <Input value={form.gstin} onChange={(e) => onGSTINChange(e.target.value)} placeholder="15-char GSTIN" />
            {gstinHint ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {gstinHint}
              </p>
            ) : null}
            {gstinError ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                <TriangleAlert className="h-3.5 w-3.5" />
                {gstinError}
              </p>
            ) : null}
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.compositionScheme)}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    compositionScheme: e.target.checked,
                    registrationType: e.target.checked ? "COMPOSITION" : p.registrationType ?? "REGULAR",
                  }))
                }
              />
              Composition Scheme
            </label>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Registration Type</p>
            <Select
              value={form.registrationType ?? "REGULAR"}
              onChange={(e) => setForm((p) => ({ ...p, registrationType: e.target.value as GSTRegistrationType }))}
            >
              <option value="REGULAR">Regular</option>
              <option value="COMPOSITION">Composition</option>
              <option value="CASUAL">Casual</option>
              <option value="SEZ">SEZ</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Address</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <p className="mb-1 text-xs text-muted-foreground">Address Line 1</p>
            <Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Address Line 2</p>
            <Input
              value={form.addressLine2 ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">City</p>
            <Input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">State</p>
            <Select
              value={stateFromCode?.name ?? form.state}
              onChange={(e) => {
                const match = INDIAN_STATES.find((state) => state.name === e.target.value);
                setForm((p) => ({ ...p, state: e.target.value, stateCode: match?.tinCode ?? p.stateCode }));
              }}
            >
              {INDIAN_STATES.map((state) => (
                <option key={state.tinCode} value={state.name}>
                  {state.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">State Code</p>
            <Input value={form.stateCode} disabled />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Pincode</p>
            <Input value={form.pincode} onChange={(e) => setForm((p) => ({ ...p, pincode: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Bank Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Bank Name</p>
            <Input value={form.bankName} onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Account Number</p>
            <div className="relative">
              <Input
                value={showAccountNumber ? form.accountNumber : maskAccountNumber(form.accountNumber)}
                onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value.replace(/\s+/g, "") }))}
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded p-1 text-muted-foreground"
                onClick={() => setShowAccountNumber((v) => !v)}
              >
                {showAccountNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">IFSC</p>
            <Input value={form.ifsc} onChange={(e) => setForm((p) => ({ ...p, ifsc: e.target.value.toUpperCase() }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Branch</p>
            <Input value={form.branch ?? ""} onChange={(e) => setForm((p) => ({ ...p, branch: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Account Type</p>
            <Select
              value={form.accountType ?? "CURRENT"}
              onChange={(e) => setForm((p) => ({ ...p, accountType: e.target.value as BusinessProfile["accountType"] }))}
            >
              <option value="SAVINGS">Savings</option>
              <option value="CURRENT">Current</option>
              <option value="OVERDRAFT">Overdraft</option>
              <option value="OTHER">Other</option>
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">UPI ID</p>
            <Input value={form.upiId} onChange={(e) => setForm((p) => ({ ...p, upiId: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Preferences</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Default Payment Terms</p>
            <Select
              value={String(form.defaultPaymentTermDays ?? 15)}
              onChange={(e) => setForm((p) => ({ ...p, defaultPaymentTermDays: Number(e.target.value) as 7 | 15 | 30 | 45 | 60 }))}
            >
              {termOptions.map((days) => (
                <option key={days} value={days}>
                  {days} days
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Invoice Prefix</p>
            <Input
              value={form.invoicePrefix ?? "INV"}
              onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value.toUpperCase() }))}
            />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Starting Sequence Number</p>
            <Input
              type="number"
              value={form.startingSequenceNumber ?? 1}
              onChange={(e) => setForm((p) => ({ ...p, startingSequenceNumber: Number(e.target.value) || 1 }))}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">Default Notes</p>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.defaultNotes ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, defaultNotes: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">Default Terms & Conditions</p>
            <textarea
              className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.defaultTerms ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, defaultTerms: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      {saved ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Business profile updated successfully.
        </div>
      ) : null}
    </div>
  );
}
