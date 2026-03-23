import { createContext, createElement, useContext, useMemo, useState, type PropsWithChildren } from "react";
import type {
  BusinessProfile,
  Invoice,
  InvoiceStatus,
  InvoiceType,
  LineItem,
  Party,
  Payment,
  PurchaseITCEntry,
} from "../data/billing";
import {
  computeInvoiceTotalsForProfile,
  computeIsInterState,
  generateInvoiceNumber,
  getCurrentFinancialYear,
  normalizeLineItemTaxCode,
} from "./gst";
import { attachMockEInvoice } from "./mockEInvoice";

type InvoiceSequences = Record<string, Record<string, number>>;

type CreateInvoiceInput = Omit<
  Invoice,
  | "id"
  | "invoiceNumber"
  | "taxBreakdown"
  | "isInterState"
  | "paymentHistory"
  | "amountPaid"
  | "balanceDue"
  | "createdAt"
  | "updatedAt"
  | "financialYear"
>;

type BillingStoreValue = {
  invoices: Invoice[];
  parties: Party[];
  businessProfile: BusinessProfile;
  payments: Payment[];
  purchaseItcEntries: PurchaseITCEntry[];
  invoiceSequences: InvoiceSequences;
  getInvoicePaymentMeta: (invoice: Invoice, today?: Date) => { isOverdue: boolean; displayStatus: InvoiceStatus };
  createInvoice: (invoice: CreateInvoiceInput) => Invoice;
  updateInvoice: (invoice: Invoice) => void;
  finalizeInvoice: (invoiceId: string) => void;
  cancelInvoice: (invoiceId: string) => void;
  addPayment: (payment: Omit<Payment, "id"> & { id?: string }) => void;
  saveParty: (party: Party) => void;
  updateBusinessProfile: (profile: BusinessProfile) => void;
  getNextSequence: (type: InvoiceType, financialYear: string) => number;
  addPurchaseItcEntry: (entry: Omit<PurchaseITCEntry, "id"> & { id?: string }) => PurchaseITCEntry;
  updatePurchaseItcEntry: (entry: PurchaseITCEntry) => void;
  removePurchaseItcEntry: (entryId: string) => void;
};

const BillingStoreContext = createContext<BillingStoreValue | null>(null);

const DEFAULT_BUSINESS_PROFILE: BusinessProfile = {
  gstRegistrationStatus: "UNREGISTERED",
  gstin: "",
  legalName: "ABC Enterprises",
  tradeName: "ABC Enterprises",
  businessType: "PROPRIETORSHIP",
  businessScale: "SMALL",
  businessCategory: "BOTH",
  priceDisplayMode: "INCLUSIVE",
  financialYearStartMonth: "APRIL",
  address: "",
  addressLine2: "",
  city: "",
  state: "Maharashtra",
  stateCode: "27",
  pincode: "",
  pan: "",
  compositionScheme: false,
  registrationType: undefined,
  email: "",
  phone: "",
  bankName: "",
  accountNumber: "",
  ifsc: "",
  branch: "",
  accountType: "CURRENT",
  upiId: "",
  defaultPaymentTermDays: 15,
  defaultNotes: "",
  defaultTerms: "",
  invoicePrefix: "INV",
  startingSequenceNumber: 1,
  setupComplete: false,
  signatureUrl: "",
};

const SEED_BUSINESS_PROFILE: BusinessProfile = {
  gstRegistrationStatus: "REGISTERED",
  gstin: "27AAECS1234F1Z5",
  legalName: "ABC Enterprises",
  tradeName: "ABC Enterprises",
  businessType: "PRIVATE_LIMITED",
  businessScale: "ESTABLISHED",
  businessCategory: "BOTH",
  priceDisplayMode: "EXCLUSIVE",
  financialYearStartMonth: "APRIL",
  address: "Unit 14, Saki Vihar Road, Andheri East",
  addressLine2: "Near Powai Lake",
  city: "Mumbai",
  state: "Maharashtra",
  stateCode: "27",
  pincode: "400072",
  pan: "AAECS1234F",
  compositionScheme: false,
  registrationType: "REGULAR",
  email: "accounts@sampurnahome.in",
  phone: "+91-22-4101-5500",
  bankName: "HDFC Bank",
  accountNumber: "50200012345678",
  ifsc: "HDFC0001023",
  branch: "Andheri East",
  accountType: "CURRENT",
  upiId: "sampurna@hdfcbank",
  defaultPaymentTermDays: 15,
  defaultNotes: "Goods once sold will not be taken back unless damaged in transit.",
  defaultTerms: "Payment due within 15 days from issue date.",
  invoicePrefix: "INV",
  startingSequenceNumber: 1,
  setupComplete: true,
  signatureUrl: "https://example.com/signatures/sampurna-authorized-signatory.png",
};

