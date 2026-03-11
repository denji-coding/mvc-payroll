import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import companyLogo from '@/assets/company-logo.png';

interface PayrollSummaryRecord {
  employees: {
    employee_id: string;
    first_name: string;
    last_name: string;
  } | null;
  basic_pay: number;
  days_worked: number | null;
  gross_pay: number | null;
  other_deductions: number | null;
  sss_contribution: number | null;
  philhealth_contribution: number | null;
  pagibig_contribution: number | null;
  net_pay: number | null;
}

interface GeneratePayrollSummaryParams {
  records: PayrollSummaryRecord[];
  periodStart: string;
  periodEnd: string;
}

const fmtCur = (n: number): string =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generatePayrollSummaryPdf({ records, periodStart, periodEnd }: GeneratePayrollSummaryParams): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let yPos = 14;

  // Header - company name
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(220, 38, 38);
  doc.text('MIGRANTS VENTURE CORPORATION', pageWidth / 2, yPos, { align: 'center' });

  yPos += 6;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(
    'Vasquez Bldg. Lapu-Lapu St. Corner Sobrecary St. Magugpo South Tagum City Davao del Norte',
    pageWidth / 2,
    yPos,
    { align: 'center' }
  );

  // Period info
  yPos += 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const periodLabel = `${format(new Date(periodStart), 'MMMM d')}-${format(new Date(periodEnd), 'd, yyyy')}`.toUpperCase();
  doc.text('Salary Period:', margin + 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(periodLabel, margin + 52, yPos);

  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Department:', margin + 20, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text('Migrants Venture Corporation', margin + 52, yPos);

  // Build table data
  yPos += 8;
  const bodyData: (string | number)[][] = [];

  records.forEach((r, idx) => {
    const emp = r.employees;
    if (!emp) return;
    const name = `${emp.last_name}, ${emp.first_name}`.toUpperCase();
    const dailyRate = (r.days_worked && r.days_worked > 0) ? (r.basic_pay / r.days_worked) : 0;

    bodyData.push([
      idx + 1,
      name,
      fmtCur(dailyRate),
      r.days_worked || 0,
      fmtCur(r.gross_pay || 0),
      r.other_deductions ? fmtCur(r.other_deductions) : '',
      fmtCur(r.philhealth_contribution || 0),
      fmtCur(r.sss_contribution || 0),
      fmtCur(r.pagibig_contribution || 0),
      fmtCur(r.net_pay || 0),
      '', // Signature
    ]);
  });

  // Total row
  const totalNet = records.reduce((s, r) => s + (r.net_pay || 0), 0);

  autoTable(doc, {
    startY: yPos,
    head: [
      [
        { content: '', styles: { halign: 'center' } },
        { content: 'NAME', styles: { halign: 'center' } },
        { content: 'Daily Rate', styles: { halign: 'center' } },
        { content: 'No. of Days', styles: { halign: 'center' } },
        { content: 'Amount Earned', styles: { halign: 'center' } },
        { content: 'Late', styles: { halign: 'center' } },
        { content: 'PhilHealth', styles: { halign: 'center' } },
        { content: 'SSS', styles: { halign: 'center' } },
        { content: 'Pag-Ibig', styles: { halign: 'center' } },
        { content: 'NET AMOUNT', styles: { halign: 'center' } },
        { content: 'Signature', styles: { halign: 'center' } },
      ],
    ],
    body: bodyData,
    foot: [
      ['', '', '', '', '', '', '', { content: 'TOTAL', styles: { fontStyle: 'bold', textColor: [220, 38, 38] as [number, number, number] } }, '', fmtCur(totalNet), ''],
    ],
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      fontStyle: 'bold',
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    footStyles: {
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
      lineColor: [0, 0, 0],
      lineWidth: 0.3,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 45 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 28, halign: 'right' },
      5: { cellWidth: 22, halign: 'right' },
      6: { cellWidth: 22, halign: 'right' },
      7: { cellWidth: 22, halign: 'right' },
      8: { cellWidth: 22, halign: 'right' },
      9: { cellWidth: 28, halign: 'right' },
      10: { cellWidth: 30 },
    },
    margin: { left: margin, right: margin },
    theme: 'grid',
  });

  // Signatures section
  const finalY = (doc as any).lastAutoTable.finalY + 20;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Prepare by:', margin + 20, finalY);
  doc.text('Verified by:', pageWidth / 2 + 10, finalY);

  doc.setFont('helvetica', 'bold');
  doc.text('____________________________', margin + 20, finalY + 15);
  doc.text('____________________________', pageWidth / 2 + 10, finalY + 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('HR Manager', margin + 40, finalY + 20);
  doc.text('Accounting Head', pageWidth / 2 + 30, finalY + 20);

  // Save
  const periodStr = `${format(new Date(periodStart), 'MMMdd')}-${format(new Date(periodEnd), 'MMMdd_yyyy')}`;
  doc.save(`Payroll_Summary_${periodStr}.pdf`);
}
