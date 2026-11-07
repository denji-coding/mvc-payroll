import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Users, PhilippinePeso, HandCoins, Eye, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { notifyError, notifyProcessing } from '@/lib/formNotifications';
import { format } from 'date-fns';
import { DateInput } from '@/components/ui/date-picker';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyInfo } from '@/hooks/useCompanyInfo';
import { PdfReportPreviewDialog } from '@/components/reports/PdfReportPreviewDialog';
import type { ReportColumn, CompanyHeaderInfo, PreparedByInfo } from '@/components/reports/PdfReportDocument';
import { formatFullName } from '@/lib/formatName';

type ReportType = 'employee-masterlist' | 'attendance-summary' | 'payroll-summary' | 'gov-contributions';

const reports = [
  { id: 'employee-masterlist' as ReportType, title: 'Employee Masterlist', description: 'Complete list of all employees with details', icon: Users, category: 'HR', orientation: 'landscape' as const },
  { id: 'attendance-summary' as ReportType, title: 'Attendance Summary', description: 'Daily, weekly, or monthly attendance reports', icon: FileText, category: 'HR', orientation: 'landscape' as const },
  { id: 'payroll-summary' as ReportType, title: 'Payroll Summary', description: 'Payroll totals per period', icon: PhilippinePeso, category: 'Payroll', orientation: 'landscape' as const },
  { id: 'gov-contributions' as ReportType, title: 'Government Contributions', description: 'SSS, PhilHealth, Pag-IBIG reports', icon: HandCoins, category: 'Payroll', orientation: 'landscape' as const },
];

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Administrator',
  hr_admin: 'HR Administrator',
  branch_manager: 'Branch Manager',
  employee: 'Employee',
};

const COMPANY_ADDRESS = 'Vasquez Bldg. Lapu-Lapu St. Corner Sobrecary St. Magugpo South, Tagum City, Davao del Norte';

const fmtMoney = (n: number) => n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatTs = (ts: string | null) => {
  if (!ts) return '';
  try { return format(new Date(ts), 'hh:mm a'); } catch { return ts; }
};

