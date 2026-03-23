import { useEffect, useMemo } from "react";
import { Building2, ChevronRight, Keyboard, Package, Percent, Printer, ShieldAlert, SlidersHorizontal, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { POSPaymentMode, POSTaxBehavior } from "@/data/pos";
import { getBusinessModeConfig } from "@/lib/businessMode";
import { cn } from "@/lib/utils";
import { useBillingStore } from "@/lib/billingStore";
import { usePosStore } from "@/lib/posStore";

const taxOptions: Array<{ value: POSTaxBehavior; label: string; helper: string }> = [
  { value: "EXCLUSIVE", label: "Exclusive", helper: "Add GST on top of the listed price." },
  { value: "INCLUSIVE", label: "Inclusive", helper: "Show GST folded into the displayed price." },
  { value: "NONE", label: "None", helper: "Use clean pricing with no GST on the POS." },
];

const paymentModes: Array<{ value: POSPaymentMode; label: string }> = [
  { value: "CASH", label: "Cash" },
  { value: "UPI", label: "UPI" },
  { value: "CARD", label: "Card" },
  { value: "SPLIT", label: "Split" },
];

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-200/50">
      <CardHeader className="space-y-3 border-b border-slate-200 bg-gradient-to-br from-white to-slate-50">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white shadow-sm shadow-slate-200/70">
            {icon}
          </div>
          <div>
            <CardTitle className="text-xl text-slate-950">{title}</CardTitle>
            <CardDescription className="mt-1 text-slate-600">{description}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-5">{children}</CardContent>
    </Card>
  );
}

function ToggleRow({
  title,
  description,
  enabled,
  onToggle,
  disabled,
  lockedLabel,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
  lockedLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "w-full rounded-2xl border px-4 py-4 text-left transition",
        enabled ? "border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-200/70" : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white",
        disabled && "cursor-not-allowed opacity-60 hover:bg-slate-50",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className={cn("mt-1 text-xs leading-5", enabled ? "text-slate-200" : "text-slate-500")}>{description}</p>
        </div>
        <div
          className={cn(
            "shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em]",
            enabled ? "border-white/20 bg-white/10 text-white" : "border-slate-200 bg-white text-slate-600",
          )}
        >
          {disabled ? lockedLabel || "Locked" : enabled ? "On" : "Off"}
        </div>
      </div>
    </button>
  );
}

