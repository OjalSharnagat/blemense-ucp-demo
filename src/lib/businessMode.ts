import type { BusinessProfile, BusinessScale } from "@/data/billing";

export type InvoiceDocumentKind = "BILL" | "BILL_OF_SUPPLY" | "TAX_INVOICE" | "PROFORMA" | "CREDIT_NOTE" | "DEBIT_NOTE";

export interface BusinessModeConfig {
  mode: "UNREGISTERED" | "COMPOSITION" | "GST";
  showGstFields: boolean;
  showGstReturns: boolean;
  showTaxColumns: boolean;
  showHsnSac: boolean;
  canCollectTax: boolean;
  title: string;
  subtitle: string;
}

export const isGstRegistered = (profile: Pick<BusinessProfile, "gstRegistrationStatus">): boolean =>
  profile.gstRegistrationStatus === "REGISTERED";

export const isCompositionDealer = (profile: Pick<BusinessProfile, "gstRegistrationStatus" | "compositionScheme">): boolean =>
  isGstRegistered(profile) && Boolean(profile.compositionScheme);

export const usesGstTaxation = (profile: Pick<BusinessProfile, "gstRegistrationStatus" | "compositionScheme">): boolean =>
  isGstRegistered(profile) && !profile.compositionScheme;

export const getBusinessModeConfig = (profile: BusinessProfile): BusinessModeConfig => {
  if (!isGstRegistered(profile)) {
    return {
      mode: "UNREGISTERED",
      showGstFields: false,
      showGstReturns: false,
      showTaxColumns: false,
      showHsnSac: false,
      canCollectTax: false,
      title: "Bill",
      subtitle: "Simple invoicing for businesses that are not GST registered.",
    };
  }

  if (profile.compositionScheme) {
    return {
      mode: "COMPOSITION",
      showGstFields: true,
      showGstReturns: true,
      showTaxColumns: false,
      showHsnSac: false,
      canCollectTax: false,
      title: "Bill of Supply",
      subtitle: "Composition dealers issue supply bills without collecting GST.",
    };
  }

  return {
    mode: "GST",
    showGstFields: true,
    showGstReturns: true,
    showTaxColumns: true,
    showHsnSac: true,
    canCollectTax: true,
    title: "Tax Invoice",
    subtitle: "Full GST-compliant invoicing with tax columns and returns support.",
  };
};

export const getBusinessScaleLabel = (scale?: BusinessScale): string => {
  switch (scale) {
    case "FREELANCER":
      return "Freelancer / Solo Trader";
    case "SMALL":
      return "Small Business (1-10 people)";
    case "GROWING":
      return "Growing Business (10-50 people)";
    case "ESTABLISHED":
      return "Established Business (50+ people)";
    default:
      return "Unspecified";
  }
};