const INITIAL_PARTIES: Party[] = [
  {
    id: "pty-royal-retail",
    name: "Royal Retail India LLP",
    gstin: "27AAKFR1122G1Z8",
    pan: "AAKFR1122G",
    address: "Shop 8, Phoenix Marketcity, Kurla West",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "400070",
    email: "procurement@royalretail.in",
    phone: "+91-22-4850-0099",
    isRegistered: true,
  },
  {
    id: "pty-neelam-kitchens",
    name: "Neelam Kitchens",
    gstin: "24AZKPN8899D1Z6",
    pan: "AZKPN8899D",
    address: "B-19, Satellite Road",
    city: "Ahmedabad",
    state: "Gujarat",
    stateCode: "24",
    pincode: "380015",
    email: "accounts@neelamkitchens.com",
    phone: "+91-79-4011-2400",
    isRegistered: true,
  },
  {
    id: "pty-lotus-lights",
    name: "Lotus Lights & Decor",
    gstin: "29AABCL7788R1Z7",
    pan: "AABCL7788R",
    address: "No. 22, Richmond Road",
    city: "Bengaluru",
    state: "Karnataka",
    stateCode: "29",
    pincode: "560025",
    email: "finance@lotuslights.in",
    phone: "+91-80-4490-1255",
    isRegistered: true,
  },
  {
    id: "pty-south-boutique",
    name: "Southline Boutique Hotel",
    gstin: "33AALCS5566K1Z4",
    pan: "AALCS5566K",
    address: "No. 3, Cathedral Road",
    city: "Chennai",
    state: "Tamil Nadu",
    stateCode: "33",
    pincode: "600086",
    email: "purchase@southlinehotel.com",
    phone: "+91-44-4022-8800",
    isRegistered: true,
  },
  {
    id: "pty-kokila-residency",
    name: "Kokila Residency",
    pan: "BLQPP9911R",
    address: "17, JM Road",
    city: "Pune",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "411004",
    email: "owner@kokilaresidency.com",
    phone: "+91-20-4907-1120",
    isRegistered: false,
  },
  {
    id: "pty-aarav-home",
    name: "Aarav Home Essentials",
    pan: "BJCPA3412M",
    address: "44, Link Road",
    city: "Mumbai",
    state: "Maharashtra",
    stateCode: "27",
    pincode: "400053",
    email: "orders@aaravhome.com",
    phone: "+91-22-4910-7788",
    isRegistered: false,
  },
  {
    id: "pty-raghav-villa",
    name: "Raghav Villa Projects",
    pan: "AQJPR1188L",
    address: "8, Golf Course Road",
    city: "Gurugram",
    state: "Haryana",
    stateCode: "06",
    pincode: "122002",
    email: "finance@raghavvilla.in",
    phone: "+91-124-490-1515",
    isRegistered: false,
  },
  {
    id: "pty-jaya-homes",
    name: "Jaya Homes",
    pan: "ADQPS6632C",
    address: "22, Jubilee Hills",
    city: "Hyderabad",
    state: "Telangana",
    stateCode: "36",
    pincode: "500033",
    email: "jaya.homes@gmail.com",
    phone: "+91-40-4900-8300",
    isRegistered: false,
  },
];

