import { format } from 'date-fns';
import { CalendarX2, CheckCircle2, Clock, Sunrise, Sunset, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileAttendanceListProps {
  records: any[];
  formatTime: (d: string | null) => string;
  getStatusBadge: (status: string | null, record?: any) => JSX.Element;
  isHalfDayRecord: (record: any) => boolean;
}

function formatTotalHours(hours: number | null | undefined) {
  if (!hours) return '0h 00m';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 60) return `${h + 1}h 00m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

function getStatusMeta(record: any, isHalfDay: boolean) {
  const status = record.status as string | null;
  if (isHalfDay) return { tile: 'bg-orange-100 text-orange-700', text: 'text-orange-600', label: 'Half Day' };
  switch (status) {
    case 'present': return { tile: 'bg-success/10 text-success', text: 'text-success', label: 'Present' };
    case 'late': return { tile: 'bg-warning/10 text-warning', text: 'text-warning', label: 'Late' };
    case 'absent': return { tile: 'bg-destructive/10 text-destructive', text: 'text-destructive', label: 'Absent' };
    case 'on_leave': return { tile: 'bg-info/10 text-info', text: 'text-info', label: 'On Leave' };
    case 'half_day': return { tile: 'bg-orange-100 text-orange-700', text: 'text-orange-600', label: 'Half Day' };
    default: return { tile: 'bg-muted text-muted-foreground', text: 'text-muted-foreground', label: status || 'Unknown' };
  }
}

function PunchCell({ time, label }: { time: string; label: 'IN' | 'OUT' }) {
  const has = time !== '-';
  return (
    <div>
      <p className={cn('text-sm font-semibold', !has && 'text-muted-foreground')}>{time}</p>
      <p className={cn('text-xs font-bold tracking-wide', label === 'IN' ? 'text-success' : 'text-destructive', !has && 'opacity-40')}>
        {label}
      </p>
    </div>
  );
}

export function MobileAttendanceList({ records, formatTime, getStatusBadge, isHalfDayRecord }: MobileAttendanceListProps) {
  if (!records.length) {
    return <div className="text-center py-8 text-muted-foreground">No attendance records found</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-primary font-medium">
        <CalendarDays className="h-4 w-4" />
        {records.length} record{records.length === 1 ? '' : 's'} found
      </div>

      {records.map((record: any) => {
        const date = new Date(record.date + 'T00:00:00');
        const halfDay = isHalfDayRecord(record);
        const meta = getStatusMeta(record, halfDay);
        const hasPunches = !!(record.morning_in || record.morning_out || record.afternoon_in || record.afternoon_out);

        return (
          <div key={record.id} className="rounded-lg border bg-card shadow-sm p-4">
            <div className="flex items-center justify-between gap-3">
              <div className={cn('flex flex-col items-center justify-center rounded-lg px-3 py-2 shrink-0 w-16', meta.tile)}>
                <span className="text-xs font-bold uppercase leading-tight">{format(date, 'MMM')}</span>
                <span className="text-xl font-bold leading-tight">{format(date, 'dd')}</span>
                <span className="text-xs font-medium uppercase">{format(date, 'EEE')}</span>
              </div>
              {getStatusBadge(record.status, record)}
            </div>

            {hasPunches ? (
              <div className="mt-4 grid grid-cols-2 divide-x divide-border">
                <div className="space-y-2 pr-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    AM <Sunrise className="h-3.5 w-3.5 text-warning" />
                  </p>
                  <PunchCell time={formatTime(record.morning_in)} label="IN" />
                  <PunchCell time={formatTime(record.morning_out)} label="OUT" />
                </div>
                <div className="space-y-2 pl-3">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    PM <Sunset className="h-3.5 w-3.5 text-warning" />
                  </p>
                  <PunchCell time={formatTime(record.afternoon_in)} label="IN" />
                  <PunchCell time={formatTime(record.afternoon_out)} label="OUT" />
                </div>
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-1.5 text-muted-foreground py-2">
                <CalendarX2 className="h-6 w-6" />
                <p className="text-sm">No attendance record</p>
              </div>
            )}

            <div className="mt-4 border-t border-border pt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0" /> Total Hours
                </span>
                <span className="font-semibold tabular-nums">{formatTotalHours(Number(record.hours_worked))}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> Status
                </span>
                <span className={cn('font-semibold', meta.text)}>{meta.label}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
