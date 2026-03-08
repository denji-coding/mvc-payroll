import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTerminalSettings } from './useSettings';

interface AttendanceResult {
  success: boolean;
  action?: 'time_in' | 'time_out' | 'morning_in' | 'morning_out' | 'afternoon_in' | 'afternoon_out';
  employee_id?: string;
  employee_name?: string;
  timestamp?: string;
  error?: string;
  error_title?: string;
  late_minutes?: number;
  status?: string;
}

interface TerminalError {
  title: string;
  message: string;
}

function getTerminalError(error: string, message?: string, mode?: 'rfid' | 'manual'): TerminalError {
  const lowerError = error.toLowerCase();
  
  if (lowerError.includes('no schedule assigned') || lowerError.includes('no time schedule')) {
    return {
      title: 'No Schedule Assigned',
      message: 'This employee has no schedule yet. Please contact the HR Admin for assistance.',
    };
  }
  if (lowerError.includes('employee not found') || lowerError.includes('not found or inactive')) {
    if (mode === 'rfid') {
      return {
        title: 'RFID Not Registered',
        message: 'This RFID is not registered.',
      };
    }
    return {
      title: 'Employee ID Not Found',
      message: 'Employee ID not found.',
    };
  }
  if (lowerError.includes('no duty today')) {
    return {
      title: 'No Duty Today',
      message: 'You are not scheduled to work today. If this is incorrect, please contact the HR Admin.',
    };
  }
  if (lowerError.includes('currently on leave')) {
    return {
      title: 'On Leave',
      message: message || 'You are currently on leave. Attendance is not required.',
    };
  }
  if (lowerError.includes('already completed')) {
    return {
      title: 'Attendance Already Completed',
      message: 'You have already completed all attendance logs for today.',
    };
  }
  if (lowerError.includes('manual entry is disabled')) {
    return {
      title: 'Manual Entry Disabled',
      message: 'Manual entry is disabled. Please use your RFID card to log attendance.',
    };
  }
  if (lowerError.includes('terminal is currently disabled') || lowerError.includes('attendance terminal is currently disabled')) {
    return {
      title: 'Terminal Disabled',
      message: 'The attendance terminal is currently disabled. Please contact the HR Admin.',
    };
  }
  if (lowerError.includes('rfid card number or employee id is required') || lowerError.includes('invalid input')) {
    return {
      title: 'Invalid Input',
      message: 'Please provide a valid RFID card number or Employee ID.',
    };
  }
  if (lowerError.includes('failed to process attendance')) {
    return {
      title: 'Processing Error',
      message: 'Failed to process attendance. Please try again or contact HR.',
    };
  }
  
  return {
    title: 'Attendance Error',
    message: message || error || 'An unexpected error occurred. Please try again or contact HR.',
  };
}

export function useAttendanceTerminal() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<AttendanceResult | null>(null);
  
  // Fetch terminal settings
  const { data: settings, isLoading: settingsLoading } = useTerminalSettings();

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Auto-clear result after 3 seconds
  useEffect(() => {
    if (result) {
      const timer = setTimeout(() => {
        setResult(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

  const submitRfidAttendance = useCallback(async (rfidCardNumber: string) => {
    const trimmedInput = rfidCardNumber.trim();
    if (!trimmedInput || isLoading) return;
    
    // Basic validation
    if (trimmedInput.length > 50) {
      setResult({ success: false, error: 'Invalid RFID card number' });
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rfid-attendance', {
        body: { rfid_card_number: trimmedInput },
      });

      if (error) {
        setResult({ success: false, error: 'Failed to process attendance. Please try again.', error_title: 'Connection Error' });
        return;
      }

      if (data.error) {
        const terminalError = getTerminalError(data.error, data.message, 'rfid');
        setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: data.employee_name });
        return;
      }

      setResult({
        success: true,
        action: data.action,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        timestamp: data.timestamp,
        late_minutes: data.record?.late_minutes,
        status: data.record?.status,
      });
    } catch (err) {
      console.error('RFID attendance error:', err);
      setResult({ success: false, error: 'Connection error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const submitManualAttendance = useCallback(async (employeeId: string) => {
    const trimmedInput = employeeId.trim();
    if (!trimmedInput || isLoading) return;
    
    // Basic validation
    if (trimmedInput.length > 50) {
      setResult({ success: false, error: 'Invalid Employee ID' });
      return;
    }
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('rfid-attendance', {
        body: { employee_id: trimmedInput },
      });

      if (error) {
        setResult({ success: false, error: 'Failed to process attendance. Please try again.' });
        return;
      }

      if (data.error) {
        const terminalError = getTerminalError(data.error, data.message, 'manual');
        setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: data.employee_name });
        return;
      }

      setResult({
        success: true,
        action: data.action,
        employee_id: data.employee_id,
        employee_name: data.employee_name,
        timestamp: data.timestamp,
        late_minutes: data.record?.late_minutes,
        status: data.record?.status,
      });
    } catch (err) {
      console.error('Manual attendance error:', err);
      setResult({ success: false, error: 'Connection error. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    currentTime,
    isLoading,
    result,
    settings,
    settingsLoading,
    submitRfidAttendance,
    submitManualAttendance,
    clearResult,
  };
}