const makeLineItem = (
  id: string,
  description: string,
  hsn: string,
  quantity: number,
  unitPrice: number,
  gstRate: number,
  discount = 0,
  isService = false,
): LineItem => ({
  id,
  description,
  hsn,
  taxCode: hsn,
  taxCodeType: isService ? "SAC" : "HSN",
  taxCodeSource: "CATALOG",
  gstRateSource: "CATALOG",
  quantity,
  unit: "NOS",
  unitPrice,
  discount,
  discountType: "flat",
  gstRate,
  isService,
});

const toPaymentStatus = (amountPaid: number, grandTotal: number): InvoiceStatus => {
  if (amountPaid <= 0) return "FINALIZED";
  if (amountPaid >= grandTotal) return "PAID";
  return "PARTIALLY_PAID";
};

const buildInvoice = (args: {
  id: string;
  issueDate: string;
  dueDate: string;
  supplyDate: string;
  type: InvoiceType;
  sequence: number;
  status: InvoiceStatus;
  buyer: Party;
  lineItems: LineItem[];
  notes?: string;
  linkedInvoiceId?: string;
  amountPaid?: number;
  seller?: BusinessProfile;
  customerId?: string;
  orderId?: string;
}): Invoice => {
  const financialYear = getCurrentFinancialYear(args.issueDate);
  const seller = args.seller ?? SEED_BUSINESS_PROFILE;
  const isInterState = computeIsInterState(seller.stateCode, args.buyer.stateCode);
  const normalizedLineItems = args.lineItems.map((item) => normalizeLineItemTaxCode(item));
  const taxBreakdown = computeInvoiceTotalsForProfile(normalizedLineItems, isInterState, seller);
  const amountPaid = Math.min(args.amountPaid ?? 0, taxBreakdown.grandTotal);
  const status =
    args.status === "FINALIZED" && amountPaid > 0 ? toPaymentStatus(amountPaid, taxBreakdown.grandTotal) : args.status;

  return {
    id: args.id,
    invoiceNumber: generateInvoiceNumber(args.type, financialYear, args.sequence),
    type: args.type,
    status,
    issueDate: args.issueDate,
    dueDate: args.dueDate,
    supplyDate: args.supplyDate,
    seller,
    buyer: args.buyer,
    lineItems: normalizedLineItems,
    taxBreakdown,
    isInterState,
    isRCM: false,
    placeOfSupply: args.buyer.state,
    customerId: args.customerId,
    orderId: args.orderId,
    notes: args.notes ?? "",
    terms: "Payment due within 15 days from issue date.",
    linkedInvoiceId: args.linkedInvoiceId,
    paymentHistory: [],
    amountPaid,
    balanceDue: Math.max(0, Number((taxBreakdown.grandTotal - amountPaid).toFixed(2))),
    createdAt: `${args.issueDate}T10:00:00.000Z`,
    updatedAt: `${args.issueDate}T10:00:00.000Z`,
    financialYear,
  };
};

const findParty = (id: string): Party => {
  const party = INITIAL_PARTIES.find((item) => item.id === id);
  if (!party) {
    throw new Error(`Unknown party id: ${id}`);
  }
  return party;
};

const DEMO_RECORDED_LINKS: Record<string, { customerId: string; orderId: string }> = {
  "inv-001": { customerId: "cus_9001", orderId: "ord_5001" },
  "inv-002": { customerId: "cus_9002", orderId: "ord_5002" },
  "inv-003": { customerId: "cus_9003", orderId: "ord_5003" },
  "inv-004": { customerId: "cus_9004", orderId: "ord_5004" },
  "inv-005": { customerId: "cus_9005", orderId: "ord_5005" },
  "inv-006": { customerId: "cus_9006", orderId: "ord_5006" },
  "inv-007": { customerId: "cus_9007", orderId: "ord_5007" },
  "inv-008": { customerId: "cus_9008", orderId: "ord_5008" },
  "inv-009": { customerId: "cus_9009", orderId: "ord_5009" },
  "inv-010": { customerId: "cus_9010", orderId: "ord_5010" },
  "inv-011": { customerId: "cus_9011", orderId: "ord_5011" },
  "inv-012": { customerId: "cus_9012", orderId: "ord_5012" },
};

