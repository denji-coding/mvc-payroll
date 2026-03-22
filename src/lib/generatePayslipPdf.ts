import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import companyLogo from "@/assets/company-logo.png";

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

const fmtAmount = (amount: number): string => {
  return amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export function generatePayslipPdf({ employee, payroll, dailyRate }: GeneratePayslipPdfParams): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // Company Logo
  try {
    doc.addImage(companyLogo, "PNG", margin, y, 25, 25);
  } catch (e) {
    console.warn("Failed to load logo:", e);
  }

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", pageWidth / 2 + 10, y + 8, { align: "center" });

  y += 14;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Migrants Venture Corporation", pageWidth / 2 + 10, y, { align: "center" });

  y += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Lapu-Lapu St. Tagum City, Davao del Norte", pageWidth / 2 + 10, y, { align: "center" });

  const periodStart = new Date(payroll.period_start);
  const periodEnd = new Date(payroll.period_end);

  y += 5;
  const periodLabel = `Pay Period: ${format(periodStart, "MMM d")} - ${format(periodEnd, "MMM d, yyyy")}`;
  doc.text(periodLabel, pageWidth / 2 + 10, y, { align: "center" });

  // Greeting
  y += 15;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Good day!", margin, y);

  y += 8;
  const periodText = `${format(periodStart, "MMMM d")}-${format(periodEnd, "d, yyyy")}`;
  doc.text("Furnishing you with the details of your ", margin, y);
  doc.setFont("helvetica", "bold");
  const prefixWidth = doc.getTextWidth("Furnishing you with the details of your ");
  doc.setTextColor(0, 0, 255);
  doc.textWithLink("Payslips", margin + prefixWidth, y, { url: "#" });
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  const payslipsWidth = doc.getTextWidth("Payslips");
  doc.text(` for the Period: `, margin + prefixWidth + payslipsWidth, y);
  const forWidth = doc.getTextWidth(` for the Period: `);
  doc.setFont("helvetica", "bold");
  doc.text(`${periodText}.`, margin + prefixWidth + payslipsWidth + forWidth, y);
  doc.setFont("helvetica", "normal");

  // Employee Info Table
  y += 10;
  const computedDailyRate = dailyRate || 0;

  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Employee Name", styles: { fontStyle: "bold" } },
        `${employee.last_name}, ${employee.first_name}`,
        { content: "Employee ID", styles: { fontStyle: "bold" } },
        employee.employee_id,
      ],
      [
        { content: "Position", styles: { fontStyle: "bold" } },
        employee.position,
        { content: "Pay Date", styles: { fontStyle: "bold" } },
        format(new Date(payroll.pay_date), "MMMM d, yyyy"),
      ],
      [{ content: "Daily Rate", styles: { fontStyle: "bold" } }, fmtAmount(computedDailyRate), "", ""],
    ],
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Blank separator row (same 4-col total width = 160)
  y = (doc as any).lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    body: [[{ content: "", colSpan: 4, styles: { minCellHeight: 4 } }]],
    styles: { fontSize: 1, cellPadding: 0, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Earnings Table
  y = (doc as any).lastAutoTable.finalY;

  const earningsBody: any[][] = [];
  earningsBody.push(["", "No. of Days", `${payroll.days_worked} days`, fmtAmount(payroll.basic_pay)]);

  if (payroll.allowances_breakdown) {
    Object.entries(payroll.allowances_breakdown).forEach(([name, amount]) => {
      if (Number(amount) > 0) {
        earningsBody.push(["", name, "", fmtAmount(Number(amount))]);
      }
    });
  } else if (payroll.total_allowances > 0) {
    earningsBody.push(["", "Allowances", "", fmtAmount(payroll.total_allowances)]);
  }

  if (earningsBody.length > 0) {
    earningsBody[0][0] = {
      content: "Earnings",
      rowSpan: earningsBody.length,
      styles: { fontStyle: "bold", valign: "middle", halign: "center" },
    };
  }

  autoTable(doc, {
    startY: y,
    head: [
      [
        "",
        { content: "Descriptions", styles: { halign: "left" } },
        { content: "Details", styles: { halign: "left" } },
        { content: "Amount", styles: { halign: "right" } },
      ],
    ],
    body: earningsBody,
    foot: [
      [
        { content: "Total Earnings", colSpan: 4, styles: { fontStyle: "bold" } },
        { content: fmtAmount(payroll.gross_pay), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40, halign: "left" },
      3: { cellWidth: 40, halign: "right" },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Blank separator row (same 4-col total width = 160)
  y = (doc as any).lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    body: [[{ content: "", colSpan: 4, styles: { minCellHeight: 4 } }]],
    styles: { fontSize: 1, cellPadding: 0, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 40 },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Deductions Table
  y = (doc as any).lastAutoTable.finalY;

  const deductionsBody: any[][] = [];
  if (payroll.sss_contribution > 0) deductionsBody.push(["", "SSS Contribution", fmtAmount(payroll.sss_contribution)]);
  if (payroll.philhealth_contribution > 0)
    deductionsBody.push(["", "PhilHealth Contribution", fmtAmount(payroll.philhealth_contribution)]);
  if (payroll.pagibig_contribution > 0)
    deductionsBody.push(["", "Pag-IBIG Contribution", fmtAmount(payroll.pagibig_contribution)]);
  if (payroll.withholding_tax > 0) deductionsBody.push(["", "Withholding Tax", fmtAmount(payroll.withholding_tax)]);

  if (payroll.deductions_breakdown) {
    Object.entries(payroll.deductions_breakdown).forEach(([name, amount]) => {
      if (Number(amount) > 0) {
        deductionsBody.push(["", name, fmtAmount(Number(amount))]);
      }
    });
  } else if (payroll.other_deductions > 0) {
    deductionsBody.push(["", "Other Deductions", fmtAmount(payroll.other_deductions)]);
  }

  if (deductionsBody.length === 0) {
    deductionsBody.push(["", "No deductions", "0.00"]);
  }

  if (deductionsBody.length > 0) {
    deductionsBody[0][0] = {
      content: "Deductions",
      rowSpan: deductionsBody.length,
      styles: { fontStyle: "bold", valign: "middle", halign: "center" },
    };
  }

  autoTable(doc, {
    startY: y,
    head: [
      ["", { content: "Descriptions", styles: { halign: "left" } }, { content: "Amount", styles: { halign: "right" } }],
    ],
    body: deductionsBody,
    foot: [
      [
        { content: "Total Deductions", colSpan: 2, styles: { fontStyle: "bold" } },
        { content: fmtAmount(payroll.total_deductions), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: "bold" },
    footStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 90 },
      2: { cellWidth: 40, halign: "right" },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Net Monthly Earnings
  y = (doc as any).lastAutoTable.finalY;
  autoTable(doc, {
    startY: y,
    body: [
      [
        { content: "Net Monthly Earnings", styles: { fontStyle: "bold" } },
        { content: fmtAmount(payroll.net_pay), styles: { fontStyle: "bold", halign: "right" } },
      ],
    ],
    styles: { fontSize: 9, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 120 },
      1: { cellWidth: 40, halign: "right" },
    },
    theme: "grid",
    margin: { left: margin, right: margin },
  });

  // Footer
  y = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(7);
  doc.setTextColor(128, 128, 128);
  doc.text("This is a computer-generated document. No signature required.", pageWidth / 2, y, { align: "center" });
  y += 4;
  doc.text(`Generated on: ${format(new Date(), "MMMM dd, yyyy hh:mm a")}`, pageWidth / 2, y, { align: "center" });

  // Download
  const periodStr = format(periodStart, "MMMdd") + "-" + format(periodEnd, "MMMdd_yyyy");
  const fileName = `Payslip_${employee.last_name}_${employee.first_name}_${periodStr}.pdf`;
  doc.save(fileName);
}
