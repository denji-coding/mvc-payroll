import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { FileText, Users, PhilippinePeso, HandCoins, Download, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { DateInput } from '@/components/ui/date-picker';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

type ReportType = 'employee-masterlist' | 'attendance-summary' | 'leave-balance' | 'payroll-summary' | 'gov-contributions';

const reports = [
  { id: 'employee-masterlist' as ReportType, title: 'Employee Masterlist', description: 'Complete list of all employees with details', icon: Users, category: 'HR' },
  { id: 'attendance-summary' as ReportType, title: 'Attendance Summary', description: 'Daily, weekly, or monthly attendance reports', icon: FileText, category: 'HR' },
  { id: 'leave-balance' as ReportType, title: 'Leave Balance Report', description: 'Leave credits and usage per employee', icon: FileText, category: 'HR' },
  { id: 'payroll-summary' as ReportType, title: 'Payroll Summary', description: 'Payroll totals per period', icon: DollarSign, category: 'Payroll' },
  { id: 'gov-contributions' as ReportType, title: 'Government Contributions', description: 'SSS, PhilHealth, Pag-IBIG reports', icon: DollarSign, category: 'Payroll' },
];

const headerStyle: Partial<ExcelJS.Style> = {
  font: { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF166534' } },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  border: {
    top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
  },
};

const cellBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

function autoFitColumns(worksheet: ExcelJS.Worksheet) {
  worksheet.columns.forEach((column) => {
    let maxLength = 10;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : '';
      maxLength = Math.max(maxLength, cellValue.length + 4);
    });
    column.width = Math.min(maxLength, 40);
  });
}

function applyHeaderAndCellStyles(worksheet: ExcelJS.Worksheet) {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.style = headerStyle as ExcelJS.Style;
  });

  for (let i = 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i);
    row.eachCell((cell) => {
      cell.border = cellBorder;
      cell.alignment = { vertical: 'middle' };
    });
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } };
      });
    }
  }
}

