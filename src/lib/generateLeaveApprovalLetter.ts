import jsPDF from 'jspdf';
import { format } from 'date-fns';
import { formatFullName } from '@/lib/formatName';

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
  approvedByName?: string | null;
}

const parseDate = (value: string) => new Date(`${value}T00:00:00`);

const titleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');

export function buildLeaveApprovalLetter({
  employee,
  request,
  companyName = 'Migrants Venture Corporation',
  approvedByName,
}: GenerateLeaveApprovalLetterParams): jsPDF {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = 22;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(companyName.toUpperCase(), pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Human Resource Department', pageWidth / 2, y, { align: 'center' });
  y += 6;
  doc.setDrawColor(180);
  doc.line(margin, y, pageWidth - margin, y);
  y += 12;

  // Date
  const issuedDate = request.hr_action_at ? new Date(request.hr_action_at) : new Date();
  doc.setFontSize(11);
  doc.text(format(issuedDate, 'MMMM d, yyyy'), margin, y);
  y += 12;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LEAVE APPROVAL LETTER', pageWidth / 2, y, { align: 'center' });
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

  const payLabel =
    request.pay_type === 'without_pay' ? 'Leave without Pay' : 'Leave with Pay';
  const startDate = parseDate(request.start_date);
  const endDate = parseDate(request.end_date);
  const days = Number(request.total_days) || 0;

  const body =
    `We are pleased to inform you that your application for ${titleCase(request.leave_type)} has been ` +
    `reviewed and APPROVED by the Human Resource Department. The details of your approved leave are as follows:`;
  const bodyLines = doc.splitTextToSize(body, contentWidth);
  doc.text(bodyLines, margin, y);
  y += bodyLines.length * 5.5 + 6;

  // Details block
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
  doc.setFont('helvetica', 'normal');
  doc.text('Approved by:', margin, y);
  y += 16;
  doc.setFont('helvetica', 'bold');
  doc.text(approvedByName || 'Human Resource Department', margin, y);
  doc.setDrawColor(120);
  doc.line(margin, y + 1.5, margin + 70, y + 1.5);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Human Resource Department', margin, y);

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(130);
  doc.text(
    'This is a system-generated document from the HR Management System.',
    pageWidth / 2,
    pageHeight - 12,
    { align: 'center' },
  );

  return doc;
}

export function generateLeaveApprovalLetterBlobUrl(params: GenerateLeaveApprovalLetterParams): string {
  const doc = buildLeaveApprovalLetter(params);
  return URL.createObjectURL(doc.output('blob'));
}

export function downloadLeaveApprovalLetter(params: GenerateLeaveApprovalLetterParams): void {
  const doc = buildLeaveApprovalLetter(params);
  const name = formatFullName(params.employee as any).replace(/[^\w]+/g, '_');
  doc.save(`Leave_Approval_Letter_${name}_${params.request.start_date}.pdf`);
}
