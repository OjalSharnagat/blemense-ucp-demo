export type BusinessType = "PROPRIETORSHIP" | "PARTNERSHIP" | "PRIVATE_LIMITED" | "LLP" | "OTHER";
export type GSTRegistrationType = "REGULAR" | "COMPOSITION" | "CASUAL" | "SEZ";
export type GSTRegistrationStatus = "REGISTERED" | "UNREGISTERED";
export type BusinessScale = "FREELANCER" | "SMALL" | "GROWING" | "ESTABLISHED";
export type BusinessCategory = "GOODS" | "SERVICES" | "BOTH";
export type PriceDisplayMode = "INCLUSIVE" | "EXCLUSIVE";

export interface BusinessProfile {
  gstRegistrationStatus: GSTRegistrationStatus;
  gstin?: string;
  legalName: string;
  tradeName: string;
  businessType?: BusinessType;
  businessScale?: BusinessScale;
  businessCategory?: BusinessCategory;
  priceDisplayMode?: PriceDisplayMode;
  financialYearStartMonth?: "APRIL";
  address: string;
  addressLine2?: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  pan: string;
  compositionScheme?: boolean;
  registrationType?: GSTRegistrationType;
  email: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch?: string;
  accountType?: "SAVINGS" | "CURRENT" | "OVERDRAFT" | "OTHER";
  upiId: string;
  defaultPaymentTermDays?: 7 | 15 | 30 | 45 | 60;
  defaultNotes?: string;
  defaultTerms?: string;
  invoicePrefix?: string;
  startingSequenceNumber?: number;
  setupComplete?: boolean;
  signatureUrl: string;
}

export interface Party {
  id: string;
  name: string;
  gstin?: string;
  pan: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
  email: string;
  phone: string;
  isRegistered: boolean;
}

export type LineItemUnit = "NOS" | "KGS" | "MTR" | "LTR" | "HRS" | "PCS";
export type DiscountType = "flat" | "percent";

export interface LineItem {
  id: string;
  description: string;
  hsn: string;
  quantity: number;
  unit: LineItemUnit;
  unitPrice: number;
  discount: number;
  discountType: DiscountType;
  gstRate: number;
  isService: boolean;
}

export interface TaxBreakdown {
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  cessRate: number;
  cessAmount: number;
  totalTax: number;
  grandTotal: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  date: string;
  amount: number;
  mode: "CASH" | "BANK_TRANSFER" | "UPI" | "CHEQUE" | "CARD";
  reference: string;
  notes: string;
}

export type InvoiceType = "TAX_INVOICE" | "PROFORMA" | "CREDIT_NOTE" | "DEBIT_NOTE";
export type InvoiceStatus =
  | "DRAFT"
  | "FINALIZED"
  | "PAID"
  | "PARTIALLY_PAID"
  | "OVERDUE"
  | "CANCELLED";

export interface ShippingAddress {
  address: string;
  city: string;
  state: string;
  stateCode: string;
  pincode: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: InvoiceType;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  supplyDate: string;
  seller: BusinessProfile;
  buyer: Party;
  shippingAddress?: ShippingAddress;
  lineItems: LineItem[];
  taxBreakdown: TaxBreakdown;
  isInterState: boolean;
  isRCM: boolean;
  placeOfSupply: string;
  notes: string;
  terms: string;
  eWayBillNumber?: string;
  eWayBillDate?: string;
  vehicleNumber?: string;
  transporterName?: string;
  transporterId?: string;
  transportMode?: "ROAD" | "RAIL" | "AIR" | "SHIP";
  transportDistanceKm?: number;
  linkedInvoiceId?: string;
  paymentHistory: Payment[];
  amountPaid: number;
  balanceDue: number;
  createdAt: string;
  updatedAt: string;
  financialYear: string;
}

export interface GSTREntry {
  invoiceNumber: string;
  invoiceDate: string;
  partyName: string;
  gstin: string;
  placeOfSupply: string;
  invoiceValue: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  cess: number;
  supplyType: string;
}
