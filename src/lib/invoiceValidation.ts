import type { Invoice } from "@/data/billing";
import { INDIAN_STATES } from "@/data/gst";
import { computeIsInterState, resolveTaxCode, validateGSTIN } from "@/lib/gst";

export type ValidationSeverity = "error" | "warning";

export interface ValidationError {
  field: string;
  message: string;
  severity: ValidationSeverity;
}

interface ValidateInvoiceOptions {
  existingInvoices?: Invoice[];
  today?: Date;
}

const parseDate = (value: string): Date => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
};

const startOfDay = (value: Date): Date => {
  const cloned = new Date(value);
  cloned.setHours(0, 0, 0, 0);
  return cloned;
};

const getInvoiceSequence = (invoiceNumber: string): number | null => {
  const match = invoiceNumber.match(/\/(\d+)$/);
  if (!match) return null;
  const num = Number(match[1]);
  return Number.isFinite(num) ? num : null;
};

const detectSequenceGap = (invoice: Invoice, existingInvoices: Invoice[]): boolean => {
  const thisSequence = getInvoiceSequence(invoice.invoiceNumber);
  if (!thisSequence) return false;

  const peerInvoices = existingInvoices.filter(
    (item) => item.type === invoice.type && item.financialYear === invoice.financialYear,
  );
  const sequenceSet = new Set<number>();

  for (const item of peerInvoices) {
    const seq = getInvoiceSequence(item.invoiceNumber);
    if (seq) sequenceSet.add(seq);
  }
  sequenceSet.add(thisSequence);

  const sorted = [...sequenceSet].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i] - sorted[i - 1] > 1) return true;
  }
  return false;
};

