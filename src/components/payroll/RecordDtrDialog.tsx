import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { eachDayOfInterval, format, getDay, isWeekend, parseISO } from 'date-fns';
import { formatFullName } from '@/lib/formatName';
import { useEmployeeScheduleByEmployee } from '@/hooks/useEmployeeSchedule';

const formatLeaveTypeLabel = (raw: string) => {
  const map: Record<string, string> = {
    sick: 'Sick Leave', vacation: 'Vacation Leave', emergency: 'Emergency Leave',
    maternity: 'Maternity Leave', paternity: 'Paternity Leave',
    bereavement: 'Bereavement Leave', unpaid: 'Unpaid Leave',
  };
  if (map[raw]) return map[raw];
  const titled = raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return /leave$/i.test(titled) ? titled : `${titled} Leave`;
};

interface LeaveInfo {
  label: string;
  pay_type?: 'with_pay' | 'without_pay' | string | null;
}

interface RecordDtrDialogProps {
  record: any;
  period: any;
  onClose: () => void;
}

export function RecordDtrDialog({ record, period, onClose }: RecordDtrDialogProps) {
  const employee = record?.employees || {};
  const employeeId: string | undefined = record?.employee_id;

  const startDate: string | undefined = period?.period_start;
  const endDate: string | undefined = period?.period_end;

  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['payroll-record-dtr-attendance', employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!employeeId && !!startDate && !!endDate,
  });

  const { data: leaveRequests } = useQuery({
    queryKey: ['payroll-record-dtr-leaves', employeeId, startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('leave_type, start_date, end_date, pay_type, status')
        .eq('employee_id', employeeId)
        .eq('status', 'hr_approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employeeId && !!startDate && !!endDate,
  });

  const { data: schedules } = useEmployeeScheduleByEmployee(employeeId || null);

  const weekendDutyDays = useMemo(() => {
    const dutySet = new Set<number>();
    if (schedules) {
      for (const s of schedules) {
        if ((s.day_of_week === 0 || s.day_of_week === 6) && s.is_duty_day) {
          dutySet.add(s.day_of_week);
        }
      }
    }
    return dutySet;
  }, [schedules]);

  const attendanceMap = useMemo(() => {
    if (!attendance) return new Map();
    return new Map(attendance.map((r: any) => [r.date, r]));
  }, [attendance]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return [];
    return eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
  }, [startDate, endDate]);

  const getLeaveForDate = (dateStr: string): LeaveInfo | null => {
    if (!leaveRequests) return null;
    const l = leaveRequests.find((l: any) => dateStr >= l.start_date && dateStr <= l.end_date);
    if (!l) return null;
    return { label: formatLeaveTypeLabel(l.leave_type), pay_type: l.pay_type };
  };

  const isRestDay = (day: Date) => isWeekend(day) && !weekendDutyDays.has(getDay(day));

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '';
    return format(new Date(timestamp), 'hh:mm a');
  };

  const getRemarks = (rec: any, rest: boolean, leave: LeaveInfo | null) => {
    if (rest) return '';
    if (leave) {
      return leave.pay_type === 'with_pay' ? 'Leave with Pay'
        : leave.pay_type === 'without_pay' ? 'Leave without Pay'
        : leave.label || 'On Leave';
    }
    if (!rec || rec.status === 'absent') return '';
    if (rec.status === 'late' || (rec.late_minutes || 0) > 0) return `Late (${rec.late_minutes}m)`;
    if (rec.status === 'on_leave') return 'On Leave';
    if (rec.status === 'half_day') return 'Half Day';
    return '';
  };

  const summary = useMemo(() => {
    if (!attendance) return { daysWorked: 0, totalHours: 0, lateMinutes: 0 };
    const rows = attendance as any[];
    const daysWorked = rows.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
    const totalHours = rows.reduce((sum, a) => sum + (a.hours_worked || 0), 0);
    const lateMinutes = rows.reduce((sum, a) => sum + (a.late_minutes || 0), 0);
    return { daysWorked, totalHours, lateMinutes };
  }, [attendance]);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>Daily Time Record - {formatFullName(employee.first_name, employee.last_name, employee.suffix_name, employee.middle_name)}</DialogTitle>
          {startDate && endDate && (
            <DialogDescription>
              {format(parseISO(startDate), 'MMM d')} - {format(parseISO(endDate), 'MMM d, yyyy')}
              {employee.employee_id ? ` • ${employee.employee_id}` : ''}
              {employee.position ? ` • ${employee.position}` : ''}
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="overflow-auto max-h-[60vh] rounded-md border">
          {attendanceLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <Table className="min-w-[720px] table-fixed">
              <TableHeader className="sticky top-0 z-30 bg-card shadow-sm">
                <TableRow className="border-b bg-card hover:bg-card">
                  <TableHead className="w-[70px] bg-card">Date</TableHead>
                  <TableHead className="w-[60px] bg-card">Day</TableHead>
                  <TableHead className="bg-card">AM In</TableHead>
                  <TableHead className="bg-card">AM Out</TableHead>
                  <TableHead className="bg-card">PM In</TableHead>
                  <TableHead className="bg-card">PM Out</TableHead>
                  <TableHead className="w-[70px] bg-card">Hours</TableHead>
                  <TableHead className="w-[140px] bg-card">Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((day) => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const rec = attendanceMap.get(dateStr);
                  const rest = isRestDay(day);
                  const leave = getLeaveForDate(dateStr);
                  const muted = rest || !!leave;
                  return (
                    <TableRow key={dateStr} className={rest ? 'bg-muted/40' : ''}>
                      <TableCell className="text-center">{format(day, 'dd')}</TableCell>
                      <TableCell className="text-center">{format(day, 'EEE')}</TableCell>
                      <TableCell className="text-center">{rest || leave ? '' : formatTime(rec?.morning_in || null)}</TableCell>
                      <TableCell className="text-center">{rest || leave ? '' : formatTime(rec?.morning_out || null)}</TableCell>
                      <TableCell className="text-center">{rest || leave ? '' : formatTime(rec?.afternoon_in || null)}</TableCell>
                      <TableCell className="text-center">{rest || leave ? '' : formatTime(rec?.afternoon_out || null)}</TableCell>
                      <TableCell className="text-center">{rest || leave ? '' : rec?.hours_worked ? Number(rec.hours_worked).toFixed(1) : ''}</TableCell>
                      <TableCell className={`text-center text-xs ${muted ? 'text-muted-foreground' : ''}`}>
                        {getRemarks(rec, rest, leave)}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {days.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No period dates</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">No. of Days Worked</p>
            <p className="text-sm font-bold">{summary.daysWorked}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">Total Hours Worked</p>
            <p className="text-sm font-bold">{summary.totalHours.toFixed(1)}</p>
          </div>
          <div className="rounded-lg border p-2">
            <p className="text-xs text-muted-foreground">No. of Minutes Late</p>
            <p className="text-sm font-bold">{summary.lateMinutes}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
