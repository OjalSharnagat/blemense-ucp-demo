import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import type { Invoice, LineItem } from "@/data/billing";
import { getBusinessModeConfig } from "@/lib/businessMode";
import { useBillingStore } from "@/lib/billingStore";
import { computeLineItemTax } from "@/lib/gst";
import { downloadJsonFile } from "@/lib/pdfExport";
import { Link } from "react-router-dom";
import { Badge } from "../../../ui/badge";
import { Button } from "../../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/card";
import { Select } from "../../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../ui/table";

const MONEY = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type TaxLine = {
  rate: number;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
};

type TaxRollup = {
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
};

const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

const isInvoiceEligible = (invoice: Invoice): boolean => {
  if (invoice.status === "DRAFT" || invoice.status === "CANCELLED") return false;
  if (invoice.type === "PROFORMA") return false;
  if (invoice.seller.gstRegistrationStatus !== "REGISTERED" || invoice.seller.compositionScheme) return false;
  return true;
};

const parseDate = (value: string): Date => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const getTaxLines = (invoice: Invoice): TaxLine[] => {
  const byRate = new Map<number, TaxRollup>();
  for (const item of invoice.lineItems) {
    const line = computeLineItemTax(item, invoice.isInterState);
    const rate = Number(item.gstRate.toFixed(2));
    const current = byRate.get(rate) ?? { taxable: 0, igst: 0, cgst: 0, sgst: 0 };
    current.taxable += line.taxableValue;
    current.igst += line.igstAmount;
    current.cgst += line.cgstAmount;
    current.sgst += line.sgstAmount;
    byRate.set(rate, current);
  }
  return [...byRate.entries()].map(([rate, tax]) => ({
    rate,
    taxable: round2(tax.taxable),
    igst: round2(tax.igst),
    cgst: round2(tax.cgst),
    sgst: round2(tax.sgst),
  }));
};

const getLineSign = (type: Invoice["type"]): number => (type === "CREDIT_NOTE" ? -1 : 1);