const SEED_INVOICES: Invoice[] = [
  buildInvoice({
    id: "inv-001",
    issueDate: "2025-04-05",
    dueDate: "2025-04-20",
    supplyDate: "2025-04-05",
    type: "TAX_INVOICE",
    sequence: 1,
    status: "PAID",
    buyer: findParty("pty-royal-retail"),
    ...DEMO_RECORDED_LINKS["inv-001"],
    lineItems: [
      makeLineItem("li-1", "Solid Wood Console Table", "9403", 4, 18500, 18),
      makeLineItem("li-2", "Handcrafted Table Lamp", "9405", 10, 2200, 12, 500),
    ],
    amountPaid: 115640,
  }),
  buildInvoice({
    id: "inv-002",
    issueDate: "2025-04-14",
    dueDate: "2025-04-29",
    supplyDate: "2025-04-14",
    type: "TAX_INVOICE",
    sequence: 2,
    status: "PARTIALLY_PAID",
    buyer: findParty("pty-neelam-kitchens"),
    ...DEMO_RECORDED_LINKS["inv-002"],
    lineItems: [
      makeLineItem("li-3", "Steel Cookware Set (12 pcs)", "7323", 18, 3250, 18),
      makeLineItem("li-4", "Glass Serving Bowls", "7013", 24, 780, 18),
    ],
    amountPaid: 50000,
  }),
  buildInvoice({
    id: "inv-003",
    issueDate: "2025-05-02",
    dueDate: "2025-05-17",
    supplyDate: "2025-05-02",
    type: "TAX_INVOICE",
    sequence: 3,
    status: "FINALIZED",
    buyer: findParty("pty-lotus-lights"),
    ...DEMO_RECORDED_LINKS["inv-003"],
    lineItems: [
      makeLineItem("li-5", "Pendant Lighting Cluster", "9405", 12, 5400, 12),
      makeLineItem("li-6", "Decorative Wall Mirror", "7009", 8, 4300, 18),
    ],
  }),
  buildInvoice({
    id: "inv-004",
    issueDate: "2025-05-28",
    dueDate: "2025-06-05",
    supplyDate: "2025-05-28",
    type: "TAX_INVOICE",
    sequence: 4,
    status: "OVERDUE",
    buyer: findParty("pty-south-boutique"),
    ...DEMO_RECORDED_LINKS["inv-004"],
    lineItems: [
      makeLineItem("li-7", "Premium Room Linen Pack", "6302", 60, 950, 5),
      makeLineItem("li-8", "Bathroom Accessories Set", "3924", 36, 1650, 18),
    ],
    amountPaid: 12000,
  }),
  buildInvoice({
    id: "inv-005",
    issueDate: "2025-06-08",
    dueDate: "2025-06-23",
    supplyDate: "2025-06-08",
    type: "TAX_INVOICE",
    sequence: 5,
    status: "PAID",
    buyer: findParty("pty-kokila-residency"),
    ...DEMO_RECORDED_LINKS["inv-005"],
    lineItems: [
      makeLineItem("li-9", "Sofa Set - 3+2", "9403", 3, 46500, 18),
      makeLineItem("li-10", "Indoor Rugs", "5703", 10, 3200, 12),
    ],
    amountPaid: 205910,
  }),
  buildInvoice({
    id: "inv-006",
    issueDate: "2025-07-11",
    dueDate: "2025-07-26",
    supplyDate: "2025-07-11",
    type: "TAX_INVOICE",
    sequence: 6,
    status: "FINALIZED",
    buyer: findParty("pty-aarav-home"),
    ...DEMO_RECORDED_LINKS["inv-006"],
    lineItems: [
      makeLineItem("li-11", "Kitchen Organizer Combo", "7323", 55, 890, 18),
      makeLineItem("li-12", "Storage Baskets", "3924", 70, 420, 18),
    ],
  }),
  buildInvoice({
    id: "inv-007",
    issueDate: "2025-08-03",
    dueDate: "2025-08-18",
    supplyDate: "2025-08-03",
    type: "TAX_INVOICE",
    sequence: 7,
    status: "PARTIALLY_PAID",
    buyer: findParty("pty-raghav-villa"),
    ...DEMO_RECORDED_LINKS["inv-007"],
    lineItems: [
      makeLineItem("li-13", "Custom Wardrobe Units", "9403", 15, 28000, 18),
      makeLineItem("li-14", "Modular Kitchen Pantry", "9403", 8, 42000, 18),
    ],
    amountPaid: 300000,
  }),
  buildInvoice({
    id: "inv-008",
    issueDate: "2025-09-21",
    dueDate: "2025-10-06",
    supplyDate: "2025-09-21",
    type: "TAX_INVOICE",
    sequence: 8,
    status: "DRAFT",
    buyer: findParty("pty-jaya-homes"),
    ...DEMO_RECORDED_LINKS["inv-008"],
    lineItems: [
      makeLineItem("li-15", "Dining Table Set (8 seater)", "9403", 12, 36500, 18),
      makeLineItem("li-16", "Designer Ceiling Lights", "9405", 20, 7800, 12),
    ],
  }),
  buildInvoice({
    id: "inv-009",
    issueDate: "2025-10-10",
    dueDate: "2025-10-25",
    supplyDate: "2025-10-10",
    type: "TAX_INVOICE",
    sequence: 9,
    status: "CANCELLED",
    buyer: findParty("pty-aarav-home"),
    ...DEMO_RECORDED_LINKS["inv-009"],
    lineItems: [makeLineItem("li-17", "Office Storage Cabinets", "9403", 6, 21500, 18)],
  }),
  buildInvoice({
    id: "inv-010",
    issueDate: "2025-11-08",
    dueDate: "2025-11-08",
    supplyDate: "2025-11-08",
    type: "PROFORMA",
    sequence: 1,
    status: "DRAFT",
    buyer: findParty("pty-kokila-residency"),
    ...DEMO_RECORDED_LINKS["inv-010"],
    lineItems: [
      makeLineItem("li-18", "Complete Hotel Furniture Package", "9403", 11, 350000, 18),
      makeLineItem("li-19", "Lobby Chandeliers", "9405", 6, 115000, 12),
    ],
  }),
  buildInvoice({
    id: "inv-011",
    issueDate: "2025-12-01",
    dueDate: "2025-12-01",
    supplyDate: "2025-12-01",
    type: "CREDIT_NOTE",
    sequence: 1,
    status: "FINALIZED",
    buyer: findParty("pty-neelam-kitchens"),
    ...DEMO_RECORDED_LINKS["inv-011"],
    lineItems: [makeLineItem("li-20", "Rate Difference Adjustment", "9961", 1, 15000, 18, 0, true)],
    linkedInvoiceId: "inv-002",
    notes: "Credit note issued for damaged cookware batch return.",
  }),
  buildInvoice({
    id: "inv-012",
    issueDate: "2026-01-10",
    dueDate: "2026-01-10",
    supplyDate: "2026-01-10",
    type: "DEBIT_NOTE",
    sequence: 1,
    status: "FINALIZED",
    buyer: findParty("pty-royal-retail"),
    ...DEMO_RECORDED_LINKS["inv-012"],
    lineItems: [makeLineItem("li-21", "Freight and Packing Recovery", "9965", 1, 8500, 18, 0, true)],
    linkedInvoiceId: "inv-001",
    notes: "Debit note raised toward additional logistics charge.",
  }),
];

