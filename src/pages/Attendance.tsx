import { useState, useMemo } from 'react';
import { useCountUp } from '@/hooks/useCountUp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { useAttendanceByDate, useAttendanceStats } from '@/hooks/useAttendance';
import { Skeleton } from '@/components/ui/skeleton';
import { format, parseISO } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { formatFullName } from '@/lib/formatName';

const borderColorMap: Record<string, string> = {
  'text-success': 'border-l-success',
  'text-warning': 'border-l-warning',
  'text-destructive': 'border-l-destructive',
  'text-info': 'border-l-info',
};

function AttendanceStatCard({ label, value, colorClass, loading, showBorderL = false }: { label: string; value: number; colorClass: string; loading: boolean; showBorderL?: boolean }) {
  const animated = useCountUp(value);
  const borderClass = showBorderL ? `border-l-4 ${borderColorMap[colorClass] || ''}` : '';
  return (
    <Card className={`relative overflow-hidden border border-border/60 bg-card shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1 hover:border-border group cursor-default ${borderClass}`}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        {loading ? <Skeleton className="h-9 w-14 rounded-md" /> : (
          <div className={`text-3xl font-bold tracking-tight ${colorClass} transition-transform duration-300 group-hover:scale-105 origin-left`}>
            {animated}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: attendance, isLoading } = useAttendanceByDate(dateStr);
  const { data: stats, isLoading: statsLoading } = useAttendanceStats(dateStr);

  const filteredAttendance = useMemo(() => {
    if (!attendance) return [];
    if (statusFilter === 'all') return attendance;
    return attendance.filter((a: any) => (a.status || 'present') === statusFilter);
  }, [attendance, statusFilter]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    try { return format(parseISO(timestamp), 'hh:mm a'); } catch { return timestamp; }
  };


  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = { present: 'bg-success/20 text-success', late: 'bg-warning/20 text-warning', absent: 'bg-destructive/20 text-destructive', on_leave: 'bg-info/20 text-info' };
    return <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || styles.present}`}>{status.replace('_', ' ')}</span>;
  };

  const columns: ColumnDef<any, any>[] = [
    { id: 'emp_id', header: 'Employee ID', accessorFn: (row) => row.employees?.employee_id },
    { id: 'name', header: 'Name', accessorFn: (row) => formatFullName(row.employees?.first_name, row.employees?.last_name) },
    { id: 'am_in', header: 'AM In', accessorFn: (row) => row.morning_in || row.time_in, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'am_out', header: 'AM Out', accessorFn: (row) => row.morning_out, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'pm_in', header: 'PM In', accessorFn: (row) => row.afternoon_in, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'pm_out', header: 'PM Out', accessorFn: (row) => row.afternoon_out || row.time_out, cell: ({ getValue }) => formatTime(getValue() as string) },
    { accessorKey: 'hours_worked', header: 'Hours', cell: ({ getValue }) => (getValue() as number)?.toFixed(2) || '-' },
    { accessorKey: 'late_minutes', header: 'Late', cell: ({ getValue }) => getValue() || 0 },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => getStatusBadge((getValue() as string) || 'present') },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Attendance</h1>
        <DatePicker date={selectedDate} onDateChange={(d) => d && setSelectedDate(d)} className="w-[200px]" />
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <AttendanceStatCard label="Present" value={stats?.present || 0} colorClass="text-success" loading={statsLoading} showBorderL />
        <AttendanceStatCard label="Late" value={stats?.late || 0} colorClass="text-warning" loading={statsLoading} showBorderL />
        <AttendanceStatCard label="Absent" value={stats?.absent || 0} colorClass="text-destructive" loading={statsLoading} showBorderL />
        <AttendanceStatCard label="On Leave" value={stats?.onLeave || 0} colorClass="text-info" loading={statsLoading} showBorderL />
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daily Attendance - {selectedDate.toLocaleDateString('en-PH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</CardTitle>
          </div>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <div className="overflow-x-auto">
              <TabsList className="inline-flex w-auto min-w-full sm:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="present">Present</TabsTrigger>
                <TabsTrigger value="late">Late</TabsTrigger>
                <TabsTrigger value="absent">Absent</TabsTrigger>
                <TabsTrigger value="on_leave">On Leave</TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : (
            <DataTable columns={columns} data={filteredAttendance} searchPlaceholder="Search attendance..." emptyMessage="No attendance records for this date" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}