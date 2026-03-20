import { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, AlertCircle, Calendar, CheckCircle, AlarmClock, XCircle, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useTodayAttendance } from '@/hooks/useClockInOut';
import { useEmployeeAttendance } from '@/hooks/useAttendance';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isBefore, isToday, subMonths, addMonths } from 'date-fns';
import { DataTable, ColumnDef } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

export default function MyAttendance() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const { data, isLoading } = useTodayAttendance();

  const employeeId = data?.employeeId;
  const filterStart = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const filterEnd = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');
  const { data: recentAttendance } = useEmployeeAttendance(employeeId, filterStart, filterEnd);

  const now = new Date();
  const mStart = startOfMonth(now);
  const mEnd = endOfMonth(now);

  const monthlyStats = useMemo(() => {
    if (!recentAttendance) return { present: 0, late: 0, absent: 0, totalWorkDays: 0 };

    const monthRecords = recentAttendance.filter((r: any) => {
      const d = new Date(r.date);
      return d >= mStart && d <= mEnd;
    });

    const present = monthRecords.filter((r: any) => r.status === 'present').length;
    const late = monthRecords.filter((r: any) => r.status === 'late').length;
    const onLeave = monthRecords.filter((r: any) => r.status === 'on_leave').length;

    // Count working days up to today in this month
    const daysToCount = eachDayOfInterval({
      start: mStart,
      end: isBefore(now, mEnd) ? now : mEnd,
    }).filter(d => !isWeekend(d) && (isBefore(d, now) || isToday(d)));

    const totalWorkDays = daysToCount.length;
    const absent = Math.max(0, totalWorkDays - present - late - onLeave);

    return { present, late, absent, totalWorkDays };
  }, [recentAttendance, mStart, mEnd, now]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return format(new Date(dateString), 'hh:mm a');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'present':
        return <Badge className="bg-success/10 text-success border-success/20">Present</Badge>;
      case 'late':
        return <Badge className="bg-warning/10 text-warning border-warning/20">Late</Badge>;
      case 'absent':
        return <Badge className="bg-destructive/10 text-destructive border-destructive/20">Absent</Badge>;
      case 'on_leave':
        return <Badge className="bg-info/10 text-info border-info/20">On Leave</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Unknown'}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employeeId) {
    return (
      <div className="page-container">
        <h1 className="text-2xl font-bold">My Attendance</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your account is not linked to an employee record.</p>
            <p className="text-sm text-muted-foreground mt-2">Please contact HR to set up your employee profile.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const attendance = data?.attendance;

  const columns: ColumnDef<any, any>[] = [
    { accessorKey: 'date', header: 'Date', cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy') },
    { id: 'am_in', header: 'AM In', accessorFn: (row) => row.morning_in || row.time_in, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'am_out', header: 'AM Out', accessorFn: (row) => row.morning_out, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'pm_in', header: 'PM In', accessorFn: (row) => row.afternoon_in, cell: ({ getValue }) => formatTime(getValue() as string) },
    { id: 'pm_out', header: 'PM Out', accessorFn: (row) => row.afternoon_out || row.time_out, cell: ({ getValue }) => formatTime(getValue() as string) },
    { accessorKey: 'hours_worked', header: 'Hours', cell: ({ getValue }) => getValue() || '-' },
    { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => getStatusBadge(getValue() as string) },
  ];

  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold">My Attendance</h1>

      {/* Current Time Display */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="py-6 md:py-8 text-center">
          <div className="flex items-center justify-center gap-2 md:gap-3 mb-2">
            <Clock className="h-6 w-6 md:h-8 md:w-8 text-primary" />
            <span className="text-2xl md:text-4xl font-bold tabular-nums">
              {format(currentTime, 'hh:mm:ss a')}
            </span>
          </div>
          <p className="text-sm md:text-base text-muted-foreground">
            {format(currentTime, 'EEEE, MMMM d, yyyy')}
          </p>
        </CardContent>
      </Card>

      {/* Today's Summary */}
      {attendance ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5">
              <div className="text-center p-3 md:p-4 bg-muted/50 rounded-lg">
                <p className="text-xs md:text-sm text-muted-foreground">Status</p>
                <div className="mt-1">{getStatusBadge(attendance.status)}</div>
              </div>
              <div className="text-center p-3 md:p-4 bg-muted/50 rounded-lg">
                <p className="text-xs md:text-sm text-muted-foreground">AM In</p>
                <p className="font-semibold text-sm md:text-base">{formatTime((attendance as any).morning_in || attendance.time_in)}</p>
              </div>
              <div className="text-center p-3 md:p-4 bg-muted/50 rounded-lg">
                <p className="text-xs md:text-sm text-muted-foreground">AM Out</p>
                <p className="font-semibold text-sm md:text-base">{formatTime((attendance as any).morning_out)}</p>
              </div>
              <div className="text-center p-3 md:p-4 bg-muted/50 rounded-lg">
                <p className="text-xs md:text-sm text-muted-foreground">PM In</p>
                <p className="font-semibold text-sm md:text-base">{formatTime((attendance as any).afternoon_in)}</p>
              </div>
              <div className="text-center p-3 md:p-4 bg-muted/50 rounded-lg col-span-2 md:col-span-1">
                <p className="text-xs md:text-sm text-muted-foreground">PM Out</p>
                <p className="font-semibold text-sm md:text-base">{formatTime((attendance as any).afternoon_out || attendance.time_out)}</p>
              </div>
            </div>
            {attendance.hours_worked && (
              <div className="mt-4 text-center p-3 bg-primary/5 rounded-lg">
                <p className="text-sm text-muted-foreground">Total Hours Worked</p>
                <p className="text-xl font-bold text-primary">{attendance.hours_worked} hours</p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Calendar className="h-5 w-5" />Today's Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-muted-foreground py-4">No attendance record for today. Please use the attendance terminal to clock in.</p>
          </CardContent>
        </Card>
      )}

      {/* This Month Attendances */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5" />
            This Month's Attendance
          </CardTitle>
          <CardDescription>{format(now, 'MMMM yyyy')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="rounded-lg border-l-4 border-l-success bg-success/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle className="h-4 w-4 text-success" />
                <span className="text-xs font-medium text-muted-foreground">Present</span>
              </div>
              <p className="text-2xl font-bold text-success">{monthlyStats.present}</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
            <div className="rounded-lg border-l-4 border-l-warning bg-warning/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlarmClock className="h-4 w-4 text-warning" />
                <span className="text-xs font-medium text-muted-foreground">Late</span>
              </div>
              <p className="text-2xl font-bold text-warning">{monthlyStats.late}</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
            <div className="rounded-lg border-l-4 border-l-destructive bg-destructive/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="h-4 w-4 text-destructive" />
                <span className="text-xs font-medium text-muted-foreground">Absent</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{monthlyStats.absent}</p>
              <p className="text-xs text-muted-foreground">days</p>
            </div>
            <div className="rounded-lg border-l-4 border-l-primary bg-primary/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Work Days</span>
              </div>
              <p className="text-2xl font-bold text-primary">{monthlyStats.totalWorkDays}</p>
              <p className="text-xs text-muted-foreground">this month</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Attendance Records</CardTitle>
              <CardDescription>Your attendance for {format(selectedMonth, 'MMMM yyyy')}</CardDescription>
            </div>
            <Select
              value={format(selectedMonth, 'yyyy-MM')}
              onValueChange={(val) => setSelectedMonth(new Date(val + '-01'))}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => {
                  const d = new Date(new Date().getFullYear(), i, 1);
                  return (
                    <SelectItem key={i} value={format(d, 'yyyy-MM')} disabled={d > new Date()}>
                      {format(d, 'MMMM yyyy')}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <DataTable columns={columns} data={recentAttendance || []} searchPlaceholder="Search attendance..." emptyMessage="No attendance records found" />
        </CardContent>
      </Card>
    </div>
  );
}
