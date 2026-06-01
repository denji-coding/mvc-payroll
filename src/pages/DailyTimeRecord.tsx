import { useState, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { FileText, Clock, AlertCircle, Calendar, Printer, Download } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, getDay } from 'date-fns';
import { PrintableDTR } from '@/components/dtr/PrintableDTR';
import { useEmployeeScheduleByEmployee } from '@/hooks/useEmployeeSchedule';
import {
  generateDTRPdf, 
  generateMultiMonthDTRPdf, 
  generateMonthsFromRange, 
  getDaysInMonth, 
  calculateSummary 
} from '@/lib/generateDTRPdf';
import { toast } from 'sonner';
import { useCountUp } from '@/hooks/useCountUp';

const months = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const currentYear = new Date().getFullYear();
const years = [currentYear, currentYear - 1, currentYear - 2];

function SummaryCard({ icon, label, value, decimal }: { icon: React.ReactNode; label: string; value: number; decimal?: boolean }) {
  const animated = useCountUp(decimal ? Math.round(value * 10) : value);
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{decimal ? (animated / 10).toFixed(1) : animated}</p>
      </CardContent>
    </Card>
  );
}

export default function DailyTimeRecord() {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(currentYear);
  
  // Date range mode
  const [isRangeMode, setIsRangeMode] = useState(false);
  const [endMonth, setEndMonth] = useState(new Date().getMonth());
  const [endYear, setEndYear] = useState(currentYear);

  // Get employee ID from user
  const { data: employee, isLoading: employeeLoading } = useQuery({
    queryKey: ['employee-by-user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, employee_id, position, department, created_at')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Calculate date range for selected month (for display)
  const { startDate, endDate } = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth, 1);
    return {
      startDate: format(startOfMonth(date), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(date), 'yyyy-MM-dd'),
    };
  }, [selectedMonth, selectedYear]);

  // Fetch attendance for the displayed month
  const { data: attendance, isLoading: attendanceLoading } = useQuery({
    queryKey: ['employee-attendance', employee?.id, startDate, endDate],
    queryFn: async () => {
      if (!employee?.id) return null;
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!employee?.id,
  });

  // Fetch employee schedule to know weekend duty days
  const { data: schedules } = useEmployeeScheduleByEmployee(employee?.id || null);

  // Fetch approved leave requests overlapping selected month
  const { data: leaveRequests } = useQuery({
    queryKey: ['employee-leaves-month', employee?.id, startDate, endDate],
    queryFn: async () => {
      if (!employee?.id) return [];
      const { data, error } = await supabase
        .from('leave_requests')
        .select('leave_type, start_date, end_date, pay_type, status')
        .eq('employee_id', employee.id)
        .eq('status', 'hr_approved')
        .lte('start_date', endDate)
        .gte('end_date', startDate);
      if (error) throw error;
      return data || [];
    },
    enabled: !!employee?.id,
  });

  const formatLeaveTypeLabel = (raw: string) => {
    const map: Record<string, string> = {
      sick: 'Sick Leave', vacation: 'Vacation Leave', emergency: 'Emergency Leave',
      maternity: 'Maternity Leave', paternity: 'Paternity Leave',
      bereavement: 'Bereavement Leave', unpaid: 'Unpaid Leave',
    };
    if (map[raw]) return map[raw];
    // capitalize words and append "Leave" if not present
    const titled = raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    return /leave$/i.test(titled) ? titled : `${titled} Leave`;
  };

  const getLeaveForDate = (dateStr: string) => {
    if (!leaveRequests) return null;
    return leaveRequests.find((l) => dateStr >= l.start_date && dateStr <= l.end_date) || null;
  };

  // Set of day_of_week numbers (0=Sun, 6=Sat) where employee has duty
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

  // Create a map of attendance by date
  const attendanceMap = useMemo(() => {
    if (!attendance) return new Map();
    return new Map(attendance.map(record => [record.date, record]));
  }, [attendance]);

  // Generate all days of the month
  const daysInMonth = useMemo(() => {
    const date = new Date(selectedYear, selectedMonth, 1);
    return eachDayOfInterval({
      start: startOfMonth(date),
      end: endOfMonth(date),
    });
  }, [selectedMonth, selectedYear]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (!attendance) return { daysWorked: 0, totalHours: 0, lateDays: 0, absentDays: 0 };
    
    const employeeStart = employee?.created_at ? new Date(employee.created_at) : null;
    const daysWorked = attendance.filter(a => a.status === 'present' || a.status === 'late' || a.status === 'half_day').length;
    const totalHours = attendance.reduce((sum, a) => sum + (a.hours_worked || 0), 0);
    const lateDays = attendance.filter(a => (a.late_minutes || 0) > 0).length;
    const attendedDates = new Set(attendance.map(a => a.date));
    const absentDays = daysInMonth.filter(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      if (employeeStart && day < new Date(employeeStart.getFullYear(), employeeStart.getMonth(), employeeStart.getDate())) return false;
      const dayOfWeek = getDay(day);
      const isWeekendDay = isWeekend(day);
      const isDutyWeekend = isWeekendDay && weekendDutyDays.has(dayOfWeek);
      // Count as absent only on work days (non-weekend OR weekend duty days)
      if (isWeekendDay && !isDutyWeekend) return false;
      return !attendedDates.has(dateStr) && day <= new Date();
    }).length;

    return { daysWorked, totalHours, lateDays, absentDays };
  }, [attendance, daysInMonth, weekendDutyDays]);

  // Validate date range
  const isValidRange = useMemo(() => {
    if (!isRangeMode) return true;
    if (endYear < selectedYear) return false;
    if (endYear === selectedYear && endMonth < selectedMonth) return false;
    return true;
  }, [isRangeMode, selectedMonth, selectedYear, endMonth, endYear]);

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '-';
    return format(new Date(timestamp), 'hh:mm a');
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'present':
        return <Badge variant="default" className="bg-primary">Present</Badge>;
      case 'late':
        return <Badge variant="secondary" className="bg-accent text-accent-foreground">Late</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      case 'on_leave':
        return <Badge variant="outline">On Leave</Badge>;
      case 'half_day':
        return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300">Half Day</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  if (employeeLoading) {
    return (
      <div className="page-container">
        <Skeleton className="h-8 w-48 mb-4" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-container">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Your account is not linked to an employee record.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = async () => {
    if (!isRangeMode) {
      // Single month export
      generateDTRPdf({
        employee,
        daysInMonth,
        attendanceMap,
        summary,
        month: months[selectedMonth],
        year: selectedYear,
        employeeCreatedAt: employee.created_at || undefined,
        weekendDutyDays
      });
    } else {
      // Multi-month export
      const monthsList = generateMonthsFromRange(selectedMonth, selectedYear, endMonth, endYear);
      
      if (monthsList.length === 0) {
        toast.error('Invalid date range. End date must be after start date.');
        return;
      }
      
      if (monthsList.length > 12) {
        toast.error('Maximum 12 months can be exported at once.');
        return;
      }

      toast.info(`Generating PDF for ${monthsList.length} month(s)...`);

      // Fetch attendance for all months
      const monthsData = await Promise.all(
        monthsList.map(async ({ month, year }) => {
          const days = getDaysInMonth(month, year);
          const start = format(startOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');
          const end = format(endOfMonth(new Date(year, month, 1)), 'yyyy-MM-dd');

          const { data: monthAttendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee.id)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: true });

          const attMap = new Map(
            (monthAttendance || []).map(record => [record.date, record])
          );

          return {
            month,
            year,
            daysInMonth: days,
            attendanceMap: attMap,
            summary: calculateSummary(monthAttendance || [], days, employee.created_at || undefined, weekendDutyDays)
          };
        })
      );

      generateMultiMonthDTRPdf({
        employee,
        monthsData,
        employeeCreatedAt: employee.created_at || undefined,
        weekendDutyDays
      });

      toast.success('PDF exported successfully!');
    }
  };
  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* Printable DTR - Hidden on screen, visible when printing */}
      <PrintableDTR
        employee={employee}
        daysInMonth={daysInMonth}
        attendanceMap={attendanceMap}
        summary={summary}
        month={months[selectedMonth]}
        year={selectedYear}
        employeeCreatedAt={employee.created_at || undefined}
        weekendDutyDays={weekendDutyDays}
      />

      <div className="page-header print-hide">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Daily Time Record
          </h1>
          <p className="text-muted-foreground">
            View your attendance records by month
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline" className="print-hide">
            <Printer className="h-4 w-4 mr-2" />
            Print DTR
          </Button>
          <Button 
            onClick={handleExportPDF} 
            className="print-hide"
            disabled={!isValidRange}
          >
            <Download className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Employee Info Card */}

      {/* Filters */}
      <Card className="mb-6 print-hide">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Select Period
            </CardTitle>
            <div className="flex items-center gap-2">
              <Label htmlFor="range-mode" className="text-sm text-muted-foreground">
                Date Range
              </Label>
              <Switch
                id="range-mode"
                checked={isRangeMode}
                onCheckedChange={setIsRangeMode}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {isRangeMode && (
              <span className="text-sm text-muted-foreground font-medium">From:</span>
            )}
            <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(parseInt(v))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((month, index) => (
                  <SelectItem key={month} value={index.toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Select year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isRangeMode && (
              <>
                <span className="text-sm text-muted-foreground font-medium">To:</span>
                <Select value={endMonth.toString()} onValueChange={(v) => setEndMonth(parseInt(v))}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Select month" />
                  </SelectTrigger>
                  <SelectContent>
                    {months.map((month, index) => (
                      <SelectItem key={month} value={index.toString()}>
                        {month}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={endYear.toString()} onValueChange={(v) => setEndYear(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="Select year" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
          
          {isRangeMode && !isValidRange && (
            <p className="text-sm text-destructive mt-2">
              End date must be after start date.
            </p>
          )}
          
          {isRangeMode && isValidRange && (
            <p className="text-sm text-muted-foreground mt-2">
              PDF will include {generateMonthsFromRange(selectedMonth, selectedYear, endMonth, endYear).length} month(s), each on a separate page.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6 print-hide">
        <SummaryCard icon={<Clock className="h-4 w-4 text-primary" />} label="Days Worked" value={summary.daysWorked} />
        <SummaryCard icon={<Clock className="h-4 w-4 text-primary" />} label="Total Hours" value={summary.totalHours} decimal />
        <SummaryCard icon={<AlertCircle className="h-4 w-4 text-accent-foreground" />} label="Late Days" value={summary.lateDays} />
        <SummaryCard icon={<AlertCircle className="h-4 w-4 text-destructive" />} label="Absent Days" value={summary.absentDays} />
      </div>


      {/* DTR Table */}
      <Card className="print-hide">
        <CardHeader>
          <CardTitle>
            {months[selectedMonth]} {selectedYear} Records
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px] relative rounded-md border">
              <table className="w-full caption-bottom text-sm">
                <thead className="sticky top-0 z-30 bg-card [&_tr]:border-b shadow-sm">
                  <tr className="border-b bg-card">
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[100px] bg-card">Date</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground w-[80px] bg-card">Day</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-card">AM In</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-card">AM Out</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-card">PM In</th>
                    <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground bg-card">PM Out</th>
                    <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground bg-card">Hours</th>
                    <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground bg-card">Remarks</th>
                  </tr>
                </thead>

                <TableBody>
                  {daysInMonth.map((day) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const record = attendanceMap.get(dateStr);
                    const isWeekendDay = isWeekend(day);
                    const isDutyWeekend = isWeekendDay && weekendDutyDays.has(getDay(day));
                    const isRestDay = isWeekendDay && !isDutyWeekend;
                    const isFuture = day > new Date();
                    const employeeStart = employee?.created_at ? new Date(employee.created_at) : null;
                    const isBeforeCreation = employeeStart ? day < new Date(employeeStart.getFullYear(), employeeStart.getMonth(), employeeStart.getDate()) : false;
                    const leave = !isBeforeCreation && !isRestDay && !isFuture ? getLeaveForDate(dateStr) : null;

                    return (
                      <TableRow 
                        key={dateStr}
                        className={isRestDay ? 'bg-muted/30' : ''}
                      >
                        <TableCell className="font-medium">
                          {format(day, 'MMM dd')}
                        </TableCell>
                        <TableCell className={isRestDay ? 'text-muted-foreground' : ''}>
                          {format(day, 'EEE')}
                        </TableCell>
                        <TableCell>{isBeforeCreation || isRestDay ? '' : formatTime(record?.morning_in ?? null)}</TableCell>
                        <TableCell>{isBeforeCreation || isRestDay ? '' : formatTime(record?.morning_out ?? null)}</TableCell>
                        <TableCell>{isBeforeCreation || isRestDay ? '' : formatTime(record?.afternoon_in ?? null)}</TableCell>
                        <TableCell>{isBeforeCreation || isRestDay ? '' : formatTime(record?.afternoon_out ?? null)}</TableCell>
                        <TableCell className="text-right">
                          {isBeforeCreation || isRestDay ? '' : (record?.hours_worked ? record.hours_worked.toFixed(2) : '-')}
                        </TableCell>
                        <TableCell className="text-center">
                          {isBeforeCreation ? (
                            <span className="text-muted-foreground">-</span>
                          ) : isRestDay ? (
                            <Badge variant="outline">Weekend</Badge>
                          ) : isFuture ? (
                            <Badge variant="outline">-</Badge>
                          ) : leave ? (
                            <div className="flex flex-col items-center gap-1">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {formatLeaveTypeLabel(leave.leave_type)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {leave.pay_type === 'with_pay' ? 'Leave with Pay' : 'Leave without Pay'}
                              </span>
                            </div>
                          ) : record ? (
                            (() => {
                              const hasMorning = !!(record.morning_in || record.morning_out);
                              const hasAfternoon = !!(record.afternoon_in || record.afternoon_out);
                              if (record.status === 'half_day' || (record.status === 'present' && (hasMorning !== hasAfternoon))) {
                                return <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-300">Half Day</Badge>;
                              }
                              return getStatusBadge(record.status);
                            })()
                          ) : (
                            <Badge variant="destructive">Absent</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
