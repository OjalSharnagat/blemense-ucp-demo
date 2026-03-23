import { createContext, type PropsWithChildren, useContext, useMemo, useState } from "react";
import type { BusinessProfile, LineItem, Party, TaxBreakdown } from "@/data/billing";
import type {
  POSCartDiscount,
  POSCartDiscountType,
  POSCartItem,
  POSCheckoutInput,
  POSLineItem,
  POSOrder,
  POSOrderStatus,
  POSPaymentBreakdown,
  POSPaymentMode,
  POSRefundItemInput,
  POSRefundRecord,
  POSSession,
  POSSettings,
} from "@/data/pos";
import { DEFAULT_POS_SETTINGS } from "@/data/pos";
import { useBillingStore } from "@/lib/billingStore";
import { useAdminStore } from "@/lib/store";
import type { Product } from "@/utils";

type PosStoreValue = {
  currentSession: POSSession | null;
  sessions: POSSession[];
  cart: POSCartItem[];
  cartDiscount: POSCartDiscount | null;
  orders: POSOrder[];
  refunds: POSRefundRecord[];
  settings: POSSettings;
  openSession: (openingCash: number, operatorName?: string, notes?: string) => POSSession;
  closeSession: (closingCash: number, notes?: string) => POSSession | null;
  addToCart: (product: Product) => { item: POSCartItem | null; warning?: string };
  updateCartItem: (id: string, changes: Partial<Pick<POSCartItem, "quantity" | "discount">>) => POSCartItem | null;
  removeFromCart: (id: string) => void;
  clearCart: (confirm?: boolean) => void;
  applyCartDiscount: (type: POSCartDiscountType, value: number) => void;
  checkout: (paymentDetails?: POSCheckoutInput) => POSOrder | null;
  refundOrder: (orderId: string, items: POSRefundItemInput[], reason: string) => POSRefundRecord | null;
  voidOrder: (orderId: string, reason: string) => POSOrder | null;
  linkInvoiceToOrder: (orderId: string, invoiceId: string) => POSOrder | null;
  updateSettings: (settings: Partial<POSSettings>) => POSSettings;
  getCartSummary: () => ReturnType<typeof buildOrderPricing> | null;
};

const PosStoreContext = createContext<PosStoreValue | null>(null);
const POS_SETTINGS_STORAGE_KEY = "blemense-pos-settings";

