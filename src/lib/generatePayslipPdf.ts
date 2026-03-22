import React from "react";
import { Document, Page, Text, View, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { format } from "date-fns";

interface PayslipEmployee {
  employee_id: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string | null;
}

interface PayrollData {
  period_start: string;
  period_end: string;
  pay_date: string;
  basic_pay: number;
  days_worked: number;
  overtime_pay: number;
  holiday_pay: number;
  night_differential: number;
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
}

interface GeneratePayslipPdfParams {
  employee: PayslipEmployee;
  payroll: PayrollData;
  dailyRate?: number;
}

const fmtAmount = (amount: number): string =>
  amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const border = { borderWidth: 1, borderColor: "#000" };
const cellBase = { padding: 4, fontSize: 9 };

const s = StyleSheet.create({
  page: { padding: 30, fontFamily: "Helvetica", fontSize: 9 },
  headerWrap: { alignItems: "center", marginBottom: 10 },
  logo: { width: 50, height: 50, marginBottom: 4 },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", letterSpacing: 2 },
  companyName: { fontSize: 11, fontFamily: "Helvetica-Bold", marginTop: 2 },
  companyAddr: { fontSize: 9, marginTop: 1 },
  periodLabel: { fontSize: 9, marginTop: 1 },
  greeting: { fontSize: 10, marginTop: 12 },
  furnish: { fontSize: 10, marginTop: 6, marginBottom: 10 },
  boldText: { fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row" },
  // 4-col widths (total ~530 at A4 with 30pt margins each side)
  c0: { ...cellBase, ...border, width: "18.75%", borderRight: 0, borderBottom: 0 },
  c1: { ...cellBase, ...border, width: "31.25%", borderRight: 0, borderBottom: 0 },
  c2: { ...cellBase, ...border, width: "25%", borderRight: 0, borderBottom: 0 },
  c3: { ...cellBase, ...border, width: "25%", borderBottom: 0 },
  // 3-col for deductions
  d0: { ...cellBase, ...border, width: "18.75%", borderRight: 0, borderBottom: 0 },
  d1: { ...cellBase, ...border, width: "56.25%", borderRight: 0, borderBottom: 0 },
  d2: { ...cellBase, ...border, width: "25%", borderBottom: 0 },
  // full-width blank
  blank: { ...border, height: 10, borderBottom: 0 },
  // footer
  footerRow: { flexDirection: "row" },
  f0: { ...cellBase, ...border, width: "75%", borderRight: 0 },
  f1: { ...cellBase, ...border, width: "25%", textAlign: "right" },
  // net
  n0: { ...cellBase, ...border, width: "75%", borderRight: 0 },
  n1: { ...cellBase, ...border, width: "25%", textAlign: "right" },
  // generated footer
  genFooter: { marginTop: 20, fontSize: 7, color: "#808080", textAlign: "center" },
});

// Last row needs bottom border
const lastRowBorder = { borderBottomWidth: 1, borderBottomColor: "#000" };

const PayslipDocument: React.FC<GeneratePayslipPdfParams> = ({ employee, payroll, dailyRate }) => {
  const periodStart = new Date(payroll.period_start);
  const periodEnd = new Date(payroll.period_end);
  const periodText = `${format(periodStart, "MMMM d")}-${format(periodEnd, "d, yyyy")}`;
  const computedDailyRate = dailyRate || 0;

  // Build earnings rows
  const earningsItems: { desc: string; detail: string; amount: string }[] = [];
  earningsItems.push({ desc: "No. of Days", detail: `${payroll.days_worked} days`, amount: fmtAmount(payroll.basic_pay) });
  if (payroll.allowances_breakdown) {
    Object.entries(payroll.allowances_breakdown).forEach(([name, amt]) => {
      if (Number(amt) > 0) earningsItems.push({ desc: name, detail: "", amount: fmtAmount(Number(amt)) });
    });
  } else if (payroll.total_allowances > 0) {
    earningsItems.push({ desc: "Allowances", detail: "", amount: fmtAmount(payroll.total_allowances) });
  }

  // Build deductions rows
  const deductionItems: { desc: string; amount: string }[] = [];
  if (payroll.sss_contribution > 0) deductionItems.push({ desc: "SSS Contribution", amount: fmtAmount(payroll.sss_contribution) });
  if (payroll.philhealth_contribution > 0) deductionItems.push({ desc: "PhilHealth Contribution", amount: fmtAmount(payroll.philhealth_contribution) });
  if (payroll.pagibig_contribution > 0) deductionItems.push({ desc: "Pag-IBIG Contribution", amount: fmtAmount(payroll.pagibig_contribution) });
  if (payroll.withholding_tax > 0) deductionItems.push({ desc: "Withholding Tax", amount: fmtAmount(payroll.withholding_tax) });
  if (payroll.deductions_breakdown) {
    Object.entries(payroll.deductions_breakdown).forEach(([name, amt]) => {
      if (Number(amt) > 0) deductionItems.push({ desc: name, amount: fmtAmount(Number(amt)) });
    });
  } else if (payroll.other_deductions > 0) {
    deductionItems.push({ desc: "Other Deductions", amount: fmtAmount(payroll.other_deductions) });
  }
  if (deductionItems.length === 0) deductionItems.push({ desc: "No deductions", amount: "0.00" });

  const earningsHeaderRowCount = 1 + earningsItems.length; // header + data rows
  const deductionsHeaderRowCount = 1 + deductionItems.length;

  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: s.page },
      // Header
      React.createElement(View, { style: s.headerWrap },
        React.createElement(Image, { src: "https://mvc-rose.vercel.app/favicon.png", style: s.logo }),
        React.createElement(Text, { style: s.title }, "PAYSLIP"),
        React.createElement(Text, { style: s.companyName }, "Migrants Venture Corporation"),
        React.createElement(Text, { style: s.companyAddr }, "Lapu-Lapu St. Tagum City, Davao del Norte"),
        React.createElement(Text, { style: s.periodLabel }, `Pay Period: ${format(periodStart, "MMM d")} - ${format(periodEnd, "MMM d, yyyy")}`),
      ),
      // Greeting
      React.createElement(Text, { style: s.greeting }, "Good day!"),
      React.createElement(Text, { style: s.furnish },
        "Furnishing you with the details of your Payslips for the Period: ",
        React.createElement(Text, { style: s.boldText }, `${periodText}.`),
      ),
      // Employee Info Table
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: s.c0 }, React.createElement(Text, { style: s.boldText }, "Employee Name")),
        React.createElement(View, { style: s.c1 }, React.createElement(Text, null, `${employee.last_name}, ${employee.first_name}`)),
        React.createElement(View, { style: s.c2 }, React.createElement(Text, { style: s.boldText }, "Employee ID")),
        React.createElement(View, { style: s.c3 }, React.createElement(Text, null, employee.employee_id)),
      ),
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: s.c0 }, React.createElement(Text, { style: s.boldText }, "Position")),
        React.createElement(View, { style: s.c1 }, React.createElement(Text, null, employee.position)),
        React.createElement(View, { style: s.c2 }, React.createElement(Text, { style: s.boldText }, "Pay Date")),
        React.createElement(View, { style: s.c3 }, React.createElement(Text, null, format(new Date(payroll.pay_date), "MMMM d, yyyy"))),
      ),
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: { ...s.c0, ...lastRowBorder } }, React.createElement(Text, { style: s.boldText }, "Daily Rate")),
        React.createElement(View, { style: { ...s.c1, ...lastRowBorder } }, React.createElement(Text, null, fmtAmount(computedDailyRate))),
        React.createElement(View, { style: { ...s.c2, ...lastRowBorder } }, React.createElement(Text, null, "")),
        React.createElement(View, { style: { ...s.c3, ...lastRowBorder } }, React.createElement(Text, null, "")),
      ),
      // Blank separator
      React.createElement(View, { style: { ...s.blank, ...lastRowBorder } }),
      // Earnings Header
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: s.c0 }, React.createElement(Text, { style: s.boldText }, "")),
        React.createElement(View, { style: s.c1 }, React.createElement(Text, { style: s.boldText }, "Descriptions")),
        React.createElement(View, { style: s.c2 }, React.createElement(Text, { style: s.boldText }, "Details")),
        React.createElement(View, { style: s.c3 }, React.createElement(Text, { style: s.boldText }, "Amount")),
      ),
      // Earnings rows
      ...earningsItems.map((item, i) =>
        React.createElement(View, { style: s.row, key: `e-${i}` },
          React.createElement(View, { style: s.c0 },
            i === 0
              ? React.createElement(Text, { style: { ...s.boldText, textAlign: "center" } }, "Earnings")
              : React.createElement(Text, null, ""),
          ),
          React.createElement(View, { style: s.c1 }, React.createElement(Text, null, item.desc)),
          React.createElement(View, { style: s.c2 }, React.createElement(Text, null, item.detail)),
          React.createElement(View, { style: s.c3 }, React.createElement(Text, { style: { textAlign: "right" } }, item.amount)),
        ),
      ),
      // Total Earnings
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: { ...s.c0, ...lastRowBorder, width: "75%", borderRight: 0 } },
          React.createElement(Text, { style: s.boldText }, "Total Earnings"),
        ),
        React.createElement(View, { style: { ...s.c3, ...lastRowBorder } },
          React.createElement(Text, { style: { textAlign: "right" } }, fmtAmount(payroll.gross_pay)),
        ),
      ),
      // Blank separator
      React.createElement(View, { style: { ...s.blank, ...lastRowBorder } }),
      // Deductions Header
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: s.d0 }, React.createElement(Text, { style: s.boldText }, "")),
        React.createElement(View, { style: s.d1 }, React.createElement(Text, { style: s.boldText }, "Descriptions")),
        React.createElement(View, { style: s.d2 }, React.createElement(Text, { style: s.boldText }, "Amount")),
      ),
      // Deduction rows
      ...deductionItems.map((item, i) =>
        React.createElement(View, { style: s.row, key: `d-${i}` },
          React.createElement(View, { style: s.d0 },
            i === 0
              ? React.createElement(Text, { style: { ...s.boldText, textAlign: "center" } }, "Deductions")
              : React.createElement(Text, null, ""),
          ),
          React.createElement(View, { style: s.d1 }, React.createElement(Text, null, item.desc)),
          React.createElement(View, { style: s.d2 }, React.createElement(Text, { style: { textAlign: "right" } }, item.amount)),
        ),
      ),
      // Total Deductions
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: { ...s.d0, ...lastRowBorder, width: "75%", borderRight: 0 } },
          React.createElement(Text, { style: s.boldText }, "Total Deductions"),
        ),
        React.createElement(View, { style: { ...s.d2, ...lastRowBorder } },
          React.createElement(Text, { style: { textAlign: "right" } }, fmtAmount(payroll.total_deductions)),
        ),
      ),
      // Net Monthly Earnings
      React.createElement(View, { style: s.row },
        React.createElement(View, { style: { ...s.n0 } },
          React.createElement(Text, { style: s.boldText }, "Net Monthly Earnings"),
        ),
        React.createElement(View, { style: { ...s.n1 } },
          React.createElement(Text, { style: { ...s.boldText, textAlign: "right" } }, fmtAmount(payroll.net_pay)),
        ),
      ),
      // Footer
      React.createElement(View, { style: s.genFooter },
        React.createElement(Text, null, "This is a computer-generated document. No signature required."),
        React.createElement(Text, { style: { marginTop: 3 } }, `Generated on: ${format(new Date(), "MMMM dd, yyyy hh:mm a")}`),
      ),
    ),
  );
};

export async function generatePayslipPdf(params: GeneratePayslipPdfParams): Promise<void> {
  const { employee, payroll } = params;
  const periodStart = new Date(payroll.period_start);
  const periodEnd = new Date(payroll.period_end);

  const doc = React.createElement(PayslipDocument, params) as any;
  const blob = await pdf(doc).toBlob();

  const periodStr = format(periodStart, "MMMdd") + "-" + format(periodEnd, "MMMdd_yyyy");
  const fileName = `Payslip_${employee.last_name}_${employee.first_name}_${periodStr}.pdf`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