const initialPayments: Payment[] = [
  {
    id: "pay-001",
    invoiceId: "inv-001",
    customerId: "cus_9001",
    orderId: "ord_5001",
    date: "2025-04-10",
    amount: 115640,
    mode: "BANK_TRANSFER",
    reference: "UTR9283471001",
    notes: "Full settlement",
  },
  {
    id: "pay-002",
    invoiceId: "inv-002",
    customerId: "cus_9002",
    orderId: "ord_5002",
    date: "2025-04-25",
    amount: 50000,
    mode: "UPI",
    reference: "UPI202504250099",
    notes: "Advance against invoice",
  },
  {
    id: "pay-003",
    invoiceId: "inv-004",
    customerId: "cus_9004",
    orderId: "ord_5004",
    date: "2025-06-03",
    amount: 12000,
    mode: "CHEQUE",
    reference: "CHQ557311",
    notes: "Part payment",
  },
  {
    id: "pay-004",
    invoiceId: "inv-005",
    customerId: "cus_9005",
    orderId: "ord_5005",
    date: "2025-06-20",
    amount: 205910,
    mode: "BANK_TRANSFER",
    reference: "UTR9283471458",
    notes: "Full settlement",
  },
  {
    id: "pay-005",
    invoiceId: "inv-007",
    customerId: "cus_9007",
    orderId: "ord_5007",
    date: "2025-08-15",
    amount: 300000,
    mode: "BANK_TRANSFER",
    reference: "UTR6734500199",
    notes: "Milestone payment",
  },
];

