import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, CheckCircle2, Download, Eye } from 'lucide-react';

interface MobilePayslipListProps {
  records: any[];
  selectedYear: number;
  onView: (record: any) => void;
  onDownload: (record: any) => void;
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'approved': return <Badge variant="default">Approved</Badge>;
    case 'paid': return <Badge className="bg-green-600 hover:bg-green-700">Paid</Badge>;
    case 'processing': return <Badge variant="secondary">Processing</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

export function MobilePayslipList({ records, selectedYear, onView, onDownload }: MobilePayslipListProps) {
  if (!records.length) {
    return <div className="text-center py-8 text-muted-foreground">No payslips found for {selectedYear}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <Calendar className="h-4 w-4" />
        {records.length} payslip{records.length === 1 ? '' : 's'} found
      </div>

      {records.map((r: any) => {
        const periodStart = new Date(r.payroll_periods.period_start);
        const periodEnd = new Date(r.payroll_periods.period_end);
        const payDate = new Date(r.payroll_periods.pay_date);
        const status = r.payroll_periods.status || 'draft';
        const canDownload = status === 'approved' || status === 'paid';

        return (
          <div key={r.id} className="rounded-lg border bg-card shadow-sm p-4">
            <div className="flex gap-4">
              <div className="flex flex-col items-center justify-center rounded-lg bg-secondary text-secondary-foreground px-3 py-2 shrink-0 w-16">
                <span className="text-sm font-bold uppercase leading-tight">{format(periodStart, 'MMM')}</span>
                <span className="text-xs font-medium">{format(periodStart, 'yyyy')}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm break-words">
                  {format(periodStart, 'MMM d')} – {format(periodEnd, 'MMM d, yyyy')}
                  {r.is_manual && (
                    <Badge variant="outline" className="bg-info/10 text-info border-info/30 text-xs ml-2">Manual</Badge>
                  )}
                </p>
                <div className="mt-3 space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-4 w-4 shrink-0" /> Pay Date
                    </span>
                    <span className="font-medium">{format(payDate, 'MMM d, yyyy')}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 shrink-0" /> Status
                    </span>
                    {getStatusBadge(status)}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" onClick={() => onView(r)}>
                <Eye className="h-4 w-4 mr-2" /> View
              </Button>
              <Button className="w-full" disabled={!canDownload} onClick={() => onDownload(r)}>
                <Download className="h-4 w-4 mr-2" /> {canDownload ? 'Download' : 'Pending'}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
