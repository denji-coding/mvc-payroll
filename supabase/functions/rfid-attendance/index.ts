import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-terminal-secret',
};

interface AttendanceRequest {
  rfid_card_number?: string;
  employee_id?: string;
}

interface TerminalSettings {
  terminal_enabled?: boolean;
  work_start_time: string;
  work_end_time: string;
  grace_period_minutes: number;
  allow_manual_entry: boolean;
}

// Helper: parse "HH:MM" time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch terminal settings
    const { data: settingsData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'terminal')
      .single();
    
    const settings: TerminalSettings = settingsData?.value || { 
      terminal_enabled: true,
      work_start_time: '08:00', 
      work_end_time: '17:00', 
      grace_period_minutes: 0,
      allow_manual_entry: true
    };

    if (settings.terminal_enabled === false) {
      return new Response(
        JSON.stringify({ error: 'Attendance terminal is currently disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if current time is within the allowed shift window
    const phTimeFormatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false
    });
    const currentPHTime = phTimeFormatter.format(new Date());
    const shiftStart = settings.work_start_time || '06:00';
    const shiftEnd = settings.work_end_time || '22:00';
    
    if (currentPHTime < shiftStart || currentPHTime > shiftEnd) {
      return new Response(
        JSON.stringify({ 
          error: 'Outside shift hours',
          message: `Attendance can only be recorded between ${shiftStart} and ${shiftEnd}. Current time: ${currentPHTime}.`
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { rfid_card_number, employee_id }: AttendanceRequest = await req.json();

    if (employee_id && !rfid_card_number && settings.allow_manual_entry === false) {
      return new Response(
        JSON.stringify({ error: 'Manual entry is disabled. Please use your RFID card.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!rfid_card_number && !employee_id) {
      return new Response(
        JSON.stringify({ error: 'RFID card number or Employee ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if ((rfid_card_number && rfid_card_number.length > 50) || (employee_id && employee_id.length > 50)) {
      return new Response(
        JSON.stringify({ error: 'Invalid input' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Find employee
    let employeeQuery = supabase
      .from('employees')
      .select('id, first_name, last_name, employee_id, branch_id')
      .eq('employment_status', 'active');

    if (rfid_card_number) {
      employeeQuery = employeeQuery.ilike('rfid_card_number', rfid_card_number);
    } else if (employee_id) {
      employeeQuery = employeeQuery.ilike('employee_id', employee_id);
    }

    const { data: employee, error: empError } = await employeeQuery.single();

    if (empError || !employee) {
      return new Response(
        JSON.stringify({ error: 'Employee not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const phFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const today = phFormatter.format(now);
    const currentTime = now.toISOString();

    // Check for approved leave
    const { data: activeLeave } = await supabase
      .from('leave_requests')
      .select('id, leave_type, start_date, end_date')
      .eq('employee_id', employee.id)
      .eq('status', 'hr_approved')
      .lte('start_date', today)
      .gte('end_date', today)
      .maybeSingle();

    if (activeLeave) {
      return new Response(
        JSON.stringify({ 
          error: 'Currently on leave',
          employee_name: `${employee.first_name} ${employee.last_name}`,
          message: `You are on ${activeLeave.leave_type} leave until ${activeLeave.end_date}. Attendance is not required.`,
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if employee has any schedule
    const { data: allSchedules } = await supabase
      .from('employee_schedules')
      .select('id')
      .eq('employee_id', employee.id);
    
    if (!allSchedules || allSchedules.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: 'No schedule assigned',
          employee_name: `${employee.first_name} ${employee.last_name}`,
          message: 'No time schedule has been assigned yet. Please contact HR.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check today's schedule
    const phtDate = new Date(`${today}T12:00:00+08:00`);
    const dayOfWeek = phtDate.getDay();
    const { data: scheduleData } = await supabase
      .from('employee_schedules')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('day_of_week', dayOfWeek)
      .single();

    if (!scheduleData || !scheduleData.is_duty_day) {
      return new Response(
        JSON.stringify({ 
          error: 'No duty today',
          employee_name: `${employee.first_name} ${employee.last_name}`,
          message: 'You are not scheduled to work today.'
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const morningStart = scheduleData.morning_start || '08:00';
    const morningEnd = scheduleData.morning_end || '12:00';
    const afternoonStart = scheduleData.afternoon_start || '13:00';
    const afternoonEnd = scheduleData.afternoon_end || '17:00';

    // Calculate scheduled session durations in hours
    const morningScheduledHours = (timeToMinutes(morningEnd) - timeToMinutes(morningStart)) / 60;
    const afternoonScheduledHours = (timeToMinutes(afternoonEnd) - timeToMinutes(afternoonStart)) / 60;
    const totalScheduledHours = morningScheduledHours + afternoonScheduledHours;

    // Get existing attendance record
    const { data: existingRecord } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('date', today)
      .single();

    let result;
    let action: 'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out';

    if (!existingRecord) {
      // 1st scan — check if it's afternoon-only (half-day)
      const currentMinutes = timeToMinutes(currentPHTime);
      const afternoonStartMinutes = timeToMinutes(afternoonStart);

      if (currentMinutes >= afternoonStartMinutes) {
        // Afternoon-only half-day: skip morning, go straight to afternoon_in
        action = 'afternoon_in';

        // Calculate late for afternoon session with grace period
        const scheduledAfternoonMinutes = timeToMinutes(afternoonStart);
        let lateMinutes = 0;
        if (currentMinutes > scheduledAfternoonMinutes + settings.grace_period_minutes) {
          lateMinutes = currentMinutes - scheduledAfternoonMinutes;
        }

        const status = lateMinutes > 0 ? 'late' : 'half_day';

        const { data, error } = await supabase
          .from('attendance')
          .insert({
            employee_id: employee.id,
            date: today,
            afternoon_in: currentTime,
            rfid_time_in: rfid_card_number,
            status: status,
            late_minutes: lateMinutes,
            overtime_hours: 0,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Normal morning_in
        action = 'morning_in';
        
        const scheduledMorningMinutes = timeToMinutes(morningStart);
        
        let lateMinutes = 0;
        if (currentMinutes > scheduledMorningMinutes + settings.grace_period_minutes) {
          lateMinutes = currentMinutes - scheduledMorningMinutes;
        }

        const status = lateMinutes > 0 ? 'late' : 'present';

        const { data, error } = await supabase
          .from('attendance')
          .insert({
            employee_id: employee.id,
            date: today,
            time_in: currentTime,
            morning_in: currentTime,
            rfid_time_in: rfid_card_number,
            status: status,
            late_minutes: lateMinutes,
            overtime_hours: 0,
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }
    } else if (existingRecord.morning_in && !existingRecord.morning_out && !existingRecord.afternoon_in) {
      // 2nd scan - Morning Out
      action = 'morning_out';

      const { data, error } = await supabase
        .from('attendance')
        .update({ morning_out: currentTime })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (!existingRecord.afternoon_in) {
      // 3rd scan (or 2nd for afternoon-only records) - Afternoon In
      action = 'afternoon_in';

      // Calculate late for afternoon session with grace period
      const scheduledAfternoonMinutes = timeToMinutes(afternoonStart);
      const currentMinutes = timeToMinutes(currentPHTime);
      let afternoonLateMinutes = 0;
      if (currentMinutes > scheduledAfternoonMinutes + settings.grace_period_minutes) {
        afternoonLateMinutes = currentMinutes - scheduledAfternoonMinutes;
      }

      // Add afternoon late to existing morning late
      const existingLate = existingRecord.late_minutes || 0;
      const totalLate = existingLate + afternoonLateMinutes;
      const status = totalLate > 0 ? 'late' : (existingRecord.status || 'present');

      const { data, error } = await supabase
        .from('attendance')
        .update({ 
          afternoon_in: currentTime,
          late_minutes: totalLate,
          status: status,
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else if (!existingRecord.afternoon_out) {
      // Final scan - Afternoon Out
      action = 'afternoon_out';

      // Calculate hours worked per session, capped to schedule
      const morningIn = existingRecord.morning_in ? new Date(existingRecord.morning_in) : null;
      const morningOut = existingRecord.morning_out ? new Date(existingRecord.morning_out) : null;
      const afternoonIn = existingRecord.afternoon_in ? new Date(existingRecord.afternoon_in) : null;
      
      let totalHours = 0;
      let isHalfDay = false;

      if (morningIn && morningOut) {
        const rawMorningHours = (morningOut.getTime() - morningIn.getTime()) / (1000 * 60 * 60);
        totalHours += Math.min(rawMorningHours, morningScheduledHours);
      } else {
        isHalfDay = true; // No morning session
      }

      if (afternoonIn) {
        const rawAfternoonHours = (now.getTime() - afternoonIn.getTime()) / (1000 * 60 * 60);
        totalHours += Math.min(rawAfternoonHours, afternoonScheduledHours);
      }

      // If only one session, it's a half-day
      if (!morningIn && !morningOut) {
        isHalfDay = true;
      }

      // Cap total to scheduled hours
      totalHours = Math.min(totalHours, totalScheduledHours);

      // Calculate undertime based on scheduled end
      const endTime = new Date(`${today}T${afternoonEnd}`);
      let undertimeMinutes = 0;
      if (now < endTime) {
        undertimeMinutes = Math.floor((endTime.getTime() - now.getTime()) / (1000 * 60));
      }

      const status = isHalfDay ? 'half_day' : (existingRecord.status || 'present');

      const { data, error } = await supabase
        .from('attendance')
        .update({
          time_out: currentTime,
          afternoon_out: currentTime,
          rfid_time_out: rfid_card_number,
          hours_worked: Math.round(totalHours * 100) / 100,
          undertime_minutes: undertimeMinutes,
          overtime_hours: 0,
          status: status,
        })
        .eq('id', existingRecord.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Already completed all punches
      return new Response(
        JSON.stringify({ 
          error: 'Already completed attendance for today',
          employee_name: `${employee.first_name} ${employee.last_name}`,
          morning_in: existingRecord.morning_in,
          morning_out: existingRecord.morning_out,
          afternoon_in: existingRecord.afternoon_in,
          afternoon_out: existingRecord.afternoon_out,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actionLabels = {
      morning_in: 'MORNING IN',
      morning_out: 'MORNING OUT',
      afternoon_in: 'AFTERNOON IN',
      afternoon_out: 'AFTERNOON OUT',
    };

    console.log(`Attendance ${action} recorded for ${employee.first_name} ${employee.last_name}`);

    return new Response(
      JSON.stringify({
        success: true,
        action,
        action_label: actionLabels[action],
        employee_id: employee.employee_id,
        employee_name: `${employee.first_name} ${employee.last_name}`,
        timestamp: currentTime,
        record: result,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('RFID Attendance Error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process attendance' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});