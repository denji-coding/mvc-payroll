import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { formatFullName } from '@/lib/formatName';
import companyLogo from '@/assets/company-logo.png';

export interface LeaveLetterEmployee {
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  suffix_name?: string | null;
  employee_id: string;
  position?: string | null;
}

export interface LeaveLetterRequest {
  leave_type: string;
  pay_type?: string | null;
  start_date: string;
  end_date: string;
  total_days: number | string;
  reason?: string | null;
  hr_action_at?: string | null;
  hr_remarks?: string | null;
}

export interface GenerateLeaveApprovalLetterParams {
  employee: LeaveLetterEmployee;
  request: LeaveLetterRequest;
  companyName?: string;
  companyLogoUrl?: string | null;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  approvedByName?: string | null;
}

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const titleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

async function loadImageDataUrl(src: string): Promise<string | null> {
  try {
    const res = await fetch(src);
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function buildLeaveApprovalLetter({
  employee,
  request,
  companyName = 'Migrants Venture Corporation',
  companyLogoUrl,
  companyAddress = 'Vasquez Bldg. Lapu-Lapu St. Corner Sobrecary St. Magugpo South, Tagum City, Davao del Norte',
  companyPhone,
  companyEmail,
  approvedByName,
}: GenerateLeaveApprovalLetterParams): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const issuedDate = request.hr_action_at ? new Date(request.hr_action_at) : new Date();

  // ---- Header (matches the Reports PDF header) ----
  const logoData = await loadImageDataUrl(companyLogoUrl || companyLogo);
  let y = 16;
  const headerTop = y;
  if (logoData) {
    try {
      doc.addImage(logoData, 'PNG', margin, headerTop, 16, 16);
    } catch {
      /* ignore unsupported image */
    }
  }
  const textX = margin + (logoData ? 20 : 0);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(22, 101, 52);
  doc.text(companyName.toUpperCase(), textX, headerTop + 5.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(55, 65, 81);
  let metaY = headerTop + 10;
  if (companyAddress) {
    doc.text(companyAddress, textX, metaY);
    metaY += 3.5;
  }
  const contact = [companyPhone, companyEmail].filter(Boolean).join('  •  ');
  if (contact) {
    doc.text(contact, textX, metaY);
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);

  doc.setDrawColor(22, 101, 52);
  doc.setLineWidth(0.6);
  doc.line(margin, headerTop + 20, pageWidth - margin, headerTop + 20);
  doc.setLineWidth(0.2);
  doc.setTextColor(17, 24, 39);

  // Centered document title below the green divider
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LEAVE APPROVAL LETTER', pageWidth / 2, headerTop + 32, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  y = headerTop + 44;

  // Date
  doc.setFontSize(11);
  doc.text(format(issuedDate, 'MMMM d, yyyy'), margin, y);
  y += 12;

  const fullName = formatFullName(
    employee.first_name,
    employee.last_name,
    employee.suffix_name,
    employee.middle_name,
  );

  // Recipient
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(fullName, margin, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  if (employee.position) {
    doc.text(employee.position, margin, y);
    y += 5;
  }
  doc.text(`Employee ID: ${employee.employee_id}`, margin, y);
  y += 12;

  doc.setFontSize(11);
  doc.text(`Dear ${fullName},`, margin, y);
  y += 9;

  const payLabel = request.pay_type === 'without_pay' ? 'Leave without Pay' : 'Leave with Pay';
  const startDate = parseDate(request.start_date);
  const endDate = parseDate(request.end_date);
  const days = Number(request.total_days) || 0;

  const body =
    `We are pleased to inform you that your application for ${titleCase(request.leave_type)} has been ` +
    `reviewed and APPROVED by the Human Resource Department. The details of your approved leave are as follows:`;
  const bodyLines = doc.splitTextToSize(body, contentWidth);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 5.5 + 6;

  const details: [string, string][] = [
    ['Leave Type', titleCase(request.leave_type)],
    ['Pay Status', payLabel],
    ['From', format(startDate, 'MMMM d, yyyy')],
    ['To', format(endDate, 'MMMM d, yyyy')],
    ['Number of Days', `${days} ${days === 1 ? 'day' : 'days'}`],
    ['Reason', request.reason?.trim() || 'N/A'],
  ];

  const boxTop = y - 4;
  const labelX = margin + 4;
  const valueX = margin + 48;
  doc.setFontSize(10);
  details.forEach(([label, value]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label}:`, labelX, y);
    doc.setFont('helvetica', 'normal');
    const valueLines = doc.splitTextToSize(String(value), contentWidth - 52);
    doc.text(valueLines, valueX, y);
    y += valueLines.length * 5 + 2;
  });
  doc.setDrawColor(200);
  doc.rect(margin, boxTop, contentWidth, y - boxTop);
  y += 10;

  doc.setFontSize(11);
  const closing =
    'You are expected to report back to work on the next scheduled working day following the end of your ' +
    'approved leave. Please coordinate with your immediate supervisor regarding the turnover of your ' +
    'pending tasks prior to the start of your leave.';
  const closingLines = doc.splitTextToSize(closing, contentWidth);
  doc.text(closingLines, margin, y);
  y += closingLines.length * 5.5 + 8;

  if (request.hr_remarks?.trim()) {
    doc.setFont('helvetica', 'bold');
    doc.text('HR Remarks:', margin, y);
    doc.setFont('helvetica', 'normal');
    const remarkLines = doc.splitTextToSize(request.hr_remarks.trim(), contentWidth);
    doc.text(remarkLines, margin, y + 6);
    y += remarkLines.length * 5.5 + 12;
  }

  doc.text('Thank you.', margin, y);
  y += 20;

  // Signature
  const signerName = approvedByName || 'HR Approver';
  const signerLabel = 'Human Resource Department';

  doc.setFont('helvetica', 'normal');
  doc.text('Approved by:', margin, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text(signerName, margin, y);
  doc.setDrawColor(120);
  doc.line(margin, y + 1.5, margin + 70, y + 1.5);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(signerLabel, margin, y);

  // Footer (matches Reports PDF footer)
  doc.setDrawColor(209, 213, 219);
  doc.line(margin, pageHeight - 16, pageWidth - margin, pageHeight - 16);
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(`${companyName} • HRM & Payroll System`, margin, pageHeight - 11);
  doc.text('Page 1 of 1', pageWidth / 2, pageHeight - 11, { align: 'center' });
  doc.text(format(issuedDate, 'yyyy-MM-dd HH:mm'), pageWidth - margin, pageHeight - 11, { align: 'right' });

  return doc;
}

export async function generateLeaveApprovalLetterBlob(
  params: GenerateLeaveApprovalLetterParams,
): Promise<Blob> {
  const doc = await buildLeaveApprovalLetter(params);
  return doc.output('blob');
}

export function leaveApprovalLetterFileName(params: GenerateLeaveApprovalLetterParams): string {
  const name = formatFullName(
    params.employee.first_name,
    params.employee.last_name,
    params.employee.suffix_name,
    params.employee.middle_name,
  ).replace(/[^\w]+/g, '_');
  return `Leave_Approval_Letter_${name}_${params.request.start_date}.pdf`;
}

export async function downloadLeaveApprovalLetter(
  params: GenerateLeaveApprovalLetterParams,
): Promise<void> {
  const doc = await buildLeaveApprovalLetter(params);
  doc.save(leaveApprovalLetterFileName(params));
}
