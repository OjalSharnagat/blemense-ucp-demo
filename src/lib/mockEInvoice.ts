import type { Invoice } from "@/data/billing";
import { computeLineItemTax, resolveTaxCode } from "@/lib/gst";

type MockEInvoiceSource = Pick<
  Invoice,
  "invoiceNumber" | "issueDate" | "supplyDate" | "seller" | "buyer" | "type" | "taxBreakdown" | "financialYear" | "lineItems"
>;

export interface MockEInvoiceDetails {
  irn: string;
  irnAcknowledgementNumber: string;
  irnAcknowledgementDate: string;
  irnQrCodeDataUrl: string;
  mockEInvoicePayload: Invoice["mockEInvoicePayload"];
}

const hashString = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, "0");
};

const buildHexChain = (seed: string): string => {
  const segments = Array.from({ length: 8 }, (_, index) => hashString(`${seed}:${index}`));
  return segments.join("").slice(0, 64);
};

const buildMockQrSvg = (payload: string): string => {
  const size = 25;
  const cell = 8;
  const padding = 8;
  const dimension = size * cell + padding * 2;
  const hash = buildHexChain(payload);

  const isFinderZone = (x: number, y: number): boolean =>
    (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);

  const rects: string[] = [];

  const addFinder = (x0: number, y0: number) => {
    rects.push(`<rect x="${x0}" y="${y0}" width="${7 * cell}" height="${7 * cell}" rx="2" fill="#111827" />`);
    rects.push(`<rect x="${x0 + cell}" y="${y0 + cell}" width="${5 * cell}" height="${5 * cell}" fill="#ffffff" />`);
    rects.push(`<rect x="${x0 + 2 * cell}" y="${y0 + 2 * cell}" width="${3 * cell}" height="${3 * cell}" fill="#111827" />`);
  };

  addFinder(padding, padding);
  addFinder(dimension - padding - 7 * cell, padding);
  addFinder(padding, dimension - padding - 7 * cell);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (isFinderZone(col, row)) continue;
      const index = (row * size + col) % hash.length;
      const nibble = Number.parseInt(hash[index] || "0", 16);
      if ((nibble + row + col) % 3 !== 0) continue;
      const x = padding + col * cell;
      const y = padding + row * cell;
      rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="#111827" />`);
    }
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${dimension}" height="${dimension}" viewBox="0 0 ${dimension} ${dimension}" role="img" aria-label="Mock QR code">
      <rect width="100%" height="100%" fill="#ffffff" />
      ${rects.join("")}
      <rect x="${padding}" y="${dimension - 28}" width="${dimension - padding * 2}" height="20" rx="4" fill="#eff6ff" />
      <text x="${dimension / 2}" y="${dimension - 14}" font-family="Arial, sans-serif" font-size="10" text-anchor="middle" fill="#1d4ed8">MOCK IRN QR</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

const shouldGenerateMockEInvoice = (invoice: Pick<Invoice, "seller" | "type">): boolean => {
  return invoice.seller.gstRegistrationStatus === "REGISTERED" && !invoice.seller.compositionScheme && invoice.type === "TAX_INVOICE";
};

export const generateMockEInvoice = (invoice: MockEInvoiceSource, timestamp = new Date()): MockEInvoiceDetails => {
  const seed = [
    invoice.invoiceNumber,
    invoice.issueDate,
    invoice.supplyDate,
    invoice.seller.gstin || invoice.seller.legalName,
    invoice.buyer.gstin || invoice.buyer.name,
    invoice.type,
    String(invoice.taxBreakdown.grandTotal),
    invoice.financialYear,
  ].join("|");

  const lineItems = invoice.lineItems.map((item) => {
    const resolution = resolveTaxCode(item);
    const tax = computeLineItemTax(item, invoice.seller.stateCode.trim() !== invoice.buyer.stateCode.trim());
    return {
      description: item.description,
      taxCode: resolution.code,
      taxCodeType: resolution.codeType,
      hsn: item.hsn || resolution.code,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      gstRate: resolution.effectiveGstRate,
      taxableValue: tax.taxableValue,
      taxAmount: tax.igstAmount + tax.cgstAmount + tax.sgstAmount,
    };
  });

  const irn = `MOCK-${buildHexChain(seed)}`;
  const acknowledgementSeed = `${seed}|ack`;
  const irnAcknowledgementNumber = `${buildHexChain(acknowledgementSeed).replace(/[A-F]/g, "").slice(0, 15)}`.padStart(15, "0");
  const irnAcknowledgementDate = timestamp.toISOString();
  const irnQrCodeDataUrl = buildMockQrSvg(`${irn}|${irnAcknowledgementNumber}`);
  const mockEInvoicePayload = {
    lineItems,
    totals: {
      taxableValue: invoice.taxBreakdown.taxableValue,
      totalTax: invoice.taxBreakdown.totalTax,
      grandTotal: invoice.taxBreakdown.grandTotal,
    },
  };

  return {
    irn,
    irnAcknowledgementNumber,
    irnAcknowledgementDate,
    irnQrCodeDataUrl,
    mockEInvoicePayload,
  };
};

export const attachMockEInvoice = <T extends Invoice>(invoice: T, timestamp = new Date()): T => {
  if (!shouldGenerateMockEInvoice(invoice) || invoice.irn) {
    return invoice;
  }

  return {
    ...invoice,
    ...generateMockEInvoice(invoice, timestamp),
  };
};

export const supportsMockEInvoice = shouldGenerateMockEInvoice;