const SEED_PURCHASE_ITC_ENTRIES: PurchaseITCEntry[] = [
  {
    id: "itc-001",
    supplierName: "Global Packaging Supplies",
    gstin: "27AABCG1122H1Z3",
    invoiceNumber: "PUR/2025-26/001",
    invoiceDate: "2025-04-18",
    placeOfSupply: "Maharashtra",
    hsn: "9985",
    taxCodeType: "SAC",
    taxableValue: 42000,
    igst: 0,
    cgst: 3780,
    sgst: 3780,
    cess: 0,
    notes: "Packaging services for April outbound dispatches.",
  },
  {
    id: "itc-002",
    supplierName: "Transit Logistics Pvt Ltd",
    gstin: "27AAFCT3344K1Z7",
    invoiceNumber: "PUR/2025-26/002",
    invoiceDate: "2025-05-11",
    placeOfSupply: "Maharashtra",
    hsn: "9965",
    taxCodeType: "SAC",
    taxableValue: 88000,
    igst: 0,
    cgst: 7920,
    sgst: 7920,
    cess: 0,
    notes: "Freight credit captured from inbound logistics invoices.",
  },
];

const INVOICE_SEQUENCES: InvoiceSequences = {
  TAX_INVOICE: { "2025-26": 9 },
  PROFORMA: { "2025-26": 1 },
  CREDIT_NOTE: { "2025-26": 1 },
  DEBIT_NOTE: { "2025-26": 1 },
};

const BUSINESS_PROFILE_STORAGE_KEY = "demo-ecom.businessProfile";
const PURCHASE_ITC_STORAGE_KEY = "demo-ecom.purchaseItcEntries";

const readStoredBusinessProfile = (): BusinessProfile | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(BUSINESS_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BusinessProfile>;
    return {
      ...DEFAULT_BUSINESS_PROFILE,
      ...parsed,
      gstRegistrationStatus: parsed.gstRegistrationStatus ?? DEFAULT_BUSINESS_PROFILE.gstRegistrationStatus,
      setupComplete: Boolean(parsed.setupComplete),
    };
  } catch {
    return null;
  }
};

const writeStoredBusinessProfile = (profile: BusinessProfile) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BUSINESS_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage failures in demo mode.
  }
};

const readStoredPurchaseItcEntries = (): PurchaseITCEntry[] | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PURCHASE_ITC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PurchaseITCEntry[] | null;
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeStoredPurchaseItcEntries = (entries: PurchaseITCEntry[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PURCHASE_ITC_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage failures in demo mode.
  }
};

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const parseDate = (value: string): Date => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const deriveInvoicePaymentMeta = (
  invoice: Pick<Invoice, "status" | "dueDate" | "amountPaid" | "balanceDue">,
  today = new Date(),
): { isOverdue: boolean; displayStatus: InvoiceStatus } => {
  if (invoice.status === "CANCELLED" || invoice.status === "DRAFT") {
    return { isOverdue: false, displayStatus: invoice.status };
  }

  if (invoice.balanceDue <= 0) {
    return { isOverdue: false, displayStatus: "PAID" };
  }

  const overdue = startOfDay(parseDate(invoice.dueDate)).getTime() < startOfDay(today).getTime();
  if (overdue) return { isOverdue: true, displayStatus: "OVERDUE" };
  if (invoice.amountPaid > 0) return { isOverdue: false, displayStatus: "PARTIALLY_PAID" };
  return { isOverdue: false, displayStatus: "FINALIZED" };
};