export default function GSTReturnsView() {
  const { invoices, businessProfile } = useBillingStore();
  const businessMode = getBusinessModeConfig(businessProfile);

  if (!businessMode.showGstReturns) {
    return (
      <div className="dash-view space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">GST Returns</h1>
        <Card>
          <CardContent className="space-y-3 py-6">
            <p className="text-sm text-muted-foreground">
              GST returns are hidden because this business profile is not GST registered.
            </p>
            <p className="text-sm text-muted-foreground">
              Turn on GST registration in Business Setup when you are ready for returns, tax invoices, and filing workflows.
            </p>
            <Button asChild>
              <Link to="/admin/settings/business-gst">Open Business Setup</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    for (const invoice of invoices) {
      set.add(parseDate(invoice.supplyDate).getFullYear());
    }
    return [...set].sort((a, b) => b - a);
  }, [invoices]);

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(availableYears[0] ?? now.getFullYear());
  const [tab, setTab] = useState<"GSTR1" | "GSTR3B">("GSTR1");
  const [sections, setSections] = useState({
    s4a: true,
    s5: true,
    s7: true,
    s9b: true,
  });

  const fp = `${String(selectedMonth).padStart(2, "0")}${selectedYear}`;

  const periodInvoices = useMemo(
    () =>
      invoices.filter((invoice) => {
        if (!isInvoiceEligible(invoice)) return false;
        const supplyDate = parseDate(invoice.supplyDate);
        return supplyDate.getMonth() + 1 === selectedMonth && supplyDate.getFullYear() === selectedYear;
      }),
    [invoices, selectedMonth, selectedYear],
  );

  const b2bRows = useMemo(() => {
    const rows: Array<{
      invoiceId: string;
      gstin: string;
      receiverName: string;
      invoiceNo: string;
      date: string;
      value: number;
      placeOfSupply: string;
      reverseCharge: string;
      invoiceType: string;
      rate: number;
      taxableValue: number;
      igst: number;
      cgst: number;
      sgst: number;
    }> = [];

    for (const invoice of periodInvoices) {
      if (!invoice.buyer.isRegistered) continue;
      if (invoice.type !== "TAX_INVOICE") continue;
      for (const taxLine of getTaxLines(invoice)) {
        rows.push({
          invoiceId: invoice.id,
          gstin: invoice.buyer.gstin ?? "",
          receiverName: invoice.buyer.name,
          invoiceNo: invoice.invoiceNumber,
          date: invoice.issueDate,
          value: invoice.taxBreakdown.grandTotal,
          placeOfSupply: invoice.placeOfSupply,
          reverseCharge: invoice.isRCM ? "Y" : "N",
          invoiceType: invoice.type,
          rate: taxLine.rate,
          taxableValue: taxLine.taxable,
          igst: taxLine.igst,
          cgst: taxLine.cgst,
          sgst: taxLine.sgst,
        });
      }
    }

    return rows;
  }, [periodInvoices]);

  const b2clRows = useMemo(() => {
    const grouped = new Map<string, { placeOfSupply: string; rate: number; taxable: number; igst: number; value: number }>();
    for (const invoice of periodInvoices) {
      if (invoice.buyer.isRegistered) continue;
      if (invoice.taxBreakdown.grandTotal <= 250000) continue;
      if (invoice.type !== "TAX_INVOICE") continue;
      for (const line of getTaxLines(invoice)) {
        const key = `${invoice.placeOfSupply}-${line.rate}`;
        const current = grouped.get(key) ?? {
          placeOfSupply: invoice.placeOfSupply,
          rate: line.rate,
          taxable: 0,
          igst: 0,
          value: 0,
        };
        current.taxable += line.taxable;
        current.igst += line.igst;
        current.value += invoice.taxBreakdown.grandTotal;
        grouped.set(key, current);
      }
    }
    return [...grouped.values()].map((row) => ({
      ...row,
      taxable: round2(row.taxable),
      igst: round2(row.igst),
      value: round2(row.value),
    }));
  }, [periodInvoices]);

  const b2csRows = useMemo(() => {
    const grouped = new Map<string, { placeOfSupply: string; rate: number; taxable: number; igst: number; cgst: number; sgst: number }>();

    for (const invoice of periodInvoices) {
      if (invoice.buyer.isRegistered) continue;
      if (invoice.type !== "TAX_INVOICE" && invoice.type !== "CREDIT_NOTE" && invoice.type !== "DEBIT_NOTE") continue;
      if (invoice.type === "TAX_INVOICE" && invoice.taxBreakdown.grandTotal > 250000) continue;

      const sign = getLineSign(invoice.type);
      for (const line of getTaxLines(invoice)) {
        const key = `${invoice.placeOfSupply}-${line.rate}-${invoice.isInterState ? "I" : "C"}`;
        const current = grouped.get(key) ?? {
          placeOfSupply: invoice.placeOfSupply,
          rate: line.rate,
          taxable: 0,
          igst: 0,
          cgst: 0,
          sgst: 0,
        };
        current.taxable += sign * line.taxable;
        current.igst += sign * line.igst;
        current.cgst += sign * line.cgst;
        current.sgst += sign * line.sgst;
        grouped.set(key, current);
      }
    }
    return [...grouped.values()].map((row) => ({
      ...row,
      taxable: round2(row.taxable),
      igst: round2(row.igst),
      cgst: round2(row.cgst),
      sgst: round2(row.sgst),
    }));
  }, [periodInvoices]);

  const noteRows = useMemo(() => {
    const rows: Array<{
      gstin: string;
      receiverName: string;
      noteNo: string;
      noteDate: string;
      noteType: "C" | "D";
      linkedInvoiceNo: string;
      linkedInvoiceDate: string;
      value: number;
      rate: number;
      taxable: number;
      igst: number;
      cgst: number;
      sgst: number;
    }> = [];

    for (const invoice of periodInvoices) {
      if (invoice.type !== "CREDIT_NOTE" && invoice.type !== "DEBIT_NOTE") continue;
      const linked = invoice.linkedInvoiceId ? invoices.find((it) => it.id === invoice.linkedInvoiceId) : undefined;
      const isRegistered = linked ? linked.buyer.isRegistered : invoice.buyer.isRegistered;
      if (!isRegistered) continue;
      const sign = getLineSign(invoice.type);
      for (const line of getTaxLines(invoice)) {
        rows.push({
          gstin: invoice.buyer.gstin ?? linked?.buyer.gstin ?? "",
          receiverName: invoice.buyer.name,
          noteNo: invoice.invoiceNumber,
          noteDate: invoice.issueDate,
          noteType: invoice.type === "CREDIT_NOTE" ? "C" : "D",
          linkedInvoiceNo: linked?.invoiceNumber ?? "-",
          linkedInvoiceDate: linked?.issueDate ?? "",
          value: round2(sign * invoice.taxBreakdown.grandTotal),
          rate: line.rate,
          taxable: round2(sign * line.taxable),
          igst: round2(sign * line.igst),
          cgst: round2(sign * line.cgst),
          sgst: round2(sign * line.sgst),
        });
      }
    }
    return rows;
  }, [periodInvoices, invoices]);

  const gstr1Totals = useMemo(() => {
    const sum = <T extends Record<string, unknown>>(rows: T[], key: keyof T): number =>
      round2(rows.reduce((acc, row) => acc + Number(row[key] || 0), 0));
    return {
      b2b: {
        value: sum(b2bRows, "value"),
        taxableValue: sum(b2bRows, "taxableValue"),
        igst: sum(b2bRows, "igst"),
        cgst: sum(b2bRows, "cgst"),
        sgst: sum(b2bRows, "sgst"),
      },
      b2cl: {
        value: sum(b2clRows, "value"),
        taxable: sum(b2clRows, "taxable"),
        igst: sum(b2clRows, "igst"),
      },
      b2cs: {
        taxable: sum(b2csRows, "taxable"),
        igst: sum(b2csRows, "igst"),
        cgst: sum(b2csRows, "cgst"),
        sgst: sum(b2csRows, "sgst"),
      },
      notes: {
        value: sum(noteRows, "value"),
        taxable: sum(noteRows, "taxable"),
        igst: sum(noteRows, "igst"),
        cgst: sum(noteRows, "cgst"),
        sgst: sum(noteRows, "sgst"),
      },
    };
  }, [b2bRows, b2clRows, b2csRows, noteRows]);

  const gstr3b = useMemo(() => {
    let taxable = 0;
    let taxableI = 0;
    let taxableC = 0;
    let taxableS = 0;
    let nilExempt = 0;
    const interstateByState = new Map<string, { taxable: number; igst: number }>();

    for (const invoice of periodInvoices) {
      const sign = getLineSign(invoice.type);
      for (const item of invoice.lineItems) {
        const line = computeLineItemTax(item, invoice.isInterState);
        if (item.gstRate <= 0) {
          nilExempt += sign * line.taxableValue;
          continue;
        }
        taxable += sign * line.taxableValue;
        taxableI += sign * line.igstAmount;
        taxableC += sign * line.cgstAmount;
        taxableS += sign * line.sgstAmount;

        if (invoice.isInterState) {
          const current = interstateByState.get(invoice.placeOfSupply) ?? { taxable: 0, igst: 0 };
          current.taxable += sign * line.taxableValue;
          current.igst += sign * line.igstAmount;
          interstateByState.set(invoice.placeOfSupply, current);
        }
      }
    }

    const zeroRated = 0;
    const nonGst = 0;
    const outwardTotal = taxable + zeroRated + nilExempt + nonGst;

    return {
      section31: {
        taxable: round2(taxable),
        igst: round2(taxableI),
        cgst: round2(taxableC),
        sgst: round2(taxableS),
        zeroRated: round2(zeroRated),
        nilExempt: round2(nilExempt),
        nonGst: round2(nonGst),
        total: round2(outwardTotal),
      },
      section32: [...interstateByState.entries()].map(([state, values]) => ({
        state,
        taxable: round2(values.taxable),
        igst: round2(values.igst),
      })),
      section5: {
        exempt: round2(nilExempt),
        nil: round2(nilExempt),
        nonGst: round2(nonGst),
      },
      taxPayable: {
        igst: round2(taxableI),
        cgst: round2(taxableC),
        sgst: round2(taxableS),
        total: round2(taxableI + taxableC + taxableS),
      },
    };
  }, [periodInvoices]);

  const gstr1Json = useMemo(() => {
    const b2bMap = new Map<
      string,
      {
        ctin: string;
        inv: Array<{
          inum: string;
          idt: string;
          val: number;
          pos: string;
          rchrg: "Y" | "N";
          inv_typ: string;
          itms: Array<{ num: number; itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number } }>;
        }>;
      }
    >();

    for (const row of b2bRows) {
      const ctin = row.gstin;
      const current = b2bMap.get(ctin) ?? { ctin, inv: [] };
      let inv = current.inv.find((it) => it.inum === row.invoiceNo);
      if (!inv) {
        inv = {
          inum: row.invoiceNo,
          idt: parseDate(row.date).toLocaleDateString("en-GB").split("/").join("-"),
          val: round2(row.value),
          pos: row.placeOfSupply,
          rchrg: row.reverseCharge as "Y" | "N",
          inv_typ: "R",
          itms: [],
        };
        current.inv.push(inv);
      }
      inv.itms.push({
        num: inv.itms.length + 1,
        itm_det: {
          rt: row.rate,
          txval: round2(row.taxableValue),
          iamt: round2(row.igst),
          camt: round2(row.cgst),
          samt: round2(row.sgst),
          csamt: 0,
        },
      });
      b2bMap.set(ctin, current);
    }

    const b2cl = b2clRows.map((row, index) => ({
      pos: row.placeOfSupply,
      inv: [
        {
          inum: `B2CL-${index + 1}`,
          idt: `01-${String(selectedMonth).padStart(2, "0")}-${selectedYear}`,
          val: round2(row.value),
          itms: [
            {
              num: 1,
              itm_det: {
                rt: row.rate,
                txval: round2(row.taxable),
                iamt: round2(row.igst),
                csamt: 0,
              },
            },
          ],
        },
      ],
    }));

    const b2cs = b2csRows.map((row) => ({
      sply_ty: row.igst ? "INTER" : "INTRA",
      typ: "OE",
      pos: row.placeOfSupply,
      rt: row.rate,
      txval: round2(row.taxable),
      iamt: round2(row.igst),
      camt: round2(row.cgst),
      samt: round2(row.sgst),
      csamt: 0,
    }));

    const cdnrMap = new Map<
      string,
      {
        ctin: string;
        nt: Array<{
          nt_num: string;
          nt_dt: string;
          ntty: "C" | "D";
          rsn: string;
          p_gst: "Y" | "N";
          inum: string;
          idt: string;
          val: number;
          itms: Array<{ num: number; itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number } }>;
        }>;
      }
    >();
    for (const row of noteRows) {
      const ctin = row.gstin;
      const current = cdnrMap.get(ctin) ?? { ctin, nt: [] };
      let note = current.nt.find((it) => it.nt_num === row.noteNo);
      if (!note) {
        note = {
          nt_num: row.noteNo,
          nt_dt: parseDate(row.noteDate).toLocaleDateString("en-GB").split("/").join("-"),
          ntty: row.noteType,
          rsn: "Sales Return / Adjustment",
          p_gst: "Y",
          inum: row.linkedInvoiceNo,
          idt: row.linkedInvoiceDate
            ? parseDate(row.linkedInvoiceDate).toLocaleDateString("en-GB").split("/").join("-")
            : "",
          val: round2(row.value),
          itms: [],
        };
        current.nt.push(note);
      }
      note.itms.push({
        num: note.itms.length + 1,
        itm_det: {
          rt: row.rate,
          txval: round2(row.taxable),
          iamt: round2(row.igst),
          camt: round2(row.cgst),
          samt: round2(row.sgst),
          csamt: 0,
        },
      });
      cdnrMap.set(ctin, current);
    }

    return {
      gstin: businessProfile.gstin,
      fp,
      gt: round2(periodInvoices.reduce((sum, inv) => sum + inv.taxBreakdown.grandTotal, 0)),
      cur_gt: round2(periodInvoices.reduce((sum, inv) => sum + inv.taxBreakdown.grandTotal, 0)),
      b2b: [...b2bMap.values()],
      b2cl,
      b2cs,
      cdnr: [...cdnrMap.values()],
      doc_issue: [],
      hsn: [],
    };
  }, [b2bRows, b2clRows, b2csRows, noteRows, businessProfile.gstin, fp, periodInvoices]);

  const gstr3bJson = useMemo(
    () => ({
      gstin: businessProfile.gstin,
      ret_period: fp,
      sup_details: {
        osup_det: {
          txval: gstr3b.section31.taxable,
          iamt: gstr3b.section31.igst,
          camt: gstr3b.section31.cgst,
          samt: gstr3b.section31.sgst,
          csamt: 0,
        },
        osup_zero: { txval: gstr3b.section31.zeroRated, iamt: 0, camt: 0, samt: 0, csamt: 0 },
        osup_nil_exmp: { txval: gstr3b.section31.nilExempt },
        osup_nongst: { txval: gstr3b.section31.nonGst },
      },
      inter_sup: gstr3b.section32.map((row) => ({
        pos: row.state,
        txval: row.taxable,
        iamt: row.igst,
      })),
      itc_elg: [
        { ty: "IMPG", iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: "IMPS", iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: "ISRC", iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: "ISD", iamt: 0, camt: 0, samt: 0, csamt: 0 },
        { ty: "OTH", iamt: 0, camt: 0, samt: 0, csamt: 0 },
      ],
      inward_sup: {
        isup_details: [
          { ty: "GST", inter: 0, intra: 0 },
          { ty: "NONGST", inter: 0, intra: 0 },
        ],
      },
      inward_nil_exmp: {
        inter: 0,
        intra: 0,
        non_gst: gstr3b.section31.nonGst,
      },
      tax_pmt: {
        igst: gstr3b.taxPayable.igst,
        cgst: gstr3b.taxPayable.cgst,
        sgst: gstr3b.taxPayable.sgst,
      },
    }),
    [businessProfile.gstin, fp, gstr3b],
  );

  const renderSectionHeader = (id: keyof typeof sections, title: string) => (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-md border bg-slate-50 px-3 py-2 text-left"
      onClick={() => setSections((prev) => ({ ...prev, [id]: !prev[id] }))}
    >
      <p className="font-medium">{title}</p>
      {sections[id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
    </button>
  );

  return (
    <div className="dash-view space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GST Returns</h1>
          <p className="text-sm text-muted-foreground">Read-only analytics derived from invoice data by supply date.</p>
        </div>
        <Badge variant="secondary">
          Period: {MONTHS[selectedMonth - 1]} {selectedYear}
        </Badge>
      </div>

      {businessMode.mode === "COMPOSITION" ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="py-4 text-sm text-amber-900">
            Composition dealers do not use the standard GSTR-1 / GSTR-3B filing flow. This page stays available as a historical
            report only.
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Return Period</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Month</p>
            <Select value={String(selectedMonth)} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
              {MONTHS.map((label, idx) => (
                <option key={label} value={idx + 1}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <p className="mb-1 text-xs text-muted-foreground">Year</p>
            <Select value={String(selectedYear)} onChange={(e) => setSelectedYear(Number(e.target.value))}>
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
          </div>
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Invoices in Period</p>
              <p className="text-lg font-semibold">{periodInvoices.length}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Return Period Code</p>
              <p className="text-lg font-semibold">{fp}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button variant={tab === "GSTR1" ? "default" : "outline"} onClick={() => setTab("GSTR1")}>
          GSTR-1
        </Button>
        <Button variant={tab === "GSTR3B" ? "default" : "outline"} onClick={() => setTab("GSTR3B")}>
          GSTR-3B
        </Button>
      </div>

      {tab === "GSTR1" ? (
        <div className="space-y-4">
          {renderSectionHeader("s4a", "4A — B2B Supplies")}
          {sections.s4a ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Receiver Name</TableHead>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Place of Supply</TableHead>
                      <TableHead>RCM</TableHead>
                      <TableHead>Invoice Type</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b2bRows.map((row, index) => (
                      <TableRow key={`${row.invoiceId}-${index}`}>
                        <TableCell>{row.gstin}</TableCell>
                        <TableCell>{row.receiverName}</TableCell>
                        <TableCell>{row.invoiceNo}</TableCell>
                        <TableCell>{new Date(row.date).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.value)}</TableCell>
                        <TableCell>{row.placeOfSupply}</TableCell>
                        <TableCell>{row.reverseCharge}</TableCell>
                        <TableCell>{row.invoiceType}</TableCell>
                        <TableCell className="text-right">{row.rate}%</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.taxableValue)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.igst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.cgst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.sgst)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={4}>Summary</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2b.value)}</TableCell>
                      <TableCell colSpan={4} />
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2b.taxableValue)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2b.igst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2b.cgst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2b.sgst)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {renderSectionHeader("s5", "5 — B2C Large")}
          {sections.s5 ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Place of Supply</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Invoice Value</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b2clRows.map((row, index) => (
                      <TableRow key={`${row.placeOfSupply}-${row.rate}-${index}`}>
                        <TableCell>{row.placeOfSupply}</TableCell>
                        <TableCell className="text-right">{row.rate}%</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.value)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.taxable)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.igst)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell>Summary</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cl.value)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cl.taxable)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cl.igst)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {renderSectionHeader("s7", "7 — B2C Small (Net of CN/DN)")}
          {sections.s7 ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Place of Supply</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable Value</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {b2csRows.map((row, index) => (
                      <TableRow key={`${row.placeOfSupply}-${row.rate}-${index}`}>
                        <TableCell>{row.placeOfSupply}</TableCell>
                        <TableCell className="text-right">{row.rate}%</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.taxable)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.igst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.cgst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.sgst)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell>Summary</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cs.taxable)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cs.igst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cs.cgst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.b2cs.sgst)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}

          {renderSectionHeader("s9b", "9B — Credit/Debit Notes (Registered)")}
          {sections.s9b ? (
            <Card>
              <CardContent className="pt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>GSTIN</TableHead>
                      <TableHead>Receiver Name</TableHead>
                      <TableHead>Note No.</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Linked Invoice</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Taxable</TableHead>
                      <TableHead className="text-right">IGST</TableHead>
                      <TableHead className="text-right">CGST</TableHead>
                      <TableHead className="text-right">SGST</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {noteRows.map((row, index) => (
                      <TableRow key={`${row.noteNo}-${index}`}>
                        <TableCell>{row.gstin}</TableCell>
                        <TableCell>{row.receiverName}</TableCell>
                        <TableCell>{row.noteNo}</TableCell>
                        <TableCell>{new Date(row.noteDate).toLocaleDateString("en-IN")}</TableCell>
                        <TableCell>{row.noteType}</TableCell>
                        <TableCell>{row.linkedInvoiceNo}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.value)}</TableCell>
                        <TableCell className="text-right">{row.rate}%</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.taxable)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.igst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.cgst)}</TableCell>
                        <TableCell className="text-right">{MONEY.format(row.sgst)}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-medium">
                      <TableCell colSpan={6}>Summary</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.notes.value)}</TableCell>
                      <TableCell />
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.notes.taxable)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.notes.igst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.notes.cgst)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(gstr1Totals.notes.sgst)}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">3.1 — Outward Supplies</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Particulars</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                    <TableHead className="text-right">CGST</TableHead>
                    <TableHead className="text-right">SGST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Taxable Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.taxable)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.igst)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.cgst)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.sgst)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Zero-rated Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.zeroRated)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Nil/Exempt Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.nilExempt)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Non-GST Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.nonGst)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(0)}</TableCell>
                  </TableRow>
                  <TableRow className="bg-slate-50 font-medium">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.total)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.igst)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.cgst)}</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section31.sgst)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">3.2 — Inter-State Supplies</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Place of Supply</TableHead>
                    <TableHead className="text-right">Taxable Value</TableHead>
                    <TableHead className="text-right">IGST</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {gstr3b.section32.map((row) => (
                    <TableRow key={row.state}>
                      <TableCell>{row.state}</TableCell>
                      <TableCell className="text-right">{MONEY.format(row.taxable)}</TableCell>
                      <TableCell className="text-right">{MONEY.format(row.igst)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">4 — ITC Available</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              ITC from purchase invoices — enter manually
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">5 — Values of Exempt, Nil, Non-GST Supplies</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Exempt Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section5.exempt)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Nil Rated Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section5.nil)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Non-GST Supplies</TableCell>
                    <TableCell className="text-right">{MONEY.format(gstr3b.section5.nonGst)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tax Payable</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">IGST</p>
                <p className="text-lg font-semibold">{MONEY.format(gstr3b.taxPayable.igst)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">CGST</p>
                <p className="text-lg font-semibold">{MONEY.format(gstr3b.taxPayable.cgst)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">SGST</p>
                <p className="text-lg font-semibold">{MONEY.format(gstr3b.taxPayable.sgst)}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-semibold">{MONEY.format(gstr3b.taxPayable.total)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Export</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => downloadJsonFile(`gstr1-${fp}.json`, gstr1Json)}>
                <Download className="mr-2 h-4 w-4" />
                Export GSTR-1 (JSON)
              </Button>
              <Button variant="outline" onClick={() => downloadJsonFile(`gstr3b-${fp}.json`, gstr3bJson)}>
                <Download className="mr-2 h-4 w-4" />
                Export GSTR-3B (JSON)
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