const loadPersistedPosSettings = (): POSSettings => {
  if (typeof window === "undefined") {
    return DEFAULT_POS_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(POS_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_POS_SETTINGS;

    const parsed = JSON.parse(raw) as Partial<POSSettings> | null;
    if (!parsed || typeof parsed !== "object") {
      return DEFAULT_POS_SETTINGS;
    }

    return {
      ...DEFAULT_POS_SETTINGS,
      ...parsed,
      id: DEFAULT_POS_SETTINGS.id,
    };
  } catch {
    return DEFAULT_POS_SETTINGS;
  }
};

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

const roundToNearestRupee = (value: number): number => Math.round(value);

const createPaymentBreakdown = (breakdown?: Partial<POSPaymentBreakdown>): POSPaymentBreakdown => ({
  cash: round2(breakdown?.cash ?? 0),
  upi: round2(breakdown?.upi ?? 0),
  card: round2(breakdown?.card ?? 0),
  other: round2(breakdown?.other ?? 0),
});

const addPaymentBreakdowns = (...breakdowns: POSPaymentBreakdown[]): POSPaymentBreakdown => {
  const totals = breakdowns.reduce(
    (acc, breakdown) => ({
      cash: acc.cash + breakdown.cash,
      upi: acc.upi + breakdown.upi,
      card: acc.card + breakdown.card,
      other: acc.other + breakdown.other,
    }),
    { cash: 0, upi: 0, card: 0, other: 0 },
  );

  return createPaymentBreakdown(totals);
};

const subtractPaymentBreakdowns = (base: POSPaymentBreakdown, deduction: POSPaymentBreakdown): POSPaymentBreakdown =>
  createPaymentBreakdown({
    cash: base.cash - deduction.cash,
    upi: base.upi - deduction.upi,
    card: base.card - deduction.card,
    other: base.other - deduction.other,
  });

const sumPaymentBreakdownTotal = (breakdown: POSPaymentBreakdown): number =>
  round2(breakdown.cash + breakdown.upi + breakdown.card + breakdown.other);

const clampAmount = (value: number): number => round2(Math.max(0, value));

const formatToday = (date = new Date()): string => date.toLocaleDateString("en-CA");

const generateId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const generateOrderNumber = (sequence: number): string => `POS-${String(sequence).padStart(3, "0")}`;

const getEffectiveTaxBehavior = (
  businessProfile: Pick<BusinessProfile, "gstRegistrationStatus" | "compositionScheme">,
  settings: POSSettings,
): POSSettings["defaultTaxBehavior"] => {
  if (businessProfile.gstRegistrationStatus !== "REGISTERED") {
    return "NONE";
  }
  if (businessProfile.compositionScheme) {
    return "INCLUSIVE";
  }
  return settings.defaultTaxBehavior;
};

const isStockManagedBusiness = (businessProfile: Pick<BusinessProfile, "businessCategory">): boolean =>
  businessProfile.businessCategory !== "SERVICES";

const calculateBaseAmount = (item: Pick<POSLineItem, "quantity" | "unitPrice" | "discount">): number =>
  clampAmount(item.quantity * item.unitPrice - item.discount);

const calculateLinePricing = (
  baseAmount: number,
  gstRate: number | undefined,
  taxBehavior: POSSettings["defaultTaxBehavior"],
): { taxableValue: number; taxAmount: number; total: number } => {
  const cleanBaseAmount = clampAmount(baseAmount);
  const rate = Number.isFinite(gstRate) ? Math.max(0, gstRate ?? 0) : 0;

  if (cleanBaseAmount <= 0) {
    return { taxableValue: 0, taxAmount: 0, total: 0 };
  }

  if (taxBehavior === "NONE" || rate <= 0) {
    return {
      taxableValue: cleanBaseAmount,
      taxAmount: 0,
      total: cleanBaseAmount,
    };
  }

  if (taxBehavior === "INCLUSIVE") {
    const taxableValue = round2(cleanBaseAmount / (1 + rate / 100));
    const taxAmount = round2(cleanBaseAmount - taxableValue);
    return {
      taxableValue,
      taxAmount,
      total: cleanBaseAmount,
    };
  }

  const taxAmount = round2((cleanBaseAmount * rate) / 100);
  return {
    taxableValue: cleanBaseAmount,
    taxAmount,
    total: round2(cleanBaseAmount + taxAmount),
  };
};

const calculateDiscountAmount = (baseAmount: number, discount?: POSCartDiscount | null): number => {
  if (!discount || baseAmount <= 0) return 0;
  if (discount.type === "PERCENT") {
    return clampAmount((baseAmount * discount.value) / 100);
  }
  return clampAmount(discount.value);
};

const allocateDiscountAcrossItems = (baseAmounts: number[], totalDiscount: number): number[] => {
  const cleanDiscount = clampAmount(totalDiscount);
  const totalBase = round2(baseAmounts.reduce((sum, value) => sum + value, 0));
  if (cleanDiscount <= 0 || totalBase <= 0) {
    return baseAmounts.map(() => 0);
  }

  let remainingDiscount = cleanDiscount;
  return baseAmounts.map((baseAmount, index) => {
    if (index === baseAmounts.length - 1) {
      return clampAmount(remainingDiscount);
    }

    const allocated = clampAmount((cleanDiscount * baseAmount) / totalBase);
    remainingDiscount = round2(remainingDiscount - allocated);
    return allocated;
  });
};

const toBillingPaymentMode = (mode: POSPaymentMode): "CASH" | "UPI" | "CARD" => {
  switch (mode) {
    case "CASH":
      return "CASH";
    case "CARD":
      return "CARD";
    case "UPI":
      return "UPI";
    case "SPLIT":
      return "CASH";
    default:
      return "CASH";
  }
};

const getBreakdownModeAmount = (breakdown: POSPaymentBreakdown): [keyof POSPaymentBreakdown, number] => {
  const entries: Array<[keyof POSPaymentBreakdown, number]> = [
    ["cash", breakdown.cash],
    ["upi", breakdown.upi],
    ["card", breakdown.card],
    ["other", breakdown.other],
  ];
  return entries.sort((a, b) => b[1] - a[1])[0] ?? ["other", 0];
};

const paymentModeForInvoice = (mode: POSPaymentMode, breakdown: POSPaymentBreakdown): "CASH" | "UPI" | "CARD" => {
  if (mode !== "SPLIT") {
    return toBillingPaymentMode(mode);
  }

  const [dominantMode] = getBreakdownModeAmount(breakdown);
  switch (dominantMode) {
    case "upi":
      return "UPI";
    case "card":
      return "CARD";
    case "cash":
    case "other":
    default:
      return "CASH";
  }
};

const buildWalkInBuyer = (businessProfile: BusinessProfile, customerName?: string, customerPhone?: string): Party => ({
  id: generateId("party-pos"),
  name: customerName?.trim() || "Walk-in Customer",
  gstin: undefined,
  pan: "URP",
  address: businessProfile.address || "Counter sale",
  city: businessProfile.city || "Local",
  state: businessProfile.state,
  stateCode: businessProfile.stateCode,
  pincode: businessProfile.pincode || "000000",
  email: "",
  phone: customerPhone?.trim() || "",
  isRegistered: false,
});

const toInvoiceLineItem = (item: POSLineItem): LineItem => ({
  id: item.id,
  description: item.name,
  hsn: item.hsn ?? "",
  quantity: item.quantity,
  unit: "NOS",
  unitPrice: item.unitPrice,
  discount: item.discount,
  discountType: "flat",
  gstRate: item.gstRate ?? 0,
  isService: false,
});

const sumLineTotals = (items: POSLineItem[]): number => round2(items.reduce((sum, item) => sum + item.total, 0));

const buildSessionSnapshot = (
  session: POSSession,
  orders: POSOrder[],
  refunds: POSRefundRecord[],
): POSSession => {
  const relevantOrders = orders.filter((order) => order.sessionId === session.id && order.status !== "VOIDED");
  const relevantRefunds = refunds.filter((refund) => refund.sessionId === session.id);

  const netSales = round2(
    relevantOrders.reduce((sum, order) => sum + order.total, 0) - relevantRefunds.reduce((sum, refund) => sum + refund.total, 0),
  );
  const orderBreakdown = relevantOrders.reduce(
    (acc, order) => addPaymentBreakdowns(acc, order.paymentBreakdown),
    createPaymentBreakdown(),
  );
  const refundBreakdown = relevantRefunds.reduce(
    (acc, refund) => addPaymentBreakdowns(acc, refund.paymentBreakdown),
    createPaymentBreakdown(),
  );
  const paymentBreakdown = subtractPaymentBreakdowns(orderBreakdown, refundBreakdown);
  const expectedCash = round2(session.openingCash + paymentBreakdown.cash);
  const closedCash = session.closedAt ? session.closingCash ?? 0 : session.closingCash;
  const cashDifference =
    typeof closedCash === "number" ? round2(closedCash - expectedCash) : session.cashDifference ?? undefined;

  return {
    ...session,
    totalSales: netSales,
    totalOrders: relevantOrders.length,
    paymentBreakdown,
    expectedCash,
    cashDifference,
    hasDiscrepancy: typeof cashDifference === "number" ? Math.abs(cashDifference) > 0.01 : session.hasDiscrepancy,
  };
};

const buildCartItemPricing = (
  items: POSCartItem[],
  businessProfile: BusinessProfile,
  settings: POSSettings,
): POSCartItem[] => {
  const taxBehavior = getEffectiveTaxBehavior(businessProfile, settings);

  return items.map((item) => {
    const baseAmount = calculateBaseAmount(item);
    const { taxableValue, taxAmount, total } = calculateLinePricing(baseAmount, item.gstRate, taxBehavior);

    return {
      ...item,
      taxAmount,
      total,
    };
  });
};

const buildOrderPricing = (
  items: POSCartItem[],
  cartDiscount: POSCartDiscount | null,
  businessProfile: BusinessProfile,
  settings: POSSettings,
): {
  items: POSLineItem[];
  subtotal: number;
  discountAmount: number;
  taxBreakdown: TaxBreakdown;
  total: number;
  roundOffAmount: number;
} => {
  const taxBehavior = getEffectiveTaxBehavior(businessProfile, settings);
  type PricedLineItem = POSLineItem & { taxableValue: number };

  const lineSubtotals = items.map((item) => round2(item.quantity * item.unitPrice));
  const baseAmounts = items.map((item) => calculateBaseAmount(item));
  const subtotal = round2(lineSubtotals.reduce((sum, value) => sum + value, 0));
  const itemDiscountAmount = round2(
    items.reduce((sum, item, index) => sum + Math.min(lineSubtotals[index], clampAmount(item.discount)), 0),
  );
  const baseAfterItemDiscount = round2(baseAmounts.reduce((sum, value) => sum + value, 0));
  const cartDiscountAmount = clampAmount(calculateDiscountAmount(baseAfterItemDiscount, cartDiscount));
  const lineCartDiscounts = allocateDiscountAcrossItems(baseAmounts, cartDiscountAmount);

  const lineTotals: PricedLineItem[] = items.map((item, index) => {
    const netBase = clampAmount(baseAmounts[index] - lineCartDiscounts[index]);
    const { taxableValue, taxAmount, total } = calculateLinePricing(netBase, item.gstRate, taxBehavior);

    return {
      ...item,
      discount: clampAmount(item.discount),
      taxAmount,
      total: round2(total),
      taxableValue,
    };
  });

  const taxBreakdown = lineTotals.reduce(
    (acc, line) => {
      const taxAmount = round2(line.taxAmount ?? 0);
      acc.taxableValue += round2(line.taxableValue);
      acc.cgstAmount += round2(taxAmount / 2);
      acc.sgstAmount += round2(taxAmount / 2);
      acc.totalTax += taxAmount;
      return acc;
    },
    {
      taxableValue: 0,
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: 0,
      igstAmount: 0,
      cessRate: 0,
      cessAmount: 0,
      totalTax: 0,
      grandTotal: 0,
    } satisfies TaxBreakdown,
  );

  const netBeforeRoundOff = round2(lineTotals.reduce((sum, line) => sum + line.total, 0));
  const roundedTotal = settings.roundOffTotal ? roundToNearestRupee(netBeforeRoundOff) : netBeforeRoundOff;
  const roundOffAmount = round2(roundedTotal - netBeforeRoundOff);

  taxBreakdown.taxableValue = round2(lineTotals.reduce((sum, line) => sum + line.taxableValue, 0));
  taxBreakdown.totalTax = round2(lineTotals.reduce((sum, line) => sum + (line.taxAmount ?? 0), 0));
  taxBreakdown.grandTotal = round2(netBeforeRoundOff);
  taxBreakdown.cgstRate = taxBreakdown.taxableValue > 0 ? round2((taxBreakdown.cgstAmount / taxBreakdown.taxableValue) * 100) : 0;
  taxBreakdown.sgstRate = taxBreakdown.taxableValue > 0 ? round2((taxBreakdown.sgstAmount / taxBreakdown.taxableValue) * 100) : 0;
  taxBreakdown.igstRate = 0;

  return {
    items: lineTotals.map(({ taxableValue: _taxableValue, ...line }) => line),
    subtotal,
    discountAmount: round2(itemDiscountAmount + cartDiscountAmount),
    taxBreakdown,
    total: round2(roundedTotal),
    roundOffAmount,
  };
};

export function PosStoreProvider({ children }: PropsWithChildren) {
  const { products, updateProduct } = useAdminStore();
  const { businessProfile, createInvoice, addPayment } = useBillingStore();
  const [currentSession, setCurrentSession] = useState<POSSession | null>(null);
  const [sessions, setSessions] = useState<POSSession[]>([]);
  const [cart, setCart] = useState<POSCartItem[]>([]);
  const [cartDiscount, setCartDiscount] = useState<POSCartDiscount | null>(null);
  const [orders, setOrders] = useState<POSOrder[]>([]);
  const [refunds, setRefunds] = useState<POSRefundRecord[]>([]);
  const [settings, setSettings] = useState<POSSettings>(loadPersistedPosSettings);

  const value = useMemo<PosStoreValue>(
    () => ({
      currentSession,
      sessions,
      cart,
      cartDiscount,
      orders,
      refunds,
      settings,
      getCartSummary: () => {
        if (!cart.length) return null;
        const effectiveCart = buildCartItemPricing(cart, businessProfile, settings);
        return buildOrderPricing(effectiveCart, cartDiscount, businessProfile, settings);
      },
      openSession: (openingCash, operatorName = "Cashier", notes = "") => {
        if (currentSession?.status === "OPEN") {
          return currentSession;
        }

        const session: POSSession = {
          id: generateId("pos-session"),
          openedAt: new Date().toISOString(),
          openingCash: round2(openingCash),
          totalSales: 0,
          totalOrders: 0,
          paymentBreakdown: createPaymentBreakdown(),
          status: "OPEN",
          notes,
          operatorName,
        };

        setCurrentSession(session);
        setSessions((prev) => [session, ...prev]);
        setCart([]);
        setCartDiscount(null);
        return session;
      },
      closeSession: (closingCash, notes = "") => {
        if (!currentSession || currentSession.status !== "OPEN") {
          return null;
        }

        const snapshot = buildSessionSnapshot(currentSession, orders, refunds);
        const closedSession: POSSession = {
          ...snapshot,
          closedAt: new Date().toISOString(),
          closingCash: round2(closingCash),
          notes: notes || currentSession.notes,
          status: "CLOSED",
          cashDifference: round2(closingCash - snapshot.expectedCash),
          hasDiscrepancy: Math.abs(round2(closingCash - snapshot.expectedCash)) > 0.01,
        };

        setSessions((prev) => prev.map((session) => (session.id === closedSession.id ? closedSession : session)));
        setCurrentSession(null);
        setCart([]);
        setCartDiscount(null);
        return closedSession;
      },
      addToCart: (product) => {
        if (product.status !== "active") {
          return { item: null, warning: "Only active products can be sold from POS." };
        }

        const stockManaged = isStockManagedBusiness(businessProfile);
        const existing = cart.find((item) => item.productId === product.id);
        const nextQuantity = (existing?.quantity ?? 0) + 1;
        const maxStock = stockManaged ? product.stock : Number.POSITIVE_INFINITY;
        let warning: string | undefined;

        if (stockManaged && !settings.allowNegativeStock && nextQuantity > maxStock) {
          warning = maxStock <= 0 ? `${product.name} is out of stock.` : `${product.name} capped at available stock (${maxStock}).`;
        }

        const effectiveQuantity = stockManaged && !settings.allowNegativeStock ? Math.min(nextQuantity, Math.max(0, maxStock)) : nextQuantity;
        if (effectiveQuantity <= 0) {
          return { item: null, warning };
        }

        const updatedItem: POSCartItem = {
          id: existing?.id ?? generateId("pos-cart"),
          productId: product.id,
          name: product.name,
          hsn: product.hsn,
          quantity: effectiveQuantity,
          unitPrice: round2(product.price),
          discount: round2(existing?.discount ?? 0),
          gstRate: product.gstRate,
          taxAmount: 0,
          total: 0,
          maxStock,
        };

        const priced = buildCartItemPricing([updatedItem], businessProfile, settings)[0];
        setCart((prev) => {
          const withoutItem = prev.filter((item) => item.productId !== product.id);
          return [priced, ...withoutItem];
        });

        if (
          stockManaged &&
          !warning &&
          !settings.allowNegativeStock &&
          Number.isFinite(maxStock) &&
          maxStock - effectiveQuantity <= settings.lowStockWarningThreshold
        ) {
          warning = `${product.name} is low on stock.`;
        }

        return { item: priced, warning };
      },
      updateCartItem: (id, changes) => {
        let nextItem: POSCartItem | null = null;

        setCart((prev) => {
          const nextCart = prev.map((item) => {
            if (item.id !== id) return item;

            const updated: POSCartItem = {
              ...item,
              ...changes,
              quantity: Math.max(0, Number(changes.quantity ?? item.quantity)),
              discount: clampAmount(changes.discount ?? item.discount),
            };

            const product = products.find((entry) => entry.id === updated.productId);
            const stockManaged = isStockManagedBusiness(businessProfile);
            const maxStock = stockManaged ? product?.stock ?? item.maxStock : Number.POSITIVE_INFINITY;
            const cappedQuantity = stockManaged && !settings.allowNegativeStock ? Math.min(updated.quantity, Math.max(0, maxStock)) : updated.quantity;
            const priced = buildCartItemPricing(
              [
                {
                  ...updated,
                  quantity: cappedQuantity,
                  maxStock,
                },
              ],
              businessProfile,
              settings,
            )[0];

            if (cappedQuantity <= 0) {
              nextItem = null;
              return null;
            }
            nextItem = priced;
            return priced;
          });

          return nextCart.filter((item): item is POSCartItem => Boolean(item));
        });

        return nextItem;
      },
      removeFromCart: (id) => {
        setCart((prev) => prev.filter((item) => item.id !== id));
      },
      clearCart: (confirm = false) => {
        if (cart.length > 0 && !confirm) {
          return;
        }
        setCart([]);
        setCartDiscount(null);
      },
      applyCartDiscount: (type, value) => {
        const cleanValue = type === "PERCENT" ? Math.max(0, Math.min(100, value)) : Math.max(0, value);
        setCartDiscount(cleanValue <= 0 ? null : { type, value: round2(cleanValue) });
      },
      checkout: (paymentDetails) => {
        if (!currentSession || currentSession.status !== "OPEN" || cart.length === 0) {
          return null;
        }

        const validatedCart = cart
          .map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            const stockManaged = isStockManagedBusiness(businessProfile);
            const availableStock = stockManaged ? product?.stock ?? item.maxStock : Number.POSITIVE_INFINITY;
            const quantity = stockManaged && !settings.allowNegativeStock ? Math.min(item.quantity, Math.max(0, availableStock)) : item.quantity;
            if (quantity <= 0) return null;
            return {
              ...item,
              quantity,
              maxStock: availableStock,
            } as POSCartItem;
          })
          .filter((item): item is POSCartItem => Boolean(item));

        if (!validatedCart.length) {
          return null;
        }

        const effectiveCart = buildCartItemPricing(validatedCart, businessProfile, settings);
        const pricing = buildOrderPricing(effectiveCart, cartDiscount, businessProfile, settings);
        const paymentMode = paymentDetails?.paymentMode ?? settings.defaultPaymentMode;
        const total = round2(pricing.total);

        let paymentBreakdown = createPaymentBreakdown();
        let amountTendered = 0;
        let changeReturned = 0;

        if (paymentMode === "SPLIT") {
          if (!settings.enableSplitPayment) {
            return null;
          }
          const splitBreakdown = createPaymentBreakdown(paymentDetails?.paymentBreakdown);
          const splitTotal = sumPaymentBreakdownTotal(splitBreakdown);
          if (Math.abs(splitTotal - total) > 0.01) {
            return null;
          }
          paymentBreakdown = splitBreakdown;
          amountTendered = round2(splitBreakdown.cash);
        } else {
          paymentBreakdown = createPaymentBreakdown({
            [paymentMode.toLowerCase() as "cash" | "upi" | "card"]: total,
          });
          if (paymentMode === "CASH") {
            amountTendered = round2(paymentDetails?.amountTendered ?? total);
            if (amountTendered + 0.01 < total) {
              return null;
            }
            changeReturned = round2(amountTendered - total);
          }
        }

        const orderSequence = orders.filter((order) => order.sessionId === currentSession.id).length + 1;
        const completedAt = new Date().toISOString();
        const order: POSOrder = {
          id: generateId("pos-order"),
          sessionId: currentSession.id,
          orderNumber: generateOrderNumber(orderSequence),
          items: pricing.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            name: item.name,
            hsn: item.hsn,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discount: item.discount,
            gstRate: item.gstRate,
            taxAmount: item.taxAmount,
            total: item.total,
          })),
          subtotal: pricing.subtotal,
          discountAmount: pricing.discountAmount,
          taxBreakdown: pricing.taxBreakdown,
          total,
          paymentMode,
          paymentBreakdown,
          amountTendered,
          changeReturned,
          roundOffAmount: pricing.roundOffAmount,
          status: "COMPLETED",
          completedAt,
          customerName: paymentDetails?.customerName?.trim() || undefined,
          customerPhone: paymentDetails?.customerPhone?.trim() || undefined,
          notes: paymentDetails?.notes?.trim() || "",
          linkedInvoiceId: paymentDetails?.linkedInvoiceId,
        };

        const nextOrders = [order, ...orders];

        const stockManaged = isStockManagedBusiness(businessProfile);

        validatedCart.forEach((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return;
          if (!stockManaged) return;
          updateProduct({
            ...product,
            stock: settings.allowNegativeStock ? product.stock - item.quantity : Math.max(0, product.stock - item.quantity),
          });
        });

        if (paymentDetails?.generateLinkedInvoice && businessProfile.gstRegistrationStatus === "REGISTERED" && !businessProfile.compositionScheme) {
          const invoice = createInvoice({
            type: "TAX_INVOICE",
            status: "FINALIZED",
            issueDate: formatToday(new Date()),
            dueDate: formatToday(new Date()),
            supplyDate: formatToday(new Date()),
            seller: businessProfile,
            buyer: buildWalkInBuyer(businessProfile, order.customerName, order.customerPhone),
            lineItems: order.items.map(toInvoiceLineItem),
            isRCM: false,
            placeOfSupply: businessProfile.state,
            notes: order.notes,
            terms: "Paid at point of sale.",
            orderId: order.id,
            linkedInvoiceId: paymentDetails.linkedInvoiceId,
            customerId: undefined,
          });

          addPayment({
            invoiceId: invoice.id,
            orderId: order.id,
            date: formatToday(new Date()),
            amount: total,
            mode: paymentModeForInvoice(paymentMode, paymentBreakdown),
            reference: order.orderNumber,
            notes:
              paymentMode === "SPLIT"
                ? `Split POS settlement: cash ${paymentBreakdown.cash}, upi ${paymentBreakdown.upi}, card ${paymentBreakdown.card}, other ${paymentBreakdown.other}.`
                : "POS settlement",
          });

          order.linkedInvoiceId = invoice.id;
          nextOrders[0] = order;
        }

        setOrders(nextOrders);
        setCart([]);
        setCartDiscount(null);

        if (currentSession) {
          const snapshot = buildSessionSnapshot(
            {
              ...currentSession,
            },
            nextOrders,
            refunds,
          );
          const nextSession = {
            ...currentSession,
            ...snapshot,
          };
          setCurrentSession(nextSession);
          setSessions((prev) => prev.map((session) => (session.id === nextSession.id ? nextSession : session)));
        }

        return order;
      },
      refundOrder: (orderId, items, reason) => {
        const sourceOrder = orders.find((order) => order.id === orderId);
        if (!sourceOrder || sourceOrder.status === "VOIDED") {
          return null;
        }

        const existingRefundsForOrder = refunds.filter((refund) => refund.orderId === sourceOrder.id);
        const refundedQuantityByProduct = new Map<string, number>();
        for (const refund of existingRefundsForOrder) {
          for (const item of refund.items) {
            refundedQuantityByProduct.set(item.productId, (refundedQuantityByProduct.get(item.productId) ?? 0) + item.quantity);
          }
        }

        const refundedItems: POSLineItem[] = [];
        let refundSubtotal = 0;
        let refundTax = 0;

        for (const requestedItem of items) {
          const originalItem = sourceOrder.items.find((item) => item.productId === requestedItem.productId);
          if (!originalItem || requestedItem.quantity <= 0) {
            continue;
          }

          const alreadyRefunded = refundedQuantityByProduct.get(originalItem.productId) ?? 0;
          const remainingRefundable = Math.max(0, originalItem.quantity - alreadyRefunded);
          const quantity = Math.min(requestedItem.quantity, remainingRefundable);
          refundedQuantityByProduct.set(originalItem.productId, alreadyRefunded + quantity);
          if (quantity <= 0) {
            continue;
          }

          const unitShare = originalItem.quantity > 0 ? originalItem.total / originalItem.quantity : originalItem.unitPrice;
          const lineTotal = round2(unitShare * quantity);
          const lineTax = originalItem.quantity > 0 && originalItem.taxAmount ? round2((originalItem.taxAmount / originalItem.quantity) * quantity) : 0;
          const lineSubtotal = round2(lineTotal - lineTax);

          refundSubtotal = round2(refundSubtotal + lineSubtotal);
          refundTax = round2(refundTax + lineTax);
          refundedItems.push({
            ...originalItem,
            quantity,
            total: lineTotal,
            taxAmount: lineTax,
          });
        }

        if (!refundedItems.length) {
          return null;
        }

        const refundTotal = round2(refundSubtotal + refundTax);
        const refundBreakdown = createPaymentBreakdown();
        const originalBreakdownTotal = sumPaymentBreakdownTotal(sourceOrder.paymentBreakdown);

        if (originalBreakdownTotal > 0) {
          const ratio = refundTotal / originalBreakdownTotal;
          refundBreakdown.cash = round2(sourceOrder.paymentBreakdown.cash * ratio);
          refundBreakdown.upi = round2(sourceOrder.paymentBreakdown.upi * ratio);
          refundBreakdown.card = round2(sourceOrder.paymentBreakdown.card * ratio);
          refundBreakdown.other = round2(sourceOrder.paymentBreakdown.other * ratio);

          const distributed = sumPaymentBreakdownTotal(refundBreakdown);
          const remainder = round2(refundTotal - distributed);
          refundBreakdown.other = round2(refundBreakdown.other + remainder);
        } else {
          refundBreakdown.other = refundTotal;
        }

        const refundTaxBreakdown: TaxBreakdown = {
          taxableValue: round2(refundSubtotal),
          cgstRate: refundSubtotal > 0 ? round2(((refundTax / 2) / refundSubtotal) * 100) : 0,
          cgstAmount: round2(refundTax / 2),
          sgstRate: refundSubtotal > 0 ? round2(((refundTax / 2) / refundSubtotal) * 100) : 0,
          sgstAmount: round2(refundTax / 2),
          igstRate: 0,
          igstAmount: 0,
          cessRate: 0,
          cessAmount: 0,
          totalTax: round2(refundTax),
          grandTotal: refundTotal,
        };

        const refund: POSRefundRecord = {
          id: generateId("pos-refund"),
          orderId: sourceOrder.id,
          sessionId: sourceOrder.sessionId,
          items: refundedItems,
          subtotal: refundSubtotal,
          taxBreakdown: refundTaxBreakdown,
          total: refundTotal,
          paymentBreakdown: refundBreakdown,
          reason,
          refundedAt: new Date().toISOString(),
        };

        const nextRefunds = [refund, ...refunds];
        const isFullyRefunded = sourceOrder.items.every((item) => (refundedQuantityByProduct.get(item.productId) ?? 0) >= item.quantity);
        const updatedOrder: POSOrder = {
          ...sourceOrder,
          status: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
          refundedAt: refund.refundedAt,
          refundReason: reason,
        };

        refundedItems.forEach((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return;
          if (!isStockManagedBusiness(businessProfile)) return;
          updateProduct({
            ...product,
            stock: product.stock + item.quantity,
          });
        });

        const nextOrders = orders.map((order) => (order.id === sourceOrder.id ? updatedOrder : order));
        setOrders(nextOrders);
        setRefunds(nextRefunds);

        const affectedSession = currentSession?.id === sourceOrder.sessionId
          ? currentSession
          : sessions.find((session) => session.id === sourceOrder.sessionId) ?? null;

        if (affectedSession) {
          const sessionSnapshot = buildSessionSnapshot(affectedSession, nextOrders, nextRefunds);
          const updatedSession = {
            ...affectedSession,
            ...sessionSnapshot,
          };

          if (currentSession?.id === updatedSession.id) {
            setCurrentSession(updatedSession);
          }

          setSessions((prev) => prev.map((session) => (session.id === updatedSession.id ? updatedSession : session)));
        }

        return refund;
      },
      voidOrder: (orderId, reason) => {
        const sourceOrder = orders.find((order) => order.id === orderId);
        if (!sourceOrder || sourceOrder.status !== "COMPLETED") {
          return null;
        }

        if (!currentSession || currentSession.id !== sourceOrder.sessionId || currentSession.status !== "OPEN") {
          return null;
        }

        const updatedOrder: POSOrder = {
          ...sourceOrder,
          status: "VOIDED",
          voidedAt: new Date().toISOString(),
          voidReason: reason,
        };

        sourceOrder.items.forEach((item) => {
          const product = products.find((entry) => entry.id === item.productId);
          if (!product) return;
          if (!isStockManagedBusiness(businessProfile)) return;
          updateProduct({
            ...product,
            stock: product.stock + item.quantity,
          });
        });

        const nextOrders = orders.map((order) => (order.id === sourceOrder.id ? updatedOrder : order));
        setOrders(nextOrders);

        const sessionSnapshot = buildSessionSnapshot(currentSession, nextOrders, refunds);
        const updatedSession = {
          ...currentSession,
          ...sessionSnapshot,
        };
        setCurrentSession(updatedSession);
        setSessions((prev) => prev.map((session) => (session.id === updatedSession.id ? updatedSession : session)));

        return updatedOrder;
      },
      linkInvoiceToOrder: (orderId, invoiceId) => {
        const sourceOrder = orders.find((order) => order.id === orderId);
        if (!sourceOrder) {
          return null;
        }

        const updatedOrder: POSOrder = {
          ...sourceOrder,
          linkedInvoiceId: invoiceId,
        };

        const nextOrders = orders.map((order) => (order.id === orderId ? updatedOrder : order));
        setOrders(nextOrders);

        const affectedSession = currentSession?.id === sourceOrder.sessionId
          ? currentSession
          : sessions.find((session) => session.id === sourceOrder.sessionId) ?? null;

        if (affectedSession) {
          const sessionSnapshot = buildSessionSnapshot(affectedSession, nextOrders, refunds);
          const updatedSession = {
            ...affectedSession,
            ...sessionSnapshot,
          };
          if (currentSession?.id === updatedSession.id) {
            setCurrentSession(updatedSession);
          }
          setSessions((prev) => prev.map((session) => (session.id === updatedSession.id ? updatedSession : session)));
        }

        return updatedOrder;
      },
      updateSettings: (nextSettings) => {
        const updated = { ...settings, ...nextSettings };
        setSettings(updated);
        if (typeof window !== "undefined") {
          try {
            window.localStorage.setItem(POS_SETTINGS_STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // Ignore storage failures in demo mode.
          }
        }
        return updated;
      },
    }),
    [currentSession, sessions, cart, cartDiscount, orders, refunds, settings, products, businessProfile, createInvoice, addPayment, updateProduct],
  );

  return <PosStoreContext.Provider value={value}>{children}</PosStoreContext.Provider>;
}

export function usePosStore() {
  const context = useContext(PosStoreContext);
  if (!context) {
    throw new Error("usePosStore must be used within <PosStoreProvider>.");
  }
  return context;
}