export default function POSSettings() {
  const { businessProfile } = useBillingStore();
  const { settings, updateSettings } = usePosStore();
  const businessMode = useMemo(() => getBusinessModeConfig(businessProfile), [businessProfile]);
  const gstLocked = businessMode.mode !== "GST";
  const serviceBusiness = businessProfile.businessCategory === "SERVICES";
  const currentTaxBehavior: POSTaxBehavior =
    businessMode.mode === "COMPOSITION" ? "INCLUSIVE" : gstLocked ? "NONE" : settings.defaultTaxBehavior;
  const effectiveDefaultPaymentMode: POSPaymentMode =
    settings.enableSplitPayment || settings.defaultPaymentMode !== "SPLIT" ? settings.defaultPaymentMode : "CASH";

  const setTaxBehavior = (value: POSTaxBehavior) => {
    if (gstLocked) return;
    updateSettings({ defaultTaxBehavior: value });
  };

  const setSplitPayment = (enabled: boolean) => {
    updateSettings({
      enableSplitPayment: enabled,
      defaultPaymentMode: !enabled && settings.defaultPaymentMode === "SPLIT" ? "CASH" : settings.defaultPaymentMode,
    });
  };

  useEffect(() => {
    if (!settings.enableSplitPayment && settings.defaultPaymentMode === "SPLIT") {
      updateSettings({ defaultPaymentMode: "CASH" });
    }
  }, [settings.defaultPaymentMode, settings.enableSplitPayment, updateSettings]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            <Link to="/admin/settings" className="hover:text-slate-900">
              Settings
            </Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-900">POS Configuration</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">POS Configuration</h1>
          <p className="max-w-3xl text-sm leading-6 text-slate-600">
            Tune billing behavior, receipt fields, stock rules, and cashier shortcuts for the live terminal.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
            Applies instantly
          </Badge>
          <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
            {businessMode.title}
          </Badge>
          <Link
            to="/admin/settings/business-gst"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            <Building2 className="h-4 w-4" />
            Business Setup
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-6">
          <SectionCard
            title="Billing Behavior"
            description="Control tax display and payment defaults used by the terminal."
            icon={<Percent className="h-5 w-5" />}
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">GST on POS</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {businessMode.mode === "COMPOSITION"
                      ? "Composition dealers use inclusive pricing and no GST breakdown on the slip."
                      : gstLocked
                        ? "Locked off by business profile. Register GST in Business Setup to collect tax."
                        : "Enabled. The terminal can collect GST on taxable sales."}
                  </p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                  {businessMode.mode === "COMPOSITION" ? "Composition" : gstLocked ? "Off permanently" : "Available"}
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {taxOptions.map((option) => {
                  const selected = currentTaxBehavior === option.value;
                  const disabled = gstLocked;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => setTaxBehavior(option.value)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition",
                        selected ? "border-slate-900 bg-slate-900 text-white shadow-sm shadow-slate-200/70" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                        disabled && "cursor-not-allowed opacity-75",
                      )}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className={cn("mt-1 text-xs leading-5", selected ? "text-slate-200" : "text-slate-500")}>{option.helper}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Default payment mode</label>
                <Select
                  value={effectiveDefaultPaymentMode}
                  onChange={(event) => updateSettings({ defaultPaymentMode: event.target.value as POSPaymentMode })}
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                >
                  {paymentModes.map((mode) => (
                    <option key={mode.value} value={mode.value} disabled={mode.value === "SPLIT" && !settings.enableSplitPayment}>
                      {mode.label}
                    </option>
                  ))}
                </Select>
              </div>

              <ToggleRow
                title="Round off totals"
                description="Round checkout totals to the nearest rupee before payment."
                enabled={settings.roundOffTotal}
                onToggle={() => updateSettings({ roundOffTotal: !settings.roundOffTotal })}
              />
            </div>

            <ToggleRow
              title="Split payment"
              description="Allow cash and digital payment to be combined on one sale."
              enabled={settings.enableSplitPayment}
              onToggle={() => setSplitPayment(!settings.enableSplitPayment)}
            />
          </SectionCard>

          <SectionCard
            title="Receipt Customization"
            description="Shape the thermal slip so it matches your business and printer."
            icon={<Printer className="h-5 w-5" />}
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Receipt header</label>
                <Input
                  value={settings.receiptHeader}
                  onChange={(event) => updateSettings({ receiptHeader: event.target.value })}
                  placeholder="Blemense UCP POS"
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Receipt footer</label>
                <Input
                  value={settings.receiptFooter}
                  onChange={(event) => updateSettings({ receiptFooter: event.target.value })}
                  placeholder="Thank you for your purchase."
                  className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <ToggleRow
                title="Show GSTIN"
                description="Print the GSTIN on receipts when available."
                enabled={settings.showGstinOnReceipt}
                onToggle={() => updateSettings({ showGstinOnReceipt: !settings.showGstinOnReceipt })}
                disabled={businessMode.mode === "UNREGISTERED"}
                lockedLabel="N/A"
              />
              <ToggleRow
                title="Show operator"
                description="Include the operator name on the slip."
                enabled={settings.showOperatorNameOnReceipt}
                onToggle={() => updateSettings({ showOperatorNameOnReceipt: !settings.showOperatorNameOnReceipt })}
              />
              <ToggleRow
                title="Show order no."
                description="Print the POS order number on the receipt."
                enabled={settings.showOrderNumberOnReceipt}
                onToggle={() => updateSettings({ showOrderNumberOnReceipt: !settings.showOrderNumberOnReceipt })}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Stock Behavior"
            description="Tune how the terminal reacts to stock counts and barcode entry."
            icon={<Package className="h-5 w-5" />}
          >
            {serviceBusiness ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                Stock checks are off for service businesses. The terminal can still sell walk-in services without inventory limits.
              </div>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-2">
              <ToggleRow
                title="Allow negative stock"
                description="Let the terminal continue sales when stock is exhausted."
                enabled={settings.allowNegativeStock}
                onToggle={() => updateSettings({ allowNegativeStock: !settings.allowNegativeStock })}
                disabled={serviceBusiness}
                lockedLabel="Off"
              />
              <ToggleRow
                title="Enable barcode search"
                description="Allow scans and barcode lookups from the product browser."
                enabled={settings.enableBarcode}
                onToggle={() => updateSettings({ enableBarcode: !settings.enableBarcode })}
              />
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <label className="mb-2 block text-xs uppercase tracking-wide text-slate-500">Low stock warning threshold</label>
              <Input
                type="number"
                min={0}
                step="1"
                value={settings.lowStockWarningThreshold}
                onChange={(event) => updateSettings({ lowStockWarningThreshold: Number(event.target.value || 0) })}
                disabled={serviceBusiness}
                className="h-11 rounded-xl border-slate-200 bg-white text-slate-900 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                {serviceBusiness
                  ? "Stock warnings are disabled because this business sells services."
                  : "Items at or below this count will warn the operator in the live terminal."}
              </p>
            </div>
          </SectionCard>

          <SectionCard
            title="Customer Capture"
            description="Optionally collect customer details at checkout from the live POS terminal."
            icon={<Users className="h-5 w-5" />}
          >
            <ToggleRow
              title="Enable customer capture"
              description="Show customer name and phone fields above payment on the terminal."
              enabled={settings.enableCustomerCapture}
              onToggle={() => updateSettings({ enableCustomerCapture: !settings.enableCustomerCapture })}
            />
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
              When this is on, the operator can attach a customer name and phone before taking payment. It stays quick and optional.
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white shadow-sm shadow-slate-200/70">
                  <Keyboard className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-950">Keyboard shortcuts</CardTitle>
                  <CardDescription className="mt-1 text-slate-600">Cashier speed cheatsheet visible to the whole team.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 p-5">
              {[
                ["F2 or /", "Focus the product search"],
                ["Arrow keys", "Move through the product grid"],
                ["Enter", "Add the highlighted product"],
                ["Escape", "Clear search and start over"],
                ["Ctrl + Enter", "Complete sale"],
                ["F12", "Complete sale"],
              ].map(([shortcut, meaning]) => (
                <div key={shortcut} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                    {shortcut}
                  </div>
                  <p className="flex-1 text-right text-sm text-slate-600">{meaning}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            <CardHeader className="border-b border-slate-200 bg-gradient-to-br from-white to-slate-50">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 p-3 text-white shadow-sm shadow-slate-200/70">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-xl text-slate-950">Live behavior</CardTitle>
                  <CardDescription className="mt-1 text-slate-600">These settings drive the current POS session only.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Active tax mode</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {businessMode.mode === "UNREGISTERED" ? "NONE" : currentTaxBehavior}
                </p>
                <p className="mt-1 text-sm text-slate-600">{businessMode.subtitle}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Receipt fields</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
                    GSTIN {settings.showGstinOnReceipt ? "on" : "off"}
                  </Badge>
                  <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
                    Operator {settings.showOperatorNameOnReceipt ? "on" : "off"}
                  </Badge>
                  <Badge variant="secondary" className="border-slate-200 bg-white text-slate-700">
                    Order No. {settings.showOrderNumberOnReceipt ? "on" : "off"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">Operational note</p>
                    <p className="mt-1 text-sm leading-6">
                      POS settings apply instantly in this browser session. For long-term persistence, connect them to your business settings save flow later.
                    </p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
                Need to change GST registration or business identity? Open Business Setup and update the core profile there.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
