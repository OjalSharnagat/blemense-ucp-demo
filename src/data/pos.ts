import type { TaxBreakdown } from "./billing";
import type { GstRateSource, TaxCodeSource } from "./billing";
import type { TaxCodeType } from "./gst";

export type POSSessionStatus = "OPEN" | "CLOSED";
export type POSPaymentMode = "CASH" | "UPI" | "CARD" | "SPLIT";
export type POSOrderStatus = "COMPLETED" | "REFUNDED" | "PARTIALLY_REFUNDED" | "VOIDED";
export type POSTaxBehavior = "INCLUSIVE" | "EXCLUSIVE" | "NONE";
export type POSCartDiscountType = "FLAT" | "PERCENT";

export interface POSPaymentBreakdown {
  cash: number;
  upi: number;
  card: number;
  other: number;
}

export interface POSLineItem {
  id: string;
  productId: string;
  name: string;
  hsn?: string;
  taxCode?: string;
  taxCodeType?: TaxCodeType;
  taxCodeSource?: TaxCodeSource;
  gstRateSource?: GstRateSource;
  gstRateOverride?: number;
  isService?: boolean;
  quantity: number;
  unitPrice: number;
  discount: number;
  gstRate?: number;
  taxAmount?: number;
  total: number;
}

export interface POSCartItem extends POSLineItem {
  maxStock: number;
}

export interface POSCartDiscount {
  type: POSCartDiscountType;
  value: number;
}

export interface POSSession {
  id: string;
  openedAt: string;
  closedAt?: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  totalSales: number;
  totalOrders: number;
  paymentBreakdown: POSPaymentBreakdown;
  status: POSSessionStatus;
  notes: string;
  operatorName: string;
  cashDifference?: number;
  hasDiscrepancy?: boolean;
}

export interface POSOrder {
  id: string;
  sessionId: string;
  orderNumber: string;
  items: POSLineItem[];
  subtotal: number;
  discountAmount: number;
  taxBreakdown: TaxBreakdown;
  total: number;
  paymentMode: POSPaymentMode;
  paymentBreakdown: POSPaymentBreakdown;
  amountTendered: number;
  changeReturned: number;
  roundOffAmount?: number;
  status: POSOrderStatus;
  completedAt: string;
  crmContactId?: string;
  linkedInvoiceId?: string;
  customerName?: string;
  customerPhone?: string;
  notes: string;
  refundedAt?: string;
  refundReason?: string;
  voidedAt?: string;
  voidReason?: string;
}

export interface POSRefundItemInput {
  productId: string;
  quantity: number;
}

export interface POSRefundRecord {
  id: string;
  orderId: string;
  sessionId: string;
  items: POSLineItem[];
  subtotal: number;
  taxBreakdown: TaxBreakdown;
  total: number;
  paymentBreakdown: POSPaymentBreakdown;
  reason: string;
  refundedAt: string;
}

export interface POSSettings {
  id: string;
  defaultTaxBehavior: POSTaxBehavior;
  enableCustomerCapture: boolean;
  autoPrintReceipt: boolean;
  lowStockWarningThreshold: number;
  allowNegativeStock: boolean;
  enableBarcode: boolean;
  receiptHeader: string;
  receiptFooter: string;
  showGstinOnReceipt: boolean;
  showOperatorNameOnReceipt: boolean;
  showOrderNumberOnReceipt: boolean;
  enableSplitPayment: boolean;
  roundOffTotal: boolean;
  defaultPaymentMode: POSPaymentMode;
}

export interface POSCheckoutInput {
  paymentMode?: POSPaymentMode;
  paymentBreakdown?: POSPaymentBreakdown;
  amountTendered?: number;
  customerName?: string;
  customerPhone?: string;
  crmContactId?: string;
  notes?: string;
  linkedInvoiceId?: string;
  generateLinkedInvoice?: boolean;
}

export const DEFAULT_POS_SETTINGS: POSSettings = {
  id: "pos-settings-default",
  defaultTaxBehavior: "EXCLUSIVE",
  enableCustomerCapture: true,
  autoPrintReceipt: true,
  lowStockWarningThreshold: 5,
  allowNegativeStock: false,
  enableBarcode: true,
  receiptHeader: "Blemense UCP POS",
  receiptFooter: "Thank you for your purchase.",
  showGstinOnReceipt: true,
  showOperatorNameOnReceipt: true,
  showOrderNumberOnReceipt: true,
  enableSplitPayment: true,
  roundOffTotal: true,
  defaultPaymentMode: "CASH",
};
