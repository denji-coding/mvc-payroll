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
  const [cooldownMap, setCooldownMap] = useState<Record<string, number>>({});
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  
  // Fetch terminal settings
  const { data: settings, isLoading: settingsLoading } = useTerminalSettings();

  // Cleanup expired cooldowns periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setCooldownMap(prev => {
        const now = Date.now();
        const updated = { ...prev };
        let changed = false;
        for (const key in updated) {
          if (updated[key] <= now) {
            delete updated[key];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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

  const checkCooldown = useCallback((identifier: string): boolean => {
    const until = cooldownMap[identifier];
    if (until && Date.now() < until) {
      const secs = Math.ceil((until - Date.now()) / 1000);
      setResult({ success: false, error: `Please wait ${secs} seconds before logging attendance again.`, error_title: 'Please Wait' });
      return true;
    }
    return false;
  }, [cooldownMap]);

  const setCooldown = useCallback((identifier: string) => {
    setCooldownMap(prev => ({ ...prev, [identifier]: Date.now() + 60000 }));
  }, []);

  const submitRfidAttendance = useCallback(async (rfidCardNumber: string) => {
    const trimmedInput = rfidCardNumber.trim();
    if (!trimmedInput || isLoading) return;

    // Cooldown is checked after we know the employee, but we also block by RFID
    if (checkCooldown(trimmedInput.toLowerCase())) return;
    
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

      // For non-2xx responses, supabase puts the body in error.context
      let errorData = null;
      if (error) {
        try {
          if (error.context?.body instanceof ReadableStream) {
            const reader = error.context.body.getReader();
            const { value } = await reader.read();
            const text = new TextDecoder().decode(value);
            errorData = JSON.parse(text);
          } else if (typeof error.message === 'string') {
            errorData = JSON.parse(error.message);
          }
        } catch {
          // Could not parse error body
        }
        
        if (errorData?.error) {
          const terminalError = getTerminalError(errorData.error, errorData.message, 'rfid');
          setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: errorData.employee_name });
        } else {
          setResult({ success: false, error: 'Failed to process attendance. Please try again.', error_title: 'Connection Error' });
        }
        return;
      }

      if (data.error) {
        const terminalError = getTerminalError(data.error, data.message, 'rfid');
        setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: data.employee_name });
        return;
      }

      // Set cooldown by RFID and employee_id
      setCooldown(trimmedInput.toLowerCase());
      if (data.employee_id) setCooldown(data.employee_id.toLowerCase());
      
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
      setResult({ success: false, error: 'Connection error. Please try again.', error_title: 'Connection Error' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, checkCooldown, setCooldown]);

  const submitManualAttendance = useCallback(async (employeeId: string) => {
    const trimmedInput = employeeId.trim();
    if (!trimmedInput || isLoading) return;

    // Cooldown check
    if (cooldownUntil && Date.now() < cooldownUntil) {
      const secs = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setResult({ success: false, error: `Please wait ${secs} seconds before logging attendance again.`, error_title: 'Please Wait' });
      return;
    }
    
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

      let errorData = null;
      if (error) {
        try {
          if (error.context?.body instanceof ReadableStream) {
            const reader = error.context.body.getReader();
            const { value } = await reader.read();
            const text = new TextDecoder().decode(value);
            errorData = JSON.parse(text);
          } else if (typeof error.message === 'string') {
            errorData = JSON.parse(error.message);
          }
        } catch {
          // Could not parse error body
        }
        
        if (errorData?.error) {
          const terminalError = getTerminalError(errorData.error, errorData.message, 'manual');
          setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: errorData.employee_name });
        } else {
          setResult({ success: false, error: 'Failed to process attendance. Please try again.', error_title: 'Connection Error' });
        }
        return;
      }

      if (data.error) {
        const terminalError = getTerminalError(data.error, data.message, 'manual');
        setResult({ success: false, error: terminalError.message, error_title: terminalError.title, employee_name: data.employee_name });
        return;
      }

      setCooldownUntil(Date.now() + 60000);
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
      setResult({ success: false, error: 'Connection error. Please try again.', error_title: 'Connection Error' });
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, cooldownUntil]);

  const clearResult = useCallback(() => {
    setResult(null);
  }, []);

  return {
    currentTime,
    isLoading,
    result,
    cooldownRemaining,
    settings,
    settingsLoading,
    submitRfidAttendance,
    submitManualAttendance,
    clearResult,
  };
}
