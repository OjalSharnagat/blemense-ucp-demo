import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  GripVertical,
  Link2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { BusinessProfile, Invoice, InvoiceType, LineItem, Party } from "@/data/billing";
import { HSN_CODES, INDIAN_STATES } from "@/data/gst";
import { useBillingStore } from "@/lib/billingStore";
import {
  amountInWords,
  computeInvoiceTotals,
  computeIsInterState,
  computeLineItemTax,
  generateInvoiceNumber,
  getCurrentFinancialYear,
  getSupplyType,
  validateGSTIN,
} from "@/lib/gst";
import { validateInvoice } from "@/lib/invoiceValidation";
import { cn } from "@/lib/utils";
import { uid } from "@/utils";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "../../../ui/dialog";
import { Input } from "../../../ui/input";
import { Select } from "../../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";

type ChargeState = {
  amount: number;
  gstRate: number;
};

type InvoiceBuilderState = {
  type: InvoiceType;
  issueDate: string;
  dueDate: string;
  supplyDate: string;
  placeOfSupply: string;
  linkedInvoiceId?: string;
  isRCM: boolean;
  buyer: Party;
  shippingSameAsBilling: boolean;
  shippingAddress: {
    address: string;
    city: string;
    state: string;
    stateCode: string;
    pincode: string;
  };
  lineItems: LineItem[];
  charges: {
    freight: ChargeState;
    packing: ChargeState;
    other: ChargeState;
  };
  eway: {
    eWayBillNumber: string;
    eWayBillDate: string;
    transporterName: string;
    transporterId: string;
    vehicleNumber: string;
    transportMode: "ROAD" | "RAIL" | "AIR" | "SHIP";
    distanceKm: number;
  };
  notes: string;
  terms: string;
  seller: BusinessProfile;
};

const today = new Date().toISOString().slice(0, 10);
const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

const DEFAULT_TERMS = "Payment due within 15 days from issue date.";

const EMPTY_BUYER: Party = {
  id: "buyer-temp",
  name: "",
  gstin: "",
  pan: "",
  address: "",
  city: "",
  state: "",
  stateCode: "",
  pincode: "",
  email: "",
  phone: "",
  isRegistered: true,
};

const emptyLineItem = (): LineItem => ({
  id: uid("li"),
  description: "",
  hsn: "",
  quantity: 1,
  unit: "NOS",
  unitPrice: 0,
  discount: 0,
  discountType: "flat",
  gstRate: 18,
  isService: false,
});

const typeOptions: Array<{ label: string; value: InvoiceType }> = [
  { label: "Tax Invoice", value: "TAX_INVOICE" },
  { label: "Proforma", value: "PROFORMA" },
  { label: "Credit Note", value: "CREDIT_NOTE" },
  { label: "Debit Note", value: "DEBIT_NOTE" },
];

const toLineItemsWithCharges = (state: InvoiceBuilderState): LineItem[] => {
  const base = state.lineItems.filter((item) => item.description.trim() || item.unitPrice > 0);
  const charges: LineItem[] = [];

  if (state.charges.freight.amount > 0) {
    charges.push({
      id: "charge-freight",
      description: "Freight / Shipping Charges",
      hsn: "9965",
      quantity: 1,
      unit: "NOS",
      unitPrice: state.charges.freight.amount,
      discount: 0,
      discountType: "flat",
      gstRate: state.charges.freight.gstRate,
      isService: true,
    });
  }
  if (state.charges.packing.amount > 0) {
    charges.push({
      id: "charge-packing",
      description: "Packing Charges",
      hsn: "9985",
      quantity: 1,
      unit: "NOS",
      unitPrice: state.charges.packing.amount,
      discount: 0,
      discountType: "flat",
      gstRate: state.charges.packing.gstRate,
      isService: true,
    });
  }
  if (state.charges.other.amount > 0) {
    charges.push({
      id: "charge-other",
      description: "Other Charges",
      hsn: "9997",
      quantity: 1,
      unit: "NOS",
      unitPrice: state.charges.other.amount,
      discount: 0,
      discountType: "flat",
      gstRate: state.charges.other.gstRate,
      isService: true,
    });
  }

  return [...base, ...charges];
};

const buildDefaultState = (businessProfile: BusinessProfile, party?: Party): InvoiceBuilderState => {
  const defaultParty = party ?? EMPTY_BUYER;
  return {
    type: "TAX_INVOICE",
    issueDate: today,
    dueDate: today,
    supplyDate: today,
    placeOfSupply: defaultParty.state || businessProfile.state,
    isRCM: false,
    buyer: { ...defaultParty },
    shippingSameAsBilling: true,
    shippingAddress: {
      address: defaultParty.address || "",
      city: defaultParty.city || "",
      state: defaultParty.state || "",
      stateCode: defaultParty.stateCode || "",
      pincode: defaultParty.pincode || "",
    },
    lineItems: [emptyLineItem()],
    charges: {
      freight: { amount: 0, gstRate: 18 },
      packing: { amount: 0, gstRate: 18 },
      other: { amount: 0, gstRate: 18 },
    },
    eway: {
      eWayBillNumber: "",
      eWayBillDate: "",
      transporterName: "",
      transporterId: "",
      vehicleNumber: "",
      transportMode: "ROAD",
      distanceKm: 0,
    },
    notes: "",
    terms: DEFAULT_TERMS,
    seller: { ...businessProfile },
  };
};

