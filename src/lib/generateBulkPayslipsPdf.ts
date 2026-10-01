import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";
import { formatFullName } from "@/lib/formatName";
import companyLogo from "@/assets/company-logo.png";

export interface BulkPayslipItem {
  employee: {
    employee_id: string;
    first_name: string;
    middle_name?: string | null;
    last_name: string;
    suffix_name?: string | null;
    position?: string | null;
  };
  payroll: {
    period_start: string;
    period_end: string;
    pay_date: string;
    basic_pay: number;
    days_worked: number;
    total_allowances: number;
    allowances_breakdown: Record<string, number>;
    gross_pay: number;
    sss_contribution: number;
    philhealth_contribution: number;
    pagibig_contribution: number;
    withholding_tax: number;
    other_deductions: number;
    deductions_breakdown: Record<string, number>;
    total_deductions: number;
    net_pay: number;
  };
  dailyRate?: number;
}

const fmtAmount = (amount: number): string =>
  (Number(amount) || 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const B = "#000";
const cell = { paddingVertical: 1.5, paddingHorizontal: 3, fontSize: 5 };

const s = StyleSheet.create({
  page: { paddingVertical: 18, paddingHorizontal: 16, fontFamily: "Helvetica", fontSize: 5 },
  gridRow: { flexDirection: "row", justifyContent: "space-between" },
  slip: { width: "48.5%", borderWidth: 1, borderColor: B, padding: 6 },
  cutRow: { flexDirection: "row", alignItems: "center", marginVertical: 5 },
  cutLine: { flexGrow: 1, borderBottomWidth: 1, borderBottomColor: "#666", borderBottomStyle: "dashed" },
  cutText: { fontSize: 5, color: "#666", marginHorizontal: 4, fontFamily: "Helvetica-Bold" },
  center: { alignItems: "center" },
  logo: { width: 18, height: 18, objectFit: "contain", marginBottom: 2 },
  title: { fontSize: 8, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  company: { fontSize: 6.5, fontFamily: "Helvetica-Bold", marginTop: 1 },
  addr: { fontSize: 5, marginTop: 0.5 },
  bold: { fontFamily: "Helvetica-Bold" },
  periodLine: { fontSize: 5.5, fontFamily: "Helvetica-Bold", marginTop: 5 },
  furnish: { fontSize: 4.5, marginTop: 1, marginBottom: 4 },
  row: { flexDirection: "row" },
  tableTop: { borderTopWidth: 1, borderTopColor: B, borderLeftWidth: 1, borderLeftColor: B },
  spacer: { height: 4 },
  footNote: { fontSize: 3.8, color: "#555", textAlign: "center", marginTop: 4 },
});

const td = (width: string, opts: { bold?: boolean; right?: boolean; last?: boolean; lastRow?: boolean } = {}) => ({
  ...cell,
  width,
  borderRightWidth: 1,
  borderRightColor: B,
  borderBottomWidth: 1,
  borderBottomColor: B,
  ...(opts.bold ? { fontFamily: "Helvetica-Bold" } : {}),
  ...(opts.right ? { textAlign: "right" as const } : {}),
});

const Cell = (
  key: string,
  width: string,
  value: string,
  opts: { bold?: boolean; right?: boolean } = {},
) => React.createElement(Text, { key, style: td(width, opts) }, value);

const Slip: React.FC<{ item: BulkPayslipItem; logoUrl: string }> = ({ item, logoUrl }) => {
  const { employee: e, payroll: p, dailyRate } = item;
  const start = new Date(p.period_start);
  const end = new Date(p.period_end);

  // Leave with pay aggregation
  const lwpRegex = /leave\s*with\s*pay/i;
  let lwpAmount = 0;
  let lwpDays = 0;
  const otherEarnings: [string, number][] = [];
  Object.entries(p.allowances_breakdown || {}).forEach(([name, amt]) => {
    const val = Number(amt) || 0;
    if (lwpRegex.test(name)) {
      lwpAmount += val;
      const m = name.match(/\((\d+(?:\.\d+)?)\s*days?\)/i);
      if (m) lwpDays += Number(m[1]);
    } else if (val > 0) {
      otherEarnings.push([name, val]);
    }
  });

  const earnings: { desc: string; detail: string; amount: number }[] = [
    { desc: "No. of Days", detail: `${p.days_worked} days`, amount: p.basic_pay },
    { desc: "Leave with Pay", detail: `${lwpDays} day${lwpDays === 1 ? "" : "s"}`, amount: lwpAmount },
    ...otherEarnings.map(([name, amt]) => ({ desc: name, detail: "", amount: amt })),
  ];

  const deductions: { desc: string; amount: number }[] = [];
  if (p.sss_contribution > 0) deductions.push({ desc: "SSS Contribution", amount: p.sss_contribution });
  if (p.philhealth_contribution > 0) deductions.push({ desc: "PhilHealth Contribution", amount: p.philhealth_contribution });
  if (p.pagibig_contribution > 0) deductions.push({ desc: "Pag-IBIG Contribution", amount: p.pagibig_contribution });
  if (p.withholding_tax > 0) deductions.push({ desc: "Withholding Tax", amount: p.withholding_tax });
  Object.entries(p.deductions_breakdown || {}).forEach(([name, amt]) => {
    if (Number(amt) > 0) deductions.push({ desc: name, amount: Number(amt) });
  });
  if (deductions.length === 0) deductions.push({ desc: "No deductions", amount: 0 });

  return React.createElement(View, { style: s.slip },
    React.createElement(View, { style: s.center },
      React.createElement(Image, { src: logoUrl, style: s.logo }),
      React.createElement(Text, { style: s.title }, "PAYSLIP"),
      React.createElement(Text, { style: s.company }, "Migrants Venture Corporation"),
      React.createElement(Text, { style: s.addr }, "Lapu-Lapu St. Tagum City, Davao del Norte"),
    ),
    React.createElement(Text, { style: s.periodLine },
      `Pay Period: ${format(start, "MMM d")} - ${format(end, "MMM d, yyyy")}`),
    React.createElement(Text, { style: s.furnish },
      `Furnishing you with the details of your Payslip for the Period: ${format(start, "MMMM d")}-${format(end, "d, yyyy")}.`),

    // Employee info table
    React.createElement(View, { style: s.tableTop },
      React.createElement(View, { style: s.row },
        Cell("ln", "30%", "Employee Name:", { bold: true }),
        Cell("lv", "35%", formatFullName(e.first_name, e.last_name, e.suffix_name, e.middle_name)),
        Cell("il", "20%", "Employee ID:", { bold: true }),
        Cell("iv", "15%", e.employee_id || "", { right: true }),
      ),
      React.createElement(View, { style: s.row },
        Cell("pl", "30%", "Position:", { bold: true }),
        Cell("pv", "35%", e.position || ""),
        Cell("dl", "20%", "Pay Date:", { bold: true }),
        Cell("dv", "15%", format(new Date(p.pay_date), "MMMM d, yyyy"), { right: true }),
      ),
      React.createElement(View, { style: s.row },
        Cell("rl", "30%", "Daily Rate:", { bold: true }),
        Cell("rv", "35%", fmtAmount(dailyRate || 0)),
        Cell("re", "20%", ""),
        Cell("rf", "15%", ""),
      ),
    ),
    React.createElement(View, { style: s.spacer }),

    // Earnings
    React.createElement(View, { style: s.tableTop },
      React.createElement(View, { style: s.row },
        Cell("eh0", "45%", "EARNINGS", { bold: true }),
        Cell("eh1", "30%", "DETAILS", { bold: true }),
        Cell("eh2", "25%", "AMOUNT", { bold: true, right: true }),
      ),
      ...earnings.map((it, i) => React.createElement(View, { style: s.row, key: `e${i}` },
        Cell(`e${i}a`, "45%", it.desc),
        Cell(`e${i}b`, "30%", it.detail),
        Cell(`e${i}c`, "25%", fmtAmount(it.amount), { right: true }),
      )),
      React.createElement(View, { style: s.row, key: "etot" },
        Cell("et0", "45%", "Total Earnings", { bold: true }),
        Cell("et1", "30%", ""),
        Cell("et2", "25%", fmtAmount(p.gross_pay), { bold: true, right: true }),
      ),
    ),
    React.createElement(View, { style: s.spacer }),

    // Deductions
    React.createElement(View, { style: s.tableTop },
      React.createElement(View, { style: s.row },
        Cell("dh0", "75%", "DEDUCTIONS", { bold: true }),
        Cell("dh1", "25%", "AMOUNT", { bold: true, right: true }),
      ),
      ...deductions.map((it, i) => React.createElement(View, { style: s.row, key: `d${i}` },
        Cell(`d${i}a`, "75%", it.desc),
        Cell(`d${i}b`, "25%", fmtAmount(it.amount), { right: true }),
      )),
      React.createElement(View, { style: s.row, key: "dtot" },
        Cell("dt0", "75%", "Total Deductions", { bold: true }),
        Cell("dt1", "25%", fmtAmount(p.total_deductions), { bold: true, right: true }),
      ),
      React.createElement(View, { style: s.row, key: "net" },
        Cell("n0", "75%", "NET MONTHLY EARNINGS", { bold: true }),
        Cell("n1", "25%", fmtAmount(p.net_pay), { bold: true, right: true }),
      ),
    ),
    React.createElement(Text, { style: s.footNote }, "This is a computer-generated document. No signature required."),
  );
};

const CutLine = () => React.createElement(View, { style: s.cutRow },
  React.createElement(View, { style: s.cutLine }),
  React.createElement(Text, { style: s.cutText }, "CUT HERE"),
  React.createElement(View, { style: s.cutLine }),
);

const BulkDocument: React.FC<{ items: BulkPayslipItem[]; logoUrl: string }> = ({ items, logoUrl }) => {
  // chunk into pages of 6 (3 rows x 2 columns)
  const pages: BulkPayslipItem[][] = [];
  for (let i = 0; i < items.length; i += 6) pages.push(items.slice(i, i + 6));

  return React.createElement(Document, null,
    ...pages.map((pageItems, pi) => {
      const rows: BulkPayslipItem[][] = [];
      for (let i = 0; i < pageItems.length; i += 2) rows.push(pageItems.slice(i, i + 2));
      const children: React.ReactElement[] = [];
      rows.forEach((row, ri) => {
        children.push(
          React.createElement(View, { style: s.gridRow, key: `r${ri}` },
            ...row.map((item, ci) => React.createElement(Slip, { item, logoUrl, key: `s${ri}-${ci}` })),
          ),
        );
        if (ri < rows.length - 1) children.push(React.createElement(CutLine, { key: `c${ri}` } as any));
      });
      return React.createElement(Page, { size: "A4", style: s.page, key: `p${pi}` }, ...children);
    }),
  );
};

export async function generateBulkPayslipsPdf(params: {
  items: BulkPayslipItem[];
  periodStart: string;
  periodEnd: string;
  companyLogoUrl?: string | null;
}): Promise<void> {
  const doc = React.createElement(BulkDocument, { items: params.items, logoUrl: params.companyLogoUrl || companyLogo }) as any;
  const blob = await pdf(doc).toBlob();
  const periodStr = `${format(new Date(params.periodStart), "MMMdd")}-${format(new Date(params.periodEnd), "MMMdd_yyyy")}`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Bulk_Payslips_${periodStr}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