export default function Reports() {
  const { role, profile } = useAuth();
  const { data: companyInfo } = useCompanyInfo();
  const [loadingReport, setLoadingReport] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [pickerOpen, setPickerOpen] = useState<ReportType | null>(null);

  const [previewState, setPreviewState] = useState<{
    open: boolean;
    title: string;
    fileName: string;
    columns: ReportColumn[];
    rows: (string | number)[][];
    orientation: 'portrait' | 'landscape';
    subtitle?: string;
  } | null>(null);

  const canGenerate = role === 'hr_admin' || role === 'super_admin';

  if (!canGenerate) {
    return (
      <div className="page-container">
        <div className="page-header"><h1 className="page-title">Reports</h1></div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldAlert className="h-12 w-12 text-muted-foreground mb-4" />
            <h2 className="text-lg font-semibold mb-1">Restricted Access</h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Only HR personnel can generate reports. Please contact your administrator if you need access.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const company: CompanyHeaderInfo = {
    name: companyInfo?.company_name || 'Migrants Venture Corporation',
    address: COMPANY_ADDRESS,
    logoUrl: companyInfo?.company_logo_url || null,
  };

  const preparedBy: PreparedByInfo = {
    name: profile ? `${profile.firstName} ${profile.lastName}`.trim() || profile.email : 'HR Personnel',
    role: role ? ROLE_LABELS[role] : undefined,
  };

  const openPreview = (config: Omit<NonNullable<typeof previewState>, 'open'>) => {
    setPreviewState({ ...config, open: true });
  };

  const generateReport = async (reportId: ReportType) => {
    if (loadingReport) return;
    const reportMeta = reports.find(r => r.id === reportId);
    if (!reportMeta) return;
    if (reportId === 'attendance-summary' && (!dateRange.start || !dateRange.end)) {
      toast.error('Please select a date range');
      return;
    }
    setLoadingReport(reportId);
    const toastId = notifyProcessing('Generating report...');
    try {
      switch (reportId) {
        case 'employee-masterlist': {
          const { data, error } = await supabase.from('employees').select('*, branches(name)').order('last_name');
          if (error) throw error;
          const columns: ReportColumn[] = [
            { key: 'id', label: 'Emp ID', width: '10%' },
            { key: 'name', label: 'Name', width: '20%' },
            { key: 'email', label: 'Email', width: '18%' },
            { key: 'phone', label: 'Phone', width: '10%' },
            { key: 'position', label: 'Position', width: '12%' },
            { key: 'branch', label: 'Branch', width: '10%' },
            { key: 'hired', label: 'Date Hired', width: '8%', align: 'center' },
            { key: 'status', label: 'Status', width: '7%', align: 'center' },
            { key: 'salary', label: 'Basic Salary', width: '10%', align: 'right' },
          ];
          const rows = (data || []).map((e: any) => [
            e.employee_id,
            formatFullName(e.first_name, e.last_name, e.suffix_name, e.middle_name),
            e.email,
            e.phone || '',
            e.position || '',
            e.branches?.name || '',
            e.date_hired || '',
            (e.employment_status || 'active').replace('_', ' '),
            fmtMoney(Number(e.basic_salary || 0)),
          ]);
          openPreview({
            title: 'Employee Masterlist',
            fileName: 'employee-masterlist',
            columns,
            rows,
            orientation: reportMeta.orientation,
          });
          break;
        }
        case 'attendance-summary': {
          if (!dateRange.start || !dateRange.end) {
            toast.error('Please select a date range');
            return;
          }
          const { data, error } = await supabase.from('attendance')
            .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name)')
            .gte('date', dateRange.start).lte('date', dateRange.end).order('date');
          if (error) throw error;
          const columns: ReportColumn[] = [
            { key: 'date', label: 'Date', width: '10%', align: 'center' },
            { key: 'eid', label: 'Emp ID', width: '10%' },
            { key: 'name', label: 'Name', width: '20%' },
            { key: 'amin', label: 'AM In', width: '9%', align: 'center' },
            { key: 'amout', label: 'AM Out', width: '9%', align: 'center' },
            { key: 'pmin', label: 'PM In', width: '9%', align: 'center' },
            { key: 'pmout', label: 'PM Out', width: '9%', align: 'center' },
            { key: 'hrs', label: 'Hours', width: '8%', align: 'right' },
            { key: 'late', label: 'Late (m)', width: '8%', align: 'right' },
            { key: 'status', label: 'Status', width: '8%', align: 'center' },
          ];
          const rows = (data || []).map((a: any) => [
            a.date,
            a.employees?.employee_id || '',
            formatFullName(a.employees?.first_name, a.employees?.last_name, a.employees?.suffix_name, a.employees?.middle_name),
            formatTs(a.morning_in),
            formatTs(a.morning_out),
            formatTs(a.afternoon_in),
            formatTs(a.afternoon_out),
            Number(a.hours_worked || 0).toFixed(2),
            Number(a.late_minutes || 0),
            (a.status || 'present').replace('_', ' '),
          ]);
          openPreview({
            title: 'Attendance Summary',
            fileName: 'attendance-summary',
            subtitle: `Period: ${format(new Date(dateRange.start), 'MMM d, yyyy')} – ${format(new Date(dateRange.end), 'MMM d, yyyy')}`,
            columns,
            rows,
            orientation: reportMeta.orientation,
          });
          setPickerOpen(null);
          break;
        }
        case 'payroll-summary': {
          const { data, error } = await supabase.from('payroll_records')
            .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name), payroll_periods(period_start, period_end, pay_date)')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const columns: ReportColumn[] = [
            { key: 'period', label: 'Period', width: '14%' },
            { key: 'paydate', label: 'Pay Date', width: '8%', align: 'center' },
            { key: 'eid', label: 'Emp ID', width: '8%' },
            { key: 'name', label: 'Name', width: '16%' },
            { key: 'days', label: 'Piece of Work', width: '6%', align: 'right' },
            { key: 'basic', label: 'Basic Pay', width: '9%', align: 'right' },
            { key: 'gross', label: 'Gross Pay', width: '9%', align: 'right' },
            { key: 'sss', label: 'SSS', width: '6%', align: 'right' },
            { key: 'ph', label: 'PhilHealth', width: '7%', align: 'right' },
            { key: 'pi', label: 'Pag-IBIG', width: '7%', align: 'right' },
            { key: 'ded', label: 'Total Ded.', width: '5%', align: 'right' },
            { key: 'net', label: 'Net Pay', width: '5%', align: 'right' },
          ];
          const rows = (data || []).map((r: any) => [
            `${r.payroll_periods?.period_start || ''} – ${r.payroll_periods?.period_end || ''}`,
            r.payroll_periods?.pay_date || '',
            r.employees?.employee_id || '',
            formatFullName(r.employees?.first_name, r.employees?.last_name, r.employees?.suffix_name, r.employees?.middle_name),
            Number(r.days_worked || 0),
            fmtMoney(Number(r.basic_pay || 0)),
            fmtMoney(Number(r.gross_pay || 0)),
            fmtMoney(Number(r.sss_contribution || 0)),
            fmtMoney(Number(r.philhealth_contribution || 0)),
            fmtMoney(Number(r.pagibig_contribution || 0)),
            fmtMoney(Number(r.total_deductions || 0)),
            fmtMoney(Number(r.net_pay || 0)),
          ]);
          openPreview({
            title: 'Payroll Summary',
            fileName: 'payroll-summary',
            columns,
            rows,
            orientation: reportMeta.orientation,
          });
          break;
        }
        case 'gov-contributions': {
          const { data, error } = await supabase.from('payroll_records')
            .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name, sss_number, philhealth_number, pagibig_number), payroll_periods(period_start, period_end)')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const columns: ReportColumn[] = [
            { key: 'period', label: 'Period', width: '14%' },
            { key: 'eid', label: 'Emp ID', width: '9%' },
            { key: 'name', label: 'Name', width: '17%' },
            { key: 'sssno', label: 'SSS No.', width: '10%' },
            { key: 'sssee', label: 'SSS Payroll Deduction', width: '10%', align: 'right' },
            { key: 'phno', label: 'PhilHealth No.', width: '10%' },
            { key: 'phee', label: 'PhilHealth Payroll Deduction', width: '10%', align: 'right' },
            { key: 'pino', label: 'Pag-IBIG No.', width: '10%' },
            { key: 'piee', label: 'Pag-IBIG Payroll Deduction', width: '10%', align: 'right' },
          ];
          const rows = (data || []).map((r: any) => [
            `${r.payroll_periods?.period_start || ''} – ${r.payroll_periods?.period_end || ''}`,
            r.employees?.employee_id || '',
            formatFullName(r.employees?.first_name, r.employees?.last_name, r.employees?.suffix_name, r.employees?.middle_name),
            r.employees?.sss_number || '',
            fmtMoney(Number(r.sss_contribution || 0)),
            r.employees?.philhealth_number || '',
            fmtMoney(Number(r.philhealth_contribution || 0)),
            r.employees?.pagibig_number || '',
            fmtMoney(Number(r.pagibig_contribution || 0)),
          ]);
          openPreview({
            title: 'Government Contributions',
            fileName: 'gov-contributions',
            columns,
            rows,
            orientation: reportMeta.orientation,
          });
          break;
        }
      }
      toast.dismiss(toastId);
    } catch (error: any) {
      notifyError(toastId, 'report', error?.message || 'Failed to generate report', 'generate');
    } finally {
      setLoadingReport(null);
    }
  };

  const needsDateRange = (id: ReportType) => id === 'attendance-summary';

  return (
    <div className="page-container">
      <div className="page-header"><h1 className="page-title">Reports</h1></div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reports.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <report.icon className="h-8 w-8 text-primary" />
                <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded">{report.category}</span>
              </div>
              <CardTitle className="text-lg">{report.title}</CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              {needsDateRange(report.id) ? (
                <Dialog open={pickerOpen === report.id} onOpenChange={(open) => setPickerOpen(open ? report.id : null)}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-green-600 hover:bg-green-700 text-white">
                      <Eye className="mr-2 h-4 w-4" /> Generate PDF Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Select Date Range</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Start Date</Label><DateInput value={dateRange.start} onChange={(v) => setDateRange({ ...dateRange, start: v })} /></div>
                        <div><Label>End Date</Label><DateInput value={dateRange.end} onChange={(v) => setDateRange({ ...dateRange, end: v })} /></div>
                      </div>
                      <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => generateReport(report.id)}>
                        <Eye className="mr-2 h-4 w-4" /> Preview Report
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button className="w-full bg-green-600 hover:bg-green-700 text-white" onClick={() => generateReport(report.id)}>
                  <Eye className="mr-2 h-4 w-4" /> Generate PDF Report
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {previewState && (
        <PdfReportPreviewDialog
          open={previewState.open}
          onOpenChange={(open) => setPreviewState(open ? previewState : null)}
          company={company}
          reportTitle={previewState.title}
          generatedAt={new Date()}
          columns={previewState.columns}
          rows={previewState.rows}
          preparedBy={preparedBy}
          orientation={previewState.orientation}
          subtitle={previewState.subtitle}
          fileName={previewState.fileName}
        />
      )}
    </div>
  );
}