export function BillingStoreProvider({ children }: PropsWithChildren) {
  const [invoices, setInvoices] = useState<Invoice[]>(
    SEED_INVOICES.map((invoice) => {
      const payments = initialPayments.filter((payment) => payment.invoiceId === invoice.id);
      const amountPaid = Number(payments.reduce((sum, payment) => sum + payment.amount, 0).toFixed(2));
      const balanceDue = Math.max(0, Number((invoice.taxBreakdown.grandTotal - amountPaid).toFixed(2)));
      const { displayStatus } = deriveInvoicePaymentMeta(
        {
          status: invoice.status,
          dueDate: invoice.dueDate,
          amountPaid,
          balanceDue,
        },
        new Date(),
      );

      return {
        ...attachMockEInvoice({
          ...invoice,
          paymentHistory: payments,
          amountPaid,
          balanceDue,
          status: displayStatus,
        }),
        status: displayStatus,
        paymentHistory: payments,
        amountPaid,
        balanceDue,
      };
    }),
  );
  const [parties, setParties] = useState<Party[]>(INITIAL_PARTIES);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile>(() => readStoredBusinessProfile() ?? DEFAULT_BUSINESS_PROFILE);
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [purchaseItcEntries, setPurchaseItcEntries] = useState<PurchaseITCEntry[]>(
    () => readStoredPurchaseItcEntries() ?? SEED_PURCHASE_ITC_ENTRIES,
  );
  const [invoiceSequences, setInvoiceSequences] = useState<InvoiceSequences>(INVOICE_SEQUENCES);

  const value = useMemo<BillingStoreValue>(
    () => ({
      invoices,
      parties,
      businessProfile,
      payments,
      purchaseItcEntries,
      invoiceSequences,
      getInvoicePaymentMeta: (invoice, today = new Date()) =>
        deriveInvoicePaymentMeta(
          {
            status: invoice.status,
            dueDate: invoice.dueDate,
            amountPaid: invoice.amountPaid,
            balanceDue: invoice.balanceDue,
          },
          today,
        ),
      getNextSequence: (type, financialYear) => {
        let next = 1;
        setInvoiceSequences((prev) => {
          const typeSequences = prev[type] ?? {};
          const current = typeSequences[financialYear] ?? 0;
          next = current + 1;
          return {
            ...prev,
            [type]: {
              ...typeSequences,
              [financialYear]: next,
            },
          };
        });
        return next;
      },
      createInvoice: (invoice) => {
        const id = `inv-${Date.now().toString(36)}`;
        const nowIso = new Date().toISOString();
        const financialYear = getCurrentFinancialYear(invoice.issueDate);
        const nextSequence = (invoiceSequences[invoice.type]?.[financialYear] ?? 0) + 1;

        setInvoiceSequences((prev) => ({
          ...prev,
          [invoice.type]: {
            ...(prev[invoice.type] ?? {}),
            [financialYear]: nextSequence,
          },
        }));

        const normalizedLineItems = invoice.lineItems.map((item) => normalizeLineItemTaxCode(item));
        const isInterState = computeIsInterState(invoice.seller.stateCode, invoice.buyer.stateCode);
        const taxBreakdown = computeInvoiceTotalsForProfile(normalizedLineItems, isInterState, invoice.seller);
        const created: Invoice = {
          ...invoice,
          id,
          invoiceNumber: generateInvoiceNumber(invoice.type, financialYear, nextSequence),
          financialYear,
          taxBreakdown,
          isInterState,
          lineItems: normalizedLineItems,
          paymentHistory: [],
          amountPaid: 0,
          balanceDue: taxBreakdown.grandTotal,
          createdAt: nowIso,
          updatedAt: nowIso,
          seller: invoice.seller,
        };

        setInvoices((prev) => [created, ...prev]);
        return created;
      },
      updateInvoice: (invoice) => {
        setInvoices((prev) =>
          prev.map((existing) => {
            if (existing.id !== invoice.id) return existing;
            if (existing.status !== "DRAFT") return existing;

            const normalizedLineItems = invoice.lineItems.map((item) => normalizeLineItemTaxCode(item));
            const isInterState = computeIsInterState(invoice.seller.stateCode, invoice.buyer.stateCode);
            const taxBreakdown = computeInvoiceTotalsForProfile(normalizedLineItems, isInterState, invoice.seller);
            return {
              ...invoice,
              lineItems: normalizedLineItems,
              isInterState,
              taxBreakdown,
              balanceDue: Math.max(0, Number((taxBreakdown.grandTotal - existing.amountPaid).toFixed(2))),
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      },
      finalizeInvoice: (invoiceId) => {
        setInvoices((prev) =>
          prev.map((invoice) => {
            if (invoice.id !== invoiceId || invoice.status !== "DRAFT") return invoice;
            return attachMockEInvoice({
              ...invoice,
              status: "FINALIZED",
              updatedAt: new Date().toISOString(),
            });
          }),
        );
      },
      cancelInvoice: (invoiceId) => {
        setInvoices((prev) =>
          prev.map((invoice) => {
            if (invoice.id !== invoiceId || invoice.status === "CANCELLED") return invoice;
            return {
              ...invoice,
              status: "CANCELLED",
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      },
      addPayment: (paymentInput) => {
        const sourceInvoice = invoices.find((invoice) => invoice.id === paymentInput.invoiceId);
        const payment: Payment = {
          ...paymentInput,
          id: paymentInput.id ?? `pay-${Date.now().toString(36)}`,
          customerId: paymentInput.customerId ?? sourceInvoice?.customerId,
          orderId: paymentInput.orderId ?? sourceInvoice?.orderId,
        };

        setPayments((prev) => [payment, ...prev]);
        setInvoices((prev) =>
          prev.map((invoice) => {
            if (invoice.id !== payment.invoiceId) return invoice;
            const amountPaid = Number((invoice.amountPaid + payment.amount).toFixed(2));
            const balanceDue = Math.max(0, Number((invoice.taxBreakdown.grandTotal - amountPaid).toFixed(2)));

            const { displayStatus } = deriveInvoicePaymentMeta(
              {
                status: invoice.status,
                dueDate: invoice.dueDate,
                amountPaid,
                balanceDue,
              },
              new Date(),
            );

            return {
              ...invoice,
              amountPaid,
              balanceDue,
              status: displayStatus,
              paymentHistory: [payment, ...invoice.paymentHistory],
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      },
      saveParty: (party) => {
        setParties((prev) => {
          const exists = prev.some((item) => item.id === party.id);
          if (exists) {
            return prev.map((item) => (item.id === party.id ? party : item));
          }
          return [party, ...prev];
        });
      },
      updateBusinessProfile: (profile) => {
        setBusinessProfile(profile);
        writeStoredBusinessProfile(profile);
      },
      addPurchaseItcEntry: (entryInput) => {
        const entry: PurchaseITCEntry = {
          ...entryInput,
          id: entryInput.id ?? `itc-${Date.now().toString(36)}`,
          hsn: entryInput.hsn?.trim().toUpperCase() || undefined,
        };
        setPurchaseItcEntries((prev) => {
          const next = [entry, ...prev.filter((item) => item.id !== entry.id)];
          writeStoredPurchaseItcEntries(next);
          return next;
        });
        return entry;
      },
      updatePurchaseItcEntry: (entry) => {
        setPurchaseItcEntries((prev) => {
          const next = prev.map((item) =>
            item.id === entry.id
              ? {
                  ...entry,
                  hsn: entry.hsn?.trim().toUpperCase() || undefined,
                }
              : item,
          );
          writeStoredPurchaseItcEntries(next);
          return next;
        });
      },
      removePurchaseItcEntry: (entryId) => {
        setPurchaseItcEntries((prev) => {
          const next = prev.filter((item) => item.id !== entryId);
          writeStoredPurchaseItcEntries(next);
          return next;
        });
      },
    }),
    [invoices, parties, businessProfile, payments, purchaseItcEntries, invoiceSequences],
  );

  return createElement(BillingStoreContext.Provider, { value }, children);
}

export function useBillingStore() {
  const context = useContext(BillingStoreContext);
  if (!context) {
    throw new Error("useBillingStore must be used within <BillingStoreProvider>.");
  }
  return context;
}
