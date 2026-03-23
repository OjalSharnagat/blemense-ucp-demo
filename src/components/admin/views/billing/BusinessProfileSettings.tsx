import { useMemo, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Save, TriangleAlert } from "lucide-react";
import type {
  BusinessCategory,
  BusinessProfile,
  BusinessScale,
  BusinessType,
  GSTRegistrationType,
  PriceDisplayMode,
} from "@/data/billing";
import { INDIAN_STATES } from "@/data/gst";
import { useBillingStore } from "@/lib/billingStore";
import { getBusinessModeConfig, getBusinessScaleLabel } from "@/lib/businessMode";
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
  const businessMode = useMemo(() => getBusinessModeConfig(form), [form]);

  const updateStatus = (status: BusinessProfile["gstRegistrationStatus"]) => {
    setForm((prev) => {
      if (status === "UNREGISTERED") {
        return {
          ...prev,
          gstRegistrationStatus: status,
          gstin: "",
          compositionScheme: false,
          registrationType: undefined,
        };
      }
      return {
        ...prev,
        gstRegistrationStatus: status,
        registrationType: prev.registrationType ?? "REGULAR",
      };
    });
    setGstinError("");
    setGstinHint("");
  };

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
    updateBusinessProfile({
      ...form,
      gstRegistrationStatus: form.gstRegistrationStatus,
      gstin: form.gstRegistrationStatus === "REGISTERED" ? form.gstin?.trim() ?? "" : "",
      compositionScheme: form.gstRegistrationStatus === "REGISTERED" ? Boolean(form.compositionScheme) : false,
      registrationType:
        form.gstRegistrationStatus === "REGISTERED"
          ? form.compositionScheme
            ? "COMPOSITION"
            : form.registrationType ?? "REGULAR"
          : undefined,
      setupComplete: true,
    });
    setForm((prev) => ({ ...prev, setupComplete: true }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1200);
  };

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Business Setup</h1>
          <p className="text-sm text-muted-foreground">
            Set your business profile once and the rest of the product will adapt around it.
          </p>
        </div>
        <Button onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          Save Profile
        </Button>
      </div>

      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-950">{businessMode.title} mode</p>
            <p className="text-sm text-blue-900/80">{businessMode.subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
              {getBusinessScaleLabel(form.businessScale)}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
              {form.businessCategory ?? "BOTH"}
            </span>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-blue-700">
              Prices {form.priceDisplayMode?.toLowerCase() ?? "inclusive"} of tax
            </span>
          </div>
        </CardContent>
      </Card>

      {!form.setupComplete ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start gap-3 p-4 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Finish this setup once and we will keep GST screens, invoice defaults, and dashboard notices aligned with your
              business type.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Business Type Setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs text-muted-foreground">GST Registration Status</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={form.gstRegistrationStatus === "REGISTERED" ? "default" : "outline"}
                  onClick={() => updateStatus("REGISTERED")}
                >
                  I am GST registered
                </Button>
                <Button
                  type="button"
                  variant={form.gstRegistrationStatus === "UNREGISTERED" ? "default" : "outline"}
                  onClick={() => updateStatus("UNREGISTERED")}
                >
                  I am not GST registered
                </Button>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Business Scale</p>
              <Select
                value={form.businessScale ?? "SMALL"}
                onChange={(e) => setForm((p) => ({ ...p, businessScale: e.target.value as BusinessScale }))}
              >
                <option value="FREELANCER">Freelancer / Solo Trader</option>
                <option value="SMALL">Small Business (1-10 people)</option>
                <option value="GROWING">Growing Business (10-50 people)</option>
                <option value="ESTABLISHED">Established Business (50+ people)</option>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Business Type</p>
              <Select
                value={form.businessCategory ?? "BOTH"}
                onChange={(e) => setForm((p) => ({ ...p, businessCategory: e.target.value as BusinessCategory }))}
              >
                <option value="GOODS">Goods</option>
                <option value="SERVICES">Services</option>
                <option value="BOTH">Both</option>
              </Select>
            </div>
            <div>
              <p className="mb-1 text-xs text-muted-foreground">Price Display</p>
              <Select
                value={form.priceDisplayMode ?? "INCLUSIVE"}
                onChange={(e) => setForm((p) => ({ ...p, priceDisplayMode: e.target.value as PriceDisplayMode }))}
              >
                <option value="INCLUSIVE">Inclusive of tax</option>
                <option value="EXCLUSIVE">Exclusive of tax</option>
              </Select>
            </div>
          </div>

          {form.gstRegistrationStatus === "REGISTERED" ? (
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">GSTIN</p>
                <Input value={form.gstin ?? ""} onChange={(e) => onGSTINChange(e.target.value)} placeholder="15-char GSTIN" />
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
                  disabled={Boolean(form.compositionScheme)}
                >
                  <option value="REGULAR">Regular</option>
                  <option value="CASUAL">Casual</option>
                  <option value="SEZ">SEZ</option>
                  <option value="COMPOSITION">Composition</option>
                </Select>
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-dashed bg-slate-50 p-3 text-sm text-muted-foreground">
              GST-specific fields stay hidden for unregistered businesses, so the rest of the app stays simple.
            </div>
          )}
        </CardContent>
      </Card>

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
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Setup Status</p>
            <Input value={form.setupComplete ? "Completed" : "In progress"} disabled />
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
            <Input value={form.addressLine2 ?? ""} onChange={(e) => setForm((p) => ({ ...p, addressLine2: e.target.value }))} />
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
              onChange={(e) =>
                setForm((p) => ({ ...p, accountType: e.target.value as NonNullable<BusinessProfile["accountType"]> }))
              }
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
          <CardTitle className="text-base">Invoice Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Default Payment Terms (days)</p>
            <Select
              value={String(form.defaultPaymentTermDays ?? 15)}
              onChange={(e) =>
                setForm((p) => ({ ...p, defaultPaymentTermDays: Number(e.target.value) as BusinessProfile["defaultPaymentTermDays"] }))
              }
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
            <Input value={form.invoicePrefix ?? "INV"} onChange={(e) => setForm((p) => ({ ...p, invoicePrefix: e.target.value }))} />
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Starting Sequence</p>
            <Input
              type="number"
              min={1}
              value={form.startingSequenceNumber ?? 1}
              onChange={(e) => setForm((p) => ({ ...p, startingSequenceNumber: Number(e.target.value) || 1 }))}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">Default Notes</p>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.defaultNotes ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, defaultNotes: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">Default Terms</p>
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              value={form.defaultTerms ?? ""}
              onChange={(e) => setForm((p) => ({ ...p, defaultTerms: e.target.value }))}
            />
          </div>
          <div className="md:col-span-2 xl:col-span-3">
            <p className="mb-1 text-xs text-muted-foreground">Signature URL</p>
            <Input value={form.signatureUrl} onChange={(e) => setForm((p) => ({ ...p, signatureUrl: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button onClick={save}>
          <Save className="mr-2 h-4 w-4" />
          Save Profile
        </Button>
        {saved ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600">
            <CheckCircle2 className="h-4 w-4" />
            Saved
          </span>
        ) : null}
      </div>
    </div>
  );
}
