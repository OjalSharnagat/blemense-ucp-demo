import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock3,
  Minus,
  Plus,
  Printer,
  QrCode,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { fmt, type Product } from "@/utils";
import { useAdminStore } from "@/lib/store";
import { useBillingStore } from "@/lib/billingStore";
import { getBusinessModeConfig } from "@/lib/businessMode";
import { usePosStore } from "@/lib/posStore";
import type { POSOrder, POSPaymentMode } from "@/data/pos";
import type { LineItem, Party } from "@/data/billing";
import POSReceipt from "./POSReceipt";

type NoticeTone = "info" | "warning" | "success" | "error";

const STOCK_WARNING_THRESHOLD = 5;

const receiptCurrency = (value: number) => fmt.format(Number(value || 0));

const formatClock = (value: string | Date) =>
  new Date(value).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

const formatLongClock = (value: string | Date) =>
  new Date(value).toLocaleString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const formatDateKey = (value: string | Date) =>
  new Date(value).toLocaleDateString("en-CA");

const stockTone = (stock: number) => {
  if (stock <= 0) return { dot: "bg-rose-400", label: "Out" };
  if (stock <= STOCK_WARNING_THRESHOLD) return { dot: "bg-amber-400", label: "Low" };
  return { dot: "bg-emerald-400", label: "In" };
};

const colorTiles = [
  "from-cyan-500 to-sky-700",
  "from-fuchsia-500 to-purple-700",
  "from-amber-500 to-orange-700",
  "from-emerald-500 to-teal-700",
  "from-rose-500 to-red-700",
  "from-indigo-500 to-blue-700",
  "from-lime-500 to-green-700",
  "from-violet-500 to-indigo-700",
];

const tileClassForProduct = (product: Product) => {
  const key = `${product.id}${product.name}`;
  const hash = key.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return colorTiles[hash % colorTiles.length];
};

const searchBlob = (product: Product, includeBarcode: boolean) =>
  [product.name, product.sku, includeBarcode ? product.barcode ?? product.sku : null, product.category, product.description]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const buildBuyer = (businessState: string, businessStateCode: string, customerName?: string, customerPhone?: string): Party => ({
  id: `walk-in-${Date.now().toString(36)}`,
  name: customerName?.trim() || "Walk-in Customer",
  pan: "URP",
  address: "Counter sale",
  city: "",
  state: businessState,
  stateCode: businessStateCode,
  pincode: "",
  email: "",
  phone: customerPhone?.trim() || "",
  isRegistered: false,
});