const parseChargesFromInvoice = (lineItems: LineItem[]) => {
  const normal: LineItem[] = [];
  const charges = {
    freight: { amount: 0, gstRate: 18 },
    packing: { amount: 0, gstRate: 18 },
    other: { amount: 0, gstRate: 18 },
  };

  for (const item of lineItems) {
    if (item.id === "charge-freight") {
      charges.freight = { amount: item.unitPrice, gstRate: item.gstRate };
      continue;
    }
    if (item.id === "charge-packing") {
      charges.packing = { amount: item.unitPrice, gstRate: item.gstRate };
      continue;
    }
    if (item.id === "charge-other") {
      charges.other = { amount: item.unitPrice, gstRate: item.gstRate };
      continue;
    }
    normal.push(item);
  }

  return { normal, charges };
};

export default function InvoiceBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, parties, businessProfile, createInvoice, updateInvoice, finalizeInvoice, saveParty } = useBillingStore();

  const [selectedPartyId, setSelectedPartyId] = useState<string>("");
  const [partyQuery, setPartyQuery] = useState("");
  const [showNewParty, setShowNewParty] = useState(false);
  const [showCharges, setShowCharges] = useState(true);
  const [showEWay, setShowEWay] = useState(true);
  const [linkedInvoiceQuery, setLinkedInvoiceQuery] = useState("");
  const [gstinStateHint, setGstinStateHint] = useState("");
  const [gstinError, setGstinError] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [ackWarnings, setAckWarnings] = useState(false);
  const [form, setForm] = useState<InvoiceBuilderState>(() => buildDefaultState(businessProfile, parties[0]));

  const existing = id ? invoices.find((item) => item.id === id) : undefined;
  const isNew = !id;
  const isEditable = isNew || existing?.status === "DRAFT";
  const isLocked = !isEditable;

  useEffect(() => {
    if (isNew) {
      const initial = buildDefaultState(businessProfile, parties[0]);
      setForm(initial);
      setSelectedPartyId(parties[0]?.id ?? "");
      return;
    }
    if (!existing) return;

    const parsed = parseChargesFromInvoice(existing.lineItems);
    setForm({
      type: existing.type,
      issueDate: existing.issueDate,
      dueDate: existing.dueDate,
      supplyDate: existing.supplyDate,
      placeOfSupply: existing.placeOfSupply,
      linkedInvoiceId: existing.linkedInvoiceId,
      isRCM: existing.isRCM,
      buyer: { ...existing.buyer },
      shippingSameAsBilling: !existing.shippingAddress,
      shippingAddress: existing.shippingAddress ?? {
        address: existing.buyer.address,
        city: existing.buyer.city,
        state: existing.buyer.state,
        stateCode: existing.buyer.stateCode,
        pincode: existing.buyer.pincode,
      },
      lineItems: parsed.normal.length ? parsed.normal : [emptyLineItem()],
      charges: parsed.charges,
      eway: {
        eWayBillNumber: existing.eWayBillNumber ?? "",
        eWayBillDate: existing.eWayBillDate ?? "",
        transporterName: existing.transporterName ?? "",
        transporterId: existing.transporterId ?? "",
        vehicleNumber: existing.vehicleNumber ?? "",
        transportMode: existing.transportMode ?? "ROAD",
        distanceKm: existing.transportDistanceKm ?? 0,
      },
      notes: existing.notes,
      terms: existing.terms,
      seller: { ...existing.seller },
    });
    setSelectedPartyId(existing.buyer.id);
  }, [isNew, existing, parties, businessProfile]);

  const filteredParties = useMemo(() => {
    const q = partyQuery.trim().toLowerCase();
    if (!q) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(q) ||
        (party.gstin ?? "").toLowerCase().includes(q) ||
        party.phone.toLowerCase().includes(q),
    );
  }, [parties, partyQuery]);

  const allItems = useMemo(() => toLineItemsWithCharges(form), [form]);
  const isInterState = useMemo(
    () => computeIsInterState(form.seller.stateCode || businessProfile.stateCode, form.buyer.stateCode || ""),
    [form.seller.stateCode, form.buyer.stateCode, businessProfile.stateCode],
  );
  const totals = useMemo(() => computeInvoiceTotals(allItems, isInterState), [allItems, isInterState]);
  const subtotal = useMemo(() => allItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0), [allItems]);
  const discountTotal = useMemo(
    () =>
      allItems.reduce((sum, item) => {
        const base = item.quantity * item.unitPrice;
        const value = item.discountType === "percent" ? (base * item.discount) / 100 : item.discount;
        return sum + value;
      }, 0),
    [allItems],
  );

  const supplyType = getSupplyType(form.buyer, totals.grandTotal);
  const showEWaySection = totals.grandTotal > 50000;

  const taxByRate = useMemo(() => {
    const buckets = new Map<
      number,
      {
        taxable: number;
        cgst: number;
        sgst: number;
        igst: number;
      }
    >();

    for (const item of allItems) {
      const line = computeLineItemTax(item, isInterState);
      const rate = Number(item.gstRate.toFixed(2));
      const curr = buckets.get(rate) ?? { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
      curr.taxable += line.taxableValue;
      curr.cgst += line.cgstAmount;
      curr.sgst += line.sgstAmount;
      curr.igst += line.igstAmount;
      buckets.set(rate, curr);
    }

    return [...buckets.entries()].sort((a, b) => a[0] - b[0]);
  }, [allItems, isInterState]);

  const existingChoices = useMemo(
    () =>
      invoices
        .filter((invoice) => !id || invoice.id !== id)
        .map((invoice) => ({
          id: invoice.id,
          label: `${invoice.invoiceNumber} • ${invoice.buyer.name}`,
        })),
    [invoices, id],
  );

  const linkedInvoiceChoices = useMemo(() => {
    const q = linkedInvoiceQuery.trim().toLowerCase();
    if (!q) return existingChoices;
    return existingChoices.filter((choice) => choice.label.toLowerCase().includes(q));
  }, [existingChoices, linkedInvoiceQuery]);

  const getNextSequencePreview = (type: InvoiceType, financialYear: string): number => {
    const sequences = invoices
      .filter((invoice) => invoice.type === type && invoice.financialYear === financialYear)
      .map((invoice) => {
        const match = invoice.invoiceNumber.match(/\/(\d+)$/);
        return match ? Number(match[1]) : 0;
      })
      .filter((num) => Number.isFinite(num));
    return (sequences.length ? Math.max(...sequences) : 0) + 1;
  };

  const applyParty = (party: Party) => {
    setForm((prev) => ({
      ...prev,
      buyer: { ...party },
      placeOfSupply: party.state || prev.placeOfSupply,
      shippingAddress: prev.shippingSameAsBilling
        ? {
            address: party.address,
            city: party.city,
            state: party.state,
            stateCode: party.stateCode,
            pincode: party.pincode,
          }
        : prev.shippingAddress,
    }));
    setGstinError("");
    setGstinStateHint(party.state ? `${party.stateCode} - ${party.state}` : "");
  };

  const handlePartyChange = (value: string) => {
    setSelectedPartyId(value);
    if (value === "__new__") {
      setShowNewParty(true);
      setForm((prev) => ({
        ...prev,
        buyer: { ...EMPTY_BUYER, id: uid("pty"), isRegistered: true },
      }));
      return;
    }
    setShowNewParty(false);
    const party = parties.find((item) => item.id === value);
    if (party) applyParty(party);
  };

  const updateBuyer = (patch: Partial<Party>) => {
    setForm((prev) => ({ ...prev, buyer: { ...prev.buyer, ...patch } }));
  };

  const addLineItem = () => {
    setForm((prev) => ({ ...prev, lineItems: [...prev.lineItems, emptyLineItem()] }));
  };

  const removeLineItem = (itemId: string) => {
    setForm((prev) => {
      const next = prev.lineItems.filter((item) => item.id !== itemId);
      return { ...prev, lineItems: next.length ? next : [emptyLineItem()] };
    });
  };

  const updateLineItem = (itemId: string, patch: Partial<LineItem>) => {
    setForm((prev) => ({
      ...prev,
      lineItems: prev.lineItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  const handleHsnChange = (itemId: string, value: string) => {
    const normalized = value.trim().toUpperCase();
    const matched = HSN_CODES.find((entry) => entry.code === normalized);
    updateLineItem(itemId, matched ? { hsn: matched.code, gstRate: matched.defaultGstRate } : { hsn: normalized });
  };

  const onGstinBlur = () => {
    if (!form.buyer.isRegistered) return;
    const value = (form.buyer.gstin ?? "").trim().toUpperCase();
    if (!value) {
      setGstinError("GSTIN is required for registered buyers.");
      setGstinStateHint("");
      return;
    }
    const result = validateGSTIN(value);
    if (!result.valid) {
      setGstinError("Invalid GSTIN. Check format and state code.");
      setGstinStateHint("");
      return;
    }
    setGstinError("");
    setGstinStateHint(`${result.stateCode} - ${result.stateName}`);
    const matchState = INDIAN_STATES.find((state) => state.tinCode === result.stateCode);
    updateBuyer({
      gstin: value,
      pan: result.pan || form.buyer.pan,
      stateCode: result.stateCode,
      state: matchState?.name ?? form.buyer.state,
    });
  };

  const reorderLineItems = (from: number, to: number) => {
    if (from === to) return;
    setForm((prev) => {
      const next = [...prev.lineItems];
      const [picked] = next.splice(from, 1);
      next.splice(to, 0, picked);
      return { ...prev, lineItems: next };
    });
  };

  const buildBuyerForSave = (): Party => ({
    ...form.buyer,
    name: form.buyer.name.trim() || "Walk-in Customer",
    state: form.buyer.state || form.placeOfSupply || businessProfile.state,
    stateCode: form.buyer.stateCode || INDIAN_STATES.find((s) => s.name === (form.placeOfSupply || form.buyer.state))?.tinCode || "",
  });

  const buildInvoiceForValidation = (): Invoice => {
    const buyer = buildBuyerForSave();
    const nowIso = new Date().toISOString();
    const financialYear = existing?.financialYear ?? getCurrentFinancialYear(form.issueDate || today);
    const sequence = existing ? 1 : getNextSequencePreview(form.type, financialYear);
    const invoiceNumber = existing?.invoiceNumber ?? generateInvoiceNumber(form.type, financialYear, sequence);
    const previewIsInterState = computeIsInterState(form.seller.stateCode || businessProfile.stateCode, buyer.stateCode || "");
    const previewTax = computeInvoiceTotals(allItems, previewIsInterState);

    return {
      id: existing?.id ?? "draft-validation",
      invoiceNumber,
      type: form.type,
      status: existing?.status ?? "DRAFT",
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      supplyDate: form.supplyDate,
      seller: form.seller,
      buyer,
      shippingAddress: form.shippingSameAsBilling ? undefined : form.shippingAddress,
      lineItems: allItems,
      taxBreakdown: previewTax,
      isInterState: previewIsInterState,
      isRCM: form.isRCM,
      placeOfSupply: form.placeOfSupply || buyer.state,
      notes: form.notes,
      terms: form.terms,
      eWayBillNumber: showEWaySection ? form.eway.eWayBillNumber || undefined : undefined,
      eWayBillDate: showEWaySection ? form.eway.eWayBillDate || undefined : undefined,
      vehicleNumber: showEWaySection ? form.eway.vehicleNumber || undefined : undefined,
      transporterName: showEWaySection ? form.eway.transporterName || undefined : undefined,
      transporterId: showEWaySection ? form.eway.transporterId || undefined : undefined,
      transportMode: showEWaySection ? form.eway.transportMode : undefined,
      transportDistanceKm: showEWaySection ? form.eway.distanceKm || undefined : undefined,
      linkedInvoiceId: form.linkedInvoiceId,
      paymentHistory: existing?.paymentHistory ?? [],
      amountPaid: existing?.amountPaid ?? 0,
      balanceDue: existing?.balanceDue ?? previewTax.grandTotal,
      createdAt: existing?.createdAt ?? nowIso,
      updatedAt: nowIso,
      financialYear,
    };
  };

  const validationIssues = useMemo(
    () =>
      validateInvoice(buildInvoiceForValidation(), {
        existingInvoices: invoices.filter((invoice) => invoice.id !== existing?.id),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, allItems, invoices, existing?.id, businessProfile.stateCode, showEWaySection],
  );
  const errorIssues = validationIssues.filter((issue) => issue.severity === "error");
  const warningIssues = validationIssues.filter((issue) => issue.severity === "warning");

  const fieldIssues = (field: string) => validationIssues.filter((issue) => issue.field === field || issue.field.startsWith(`${field}.`));

  const saveInvoice = (finalizeNow: boolean) => {
    const buyer = buildBuyerForSave();
    if (showNewParty && buyer.name.trim()) {
      saveParty(buyer);
    }

    const invoicePayload = {
      type: form.type,
      status: "DRAFT" as const,
      issueDate: form.issueDate,
      dueDate: form.dueDate,
      supplyDate: form.supplyDate,
      seller: form.seller,
      buyer,
      shippingAddress: form.shippingSameAsBilling ? undefined : form.shippingAddress,
      lineItems: allItems,
      isRCM: form.isRCM,
      placeOfSupply: form.placeOfSupply || buyer.state,
      notes: form.notes,
      terms: form.terms,
      linkedInvoiceId: form.linkedInvoiceId,
      eWayBillNumber: showEWaySection ? form.eway.eWayBillNumber || undefined : undefined,
      eWayBillDate: showEWaySection ? form.eway.eWayBillDate || undefined : undefined,
      vehicleNumber: showEWaySection ? form.eway.vehicleNumber || undefined : undefined,
      transporterName: showEWaySection ? form.eway.transporterName || undefined : undefined,
      transporterId: showEWaySection ? form.eway.transporterId || undefined : undefined,
      transportMode: showEWaySection ? form.eway.transportMode : undefined,
      transportDistanceKm: showEWaySection ? form.eway.distanceKm || undefined : undefined,
    };

    if (isNew) {
      const created = createInvoice(invoicePayload);
      if (finalizeNow) finalizeInvoice(created.id);
      navigate(`/admin/billing/${created.id}`);
      return;
    }
    if (!existing || !isEditable) return;

    updateInvoice({ ...existing, ...invoicePayload });
    if (finalizeNow) finalizeInvoice(existing.id);
  };

  const requestFinalize = () => {
    setAckWarnings(false);
    setShowValidationModal(true);
  };

  const confirmFinalize = () => {
    if (errorIssues.length > 0) return;
    if (warningIssues.length > 0 && !ackWarnings) return;
    setShowValidationModal(false);
    saveInvoice(true);
  };

  if (!isNew && !existing) {
    return (
      <div className="dash-view space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Invoice not found</h1>
        <Button asChild variant="outline">
          <Link to="/admin/billing">Back to billing</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLocked ? (
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="rotate-[-18deg] rounded border-4 border-rose-500/70 px-12 py-4 text-5xl font-extrabold tracking-wider text-rose-600/60">
            FINALIZED
          </div>
        </div>
      ) : null}
      <div className="dash-view grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="ghost" asChild className="-ml-2 gap-1">
              <Link to="/admin/billing">
                <ArrowLeft className="h-4 w-4" />
                Back to billing
              </Link>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => saveInvoice(false)} disabled={!isEditable}>
                <Save className="mr-2 h-4 w-4" />
                Save Draft
              </Button>
              <Button onClick={requestFinalize} disabled={!isEditable}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Finalize & Issue
              </Button>
              {existing ? (
                <Button variant="secondary" asChild>
                  <Link to={`/admin/billing/${existing.id}/preview`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Preview
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>

          {validationIssues.length > 0 ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
              <p className="font-medium text-amber-900">
                {errorIssues.length} error(s), {warningIssues.length} warning(s) in current invoice.
              </p>
              <p className="text-xs text-amber-800">Review inline highlights or open Finalize modal for full list.</p>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Section 1 - Document Header</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-100 p-1 md:grid-cols-4">
                {typeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={!isEditable}
                    onClick={() => setForm((prev) => ({ ...prev, type: option.value }))}
                    className={cn(
                      "rounded-md px-3 py-2 text-sm font-medium transition",
                      form.type === option.value ? "bg-white text-slate-900 shadow" : "text-slate-600 hover:text-slate-900",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Issue Date</p>
                  <Input
                    type="date"
                    value={form.issueDate}
                    disabled={!isEditable}
                    onChange={(event) => setForm((prev) => ({ ...prev, issueDate: event.target.value }))}
                  />
                  {fieldIssues("issueDate").map((issue, idx) => (
                    <p
                      key={`issueDate-${idx}`}
                      className={cn("mt-1 text-xs", issue.severity === "error" ? "text-rose-600" : "text-amber-700")}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Due Date</p>
                  <Input
                    type="date"
                    value={form.dueDate}
                    disabled={!isEditable}
                    onChange={(event) => setForm((prev) => ({ ...prev, dueDate: event.target.value }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Supply Date</p>
                  <Input
                    type="date"
                    value={form.supplyDate}
                    disabled={!isEditable}
                    onChange={(event) => setForm((prev) => ({ ...prev, supplyDate: event.target.value }))}
                  />
                  {fieldIssues("supplyDate").map((issue, idx) => (
                    <p
                      key={`supplyDate-${idx}`}
                      className={cn("mt-1 text-xs", issue.severity === "error" ? "text-rose-600" : "text-amber-700")}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Place of Supply</p>
                  <Select
                    value={form.placeOfSupply}
                    disabled={!isEditable}
                    onChange={(event) => {
                      const picked = INDIAN_STATES.find((state) => state.name === event.target.value);
                      setForm((prev) => ({
                        ...prev,
                        placeOfSupply: event.target.value,
                        buyer: {
                          ...prev.buyer,
                          state: event.target.value,
                          stateCode: picked?.tinCode ?? prev.buyer.stateCode,
                        },
                      }));
                    }}
                  >
                    {INDIAN_STATES.map((state) => (
                      <option key={state.tinCode} value={state.name}>
                        {state.name} ({state.tinCode})
                      </option>
                    ))}
                  </Select>
                  {fieldIssues("placeOfSupply").map((issue, idx) => (
                    <p
                      key={`pos-${idx}`}
                      className={cn("mt-1 text-xs", issue.severity === "error" ? "text-rose-600" : "text-amber-700")}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isRCM}
                  disabled={!isEditable}
                  onChange={(event) => setForm((prev) => ({ ...prev, isRCM: event.target.checked }))}
                />
                Reverse Charge Applicable (RCM)
              </label>

              {(form.type === "CREDIT_NOTE" || form.type === "DEBIT_NOTE") && (
                <div className="space-y-2">
                  <p className="mb-1 text-xs text-muted-foreground">Linked Invoice</p>
                  <Input
                    value={linkedInvoiceQuery}
                    disabled={!isEditable}
                    onChange={(event) => setLinkedInvoiceQuery(event.target.value)}
                    placeholder="Search invoice number or party"
                  />
                  <Select
                    value={form.linkedInvoiceId ?? ""}
                    disabled={!isEditable}
                    onChange={(event) => setForm((prev) => ({ ...prev, linkedInvoiceId: event.target.value || undefined }))}
                  >
                    <option value="">Select linked invoice</option>
                    {linkedInvoiceChoices.map((choice) => (
                      <option key={choice.id} value={choice.id}>
                        {choice.label}
                      </option>
                    ))}
                  </Select>
                  {fieldIssues("linkedInvoiceId").map((issue, idx) => (
                    <p key={`linked-${idx}`} className="text-xs text-rose-600">
                      {issue.message}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Section 2 - Seller Details</CardTitle>
              <Button variant="link" className="h-auto p-0" asChild>
                <Link to="/admin/settings">Edit Business Profile</Link>
              </Button>
            </CardHeader>
            <CardContent className="rounded-md border bg-slate-50 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="font-semibold">{form.seller.legalName}</p>
                  <p className="text-sm text-muted-foreground">{form.seller.tradeName}</p>
                  <p className="text-sm">{form.seller.address}</p>
                  <p className="text-sm">
                    {form.seller.city}, {form.seller.state} - {form.seller.pincode}
                  </p>
                </div>
                <div className="text-sm">
                  <p className="mb-2 rounded-md bg-emerald-50 px-3 py-2 font-semibold text-emerald-700">
                    GSTIN: {form.seller.gstin}
                  </p>
                  {fieldIssues("seller.gstin").map((issue, idx) => (
                    <p key={`seller-gstin-${idx}`} className="mb-1 text-xs text-rose-600">
                      {issue.message}
                    </p>
                  ))}
                  <p>PAN: {form.seller.pan}</p>
                  <p>Email: {form.seller.email}</p>
                  <p>Phone: {form.seller.phone}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Section 3 - Buyer Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Search Party</p>
                  <Input
                    value={partyQuery}
                    disabled={!isEditable}
                    onChange={(event) => setPartyQuery(event.target.value)}
                    placeholder="Search by name, GSTIN, or phone"
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Select Party</p>
                  <Select value={selectedPartyId} disabled={!isEditable} onChange={(event) => handlePartyChange(event.target.value)}>
                    <option value="">Select party</option>
                    {filteredParties.map((party) => (
                      <option key={party.id} value={party.id}>
                        {party.name}
                      </option>
                    ))}
                    <option value="__new__">+ New Party</option>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant={form.buyer.isRegistered ? "default" : "outline"}
                  disabled={!isEditable}
                  onClick={() => updateBuyer({ isRegistered: true })}
                >
                  Registered
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!form.buyer.isRegistered ? "default" : "outline"}
                  disabled={!isEditable}
                  onClick={() => updateBuyer({ isRegistered: false, gstin: "" })}
                >
                  Unregistered
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Buyer Name</p>
                  <Input value={form.buyer.name} disabled={!isEditable} onChange={(e) => updateBuyer({ name: e.target.value })} />
                </div>
                {form.buyer.isRegistered ? (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">GSTIN</p>
                    <Input
                      value={form.buyer.gstin ?? ""}
                      disabled={!isEditable}
                      onBlur={onGstinBlur}
                      onChange={(e) => updateBuyer({ gstin: e.target.value.toUpperCase() })}
                      placeholder="15-character GSTIN"
                    />
                    {gstinStateHint ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Valid GSTIN ({gstinStateHint})
                      </p>
                    ) : null}
                    {gstinError ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-rose-600">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {gstinError}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">PAN</p>
                    <Input value={form.buyer.pan} disabled={!isEditable} onChange={(e) => updateBuyer({ pan: e.target.value.toUpperCase() })} />
                  </div>
                )}
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">State</p>
                  <Select
                    value={form.buyer.state}
                    disabled={!isEditable}
                    onChange={(event) => {
                      const match = INDIAN_STATES.find((state) => state.name === event.target.value);
                      updateBuyer({ state: event.target.value, stateCode: match?.tinCode ?? "" });
                      setForm((prev) => ({ ...prev, placeOfSupply: event.target.value }));
                    }}
                  >
                    <option value="">Select state</option>
                    {INDIAN_STATES.map((state) => (
                      <option key={state.tinCode} value={state.name}>
                        {state.name} ({state.tinCode})
                      </option>
                    ))}
                  </Select>
                  {fieldIssues("buyer.state").map((issue, idx) => (
                    <p
                      key={`buyer-state-${idx}`}
                      className={cn("mt-1 text-xs", issue.severity === "error" ? "text-rose-600" : "text-amber-700")}
                    >
                      {issue.message}
                    </p>
                  ))}
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Address</p>
                  <Input value={form.buyer.address} disabled={!isEditable} onChange={(e) => updateBuyer({ address: e.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">City</p>
                  <Input value={form.buyer.city} disabled={!isEditable} onChange={(e) => updateBuyer({ city: e.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Pincode</p>
                  <Input value={form.buyer.pincode} disabled={!isEditable} onChange={(e) => updateBuyer({ pincode: e.target.value })} />
                </div>
              </div>

              {showNewParty ? (
                <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                  New party details will be saved to party master when invoice is saved.
                </div>
              ) : null}

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.shippingSameAsBilling}
                  disabled={!isEditable}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setForm((prev) => ({
                      ...prev,
                      shippingSameAsBilling: checked,
                      shippingAddress: checked
                        ? {
                            address: prev.buyer.address,
                            city: prev.buyer.city,
                            state: prev.buyer.state,
                            stateCode: prev.buyer.stateCode,
                            pincode: prev.buyer.pincode,
                          }
                        : prev.shippingAddress,
                    }));
                  }}
                />
                Same as billing address
              </label>

              {!form.shippingSameAsBilling ? (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="xl:col-span-2">
                    <p className="mb-1 text-xs text-muted-foreground">Shipping Address</p>
                    <Input
                      value={form.shippingAddress.address}
                      disabled={!isEditable}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, address: e.target.value } }))
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">City</p>
                    <Input
                      value={form.shippingAddress.city}
                      disabled={!isEditable}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, city: e.target.value } }))
                      }
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">State</p>
                    <Select
                      value={form.shippingAddress.state}
                      disabled={!isEditable}
                      onChange={(event) => {
                        const match = INDIAN_STATES.find((state) => state.name === event.target.value);
                        setForm((prev) => ({
                          ...prev,
                          shippingAddress: {
                            ...prev.shippingAddress,
                            state: event.target.value,
                            stateCode: match?.tinCode ?? "",
                          },
                        }));
                      }}
                    >
                      <option value="">Select state</option>
                      {INDIAN_STATES.map((state) => (
                        <option key={state.tinCode} value={state.name}>
                          {state.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Pincode</p>
                    <Input
                      value={form.shippingAddress.pincode}
                      disabled={!isEditable}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, shippingAddress: { ...prev.shippingAddress, pincode: e.target.value } }))
                      }
                    />
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-base">Section 4 - Line Items</CardTitle>
              <Button size="sm" variant="outline" disabled={!isEditable} onClick={addLineItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add Line Item
              </Button>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN/SAC</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead>Discount</TableHead>
                    <TableHead>Taxable Value</TableHead>
                    <TableHead>GST%</TableHead>
                    {isInterState ? <TableHead>IGST</TableHead> : <>
                      <TableHead>CGST</TableHead>
                      <TableHead>SGST</TableHead>
                    </>}
                    <TableHead>Total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {form.lineItems.map((item, idx) => {
                    const tax = computeLineItemTax(item, isInterState);
                    const rowTotal = tax.taxableValue + tax.cgstAmount + tax.sgstAmount + tax.igstAmount;
                    return (
                      <TableRow
                        key={item.id}
                        draggable={isEditable}
                        onDragStart={() => setDragIndex(idx)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          if (dragIndex === null) return;
                          reorderLineItems(dragIndex, idx);
                          setDragIndex(null);
                        }}
                        className="align-top"
                      >
                        <TableCell className="w-10">
                          <div className="flex items-center gap-2">
                            <GripVertical className="h-4 w-4 text-muted-foreground" />
                            {idx + 1}
                          </div>
                        </TableCell>
                        <TableCell className="min-w-48">
                          <Input
                            value={item.description}
                            disabled={!isEditable}
                            onChange={(e) => updateLineItem(item.id, { description: e.target.value })}
                          />
                        </TableCell>
                        <TableCell className="min-w-28">
                          <Input
                            list="hsn-codes"
                            value={item.hsn}
                            disabled={!isEditable}
                            onChange={(e) => handleHsnChange(item.id, e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="min-w-20">
                          <Input
                            type="number"
                            value={item.quantity}
                            disabled={!isEditable}
                            onChange={(e) => updateLineItem(item.id, { quantity: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="min-w-20">
                          <Select
                            value={item.unit}
                            disabled={!isEditable}
                            onChange={(e) => updateLineItem(item.id, { unit: e.target.value as LineItem["unit"] })}
                          >
                            <option value="NOS">NOS</option>
                            <option value="KGS">KGS</option>
                            <option value="MTR">MTR</option>
                            <option value="LTR">LTR</option>
                            <option value="HRS">HRS</option>
                            <option value="PCS">PCS</option>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-24">
                          <Input
                            type="number"
                            value={item.unitPrice}
                            disabled={!isEditable}
                            onChange={(e) => updateLineItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        <TableCell className="min-w-28">
                          <div className="grid grid-cols-[1fr_84px] gap-1">
                            <Input
                              type="number"
                              value={item.discount}
                              disabled={!isEditable}
                              onChange={(e) => updateLineItem(item.id, { discount: Number(e.target.value) || 0 })}
                            />
                            <Select
                              value={item.discountType}
                              disabled={!isEditable}
                              onChange={(e) =>
                                updateLineItem(item.id, { discountType: e.target.value as LineItem["discountType"] })
                              }
                            >
                              <option value="flat">Flat</option>
                              <option value="percent">%</option>
                            </Select>
                          </div>
                        </TableCell>
                        <TableCell>{MONEY.format(tax.taxableValue)}</TableCell>
                        <TableCell className="min-w-20">
                          <Input
                            type="number"
                            value={item.gstRate}
                            disabled={!isEditable}
                            onChange={(e) => updateLineItem(item.id, { gstRate: Number(e.target.value) || 0 })}
                          />
                        </TableCell>
                        {isInterState ? (
                          <TableCell>{MONEY.format(tax.igstAmount)}</TableCell>
                        ) : (
                          <>
                            <TableCell>{MONEY.format(tax.cgstAmount)}</TableCell>
                            <TableCell>{MONEY.format(tax.sgstAmount)}</TableCell>
                          </>
                        )}
                        <TableCell className="font-medium">{MONEY.format(rowTotal)}</TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={!isEditable}
                            onClick={() => removeLineItem(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {fieldIssues("lineItems").map((issue, idx) => (
                <p key={`lineitems-${idx}`} className="mt-2 text-xs text-rose-600">
                  {issue.message}
                </p>
              ))}
              {validationIssues
                .filter((issue) => issue.field.includes(".hsn"))
                .slice(0, 3)
                .map((issue, idx) => (
                  <p key={`hsn-warning-${idx}`} className="mt-1 text-xs text-amber-700">
                    {issue.message}
                  </p>
                ))}
              <datalist id="hsn-codes">
                {HSN_CODES.map((code) => (
                  <option key={code.code} value={code.code}>
                    {code.description}
                  </option>
                ))}
              </datalist>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="cursor-pointer" onClick={() => setShowCharges((prev) => !prev)}>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Section 5 - Additional Charges</CardTitle>
                {showCharges ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </CardHeader>
            {showCharges ? (
              <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Freight / Shipping</p>
                  <Input
                    type="number"
                    value={form.charges.freight.amount}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, freight: { ...prev.charges.freight, amount: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                  <Input
                    type="number"
                    className="mt-2"
                    value={form.charges.freight.gstRate}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, freight: { ...prev.charges.freight, gstRate: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                </div>
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Packing</p>
                  <Input
                    type="number"
                    value={form.charges.packing.amount}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, packing: { ...prev.charges.packing, amount: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                  <Input
                    type="number"
                    className="mt-2"
                    value={form.charges.packing.gstRate}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, packing: { ...prev.charges.packing, gstRate: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                </div>
                <div className="rounded-md border p-3">
                  <p className="mb-2 text-sm font-medium">Other</p>
                  <Input
                    type="number"
                    value={form.charges.other.amount}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, other: { ...prev.charges.other, amount: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                  <Input
                    type="number"
                    className="mt-2"
                    value={form.charges.other.gstRate}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        charges: { ...prev.charges, other: { ...prev.charges.other, gstRate: Number(e.target.value) || 0 } },
                      }))
                    }
                  />
                </div>
              </CardContent>
            ) : null}
          </Card>

          {showEWaySection ? (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowEWay((prev) => !prev)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Section 6 - E-Way Bill Fields</CardTitle>
                  {showEWay ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
              {showEWay ? (
                <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {fieldIssues("eWayBill").map((issue, idx) => (
                    <p key={`eway-${idx}`} className="md:col-span-2 xl:col-span-3 text-xs text-amber-700">
                      {issue.message}
                    </p>
                  ))}
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">E-Way Bill Number</p>
                    <Input
                      value={form.eway.eWayBillNumber}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, eWayBillNumber: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">E-Way Bill Date</p>
                    <Input
                      type="date"
                      value={form.eway.eWayBillDate}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, eWayBillDate: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Transporter Name</p>
                    <Input
                      value={form.eway.transporterName}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, transporterName: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Transporter ID (GSTIN)</p>
                    <Input
                      value={form.eway.transporterId}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, transporterId: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Vehicle Number</p>
                    <Input
                      value={form.eway.vehicleNumber}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, vehicleNumber: e.target.value } }))}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Transport Mode</p>
                    <Select
                      value={form.eway.transportMode}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, transportMode: e.target.value as "ROAD" | "RAIL" | "AIR" | "SHIP" } }))}
                    >
                      <option value="ROAD">ROAD</option>
                      <option value="RAIL">RAIL</option>
                      <option value="AIR">AIR</option>
                      <option value="SHIP">SHIP</option>
                    </Select>
                  </div>
                  <div>
                    <p className="mb-1 text-xs text-muted-foreground">Distance (km)</p>
                    <Input
                      type="number"
                      value={form.eway.distanceKm}
                      disabled={!isEditable}
                      onChange={(e) => setForm((prev) => ({ ...prev, eway: { ...prev.eway, distanceKm: Number(e.target.value) || 0 } }))}
                    />
                  </div>
                </CardContent>
              ) : null}
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Section 7 - Notes, Terms & Bank Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Notes</p>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.notes}
                  disabled={!isEditable}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div>
                <p className="mb-1 text-xs text-muted-foreground">Terms and Conditions</p>
                <textarea
                  className="min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={form.terms}
                  disabled={!isEditable}
                  onChange={(e) => setForm((prev) => ({ ...prev, terms: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Bank Name</p>
                  <Input
                    value={form.seller.bankName}
                    disabled={!isEditable}
                    onChange={(e) => setForm((prev) => ({ ...prev, seller: { ...prev.seller, bankName: e.target.value } }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">Account Number</p>
                  <Input
                    value={form.seller.accountNumber}
                    disabled={!isEditable}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, seller: { ...prev.seller, accountNumber: e.target.value } }))
                    }
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">IFSC</p>
                  <Input
                    value={form.seller.ifsc}
                    disabled={!isEditable}
                    onChange={(e) => setForm((prev) => ({ ...prev, seller: { ...prev.seller, ifsc: e.target.value } }))}
                  />
                </div>
                <div>
                  <p className="mb-1 text-xs text-muted-foreground">UPI ID</p>
                  <Input
                    value={form.seller.upiId}
                    disabled={!isEditable}
                    onChange={(e) => setForm((prev) => ({ ...prev, seller: { ...prev.seller, upiId: e.target.value } }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Live Summary</CardTitle>
                <Badge variant="secondary">{supplyType}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {isInterState ? "Inter-State: IGST applicable" : "Intra-State: CGST + SGST applicable"}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{MONEY.format(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount Total</span>
                <span>- {MONEY.format(discountTotal)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Taxable Value</span>
                <span>{MONEY.format(totals.taxableValue)}</span>
              </div>
              <div className="space-y-1 rounded-md border p-2">
                {taxByRate.map(([rate, value]) =>
                  isInterState ? (
                    <div key={`igst-${rate}`} className="flex justify-between text-xs">
                      <span>IGST @ {rate}%</span>
                      <span>{MONEY.format(value.igst)}</span>
                    </div>
                  ) : (
                    <div key={`cgst-sgst-${rate}`} className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>CGST @ {rate / 2}%</span>
                        <span>{MONEY.format(value.cgst)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>SGST @ {rate / 2}%</span>
                        <span>{MONEY.format(value.sgst)}</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="flex justify-between border-t pt-2 text-lg font-semibold">
                <span>Grand Total</span>
                <span>{MONEY.format(totals.grandTotal)}</span>
              </div>
              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-muted-foreground">{amountInWords(totals.grandTotal)}</p>
              <div className="grid grid-cols-1 gap-2 pt-2">
                <Button onClick={() => saveInvoice(false)} disabled={!isEditable}>
                  Save Draft
                </Button>
                <Button variant="secondary" onClick={requestFinalize} disabled={!isEditable}>
                  Finalize & Issue
                </Button>
                {existing ? (
                  <Button variant="outline" asChild>
                    <Link to={`/admin/billing/${existing.id}/preview`}>
                      <Link2 className="mr-2 h-4 w-4" />
                      Preview
                    </Link>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showValidationModal} onOpenChange={setShowValidationModal}>
        <DialogOverlay />
        <DialogContent className="w-[min(94vw,42rem)]">
          <DialogHeader>
            <DialogTitle>Invoice Validation Summary</DialogTitle>
            <DialogDescription>Resolve errors and acknowledge warnings before finalizing this invoice.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border bg-slate-50 p-3 text-sm">
              <p>
                Errors: <span className="font-semibold text-rose-700">{errorIssues.length}</span>
              </p>
              <p>
                Warnings: <span className="font-semibold text-amber-700">{warningIssues.length}</span>
              </p>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto rounded-md border p-3 text-sm">
              {validationIssues.length === 0 ? <p className="text-emerald-700">No validation issues found.</p> : null}
              {validationIssues.map((issue, idx) => (
                <div key={`${issue.field}-${idx}`} className="rounded-md border px-3 py-2">
                  <p className={cn("text-xs font-medium uppercase", issue.severity === "error" ? "text-rose-700" : "text-amber-700")}>
                    {issue.severity}
                  </p>
                  <p className="font-medium">{issue.message}</p>
                  <p className="text-xs text-muted-foreground">Field: {issue.field}</p>
                </div>
              ))}
            </div>
            {warningIssues.length > 0 ? (
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={ackWarnings} onChange={(e) => setAckWarnings(e.target.checked)} />
                I acknowledge all warnings and want to finalize anyway.
              </label>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowValidationModal(false)}>
              Cancel
            </Button>
            <Button onClick={confirmFinalize} disabled={errorIssues.length > 0 || (warningIssues.length > 0 && !ackWarnings)}>
              Finalize Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
