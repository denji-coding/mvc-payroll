import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Calculator, Plus, Eye, CheckCircle, Pencil, Trash2, Download, FileEdit, Loader2 } from 'lucide-react';
import { PayrollSummaryIcon } from '@/components/icons/PayrollSummaryIcon';
import { BulkPayslipsIcon } from '@/components/icons/BulkPayslipsIcon';
import { generatePayrollSummaryPdf } from '@/lib/generatePayrollSummaryPdf';
import { generatePayslipPdf } from '@/lib/generatePayslipPdf';
import { generateBulkPayslipsPdf } from '@/lib/generateBulkPayslipsPdf';
import { SalaryCalculator } from '@/components/payroll/SalaryCalculator';
import { ManualPayrollDialog } from '@/components/payroll/ManualPayrollDialog';
import { usePayrollPeriods, usePayrollRecords, useCreatePayrollPeriod, useRunPayroll, useApprovePayroll, useDeletePayrollPeriod, useDeletePayrollRecord } from '@/hooks/usePayroll';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useSalaryComponents, useCreateSalaryComponent, useUpdateSalaryComponent, useDeleteSalaryComponent } from '@/hooks/useSalaryComponents';
import { useAuth } from '@/hooks/useAuth';
import { format, isSameMonth } from 'date-fns';
import { DateInput } from '@/components/ui/date-picker';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { formatFullName } from '@/lib/formatName';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function Payroll() {
  const { role } = useAuth();
  const isHR = (role === 'hr_admin' || role === 'super_admin');
  const { data: periods, isLoading: periodsLoading } = usePayrollPeriods();
  const { data: components, isLoading: componentsLoading } = useSalaryComponents();
  const createPeriod = useCreatePayrollPeriod();
  const runPayroll = useRunPayroll();
  const approvePayroll = useApprovePayroll();
  const deletePayrollPeriod = useDeletePayrollPeriod();
  const deletePayrollRecord = useDeletePayrollRecord();

  const [selectedPeriod, setSelectedPeriod] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('periods');
  const [periodStatusFilter, setPeriodStatusFilter] = useState<string>('all');
  const { data: records, isLoading: recordsLoading } = usePayrollRecords(selectedPeriod || undefined);

  const selectedPeriodData = periods?.find((p: any) => p.id === selectedPeriod);
  const isPeriodProcessed = selectedPeriodData?.status !== 'draft';
  const isPeriodNotApproved = selectedPeriodData?.status === 'draft' || selectedPeriodData?.status === 'processing';

  const [createOpen, setCreateOpen] = useState(false);
  const [manualPayrollOpen, setManualPayrollOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [periodForm, setPeriodForm] = useState({ period_start: '', period_end: '', pay_date: '' });
  const [viewPayslip, setViewPayslip] = useState<any>(null);

  const handleViewPeriod = (periodId: string) => { setSelectedPeriod(periodId); setActiveTab('records'); };

  const handleDownloadSummary = async (period: any) => {
    try {
      const { data: periodRecords, error } = await supabase
        .from('payroll_records')
        .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name)')
        .eq('payroll_period_id', period.id)
        .order('employees(last_name)', { ascending: true });
      
      if (error) throw error;
      
      generatePayrollSummaryPdf({
        records: periodRecords || [],
        periodStart: period.period_start,
        periodEnd: period.period_end,
      });
    } catch (err) {
      console.error('Failed to generate summary PDF:', err);
    }
  };

  const [bulkPeriodId, setBulkPeriodId] = useState<string | null>(null);
  const handleDownloadBulkPayslips = async (period: any) => {
    setBulkPeriodId(period.id);
    try {
      const { data: periodRecords, error } = await supabase
        .from('payroll_records')
        .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name, position, basic_salary)')
        .eq('payroll_period_id', period.id)
        .order('employees(last_name)', { ascending: true });

      if (error) throw error;

      const items = (periodRecords || []).map((r: any) => {
        const emp = r.employees || {};
        return {
          employee: {
            employee_id: emp.employee_id,
            first_name: emp.first_name,
            middle_name: emp.middle_name,
            last_name: emp.last_name,
            suffix_name: emp.suffix_name,
            position: emp.position,
          },
          payroll: {
            period_start: period.period_start,
            period_end: period.period_end,
            pay_date: period.pay_date,
            basic_pay: Number(r.basic_pay || 0),
            days_worked: Number(r.days_worked || 0),
            total_allowances: Number(r.total_allowances || 0),
            allowances_breakdown: (r.allowances_breakdown && typeof r.allowances_breakdown === 'object') ? r.allowances_breakdown : {},
            gross_pay: Number(r.gross_pay || 0),
            sss_contribution: Number(r.sss_contribution || 0),
            philhealth_contribution: Number(r.philhealth_contribution || 0),
            pagibig_contribution: Number(r.pagibig_contribution || 0),
            withholding_tax: Number(r.withholding_tax || 0),
            other_deductions: Number(r.other_deductions || 0),
            deductions_breakdown: (r.deductions_breakdown && typeof r.deductions_breakdown === 'object') ? r.deductions_breakdown : {},
            total_deductions: Number(r.total_deductions || 0),
            net_pay: Number(r.net_pay || 0),
          },
          dailyRate: emp.basic_salary ? Number(emp.basic_salary) : undefined,
        };
      });

      if (items.length === 0) return;
      await generateBulkPayslipsPdf({ items, periodStart: period.period_start, periodEnd: period.period_end });
    } catch (err) {
      console.error('Failed to generate bulk payslips PDF:', err);
    } finally {
      setBulkPeriodId(null);
    }
  };
  
  // Check if month already has a processed/processing payroll
  const isMonthAlreadyProcessed = (periodStart: string) => {
    if (!periodStart || !periods) return false;
    const selectedDate = new Date(periodStart);
    return periods.some((p: any) => {
      const pDate = new Date(p.period_start);
      return isSameMonth(selectedDate, pDate) && (p.status === 'processing' || p.status === 'approved' || p.status === 'paid');
    });
  };

  const handleCreatePeriod = (e: React.FormEvent) => {
    e.preventDefault();
    if (isMonthAlreadyProcessed(periodForm.period_start)) {
      return;
    }
    createPeriod.mutate(periodForm, { onSuccess: () => { setPeriodForm({ period_start: '', period_end: '', pay_date: '' }); setCreateOpen(false); } });
  };

  const createDisabledReason = periodForm.period_start && isMonthAlreadyProcessed(periodForm.period_start)
    ? 'A payroll for this month has already been processed'
    : '';

  const formatCurrency = (amount: number | null) => `₱${(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = { draft: 'outline', processing: 'secondary', approved: 'default', paid: 'default' };
    const displayLabels: Record<string, string> = { approved: 'processed', paid: 'paid' };
    return <Badge variant={variants[status] || 'outline'}>{displayLabels[status] || status}</Badge>;
  };

  const earnings = components?.filter(c => c.type === 'earning') || [];
  const deductions = components?.filter(c => c.type === 'deduction') || [];

  const [runningPeriodId, setRunningPeriodId] = useState<string | null>(null);
  const [approvingPeriodId, setApprovingPeriodId] = useState<string | null>(null);
  const isProcessing = runPayroll.isPending || approvePayroll.isPending;

  // Filter periods by status
  const filteredPeriods = periods?.filter((p: any) => {
    if (periodStatusFilter === 'all') return true;
    if (periodStatusFilter === 'processed') return p.status === 'approved' || p.status === 'paid';
    return p.status === periodStatusFilter;
  }) || [];

  const periodColumns: ColumnDef<any, any>[] = [
    { id: 'period', header: 'Period', accessorFn: (row) => row.period_start, cell: ({ row }) => `${format(new Date(row.original.period_start), 'MMM d')} - ${format(new Date(row.original.period_end), 'MMM d, yyyy')}` },
    { accessorKey: 'pay_date', header: 'Pay Date', cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy') },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => getStatusBadge(getValue() as string) },
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => handleViewPeriod(p.id)}><Eye className="h-4 w-4" /></Button>
            {(p.status === 'approved' || p.status === 'paid') && (
              <Button size="sm" variant="outline" onClick={() => handleDownloadSummary(p)} title="Download Payroll Summary"><PayrollSummaryIcon className="h-4 w-4 text-foreground" /></Button>
            )}
            {(p.status === 'approved' || p.status === 'paid') && (
              <Button size="sm" variant="outline" onClick={() => handleDownloadBulkPayslips(p)} disabled={bulkPeriodId === p.id} title="Download Bulk Payslips">
                {bulkPeriodId === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <BulkPayslipsIcon className="h-4 w-4 text-foreground" />}
              </Button>
            )}
            {isHR && p.status === 'draft' && (
              <Button size="sm" onClick={() => { setRunningPeriodId(p.id); runPayroll.mutate({ periodId: p.id }, { onSettled: () => setRunningPeriodId(null) }); }} disabled={runPayroll.isPending}>
                {runningPeriodId === p.id && runPayroll.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Processing...</> : <><Calculator className="mr-1 h-4 w-4" />Run</>}
              </Button>
            )}
            {isHR && p.status === 'processing' && (
              <Button size="sm" variant="outline" onClick={() => { setApprovingPeriodId(p.id); approvePayroll.mutate(p.id, { onSettled: () => setApprovingPeriodId(null) }); }} disabled={approvePayroll.isPending}>
                {approvingPeriodId === p.id && approvePayroll.isPending ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Processing...</> : <><CheckCircle className="mr-1 h-4 w-4" />Process</>}
              </Button>
            )}
            {isHR && (p.status === 'draft' || p.status === 'processing') && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Payroll Period?</AlertDialogTitle><AlertDialogDescription>This will delete the period and all records.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePayrollPeriod.mutate(p.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        );
      },
    },
  ];

  const recordColumns: ColumnDef<any, any>[] = [
    { id: 'employee', header: 'Employee', accessorFn: (row) => formatFullName(row.employees?.first_name, row.employees?.last_name, row.employees?.suffix_name, row.employees?.middle_name) },
    { accessorKey: 'is_manual', header: 'Type of Calculation', cell: ({ getValue }) => getValue() ? <Badge variant="outline" className="bg-info/10 text-info border-info/30">Manual</Badge> : <Badge variant="outline">Automated</Badge> },
    { accessorKey: 'basic_pay', header: 'Basic', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'gross_pay', header: 'Gross', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'total_deductions', header: 'Deductions', cell: ({ getValue }) => formatCurrency(getValue() as number) },
    { accessorKey: 'net_pay', header: 'Net Pay', cell: ({ getValue }) => <span className="font-bold">{formatCurrency(getValue() as number)}</span> },
    {
      id: 'actions', header: 'Actions', enableSorting: false,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setViewPayslip(r)} disabled={!isPeriodProcessed}><Eye className="h-4 w-4" /></Button>
            {isHR && isPeriodNotApproved && (
              <Button size="sm" variant="outline" onClick={() => { setEditingRecord(r); setManualPayrollOpen(true); }}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {isHR && isPeriodNotApproved && (
              <AlertDialog>
                <AlertDialogTrigger asChild><Button size="sm" variant="outline" className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Payroll Record?</AlertDialogTitle><AlertDialogDescription>Delete record for {formatFullName(r.employees?.first_name, r.employees?.last_name, r.employees?.suffix_name, r.employees?.middle_name)}?</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deletePayrollRecord.mutate(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Payroll Management</h1>
        {isHR && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" /> New Payroll Period</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Payroll Period</DialogTitle></DialogHeader>
              <form onSubmit={handleCreatePeriod} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div><Label>Period Start</Label><DateInput value={periodForm.period_start} onChange={(v) => setPeriodForm({ ...periodForm, period_start: v })} /></div>
                  <div><Label>Period End</Label><DateInput value={periodForm.period_end} onChange={(v) => setPeriodForm({ ...periodForm, period_end: v })} /></div>
                </div>
                <div><Label>Pay Date</Label><DateInput value={periodForm.pay_date} onChange={(v) => setPeriodForm({ ...periodForm, pay_date: v })} /></div>
                {createDisabledReason && (
                  <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">{createDisabledReason}</div>
                )}
                <Button type="submit" className="w-full" disabled={createPeriod.isPending || !!createDisabledReason}>{createPeriod.isPending ? 'Creating...' : 'Create Period'}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <Card className="mb-4 border-primary/50 bg-primary/5">
          <CardContent className="flex items-center justify-center gap-3 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <p className="text-sm font-medium text-primary">{runPayroll.isPending ? 'Computing payroll... This may take a moment.' : 'Processing payroll...'}</p>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto pb-2">
          <TabsList className="inline-flex w-auto min-w-full gap-1">
            <TabsTrigger value="periods">Payroll Periods</TabsTrigger>
            <TabsTrigger value="records">Payroll Records</TabsTrigger>
            <TabsTrigger value="components">Salary Components</TabsTrigger>
            {isHR && <TabsTrigger value="calculator">Salary Calculator</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="periods" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Periods</CardTitle>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['all', 'draft', 'processing', 'processed'].map((status) => (
                  <Button
                    key={status}
                    variant={periodStatusFilter === status ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPeriodStatusFilter(status)}
                    className="capitalize"
                  >
                    {status === 'all' ? 'All' : status}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {periodsLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
                <DataTable columns={periodColumns} data={filteredPeriods} searchable={false} emptyMessage="No payroll periods" />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="records" className="mt-4">
          <Card>
            <CardHeader><CardTitle>Payroll Records</CardTitle><CardDescription>{selectedPeriod ? 'Employee payslips' : 'Select a period first'}</CardDescription></CardHeader>
            <CardContent>
              {selectedPeriod ? (
                <>
                  {!isPeriodProcessed && (
                    <div className="bg-warning/10 text-warning p-4 rounded-lg mb-4 text-center"><p className="text-sm font-medium">Payroll is not yet processed. View and download will be available after processing.</p></div>
                  )}
                  {recordsLoading ? <div className="text-center py-8 text-muted-foreground">Loading...</div> : (
                    <DataTable columns={recordColumns} data={records || []} searchPlaceholder="Search records..." emptyMessage="No records" />
                  )}
                </>
              ) : <p className="text-muted-foreground text-center py-8">Select a payroll period</p>}
            </CardContent>
          </Card>
          {viewPayslip && <PayslipDialog record={viewPayslip} onClose={() => setViewPayslip(null)} formatCurrency={formatCurrency} periodStatus={selectedPeriodData?.status} period={selectedPeriodData} />}
          {selectedPeriod && <ManualPayrollDialog periodId={selectedPeriod} open={manualPayrollOpen} onClose={() => { setManualPayrollOpen(false); setEditingRecord(null); }} editRecord={editingRecord} />}
        </TabsContent>

        <TabsContent value="components" className="mt-4">
          <SalaryComponentsTab earnings={earnings} deductions={deductions} isLoading={componentsLoading} isHR={isHR} />
        </TabsContent>

        {isHR && <TabsContent value="calculator" className="mt-4"><SalaryCalculator /></TabsContent>}
      </Tabs>
    </div>
  );
}

function PayslipDialog({ record: r, onClose, formatCurrency, periodStatus, period }: { record: any; onClose: () => void; formatCurrency: (n: number | null) => string; periodStatus?: string; period?: any }) {
  const canDownload = periodStatus === 'approved' || periodStatus === 'paid';

  // Parse allowances_breakdown for LWP display
  const allowancesBreakdown = (r.allowances_breakdown && typeof r.allowances_breakdown === 'object') ? r.allowances_breakdown as Record<string, number> : {};
  const deductionsBreakdown = (r.deductions_breakdown && typeof r.deductions_breakdown === 'object') ? r.deductions_breakdown as Record<string, number> : {};

  // Aggregate LWP amount + days across breakdown entries; always shown even when 0.00
  const lwpRegex = /leave\s*with\s*pay/i;
  let lwpAmount = 0;
  let lwpDays = 0;
  Object.entries(allowancesBreakdown).forEach(([key, value]) => {
    if (lwpRegex.test(key)) {
      lwpAmount += Number(value) || 0;
      const m = key.match(/\((\d+(?:\.\d+)?)\s*days?\)/i);
      if (m) lwpDays += Number(m[1]);
    }
  });
  const lwpDaysLabel = `${lwpDays} day${lwpDays === 1 ? '' : 's'}`;

  const lateEntries = Object.entries(deductionsBreakdown).filter(([key]) => key.toLowerCase().includes('late'));
  const lwopEntries = Object.entries(deductionsBreakdown).filter(([key]) => key.toLowerCase().includes('without pay'));

  const handleDownload = () => {
    const emp = r.employees || {};
    generatePayslipPdf({
      employee: {
        employee_id: emp.employee_id,
        first_name: emp.first_name,
        middle_name: emp.middle_name,
        last_name: emp.last_name,
        suffix_name: emp.suffix_name,
        position: emp.position,
      },
      payroll: {
        period_start: period?.period_start || r.payroll_periods?.period_start,
        period_end: period?.period_end || r.payroll_periods?.period_end,
        pay_date: period?.pay_date || r.payroll_periods?.pay_date,
        basic_pay: Number(r.basic_pay || 0),
        days_worked: Number(r.days_worked || 0),
        overtime_pay: Number(r.overtime_pay || 0),
        holiday_pay: Number(r.holiday_pay || 0),
        night_differential: Number(r.night_differential || 0),
        total_allowances: Number(r.total_allowances || 0),
        allowances_breakdown: allowancesBreakdown,
        gross_pay: Number(r.gross_pay || 0),
        sss_contribution: Number(r.sss_contribution || 0),
        philhealth_contribution: Number(r.philhealth_contribution || 0),
        pagibig_contribution: Number(r.pagibig_contribution || 0),
        withholding_tax: Number(r.withholding_tax || 0),
        other_deductions: Number(r.other_deductions || 0),
        deductions_breakdown: deductionsBreakdown,
        total_deductions: Number(r.total_deductions || 0),
        net_pay: Number(r.net_pay || 0),
      },
      dailyRate: emp.basic_salary ? Number(emp.basic_salary) : undefined,
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Payslip - {formatFullName(r.employees?.first_name, r.employees?.last_name, r.employees?.suffix_name, r.employees?.middle_name)}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold text-success mb-2">Earnings</h4>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span>Basic Pay</span><span>{formatCurrency(r.basic_pay)}</span></div>
              <div className="flex justify-between"><span>Leave with Pay ({lwpDaysLabel})</span><span>{formatCurrency(lwpAmount)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Gross</span><span>{formatCurrency(r.gross_pay)}</span></div>
            </div>
          </div>
          <div>
            <h4 className="font-semibold text-destructive mb-2">Deductions</h4>
            <div className="space-y-1 text-sm">
              {(r.sss_contribution || 0) > 0 && <div className="flex justify-between"><span>SSS</span><span>{formatCurrency(r.sss_contribution)}</span></div>}
              {(r.philhealth_contribution || 0) > 0 && <div className="flex justify-between"><span>PhilHealth</span><span>{formatCurrency(r.philhealth_contribution)}</span></div>}
              {(r.pagibig_contribution || 0) > 0 && <div className="flex justify-between"><span>Pag-IBIG</span><span>{formatCurrency(r.pagibig_contribution)}</span></div>}
              {lateEntries.length > 0 ? lateEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between"><span>{key}</span><span>{formatCurrency(value)}</span></div>
              )) : (r.other_deductions || 0) > 0 && (
                <div className="flex justify-between"><span>Late Deduction</span><span>{formatCurrency(r.other_deductions)}</span></div>
              )}
              {lwopEntries.map(([key, value]) => (
                <div key={key} className="flex justify-between"><span>{key}</span><span>{formatCurrency(value)}</span></div>
              ))}
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span>{formatCurrency(r.total_deductions)}</span></div>
            </div>
          </div>
        </div>
        <div className="bg-primary/10 p-4 rounded-lg text-center"><p className="text-sm text-muted-foreground">Net Pay</p><p className="text-2xl font-bold text-primary">{formatCurrency(r.net_pay)}</p></div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          {canDownload && <Button onClick={handleDownload} className="w-full sm:w-auto"><Download className="mr-2 h-4 w-4" /> Download Payslip</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SalaryComponentsTab({ earnings, deductions, isLoading, isHR }: { earnings: any[]; deductions: any[]; isLoading: boolean; isHR: boolean }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'earning', description: '', is_taxable: true, is_mandatory: false });
  const createComponent = useCreateSalaryComponent();
  const deleteComponent = useDeleteSalaryComponent();

  const handleSubmit = async () => { await createComponent.mutateAsync(form); setDialogOpen(false); setForm({ name: '', type: 'earning', description: '', is_taxable: true, is_mandatory: false }); };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div><CardTitle>Salary Components</CardTitle><CardDescription>Configure earnings and deductions</CardDescription></div>
          {isHR && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button className="w-full sm:w-auto"><Plus className="h-4 w-4 mr-2" />Add Component</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Salary Component</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                  <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
                  <div><Label>Type</Label><Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="earning">Earning</SelectItem><SelectItem value="deduction">Deduction</SelectItem></SelectContent></Select></div>
                  <div className="flex items-center justify-between"><Label>Taxable</Label><Switch checked={form.is_taxable} onCheckedChange={(v) => setForm({ ...form, is_taxable: v })} /></div>
                  <div className="flex items-center justify-between"><Label>Mandatory</Label><Switch checked={form.is_mandatory} onCheckedChange={(v) => setForm({ ...form, is_mandatory: v })} /></div>
                </div>
                <DialogFooter><Button onClick={handleSubmit} disabled={!form.name}>Create</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? <Skeleton className="h-40 w-full" /> : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="border rounded-lg p-4"><h3 className="font-semibold text-success mb-3">Earnings</h3>
              {earnings.length ? <ul className="space-y-2 text-sm">{earnings.map(c => <li key={c.id} className="flex justify-between items-center"><span>• {c.name}</span>{isHR && <Button variant="ghost" size="icon" onClick={() => deleteComponent.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>}</li>)}</ul> : <p className="text-muted-foreground text-sm">No earnings configured</p>}
            </div>
            <div className="border rounded-lg p-4"><h3 className="font-semibold text-destructive mb-3">Deductions</h3>
              {deductions.length ? <ul className="space-y-2 text-sm">{deductions.map(c => <li key={c.id} className="flex justify-between items-center"><span>• {c.name}</span>{isHR && <Button variant="ghost" size="icon" onClick={() => deleteComponent.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>}</li>)}</ul> : <p className="text-muted-foreground text-sm">No deductions configured</p>}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