function SaleOverlay({
  order,
  onPrint,
  onNewSale,
  onGenerateInvoice,
  invoiceLinked,
  canGenerateInvoice,
  changeAmount,
}: {
  order: POSOrder;
  onPrint: () => void;
  onNewSale: () => void;
  onGenerateInvoice: () => void;
  invoiceLinked: boolean;
  canGenerateInvoice: boolean;
  changeAmount: number;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/90 px-4">
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-200/60">
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Sale posted</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">{order.orderNumber}</h2>
            <p className="mt-1 text-sm text-slate-600">Sale recorded and stock updated.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-500">
            <Sparkles className="h-6 w-6" />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.72fr)]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">Slip preview</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Total</span>
                <span className="font-semibold text-slate-900">{receiptCurrency(order.total)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Payment</span>
                <span className="font-medium text-slate-900">{order.paymentMode}</span>
              </div>
              {order.paymentMode === "CASH" ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Change due</span>
                  <span className="font-medium text-slate-900">{receiptCurrency(changeAmount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Status</span>
                <span className="font-medium text-slate-700">Posted</span>
              </div>
              {invoiceLinked ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">Invoice</span>
                  <span className="font-medium text-slate-900">Attached</span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="h-11 w-full rounded-xl border-slate-200 bg-white text-slate-900 hover:bg-slate-50" onClick={onPrint}>
              <Printer className="mr-2 h-4 w-4" />
              Print slip
            </Button>
            <Button variant="secondary" className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={onNewSale}>
              New sale
            </Button>
          <Button
            className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
            onClick={onGenerateInvoice}
            disabled={!canGenerateInvoice && !invoiceLinked}
          >
              {invoiceLinked ? "Open invoice" : "Create invoice"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function POSTerminal() {
  const navigate = useNavigate();
  const { products } = useAdminStore();
  const { businessProfile, createInvoice, invoices } = useBillingStore();
  const businessMode = getBusinessModeConfig(businessProfile);
  const serviceBusiness = businessProfile.businessCategory === "SERVICES";
  const {
    currentSession,
    openSession,
    cart,
    cartDiscount,
    getCartSummary,
    addToCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    applyCartDiscount,
    checkout,
    linkInvoiceToOrder,
    settings,
  } = usePosStore();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [activeIndex, setActiveIndex] = useState(0);
  const [notice, setNotice] = useState<{ tone: NoticeTone; text: string } | null>(null);
  const [paymentMode, setPaymentMode] = useState<POSPaymentMode>(settings.defaultPaymentMode);
  const [amountTendered, setAmountTendered] = useState("0");
  const [cashDirty, setCashDirty] = useState(false);
  const [splitCash, setSplitCash] = useState("0");
  const [splitDigital, setSplitDigital] = useState("0");
  const [splitDigitalMode, setSplitDigitalMode] = useState<"UPI" | "CARD">("UPI");
  const [splitDirty, setSplitDirty] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [openingCash, setOpeningCash] = useState("0");
  const [operatorName, setOperatorName] = useState("Cashier");
  const [sessionNotes, setSessionNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [completedOrder, setCompletedOrder] = useState<POSOrder | null>(null);
  const [recentlyAddedProductId, setRecentlyAddedProductId] = useState<string | null>(null);
  const [keyboardHint, setKeyboardHint] = useState("F2 or / to focus search");
  const [windowWidth, setWindowWidth] = useState(typeof window === "undefined" ? 1440 : window.innerWidth);

  const searchRef = useRef<HTMLInputElement | null>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const noticeTimer = useRef<number | null>(null);
  const addedTimer = useRef<number | null>(null);
  const flashTimer = useRef<number | null>(null);
  const receiptPrintTimer = useRef<number | null>(null);
  const printedReceiptOrderId = useRef<string | null>(null);

  const categories = useMemo(() => {
    const items = new Set(products.map((product) => product.category).filter(Boolean));
    return ["All", ...Array.from(items).sort((a, b) => a.localeCompare(b))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesCategory = category === "All" || product.category === category;
        const matchesQuery = !query || searchBlob(product, settings.enableBarcode).includes(query);
        return matchesCategory && matchesQuery;
      })
      .sort((a, b) => {
        const statusScore = (item: Product) => (item.status === "active" ? 0 : item.status === "draft" ? 1 : 2);
        return statusScore(a) - statusScore(b) || a.name.localeCompare(b.name);
      });
  }, [products, search, category, settings.enableBarcode]);

  const summary = useMemo(() => getCartSummary(), [getCartSummary]);
  const paymentModes = useMemo(
    () => (settings.enableSplitPayment ? (["CASH", "UPI", "CARD", "SPLIT"] as POSPaymentMode[]) : (["CASH", "UPI", "CARD"] as POSPaymentMode[])),
    [settings.enableSplitPayment],
  );

  const total = summary?.total ?? 0;
  const discountAmount = summary?.discountAmount ?? 0;
  const taxBreakdown = summary?.taxBreakdown;
  const roundOffAmount = summary?.roundOffAmount ?? 0;
  const cashAmountTendered = Number(amountTendered || 0);
  const splitCashAmount = Number(splitCash || 0);
  const splitDigitalAmount = Number(splitDigital || 0);
  const cashChange = Math.max(0, cashAmountTendered - total);
  const splitBalance = Number((total - splitCashAmount - splitDigitalAmount).toFixed(2));
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const lowStockVisibleCount = serviceBusiness
    ? 0
    : filteredProducts.filter((product) => product.stock > 0 && product.stock <= settings.lowStockWarningThreshold).length;
  const linkedReceiptInvoice = completedOrder?.linkedInvoiceId
    ? invoices.find((invoice) => invoice.id === completedOrder.linkedInvoiceId)
    : undefined;
  const isSaleReady =
    Boolean(currentSession) &&
    Boolean(summary) &&
    cart.length > 0 &&
    ((paymentMode === "CASH" && cashAmountTendered >= total) ||
      (paymentMode === "UPI" && paymentConfirmed) ||
      (paymentMode === "CARD" && paymentConfirmed) ||
      (paymentMode === "SPLIT" && Math.abs(splitBalance) <= 0.01));

  const focusSearch = () => {
    searchRef.current?.focus();
    searchRef.current?.select();
  };

  const showNotice = (tone: NoticeTone, text: string) => {
    setNotice({ tone, text });
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 2400);
  };

  const printReceipt = () => {
    if (receiptPrintTimer.current) {
      window.clearTimeout(receiptPrintTimer.current);
      receiptPrintTimer.current = null;
    }
    if (completedOrder) {
      printedReceiptOrderId.current = completedOrder.id;
    }
    window.print();
  };

  const addSelectedProduct = (product: Product) => {
    if (!currentSession) {
      showNotice("warning", "Open a session first.");
      return;
    }

    const result = addToCart(product);
    if (result.item) {
      setRecentlyAddedProductId(product.id);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setRecentlyAddedProductId(null), 220);
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
      setNotice({ tone: "success", text: `${product.name} added to cart.` });
      addedTimer.current = window.setTimeout(() => setNotice(null), 1400);
      return;
    }
    if (result.warning) {
      showNotice("warning", result.warning);
    }
  };

  const handleCheckout = () => {
    if (!isSaleReady || !currentSession) {
      if (!currentSession) {
        showNotice("warning", "Open a session first.");
        return;
      }
      if (!cart.length) {
        showNotice("warning", "Add at least one product.");
        return;
      }
      if (paymentMode === "SPLIT" && Math.abs(splitBalance) > 0.01) {
        showNotice("error", "Split payment must match the grand total.");
        return;
      }
      if ((paymentMode === "UPI" || paymentMode === "CARD") && !paymentConfirmed) {
        showNotice("warning", "Confirm payment before completing the sale.");
        return;
      }
      if (paymentMode === "CASH" && cashAmountTendered < total) {
        showNotice("error", "Cash received is below the total.");
        return;
      }
      return;
    }

    const paymentDetails =
      paymentMode === "CASH"
        ? { paymentMode, amountTendered: cashAmountTendered }
        : paymentMode === "SPLIT"
          ? {
              paymentMode,
              paymentBreakdown:
                splitDigitalMode === "UPI"
                  ? { cash: splitCashAmount, upi: splitDigitalAmount, card: 0, other: 0 }
                  : { cash: splitCashAmount, upi: 0, card: splitDigitalAmount, other: 0 },
            }
          : {
              paymentMode,
            };

    const order = checkout({
      ...paymentDetails,
      notes: "",
      customerName,
      customerPhone,
      generateLinkedInvoice: false,
    });

    if (!order) {
      showNotice("error", "Unable to complete the sale.");
      return;
    }

    setCompletedOrder(order);
    setPaymentConfirmed(false);
    setCashDirty(false);
    setSplitDirty(false);
    setKeyboardHint(`Sale posted: ${order.orderNumber}`);
  };

  const handleInvoiceCreation = () => {
    if (!completedOrder) return;
    if (completedOrder.linkedInvoiceId) {
      navigate(`/admin/billing/${completedOrder.linkedInvoiceId}/preview`);
      return;
    }
    if (!businessMode.canCollectTax) {
      showNotice("warning", "GST invoice is unavailable for this business profile.");
      return;
    }

    const buyer = buildBuyer(businessProfile.state, businessProfile.stateCode, completedOrder.customerName, completedOrder.customerPhone);
    const lineItems: LineItem[] = completedOrder.items.map((item) => ({
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
    }));

    const invoice = createInvoice({
      type: "TAX_INVOICE",
      status: "FINALIZED",
      issueDate: formatDateKey(new Date()),
      dueDate: formatDateKey(new Date()),
      supplyDate: formatDateKey(new Date()),
      seller: businessProfile,
      buyer,
      lineItems,
      isRCM: false,
      placeOfSupply: businessProfile.state,
      notes: completedOrder.notes || "POS sale",
      terms: "Paid at point of sale.",
      orderId: completedOrder.id,
      linkedInvoiceId: completedOrder.linkedInvoiceId,
      customerId: undefined,
    });

    linkInvoiceToOrder(completedOrder.id, invoice.id);
    setCompletedOrder({ ...completedOrder, linkedInvoiceId: invoice.id });
    navigate(`/admin/billing/${invoice.id}/preview`);
  };

  useEffect(() => {
    if (currentSession) {
      focusSearch();
    }
  }, [currentSession]);

  useEffect(() => {
    if (!summary) {
      setAmountTendered("0");
      setSplitCash("0");
      setSplitDigital("0");
      return;
    }

    if (paymentMode === "CASH" && !cashDirty) {
      setAmountTendered(summary.total.toFixed(2));
    }

    if (paymentMode === "SPLIT" && !splitDirty) {
      setSplitCash(summary.total.toFixed(2));
      setSplitDigital("0");
    }
  }, [summary?.total, paymentMode, summary, cashDirty, splitDirty]);

  useEffect(() => {
    if (!completedOrder || !settings.autoPrintReceipt) {
      return;
    }

    if (printedReceiptOrderId.current === completedOrder.id) {
      return;
    }

    printedReceiptOrderId.current = completedOrder.id;

    if (receiptPrintTimer.current) {
      window.clearTimeout(receiptPrintTimer.current);
    }

    receiptPrintTimer.current = window.setTimeout(() => {
      receiptPrintTimer.current = null;
      printReceipt();
    }, 180);

    return () => {
      if (receiptPrintTimer.current) {
        window.clearTimeout(receiptPrintTimer.current);
      }
    };
  }, [completedOrder?.id, settings.autoPrintReceipt]);

  useEffect(() => {
    const syncWidth = () => setWindowWidth(window.innerWidth);
    syncWidth();
    window.addEventListener("resize", syncWidth);
    return () => window.removeEventListener("resize", syncWidth);
  }, []);

  useEffect(() => {
    setPaymentMode(settings.defaultPaymentMode);
  }, [settings.defaultPaymentMode]);

  useEffect(() => {
    if (!settings.enableCustomerCapture) {
      setCustomerName("");
      setCustomerPhone("");
    }
  }, [settings.enableCustomerCapture]);

  useEffect(() => {
    if (!settings.enableSplitPayment && paymentMode === "SPLIT") {
      setPaymentMode(settings.defaultPaymentMode === "SPLIT" ? "CASH" : settings.defaultPaymentMode);
    }
  }, [paymentMode, settings.defaultPaymentMode, settings.enableSplitPayment]);

  useEffect(() => {
    setActiveIndex((index) => {
      if (!filteredProducts.length) return 0;
      return Math.min(index, filteredProducts.length - 1);
    });
  }, [filteredProducts.length]);

  useEffect(() => {
    if (filteredProducts[activeIndex]) {
      cardRefs.current[activeIndex]?.focus({ preventScroll: true });
    }
  }, [activeIndex, filteredProducts]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (completedOrder) {
        return;
      }

      const activeElement = document.activeElement as HTMLElement | null;
      const isSearchFocused = activeElement === searchRef.current;
      const isEditable =
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement ||
        activeElement instanceof HTMLSelectElement;

      if (event.key === "F2" || (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey)) {
        event.preventDefault();
        focusSearch();
        return;
      }

      if (event.key === "Escape") {
        event.preventDefault();
        setSearch("");
        setActiveIndex(0);
        focusSearch();
        return;
      }

      if (event.key === "F12" || (event.key === "Enter" && event.ctrlKey)) {
        event.preventDefault();
        handleCheckout();
        return;
      }

      if (isEditable && !isSearchFocused) {
        return;
      }

      if (!filteredProducts.length) {
        return;
      }

      const columns = windowWidth >= 1280 ? 4 : windowWidth >= 768 ? 3 : 2;
      let nextIndex = activeIndex;

      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextIndex = Math.min(filteredProducts.length - 1, activeIndex + 1);
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        nextIndex = Math.max(0, activeIndex - 1);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nextIndex = Math.min(filteredProducts.length - 1, activeIndex + columns);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nextIndex = Math.max(0, activeIndex - columns);
      } else if (event.key === "Enter") {
        event.preventDefault();
        if (!currentSession) {
          showNotice("warning", "Open a session first.");
          return;
        }
        const product = filteredProducts[activeIndex];
        if (product) {
          addSelectedProduct(product);
        }
      } else {
        return;
      }

      if (nextIndex !== activeIndex) {
        setActiveIndex(nextIndex);
      }
    };

    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", onKeyDown, { capture: true } as AddEventListenerOptions);
  }, [activeIndex, filteredProducts, completedOrder, windowWidth, paymentMode, summary, cashAmountTendered, splitBalance, paymentConfirmed]);

  useEffect(() => {
    return () => {
      if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
      if (addedTimer.current) window.clearTimeout(addedTimer.current);
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
      if (receiptPrintTimer.current) window.clearTimeout(receiptPrintTimer.current);
    };
  }, []);

  const openDrawer = () => {
    const session = openSession(Number(openingCash || 0), operatorName.trim() || "Cashier", sessionNotes.trim());
    if (session) {
      showNotice("success", `Session opened for ${session.operatorName}.`);
    }
  };

  const onCardClick = (product: Product, index: number) => {
    setActiveIndex(index);
    addSelectedProduct(product);
  };

  const updateCartQuantity = (id: string, quantity: number) => {
    updateCartItem(id, { quantity });
  };

  const updateCartDiscount = (value: number, type = "FLAT") => {
    applyCartDiscount(type === "PERCENT" ? "PERCENT" : "FLAT", value);
  };

  const renderTerminal = () => (
    <div className="pos-terminal-light relative min-h-screen overflow-hidden bg-slate-50 text-slate-900">
      <style>{`
        .pos-terminal-light {
          color: #0f172a;
        }

        .pos-terminal-light [class*="bg-[#0b1220]"],
        .pos-terminal-light [class*="bg-slate-950/"],
        .pos-terminal-light [class*="bg-slate-900/"] {
          background-color: rgba(248, 250, 252, 0.96) !important;
        }

        .pos-terminal-light [class*="bg-slate-950"] {
          background-color: #ffffff !important;
        }

        .pos-terminal-light [class*="bg-slate-900"] {
          background-color: #f8fafc !important;
        }

        .pos-terminal-light [class*="bg-slate-800"] {
          background-color: #eef2f7 !important;
        }

        .pos-terminal-light [class*="border-white/25"],
        .pos-terminal-light [class*="border-white/20"],
        .pos-terminal-light [class*="border-white/10"],
        .pos-terminal-light [class*="border-white/5"] {
          border-color: #e2e8f0 !important;
        }

        .pos-terminal-light [class*="shadow-black"] {
          box-shadow: 0 18px 40px rgba(148, 163, 184, 0.16) !important;
        }

        .pos-terminal-light [class*="text-white"],
        .pos-terminal-light [class*="text-slate-50"],
        .pos-terminal-light [class*="text-slate-100"],
        .pos-terminal-light [class*="text-slate-200"] {
          color: #0f172a !important;
        }

        .pos-terminal-light [class*="text-slate-300"] {
          color: #334155 !important;
        }

        .pos-terminal-light [class*="text-slate-400"] {
          color: #475569 !important;
        }

        .pos-terminal-light [class*="text-slate-500"] {
          color: #64748b !important;
        }

        .pos-terminal-light [class*="hover:bg-slate-800"]:hover,
        .pos-terminal-light [class*="hover:bg-slate-900"]:hover {
          background-color: #e8edf5 !important;
        }

        .pos-terminal-light [class*="hover:border-slate-300"]:hover,
        .pos-terminal-light [class*="hover:border-white/20"]:hover {
          border-color: #cbd5e1 !important;
        }

        .pos-terminal-light [class*="focus:ring-slate-500"],
        .pos-terminal-light [class*="focus-visible:ring-slate-500"] {
          --tw-ring-color: rgba(100, 116, 139, 0.35) !important;
        }

        .pos-terminal-light [class*="from-slate-950"] {
          --tw-gradient-from: rgba(255, 255, 255, 0.78) !important;
          --tw-gradient-to: rgba(255, 255, 255, 0) !important;
        }

        .pos-terminal-light [class*="rounded-[24px]"],
        .pos-terminal-light [class*="rounded-[22px]"],
        .pos-terminal-light [class*="rounded-[18px]"],
        .pos-terminal-light [class*="rounded-[1.6rem]"] {
          border-radius: 1rem !important;
        }

        .pos-terminal-light [class*="shadow-sm shadow-slate-200/40"]:hover,
        .pos-terminal-light [class*="shadow-sm shadow-slate-200/60"]:hover,
        .pos-terminal-light [class*="shadow-lg shadow-slate-200/60"]:hover {
          box-shadow: 0 14px 30px rgba(148, 163, 184, 0.18) !important;
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0 bg-slate-100/80" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.03] [background-image:linear-gradient(rgba(148,163,184,0.55)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.55)_1px,transparent_1px)] [background-size:64px_64px]" />

      {completedOrder ? (
        <SaleOverlay
          order={completedOrder}
          onPrint={printReceipt}
          onNewSale={() => {
            setCompletedOrder(null);
            setPaymentConfirmed(false);
            setPaymentMode(settings.defaultPaymentMode);
            setAmountTendered("0");
            setSplitCash("0");
            setSplitDigital("0");
            setCustomerName("");
            setCustomerPhone("");
            setSearch("");
            setActiveIndex(0);
            setRecentlyAddedProductId(null);
            setKeyboardHint("F2 or / to focus search");
            clearCart(true);
            focusSearch();
          }}
          onGenerateInvoice={handleInvoiceCreation}
          invoiceLinked={Boolean(completedOrder.linkedInvoiceId)}
          canGenerateInvoice={businessMode.canCollectTax}
          changeAmount={cashChange}
        />
      ) : null}

      {completedOrder ? (
        <POSReceipt
          order={completedOrder}
          businessProfile={businessProfile}
          settings={settings}
          operatorName={currentSession?.operatorName || "Cashier"}
          invoiceNumber={linkedReceiptInvoice?.invoiceNumber}
        />
      ) : null}

      <div className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-4 my-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm shadow-slate-200/40">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Register rail</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
                  {currentSession ? currentSession.operatorName : "Register closed"}
                </p>
                <p className="mt-1 truncate text-xs text-slate-600">
                  {currentSession
                    ? `Opened ${formatLongClock(currentSession.openedAt)}`
                    : "Open a session to start billing."}
                </p>
              </div>
              <div className="hidden h-10 w-px bg-slate-200 lg:block" />
              <div className="flex flex-wrap gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Lane</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{currentSession ? "Open" : "Closed"}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Cart</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{cartItemCount}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Visible</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">{filteredProducts.length}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Shortcut</p>
                  <p className="mt-0.5 text-sm font-semibold text-slate-900">F2 / Enter / F12</p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row md:border-t-0 md:pt-0">
              <Button
                variant="outline"
                className="h-12 min-w-[12rem] rounded-xl border-slate-200 bg-white px-4 text-slate-900 hover:bg-slate-50"
                onClick={() => navigate("/pos/session?mode=close")}
              >
                Close Register
              </Button>
              <Button
                variant="outline"
                className="h-12 min-w-[12rem] rounded-xl border-slate-200 bg-white px-4 text-slate-900 hover:bg-slate-50"
                onClick={() => navigate("/admin/dashboard")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Exit POS
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 grid min-h-screen gap-4 px-4 pb-4 pt-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(360px,1fr)]">
        <section className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="border-b border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Register console</p>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      Fast entry
                    </span>
                  </div>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Sell fast. Stay on register.</h1>
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                    Search with name, SKU, or barcode. Move with arrows. Add with Enter. Keep the line moving without leaving the register.
                  </p>
                </div>
                <div className="hidden min-w-[13rem] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-xs text-slate-600 md:block">
                  <p className="font-semibold text-slate-900">{businessProfile.tradeName || businessProfile.legalName}</p>
                  <p className="mt-1">{businessMode.title}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.24em] text-slate-500">Register desk</p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm shadow-slate-200/40">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Items visible</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{filteredProducts.length}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Items in cart</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{cartItemCount}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{serviceBusiness ? "Stock checks" : "Low stock items"}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">{serviceBusiness ? "Off" : lowStockVisibleCount}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-2 pb-3 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Search lane</p>
                  <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                    F2 / Enter
                  </div>
                </div>
                <div className="relative mt-3 px-2">
                  <Search className="pointer-events-none absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                  <Input
                    ref={searchRef}
                    value={search}
                    onChange={(event) => {
                      setSearch(event.target.value);
                      setActiveIndex(0);
                    }}
                    placeholder="Search by name, SKU, or barcode"
                    className="h-14 rounded-xl border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 placeholder:text-slate-400 focus-visible:ring-slate-400"
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 px-2 text-xs text-slate-500">
                  <Badge variant="secondary" className="border border-slate-200 bg-white text-slate-700">
                    F2
                  </Badge>
                  <Badge variant="secondary" className="border border-slate-200 bg-white text-slate-700">
                    /
                  </Badge>
                  <span>{keyboardHint}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-sm shadow-slate-200/40">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-2 pb-3 pt-1">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Category rail</p>
                  <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{categories.length} lanes</p>
                </div>
                <div className="flex gap-2 overflow-x-auto px-1 py-3">
                  {categories.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setCategory(item);
                        setActiveIndex(0);
                      }}
                      className={cn(
                        "inline-flex h-10 min-w-[7rem] items-center justify-center whitespace-nowrap rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50",
                        category === item ? "border-slate-300 bg-slate-100 text-slate-900" : "",
                      )}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {notice ? (
            <div
              className={cn(
                "mx-4 mt-4 rounded-2xl border px-4 py-3 text-sm",
                notice.tone === "success"
                  ? "border-slate-200 bg-white text-slate-700"
                  : notice.tone === "warning"
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : notice.tone === "error"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-white text-slate-700",
              )}
            >
              {notice.text}
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              <span>{filteredProducts.length} products</span>
              <span>Stock warning at {settings.lowStockWarningThreshold}</span>
            </div>

            {!currentSession ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Open the register to start billing.
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {filteredProducts.map((product, index) => {
                const stock = serviceBusiness ? { dot: "bg-slate-400", label: "Service" } : stockTone(product.stock);
                const isActive = index === activeIndex;
                const cartQty = cart.find((item) => item.productId === product.id)?.quantity ?? 0;
                const flash = recentlyAddedProductId === product.id;

                return (
                  <button
                    key={product.id}
                    ref={(node) => {
                      cardRefs.current[index] = node;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onFocus={() => setActiveIndex(index)}
                    onClick={() => onCardClick(product, index)}
                    className={cn(
                      "group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm shadow-slate-200/40 transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:bg-slate-50 hover:shadow-md hover:shadow-slate-200/70 focus:outline-none focus:ring-2 focus:ring-slate-400",
                      isActive ? "border-slate-300 bg-slate-50 ring-2 ring-slate-300 ring-offset-0" : "",
                      flash ? "scale-[1.02]" : "",
                      !currentSession ? "cursor-not-allowed opacity-60" : "",
                      product.stock <= 0 || product.status !== "active" ? "opacity-75" : "",
                    )}
                    disabled={!currentSession}
                  >
                    <div className="relative mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                      {product.image ? (
                        <img src={product.image} alt={product.name} className="h-28 w-full object-cover" />
                      ) : (
                        <div className={cn("flex h-28 w-full items-center justify-center bg-gradient-to-br text-3xl font-semibold text-white", tileClassForProduct(product))}>
                          {product.name.slice(0, 1)}
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/85 to-transparent" />
                      <div className="absolute left-2 top-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700">
                        {product.category}
                      </div>
                      {cartQty > 0 ? (
                        <div className="absolute right-2 top-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-900 shadow-none">
                          x{cartQty}
                        </div>
                      ) : null}
                      {flash ? (
                        <div className="absolute bottom-2 right-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-900 shadow-none">
                          Added
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{product.name}</h3>
                        <p className="mt-1 truncate text-xs text-slate-600">
                          {product.sku}
                          {product.barcode ? ` • ${product.barcode}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-semibold text-slate-900">{receiptCurrency(product.price)}</p>
                        <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-slate-600">
                          {serviceBusiness ? null : <span className={cn("h-2 w-2 rounded-full", stock.dot)} />}
                          <span>{stock.label}</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="flex min-h-[calc(100vh-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
          <div className="border-b border-slate-200 bg-white p-4">
            {currentSession ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm shadow-slate-200/40">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Session</p>
                    <h2 className="mt-1 truncate text-2xl font-semibold text-slate-900">{currentSession.operatorName}</h2>
                    <p className="mt-1 text-sm text-slate-600">Opened {formatLongClock(currentSession.openedAt)}</p>
                    {currentSession.notes ? (
                      <p className="mt-2 line-clamp-2 text-xs text-slate-500">Note: {currentSession.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                      Open
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                      {currentSession.totalOrders} orders
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                      {receiptCurrency(currentSession.totalSales)} sales
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Opening cash</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{receiptCurrency(currentSession.openingCash)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Expected cash</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">
                      {receiptCurrency(currentSession.expectedCash ?? currentSession.openingCash)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Started</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatClock(currentSession.openedAt)}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Sales posted</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{receiptCurrency(currentSession.totalSales)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Payment mix</p>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Live register total</p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Cash</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{receiptCurrency(currentSession.paymentBreakdown.cash)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">UPI</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{receiptCurrency(currentSession.paymentBreakdown.upi)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-[0.22em] text-slate-500">Card</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{receiptCurrency(currentSession.paymentBreakdown.card)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm shadow-slate-200/40">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Session</p>
                <h2 className="mt-1 text-2xl font-semibold text-slate-900">Register closed</h2>
                <p className="mt-1 text-sm text-slate-600">Open the drawer to start billing, track cash, and post sales.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Status</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">Inactive</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Ready for</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">Start of day</p>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3">
                    <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Action</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">Open register</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {!currentSession ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <Card className="w-full max-w-md border-slate-200 bg-white text-slate-900 shadow-sm shadow-slate-200/40">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-slate-900">Open register</CardTitle>
                  <p className="text-sm text-slate-600">Count the drawer before you begin billing.</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Operator</label>
                      <Input
                        value={operatorName}
                        onChange={(event) => setOperatorName(event.target.value)}
                        className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Opening cash</label>
                      <Input
                        type="number"
                        value={openingCash}
                        onChange={(event) => setOpeningCash(event.target.value)}
                        className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Notes</label>
                    <Input
                      value={sessionNotes}
                      onChange={(event) => setSessionNotes(event.target.value)}
                      placeholder="Optional drawer note"
                      className="border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                    />
                  </div>
                  <Button className="h-11 w-full rounded-xl bg-slate-900 text-white hover:bg-slate-800" onClick={openDrawer}>
                    Open Register
                  </Button>
                </CardContent>
              </Card>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4">
                {cart.length === 0 ? (
                  <div className="flex h-full min-h-[18rem] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                    <div>
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                        <ShoppingCart className="h-6 w-6" />
                      </div>
                      <p className="mt-4 text-lg font-semibold text-slate-900">Cart is empty</p>
                      <p className="mt-1 text-sm text-slate-600">Use search, arrow keys, or barcode scans to start a sale fast.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {cart.map((item) => {
                      const product = products.find((entry) => entry.id === item.productId);
                      const lineTotal = item.total;

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40"
                        >
                          <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                              <p className="mt-1 text-xs text-slate-600">
                                {item.hsn ? `HSN ${item.hsn}` : "No HSN"} {product?.sku ? `• ${product.sku}` : ""}
                              </p>
                            </div>
                            <button
                              type="button"
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                              onClick={() => {
                                removeFromCart(item.id);
                              }}
                              aria-label={`Remove ${item.name}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                            <div className="grid grid-cols-[4rem_minmax(0,1fr)_4rem] items-center gap-2">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-11 w-11 rounded-xl border-slate-200 bg-white text-slate-900"
                                onClick={() => updateCartQuantity(item.id, Math.max(0, Number(item.quantity) - 1))}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <Input
                                type="number"
                                step="0.1"
                                inputMode="decimal"
                                value={item.quantity}
                                onChange={(event) => updateCartQuantity(item.id, Number(event.target.value || 0))}
                                className="h-11 rounded-xl border-slate-200 bg-white text-center text-sm text-slate-900"
                              />
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-11 w-11 rounded-xl border-slate-200 bg-white text-slate-900"
                                onClick={() => updateCartQuantity(item.id, Number(item.quantity) + 1)}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Rate</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{receiptCurrency(item.unitPrice)}</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Line total</p>
                              <p className="mt-1 text-sm font-semibold text-slate-900">{receiptCurrency(lineTotal)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 p-4">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                  <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Discount</p>
                      <p className="mt-1 text-sm text-slate-600">Order level adjustment</p>
                    </div>
                    <Button
                      variant="outline"
                      className="h-10 min-w-[6rem] rounded-xl border-slate-200 bg-white px-4 text-slate-900 hover:bg-slate-50"
                      onClick={() => {
                        applyCartDiscount("FLAT", 0);
                      }}
                    >
                      {cartDiscount ? "Clear" : "Off"}
                    </Button>
                  </div>

                  <div className="grid gap-2 sm:grid-cols-[auto,1fr]">
                    <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                      <button
                        type="button"
                        className={cn(
                          "h-10 min-w-[5.5rem] rounded-xl px-4 text-sm font-medium transition",
                          !cartDiscount || cartDiscount.type === "FLAT"
                            ? "bg-white text-slate-900 shadow-none"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                        onClick={() => updateCartDiscount(Number(cartDiscount?.value ?? 0), "FLAT")}
                      >
                        Flat
                      </button>
                      <button
                        type="button"
                        className={cn(
                          "h-10 min-w-[5.5rem] rounded-xl px-4 text-sm font-medium transition",
                          cartDiscount?.type === "PERCENT"
                            ? "bg-white text-slate-900 shadow-none"
                            : "text-slate-600 hover:text-slate-900",
                        )}
                        onClick={() => updateCartDiscount(Number(cartDiscount?.value ?? 0), "PERCENT")}
                      >
                        %
                      </button>
                    </div>
                    <Input
                      type="number"
                      step="0.01"
                      value={cartDiscount?.value ?? ""}
                      onChange={(event) => {
                        const value = Number(event.target.value || 0);
                        updateCartDiscount(value, cartDiscount?.type ?? "FLAT");
                      }}
                      placeholder="0"
                      className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                    />
                  </div>

                  {cartDiscount ? (
                    <p className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      Discount applied: <span className="font-semibold text-slate-900">{receiptCurrency(discountAmount)}</span>
                    </p>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                  <Row label="Subtotal" value={receiptCurrency(summary?.subtotal ?? 0)} />
                  <Row label="Discount" value={`- ${receiptCurrency(discountAmount)}`} />
                  {taxBreakdown ? (
                    businessMode.showTaxColumns ? (
                      <>
                        <Row label="CGST" value={receiptCurrency(taxBreakdown.cgstAmount)} />
                        <Row label="SGST" value={receiptCurrency(taxBreakdown.sgstAmount)} />
                      </>
                    ) : null
                  ) : null}
                  {taxBreakdown && taxBreakdown.totalTax > 0 ? <Row label="Tax" value={receiptCurrency(taxBreakdown.totalTax)} /> : null}
                  <Row label="Round-off" value={receiptCurrency(roundOffAmount)} />
                  <div className="mt-2 flex items-end justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Grand Total</p>
                      <p className="mt-1 text-sm text-slate-600">Ready to charge</p>
                    </div>
                    <p className="text-3xl font-semibold text-slate-900">{receiptCurrency(total)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Payment</p>
                    <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                      F12 / Ctrl+Enter
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-emerald-50 p-4 shadow-sm shadow-slate-200/40">
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Customer details</p>
                        <p className="mt-1 text-sm text-slate-600">Optional fields for receipts, invoices, and callback follow-up.</p>
                      </div>
                      <div className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                        {settings.enableCustomerCapture ? "Active" : "Optional"}
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-3">
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Customer name</label>
                        <Input
                          value={customerName}
                          onChange={(event) => setCustomerName(event.target.value)}
                          placeholder="Walk-in Customer"
                          className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                      <div className="rounded-2xl border border-emerald-100 bg-white px-3 py-3">
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Mobile number</label>
                        <Input
                          value={customerPhone}
                          onChange={(event) => setCustomerPhone(event.target.value)}
                          placeholder="98765 43210"
                          className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                    <div className={`grid gap-2 ${settings.enableSplitPayment ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                      {paymentModes.map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          size="lg"
                          variant={paymentMode === mode ? "default" : "outline"}
                          className={cn(
                            "h-12 rounded-xl border-slate-200 font-semibold",
                            paymentMode === mode
                              ? "bg-white text-slate-900 shadow-none hover:bg-slate-50"
                              : "bg-slate-50 text-slate-700 hover:bg-white",
                          )}
                          onClick={() => {
                            setPaymentMode(mode);
                            setPaymentConfirmed(false);
                            if (mode === "CASH") {
                              setAmountTendered(summary?.total.toFixed(2) ?? "0");
                              setCashDirty(false);
                            }
                            if (mode === "UPI" || mode === "CARD") {
                              setPaymentConfirmed(false);
                            }
                            if (mode === "SPLIT") {
                              setSplitCash(summary?.total.toFixed(2) ?? "0");
                              setSplitDigital("0");
                              setSplitDirty(false);
                            }
                          }}
                        >
                          {mode}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {paymentMode === "CASH" ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Amount tendered</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={amountTendered}
                          onChange={(event) => {
                            setAmountTendered(event.target.value);
                            setCashDirty(true);
                          }}
                          className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Change due</span>
                        <span className="text-lg font-semibold text-slate-900">{receiptCurrency(cashChange)}</span>
                      </div>
                    </div>
                  ) : null}

                  {paymentMode === "UPI" ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                      <div className="flex items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6">
                        <div className="text-center">
                          <div className="mx-auto flex h-28 w-28 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500">
                            <QrCode className="h-12 w-12" />
                          </div>
                          <p className="mt-3 text-sm font-medium text-slate-900">Digital payment placeholder</p>
                          <p className="mt-1 text-xs text-slate-600">Production would render a live payment display here.</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => setPaymentConfirmed(true)}
                      >
                        {paymentConfirmed ? "Payment confirmed" : "Confirm payment"}
                      </Button>
                    </div>
                  ) : null}

                  {paymentMode === "CARD" ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                      <div className="flex items-center justify-between rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4">
                        <div>
                          <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Card terminal</p>
                          <p className="mt-1 text-sm text-slate-600">Press confirm after the card machine completes.</p>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700">
                          Ready
                        </div>
                      </div>
                      <Button
                        type="button"
                        className="mt-3 h-12 w-full rounded-xl border border-slate-200 bg-slate-900 text-white hover:bg-slate-800"
                        onClick={() => setPaymentConfirmed(true)}
                      >
                        {paymentConfirmed ? "Payment confirmed" : "Confirm payment"}
                      </Button>
                    </div>
                  ) : null}

                  {paymentMode === "SPLIT" ? (
                    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-200/40">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-1.5">
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            variant={splitDigitalMode === "UPI" ? "default" : "outline"}
                          className={cn(
                              "h-11 rounded-xl border-slate-200 font-semibold",
                              splitDigitalMode === "UPI"
                                ? "bg-white text-slate-900 hover:bg-slate-50"
                                : "bg-slate-50 text-slate-700 hover:bg-white",
                            )}
                            onClick={() => setSplitDigitalMode("UPI")}
                          >
                            UPI
                          </Button>
                          <Button
                            variant={splitDigitalMode === "CARD" ? "default" : "outline"}
                          className={cn(
                              "h-11 rounded-xl border-slate-200 font-semibold",
                              splitDigitalMode === "CARD"
                                ? "bg-white text-slate-900 hover:bg-slate-50"
                                : "bg-slate-50 text-slate-700 hover:bg-white",
                            )}
                            onClick={() => setSplitDigitalMode("CARD")}
                          >
                            Card
                          </Button>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Cash amount</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={splitCash}
                          onChange={(event) => {
                            setSplitCash(event.target.value);
                            setSplitDirty(true);
                          }}
                          className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                        <label className="mb-1 block text-xs uppercase tracking-wide text-slate-500">
                          {splitDigitalMode} amount
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={splitDigital}
                          onChange={(event) => {
                            setSplitDigital(event.target.value);
                            setSplitDirty(true);
                          }}
                          className="h-11 rounded-xl border-slate-200 bg-white text-slate-900"
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Balance</span>
                        <span className={cn("text-lg font-semibold", Math.abs(splitBalance) <= 0.01 ? "text-slate-900" : "text-slate-600")}>
                          {receiptCurrency(splitBalance)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        className={cn(
                          "h-12 w-full rounded-xl border border-slate-200 font-semibold",
                          Math.abs(splitBalance) <= 0.01
                            ? "bg-white text-slate-900 hover:bg-slate-50"
                            : "bg-slate-50 text-slate-700 hover:bg-white",
                        )}
                        onClick={() => setPaymentConfirmed(true)}
                      >
                        {Math.abs(splitBalance) <= 0.01 ? "Split matched" : "Confirm split"}
                      </Button>
                    </div>
                  ) : null}

                <Button
                  className="mt-4 h-14 w-full rounded-xl bg-slate-950 text-white shadow-lg shadow-slate-300/60 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
                  onClick={handleCheckout}
                  disabled={!isSaleReady}
                >
                    Charge / Complete Sale
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );

  if (!currentSession) {
    return <Navigate to="/pos/session?mode=open" replace />;
  }

  return renderTerminal();
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
      <span className="text-[11px] uppercase tracking-[0.24em] text-slate-500">{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}