async function downloadExcel(sheetName: string, headers: string[], rows: any[][], filename: string) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  worksheet.addRow(headers);
  rows.forEach((row) => worksheet.addRow(row));

  applyHeaderAndCellStyles(worksheet);
  autoFitColumns(worksheet);

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `${filename}-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}

export default function Reports() {
  const [generating, setGenerating] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  const generateReport = async (reportId: ReportType) => {
    setGenerating(reportId);
    try {
      switch (reportId) {
        case 'employee-masterlist': {
          const { data, error } = await supabase.from('employees').select('*, branches(name)').order('last_name');
          if (error) throw error;
          const headers = ['Employee ID', 'Last Name', 'First Name', 'Middle Name', 'Email', 'Phone', 'Position', 'Branch', 'Date Hired', 'Status', 'Basic Salary'];
          const rows = (data || []).map(e => [
            e.employee_id,
            e.last_name,
            e.first_name,
            e.middle_name || '',
            e.email,
            e.phone || '',
            e.position,
            (e.branches as any)?.name || '',
            e.date_hired,
            e.employment_status || 'active',
            Number(e.basic_salary || 0),
          ]);
          await downloadExcel('Employee Masterlist', headers, rows, 'employee-masterlist');
          toast.success('Employee Masterlist report generated successfully');
          break;
        }
        case 'attendance-summary': {
          if (!dateRange.start || !dateRange.end) {
            toast.error('Please select a date range');
            setGenerating(null);
            return;
          }
          const { data, error } = await supabase.from('attendance')
            .select('*, employees(employee_id, first_name, last_name)')
            .gte('date', dateRange.start)
            .lte('date', dateRange.end)
            .order('date');
          if (error) throw error;
          const headers = ['Date', 'Employee ID', 'Name', 'AM In', 'AM Out', 'PM In', 'PM Out', 'Hours Worked', 'Late (min)', 'Status'];
          const formatTs = (ts: string | null) => {
            if (!ts) return '';
            try { return format(new Date(ts), 'hh:mm a'); } catch { return ts; }
          };
          const rows = (data || []).map(a => [
            a.date,
            (a.employees as any)?.employee_id || '',
            `${(a.employees as any)?.first_name || ''} ${(a.employees as any)?.last_name || ''}`.trim(),
            formatTs(a.morning_in || a.time_in),
            formatTs(a.morning_out),
            formatTs(a.afternoon_in),
            formatTs(a.afternoon_out || a.time_out),
            Number(a.hours_worked || 0),
            Number(a.late_minutes || 0),
            (a.status || 'present').replace('_', ' '),
          ]);
          await downloadExcel('Attendance Summary', headers, rows, 'attendance-summary');
          toast.success('Attendance Summary report generated successfully');
          break;
        }
        case 'leave-balance': {
          const { data, error } = await supabase.from('leave_credits')
            .select('*, employees(employee_id, first_name, last_name)')
            .eq('year', new Date().getFullYear());
          if (error) throw error;
          const headers = ['Employee ID', 'Name', 'Leave Type', 'Total Credits', 'Used Credits', 'Remaining Credits', 'Year'];
          const rows = (data || []).map(c => [
            (c.employees as any)?.employee_id || '',
            `${(c.employees as any)?.first_name || ''} ${(c.employees as any)?.last_name || ''}`.trim(),
            c.leave_type,
            Number(c.total_credits || 0),
            Number(c.used_credits || 0),
            Number((c.total_credits || 0) - (c.used_credits || 0)),
            c.year,
          ]);
          await downloadExcel('Leave Balance', headers, rows, 'leave-balance');
          toast.success('Leave Balance report generated successfully');
          break;
        }
        case 'payroll-summary': {
          const { data, error } = await supabase.from('payroll_records')
            .select('*, employees(employee_id, first_name, last_name), payroll_periods(period_start, period_end, pay_date)')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const headers = ['Period', 'Pay Date', 'Employee ID', 'Name', 'Days Worked', 'Basic Pay', 'Gross Pay', 'SSS', 'PhilHealth', 'Pag-IBIG', 'Total Deductions', 'Net Pay'];
          const rows = (data || []).map(r => [
            `${(r.payroll_periods as any)?.period_start || ''} to ${(r.payroll_periods as any)?.period_end || ''}`,
            (r.payroll_periods as any)?.pay_date || '',
            (r.employees as any)?.employee_id || '',
            `${(r.employees as any)?.first_name || ''} ${(r.employees as any)?.last_name || ''}`.trim(),
            Number(r.days_worked || 0),
            Number(r.basic_pay || 0),
            Number(r.gross_pay || 0),
            Number(r.sss_contribution || 0),
            Number(r.philhealth_contribution || 0),
            Number(r.pagibig_contribution || 0),
            Number(r.total_deductions || 0),
            Number(r.net_pay || 0),
          ]);
          await downloadExcel('Payroll Summary', headers, rows, 'payroll-summary');
          toast.success('Payroll Summary report generated successfully');
          break;
        }
        case 'gov-contributions': {
          const { data, error } = await supabase.from('payroll_records')
            .select('*, employees(employee_id, first_name, last_name, sss_number, philhealth_number, pagibig_number), payroll_periods(period_start, period_end)')
            .order('created_at', { ascending: false });
          if (error) throw error;
          const headers = ['Period', 'Employee ID', 'Name', 'SSS No.', 'SSS (EE)', 'SSS (ER)', 'PhilHealth No.', 'PhilHealth (EE)', 'PhilHealth (ER)', 'Pag-IBIG No.', 'Pag-IBIG (EE)', 'Pag-IBIG (ER)'];
          const rows = (data || []).map(r => [
            `${(r.payroll_periods as any)?.period_start || ''} to ${(r.payroll_periods as any)?.period_end || ''}`,
            (r.employees as any)?.employee_id || '',
            `${(r.employees as any)?.first_name || ''} ${(r.employees as any)?.last_name || ''}`.trim(),
            (r.employees as any)?.sss_number || '',
            Number(r.sss_contribution || 0),
            Number(((r.sss_contribution || 0) * 1.5).toFixed(2)),
            (r.employees as any)?.philhealth_number || '',
            Number(r.philhealth_contribution || 0),
            Number(r.philhealth_contribution || 0),
            (r.employees as any)?.pagibig_number || '',
            Number(r.pagibig_contribution || 0),
            Number(r.pagibig_contribution || 0),
          ]);
          await downloadExcel('Government Contributions', headers, rows, 'gov-contributions');
          toast.success('Government Contributions report generated successfully');
          break;
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate report');
    } finally {
      setGenerating(null);
      setSelectedReport(null);
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
                <Dialog open={selectedReport === report.id} onOpenChange={(open) => setSelectedReport(open ? report.id : null)}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Download className="mr-2 h-4 w-4" /> Generate Report
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Select Date Range</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div><Label>Start Date</Label><DateInput value={dateRange.start} onChange={(v) => setDateRange({ ...dateRange, start: v })} /></div>
                        <div><Label>End Date</Label><DateInput value={dateRange.end} onChange={(v) => setDateRange({ ...dateRange, end: v })} /></div>
                      </div>
                      <Button className="w-full" onClick={() => generateReport(report.id)} disabled={generating === report.id}>
                        {generating === report.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Download className="mr-2 h-4 w-4" /> Download Report</>}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              ) : (
                <Button variant="outline" className="w-full" onClick={() => generateReport(report.id)} disabled={generating === report.id}>
                  {generating === report.id ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : <><Download className="mr-2 h-4 w-4" /> Generate Report</>}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
