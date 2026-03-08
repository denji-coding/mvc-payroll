import { useAuth } from '@/hooks/useAuth';
import { useCountUp } from '@/hooks/useCountUp';
import { useEmployeeScheduleByEmployee } from '@/hooks/useEmployeeSchedule';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Clock, Calendar, Sun, Moon } from 'lucide-react';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatTime(time: string | null): string {
  if (!time) return '-';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${m} ${ampm}`;
}

export default function MySchedule() {
  const { user } = useAuth();

  // Get the employee record for the current user
  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ['my-employee', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('employees')
        .select('id, first_name, last_name, position, branch_id, branches(name)')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: schedules, isLoading: schedLoading } = useEmployeeScheduleByEmployee(employee?.id || '');

  const isLoading = empLoading || schedLoading;

  // Sort schedules by day_of_week
  const sortedSchedules = schedules ? [...schedules].sort((a, b) => a.day_of_week - b.day_of_week) : [];

  // Count duty days
  const dutyDaysCount = sortedSchedules.filter(s => s.is_duty_day).length;

  // Calculate total weekly hours
  const totalHours = sortedSchedules.reduce((acc, s) => {
    if (!s.is_duty_day) return acc;
    const morningStart = s.morning_start ? parseTimeToMinutes(s.morning_start) : 0;
    const morningEnd = s.morning_end ? parseTimeToMinutes(s.morning_end) : 0;
    const afternoonStart = s.afternoon_start ? parseTimeToMinutes(s.afternoon_start) : 0;
    const afternoonEnd = s.afternoon_end ? parseTimeToMinutes(s.afternoon_end) : 0;
    const morningMinutes = morningEnd > morningStart ? morningEnd - morningStart : 0;
    const afternoonMinutes = afternoonEnd > afternoonStart ? afternoonEnd - afternoonStart : 0;
    return acc + morningMinutes + afternoonMinutes;
  }, 0);

  function parseTimeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
  }

  const totalHoursFormatted = (totalHours / 60).toFixed(1);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">No employee record found for your account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="text-muted-foreground">Your weekly work schedule</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Duty Days</p>
                <p className="text-2xl font-bold">{useCountUp(dutyDaysCount)} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Weekly Hours</p>
                <p className="text-2xl font-bold">{totalHoursFormatted} hrs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sun className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rest Days</p>
                <p className="text-2xl font-bold">{7 - dutyDaysCount} days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Weekly Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedSchedules.length === 0 ? (
            <p className="text-muted-foreground py-8 text-center">
              No schedule has been set up for you yet. Please contact HR.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {sortedSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className={`p-3 rounded-lg border min-w-0 ${
                    schedule.is_duty_day
                      ? 'bg-primary/5 border-primary/20'
                      : 'bg-muted/50 border-muted'
                  }`}
                >
                  <div className="flex items-center justify-between gap-1 mb-3">
                    <span className="font-semibold text-sm truncate">{DAYS[schedule.day_of_week]}</span>
                    <Badge variant={schedule.is_duty_day ? 'default' : 'secondary'} className="text-xs shrink-0">
                      {schedule.is_duty_day ? 'Duty' : 'Rest'}
                    </Badge>
                  </div>
                  {schedule.is_duty_day ? (
                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">AM:</span>
                        <p className="text-foreground font-medium">
                          {formatTime(schedule.morning_start)} - {formatTime(schedule.morning_end)}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">PM:</span>
                        <p className="text-foreground font-medium">
                          {formatTime(schedule.afternoon_start)} - {formatTime(schedule.afternoon_end)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Day off</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
