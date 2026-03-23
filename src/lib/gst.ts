import { GSTIN_REGEX, INDIAN_STATES, type IndianState } from "../data/gst";
import type { BusinessProfile, GSTREntry, Invoice, InvoiceType, LineItem, Party, TaxBreakdown } from "../data/billing";

export interface LineItemTaxResult {
  taxableValue: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
}

export interface GSTINValidationResult {
  valid: boolean;
  stateCode: string;
  stateName: string;
  pan: string;
}

export interface GSTRPeriod {
  from?: string | Date;
  to?: string | Date;
}

export interface GSTRSummary {
  period: {
    from?: string;
    to?: string;
  };
  invoiceCount: number;
  entries: GSTREntry[];
  gstr1: {
    b2b: {
      count: number;
      invoiceValue: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    b2cl: {
      count: number;
      invoiceValue: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    b2cs: {
      count: number;
      invoiceValue: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
  };
  gstr3b: {
    outwardTaxableSupplies: {
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
      cess: number;
    };
    totalTaxLiability: number;
  };
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const toDate = (value: string | Date): Date => {
  if (value instanceof Date) return value;
  return new Date(value);
};

const isDateWithinPeriod = (dateValue: string | Date, period?: GSTRPeriod): boolean => {
  if (!period?.from && !period?.to) return true;

  const current = toDate(dateValue);
  const from = period.from ? toDate(period.from) : undefined;
  const to = period.to ? toDate(period.to) : undefined;

  if (Number.isNaN(current.getTime())) return false;
  if (from && Number.isNaN(from.getTime())) return false;
  if (to && Number.isNaN(to.getTime())) return false;

  if (from && current < from) return false;
  if (to && current > to) return false;
  return true;
};

const computeLineSubtotal = (item: LineItem): number => item.quantity * item.unitPrice;

const computeDiscountAmount = (item: LineItem, subtotal: number): number => {
  if (item.discountType === "percent") {
    return subtotal * (item.discount / 100);
  }
  return item.discount;
};

export const computeIsInterState = (sellerStateCode: string, buyerStateCode: string): boolean =>
  sellerStateCode.trim() !== buyerStateCode.trim();

export const computeLineItemTax = (item: LineItem, isInterState: boolean): LineItemTaxResult => {
  const subtotal = computeLineSubtotal(item);
  const discountAmount = computeDiscountAmount(item, subtotal);
  const taxableValue = round2(Math.max(0, subtotal - discountAmount));
  const gstRate = item.gstRate;

  if (isInterState) {
    const igstAmount = round2((taxableValue * gstRate) / 100);
    return {
      taxableValue,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: gstRate,
      igstAmount,
    };
  }

  const halfRate = gstRate / 2;
  const cgstAmount = round2((taxableValue * halfRate) / 100);
  const sgstAmount = round2((taxableValue * halfRate) / 100);

  return {
    taxableValue,
    cgstRate: halfRate,
    cgstAmount,
    sgstRate: halfRate,
    sgstAmount,
    igstRate: 0,
    igstAmount: 0,
  };
};

export const computeInvoiceTotals = (lineItems: LineItem[], isInterState: boolean): TaxBreakdown => {
  const totals = lineItems.reduce(
    (acc, item) => {
      const line = computeLineItemTax(item, isInterState);
      acc.taxableValue += line.taxableValue;
      acc.cgstAmount += line.cgstAmount;
      acc.sgstAmount += line.sgstAmount;
      acc.igstAmount += line.igstAmount;
      return acc;
    },
    {
      taxableValue: 0,
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    },
  );

  const taxableValue = round2(totals.taxableValue);
  const cgstAmount = round2(totals.cgstAmount);
  const sgstAmount = round2(totals.sgstAmount);
  const igstAmount = round2(totals.igstAmount);
  const cessRate = 0;
  const cessAmount = 0;
  const totalTax = round2(cgstAmount + sgstAmount + igstAmount + cessAmount);
  const grandTotal = round2(taxableValue + totalTax);

  const cgstRate = taxableValue > 0 ? round2((cgstAmount / taxableValue) * 100) : 0;
  const sgstRate = taxableValue > 0 ? round2((sgstAmount / taxableValue) * 100) : 0;
  const igstRate = taxableValue > 0 ? round2((igstAmount / taxableValue) * 100) : 0;

  return {
    taxableValue,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    cessRate,
    cessAmount,
    totalTax,
    grandTotal,
  };
};

export const computeInvoiceTotalsForProfile = (
  lineItems: LineItem[],
  isInterState: boolean,
  seller: Pick<BusinessProfile, "gstRegistrationStatus" | "compositionScheme">,
): TaxBreakdown => {
  const applyTax = seller.gstRegistrationStatus === "REGISTERED" && !seller.compositionScheme;
  if (!applyTax) {
    const taxableValue = round2(
      lineItems.reduce((sum, item) => {
        const subtotal = computeLineSubtotal(item);
        const discountAmount = computeDiscountAmount(item, subtotal);
        return sum + Math.max(0, subtotal - discountAmount);
      }, 0),
    );

    return {
      taxableValue,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      cessRate: 0,
      cessAmount: 0,
      totalTax: 0,
      grandTotal: taxableValue,
    };
  }

  return computeInvoiceTotals(lineItems, isInterState);
};

export const deriveStateFromGSTIN = (gstin: string): IndianState | undefined => {
  const normalized = gstin.trim().toUpperCase();
  if (normalized.length < 2) return undefined;
  const stateCode = normalized.slice(0, 2);
  return INDIAN_STATES.find((state) => state.tinCode === stateCode);
};

export const validateGSTIN = (gstin: string): GSTINValidationResult => {
  const normalized = gstin.trim().toUpperCase();
  const formatValid = GSTIN_REGEX.test(normalized);
  const state = deriveStateFromGSTIN(normalized);
  const pan = normalized.length >= 12 ? normalized.slice(2, 12) : "";

  return {
    valid: formatValid && Boolean(state),
    stateCode: state?.tinCode ?? "",
    stateName: state?.name ?? "",
    pan,
  };
};

const getInvoicePrefix = (type: InvoiceType): string => {
  switch (type) {
    case "PROFORMA":
      return "PRO";
    case "CREDIT_NOTE":
      return "CN";
    case "DEBIT_NOTE":
      return "DN";
    case "TAX_INVOICE":
    default:
      return "INV";
  }
};

export const getCurrentFinancialYear = (date: string | Date): string => {
  const current = toDate(date);
  const year = current.getFullYear();
  const month = current.getMonth() + 1;

  if (month >= 4) {
    return `${year}-${String((year + 1) % 100).padStart(2, "0")}`;
  }
  return `${year - 1}-${String(year % 100).padStart(2, "0")}`;
};

export const generateInvoiceNumber = (
  type: InvoiceType,
  financialYear: string,
  sequence: number,
): string => {
  const prefix = getInvoicePrefix(type);
  const padded = String(sequence).padStart(4, "0");
  return `${prefix}/${financialYear}/${padded}`;
};

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

const numberToWordsUnder1000 = (num: number): string => {
  if (num === 0) return "";
  if (num < 20) return ONES[num];
  if (num < 100) {
    const tenPart = TENS[Math.floor(num / 10)];
    const remainder = num % 10;
    return remainder ? `${tenPart} ${ONES[remainder]}` : tenPart;
  }

  const hundredPart = `${ONES[Math.floor(num / 100)]} Hundred`;
  const remainder = num % 100;
  return remainder ? `${hundredPart} and ${numberToWordsUnder1000(remainder)}` : hundredPart;
};

const numberToIndianWords = (num: number): string => {
  if (num === 0) return "Zero";

  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundredAndBelow = num % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberToWordsUnder1000(crore)} Crore`);
  if (lakh) parts.push(`${numberToWordsUnder1000(lakh)} Lakh`);
  if (thousand) parts.push(`${numberToWordsUnder1000(thousand)} Thousand`);
  if (hundredAndBelow) parts.push(numberToWordsUnder1000(hundredAndBelow));

  return parts.join(" ");
};

export const amountInWords = (amount: number): string => {
  const safeAmount = Number.isFinite(amount) ? Math.max(0, amount) : 0;
  const rounded = round2(safeAmount);
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  const rupeeWords = numberToIndianWords(rupees);
  if (paise === 0) {
    return `Rupees ${rupeeWords} Only`;
  }

  const paiseWords = numberToIndianWords(paise);
  return `Rupees ${rupeeWords} and Paise ${paiseWords} Only`;
};

export const getSupplyType = (buyer: Party, invoiceValue: number): "B2B" | "B2CL" | "B2CS" => {
  const hasGstin = Boolean(buyer.gstin && buyer.gstin.trim().length > 0);
  if (hasGstin) return "B2B";
  if (invoiceValue > 250000) return "B2CL";
  return "B2CS";
};

const EMPTY_BUCKET = {
  count: 0,
  invoiceValue: 0,
  taxableValue: 0,
  igst: 0,
  cgst: 0,
  sgst: 0,
  cess: 0,
};

export const computeGSTRSummary = (invoices: Invoice[], period?: GSTRPeriod): GSTRSummary => {
  const eligible = invoices.filter((invoice) => {
    if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return false;
    if (invoice.seller.gstRegistrationStatus !== "REGISTERED" || invoice.seller.compositionScheme) return false;
    return isDateWithinPeriod(invoice.issueDate, period);
  });

  const entries: GSTREntry[] = eligible.map((invoice) => ({
    invoiceNumber: invoice.invoiceNumber,
    invoiceDate: invoice.issueDate,
    partyName: invoice.buyer.name,
    gstin: invoice.buyer.gstin ?? "",
    placeOfSupply: invoice.placeOfSupply,
    invoiceValue: round2(invoice.taxBreakdown.grandTotal),
    taxableValue: round2(invoice.taxBreakdown.taxableValue),
    igst: round2(invoice.taxBreakdown.igstAmount),
    cgst: round2(invoice.taxBreakdown.cgstAmount),
    sgst: round2(invoice.taxBreakdown.sgstAmount),
    cess: round2(invoice.taxBreakdown.cessAmount),
    supplyType: getSupplyType(invoice.buyer, invoice.taxBreakdown.grandTotal),
  }));

  const b2b = { ...EMPTY_BUCKET };
  const b2cl = { ...EMPTY_BUCKET };
  const b2cs = { ...EMPTY_BUCKET };

  for (const entry of entries) {
    const bucket = entry.supplyType === "B2B" ? b2b : entry.supplyType === "B2CL" ? b2cl : b2cs;
    bucket.count += 1;
    bucket.invoiceValue = round2(bucket.invoiceValue + entry.invoiceValue);
    bucket.taxableValue = round2(bucket.taxableValue + entry.taxableValue);
    bucket.igst = round2(bucket.igst + entry.igst);
    bucket.cgst = round2(bucket.cgst + entry.cgst);
    bucket.sgst = round2(bucket.sgst + entry.sgst);
    bucket.cess = round2(bucket.cess + entry.cess);
  }

  const outwardTaxableSupplies = entries.reduce(
    (acc, entry) => {
      acc.taxableValue = round2(acc.taxableValue + entry.taxableValue);
      acc.igst = round2(acc.igst + entry.igst);
      acc.cgst = round2(acc.cgst + entry.cgst);
      acc.sgst = round2(acc.sgst + entry.sgst);
      acc.cess = round2(acc.cess + entry.cess);
      return acc;
    },
    { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
  );

  const totalTaxLiability = round2(
    outwardTaxableSupplies.igst +
      outwardTaxableSupplies.cgst +
      outwardTaxableSupplies.sgst +
      outwardTaxableSupplies.cess,
  );

  return {
    period: {
      from: period?.from ? toDate(period.from).toISOString().slice(0, 10) : undefined,
      to: period?.to ? toDate(period.to).toISOString().slice(0, 10) : undefined,
    },
    invoiceCount: entries.length,
    entries,
    gstr1: {
      b2b,
      b2cl,
      b2cs,
    },
    gstr3b: {
      outwardTaxableSupplies,
      totalTaxLiability,
    },
  };
};
