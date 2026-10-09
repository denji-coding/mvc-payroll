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
  companyName?: string;
  companyLogoUrl?: string | null;
}

const fmtCur = (n: number): string =>
  n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

async function loadLogo(url?: string | null): Promise<string> {
  if (!url) return companyLogo;
  try {
    const response = await fetch(url);
    if (!response.ok) return companyLogo;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return companyLogo;
  }
}

export async function generatePayrollSummaryPdf({ records, periodStart, periodEnd, companyName = 'Migrants Venture Corporation', companyLogoUrl }: GeneratePayrollSummaryParams): Promise<void> {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  const logo = await loadLogo(companyLogoUrl);
  const periodLabel = `${format(new Date(periodStart), 'MMMM d')}-${format(new Date(periodEnd), 'd, yyyy')}`.toUpperCase();
  const drawHeader = () => {
    try { doc.addImage(logo, margin, 6.5, 17.6, 17.6); }
    catch { doc.addImage(companyLogo, margin, 6.5, 17.6, 17.6); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(22, 101, 52);
    doc.text(companyName.toUpperCase(), margin + 22, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(55, 65, 81);
    doc.text('Vasquez Bldg. Lapu-Lapu St. Corner Sobrecary St. Magugpo South, Tagum City, Davao del Norte', margin + 22, 18);
    doc.setDrawColor(22, 101, 52);
    doc.setLineWidth(0.53);
    doc.line(margin, 27, pageWidth - margin, 27);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text('Payroll Summary', pageWidth / 2, 36, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`Salary Period: ${periodLabel}`, margin, 44);
  };

  // Build table data
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
    startY: 49,
    didDrawPage: drawHeader,
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
      1: { cellWidth: 43 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 26, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 20, halign: 'right' },
      7: { cellWidth: 20, halign: 'right' },
      8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 26, halign: 'right' },
      10: { cellWidth: 28 },
    },
    margin: { left: margin, right: margin, top: 49, bottom: 50 },
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