export function validateInvoice(invoice: Invoice, options?: ValidateInvoiceOptions): ValidationError[] {
  const issues: ValidationError[] = [];
  const today = startOfDay(options?.today ?? new Date());
  const sellerUsesGst = invoice.seller.gstRegistrationStatus === "REGISTERED" && !invoice.seller.compositionScheme;

  if (sellerUsesGst) {
    const sellerGstin = validateGSTIN(invoice.seller.gstin || "");
    if (!sellerGstin.valid) {
      issues.push({
        field: "seller.gstin",
        message: "Seller GSTIN format is invalid.",
        severity: "error",
      });
    }
  }

  if (sellerUsesGst && invoice.buyer.isRegistered) {
    const buyerGstin = validateGSTIN(invoice.buyer.gstin || "");
    if (!buyerGstin.valid) {
      issues.push({
        field: "buyer.gstin",
        message: "Buyer GSTIN is required and must be valid for registered buyers.",
        severity: "error",
      });
    }
  }

  if (!invoice.buyer.state || !invoice.buyer.stateCode) {
    issues.push({
      field: "buyer.state",
      message: "Buyer state and state code are required.",
      severity: "error",
    });
  } else if (!INDIAN_STATES.some((state) => state.name === invoice.buyer.state && state.tinCode === invoice.buyer.stateCode)) {
    issues.push({
      field: "buyer.state",
      message: "Buyer state and state code do not match valid Indian state codes.",
      severity: "warning",
    });
  }

  if (!invoice.placeOfSupply?.trim()) {
    issues.push({
      field: "placeOfSupply",
      message: "Place of supply is mandatory.",
      severity: "error",
    });
  }

  const derivedInterState = computeIsInterState(invoice.seller.stateCode || "", invoice.buyer.stateCode || "");
  if (derivedInterState !== invoice.isInterState) {
    issues.push({
      field: "isInterState",
      message: "Inter-state flag does not match seller and buyer state codes.",
      severity: "error",
    });
  }

  if (sellerUsesGst && invoice.taxBreakdown.igstAmount > 0 && (invoice.taxBreakdown.cgstAmount > 0 || invoice.taxBreakdown.sgstAmount > 0)) {
    issues.push({
      field: "taxBreakdown",
      message: "IGST and CGST/SGST cannot be applied together.",
      severity: "error",
    });
  }

  if (!invoice.lineItems.length) {
    issues.push({
      field: "lineItems",
      message: "At least one line item is required.",
      severity: "error",
    });
  }

  if (sellerUsesGst) {
    invoice.lineItems.forEach((item, index) => {
      const resolution = resolveTaxCode(item);
      if (!resolution.code) {
        issues.push({
          field: `lineItems[${index}].hsn`,
          message: `Line ${index + 1}: ${item.isService ? "SAC" : "HSN"} is required.`,
          severity: "error",
        });
        return;
      }

      if (!/^[0-9]{4,8}$/.test(resolution.code)) {
        issues.push({
          field: `lineItems[${index}].hsn`,
          message: `Line ${index + 1}: HSN/SAC must be 4 to 8 numeric digits.`,
          severity: "error",
        });
        return;
      }

      if (item.isService && resolution.codeType === "HSN") {
        issues.push({
          field: `lineItems[${index}].hsn`,
          message: `Line ${index + 1}: This looks like a goods code, but the item is marked as a service.`,
          severity: "warning",
        });
      }

      if (!item.isService && resolution.codeType === "SAC") {
        issues.push({
          field: `lineItems[${index}].hsn`,
          message: `Line ${index + 1}: This looks like a service code, but the item is marked as goods.`,
          severity: "warning",
        });
      }

      if (resolution.rateMismatch) {
        issues.push({
          field: `lineItems[${index}].gstRate`,
          message: `Line ${index + 1}: GST rate differs from the catalog default for ${resolution.codeType} ${resolution.code}.`,
          severity: "warning",
        });
      }

      if (resolution.hasCatalogMatch && resolution.source === "LEGACY" && resolution.effectiveGstRate !== resolution.defaultGstRate) {
        issues.push({
          field: `lineItems[${index}].gstRate`,
          message: `Line ${index + 1}: Saved GST rate differs from the default catalog rate for ${resolution.codeType} ${resolution.code}.`,
          severity: "warning",
        });
      }
    });
  }

  if (sellerUsesGst) {
    const issueDate = startOfDay(parseDate(invoice.issueDate));
    if (issueDate.getTime() > today.getTime()) {
      issues.push({
        field: "issueDate",
        message: "Tax invoice date is in the future.",
        severity: "warning",
      });
    }
    const supplyDate = startOfDay(parseDate(invoice.supplyDate));
    if (supplyDate.getTime() > today.getTime()) {
      issues.push({
        field: "supplyDate",
        message: "Tax invoice supply date cannot be in the future.",
        severity: "error",
      });
    }
  }

  if (sellerUsesGst && invoice.taxBreakdown.grandTotal > 50000) {
    if (!invoice.eWayBillNumber || !invoice.eWayBillDate || !invoice.vehicleNumber || !invoice.transporterName) {
      issues.push({
        field: "eWayBill",
        message: "E-way bill details are recommended for invoice value above Rs. 50,000.",
        severity: "warning",
      });
    }
  }

  if ((invoice.type === "CREDIT_NOTE" || invoice.type === "DEBIT_NOTE") && !invoice.linkedInvoiceId) {
    issues.push({
      field: "linkedInvoiceId",
      message: "Credit/Debit notes must reference a linked invoice.",
      severity: "error",
    });
  }

  if (!invoice.invoiceNumber.includes(`/${invoice.financialYear}/`)) {
    issues.push({
      field: "invoiceNumber",
      message: "Invoice number should be financial-year scoped.",
      severity: "warning",
    });
  }

  if (options?.existingInvoices?.length && detectSequenceGap(invoice, options.existingInvoices)) {
    issues.push({
      field: "invoiceNumber",
      message: "Potential gap detected in invoice sequence numbering.",
      severity: "warning",
    });
  }

  return issues;
}
