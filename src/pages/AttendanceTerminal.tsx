import { useState, useRef, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { CreditCard, User, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAttendanceTerminal } from '@/hooks/useAttendanceTerminal';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import companyLogo from '@/assets/company-logo.png';
import { formatFullName } from '@/lib/formatName';
import { terminalHeaders, setTerminalKey } from '@/lib/terminalKey';
import { useAuth } from '@/hooks/useAuth';

export default function AttendanceTerminal() {
  const [mode, setMode] = useState<'rfid' | 'manual'>('rfid');
  const [rfidInput, setRfidInput] = useState('');
  const [employeeIdInput, setEmployeeIdInput] = useState('');
  const rfidInputRef = useRef<HTMLInputElement>(null);
  const manualInputRef = useRef<HTMLInputElement>(null);
  const autoSubmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastKeystrokeTimeRef = useRef<number>(0);
  const rfidBufferRef = useRef<string>('');

  const {
    currentTime,
    isLoading,
    result,
    settings,
    settingsLoading,
    submitRfidAttendance,
    submitManualAttendance,
    clearResult,
  } = useAttendanceTerminal();

  // Fetch today's attendance records via edge function (bypasses RLS for kiosk mode)
  const [keyInput, setKeyInput] = useState('');
  const { user: authUser, role } = useAuth();
  const [keyError, setKeyError] = useState('');
  const { data: attendanceRecords, refetch: refetchAttendance, isError: terminalUnauthorized, isSuccess: terminalAuthorized } = useQuery({
    queryKey: ['terminal-attendance', format(new Date(), 'yyyy-MM-dd'), authUser?.id ?? 'kiosk'],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('terminal-attendance-log', { headers: terminalHeaders() });
      
      if (error) throw error;
      return data?.records || [];
    },
    refetchInterval: 10000,
  });

  // Refetch attendance when a successful result is recorded
  useEffect(() => {
    if (result?.success) {
      refetchAttendance();
    }
  }, [result, refetchAttendance]);

  const isAdminUser = role === 'super_admin' || role === 'hr_admin';
  const showKeyPrompt = terminalUnauthorized && !isAdminUser;
  const isTerminalEnabled = settings?.terminal_enabled !== false;
  const isManualEntryAllowed = settings?.allow_manual_entry !== false;

  // Auto-focus RFID input
  useEffect(() => {
    if (isTerminalEnabled && terminalAuthorized && !result && !isLoading) {
      const focusInput = () => {
        if (mode === 'rfid' && rfidInputRef.current && document.activeElement !== rfidInputRef.current) {
          rfidInputRef.current.focus();
        } else if (mode === 'manual' && manualInputRef.current && document.activeElement !== manualInputRef.current) {
          manualInputRef.current.focus();
        }
      };
      
      focusInput();
      const focusInterval = setInterval(focusInput, 500);
      return () => clearInterval(focusInterval);
    }
  }, [mode, result, isTerminalEnabled, isLoading, terminalAuthorized]);

  useEffect(() => {
    if (!result) {
      setRfidInput('');
      setEmployeeIdInput('');
    }
  }, [result]);

  useEffect(() => {
    if (!isManualEntryAllowed && mode === 'manual') {
      setMode('rfid');
    }
  }, [isManualEntryAllowed, mode]);

  // RFID scanners send characters very rapidly (<50ms between keystrokes)
  // Human typing is much slower. We use this to distinguish scanner vs keyboard.
  const handleRfidKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    const now = Date.now();
    const timeSinceLastKey = now - lastKeystrokeTimeRef.current;
    lastKeystrokeTimeRef.current = now;

    if (e.key === 'Enter') {
      e.preventDefault();
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
      // Only submit if buffer was built from rapid input (scanner)
      if (rfidBufferRef.current.trim() && !isLoading) {
        setRfidInput(rfidBufferRef.current);
        submitRfidAttendance(rfidBufferRef.current);
      }
      rfidBufferRef.current = '';
      setRfidInput('');
      return;
    }

    // Ignore non-printable keys
    if (e.key.length !== 1) return;

    // If time between keystrokes > 80ms, it's likely manual typing — reset buffer
    if (timeSinceLastKey > 80 && rfidBufferRef.current.length > 0) {
      rfidBufferRef.current = '';
      setRfidInput('');
    }

    rfidBufferRef.current += e.key;
    // Don't show the value — keep input visually empty
    e.preventDefault();

    // Auto-submit after 300ms idle (scanner finishes quickly)
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }
    autoSubmitTimeoutRef.current = setTimeout(() => {
      if (rfidBufferRef.current.trim() && !isLoading) {
        setRfidInput(rfidBufferRef.current);
        submitRfidAttendance(rfidBufferRef.current);
        rfidBufferRef.current = '';
        setRfidInput('');
      }
    }, 300);
  }, [submitRfidAttendance, isLoading]);

  const handleRfidChange = useCallback((_value: string) => {
    // Prevent manual input — all handling is done via onKeyDown
  }, []);

  useEffect(() => {
    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, []);

  const handleRfidSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }
    if (rfidInput.trim() && !isLoading) {
      submitRfidAttendance(rfidInput);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (employeeIdInput.trim() && !isLoading) {
      submitManualAttendance(employeeIdInput);
    }
  };

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      morning_in: 'MORNING IN',
      morning_out: 'MORNING OUT',
      afternoon_in: 'AFTERNOON IN',
      afternoon_out: 'AFTERNOON OUT',
      time_in: 'TIME IN',
      time_out: 'TIME OUT',
    };
    return labels[action] || action?.toUpperCase().replace('_', ' ');
  };

  // Force light mode styles - all hardcoded to light theme
  if (settingsLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-green-700 mx-auto mb-4 animate-spin" />
          <p className="text-gray-500 text-lg">Loading terminal...</p>
        </div>
      </div>
    );
  }

  if (!isTerminalEnabled) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center p-8">
          <div className="w-24 h-24 bg-yellow-100 rounded-full mx-auto mb-6 flex items-center justify-center">
            <AlertTriangle className="w-12 h-12 text-yellow-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Terminal Disabled</h2>
          <p className="text-gray-500 mb-6">
            The attendance terminal is currently disabled by the administrator.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen overflow-hidden flex bg-white">
      {/* Left Sidebar - Dark Panel */}
      <div className="w-72 bg-[#1a3d2b] text-white flex flex-col">
        {/* Logo and Company Name */}
        <div className="p-6 text-center border-b border-white/10">
          <img 
            src={companyLogo} 
            alt="Company Logo" 
            className="w-20 h-20 mx-auto mb-4 object-contain"
          />
          <h1 className="text-lg font-bold">Migrants Venture Corporation</h1>
          <p className="text-sm text-white/70 mt-1">Employee Attendance System</p>
        </div>

        {showKeyPrompt && (
          <form
            className="p-4 border-b border-white/10 space-y-2"
            onSubmit={async (e) => { e.preventDefault(); setKeyError(''); setTerminalKey(keyInput); setKeyInput(''); const r = await refetchAttendance(); if (r.isError) setKeyError('Incorrect terminal key. Please try again.'); }}
          >
            <p className="text-xs text-white/80">This device is not authorized. Enter the terminal key.</p>
            <Input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Terminal key"
              className="bg-white text-foreground"
            />
            {keyError && <p className="text-xs text-destructive-foreground bg-destructive/80 rounded px-2 py-1">{keyError}</p>}
            <Button type="submit" size="sm" className="w-full" title="Save terminal key">Save Key</Button>
          </form>
        )}

        {/* Input Section */}
        <div className={`flex-1 p-6 ${terminalAuthorized ? '' : 'hidden'}`}>
          {/* Mode Switch - Moved to top */}
          {isManualEntryAllowed && (
            <div className="mb-6 pb-4 border-b border-white/10">
              <p className="text-xs text-white/60 text-center mb-3">Input Mode</p>
              <div className="flex rounded-lg bg-white/10 p-1">
                <button
                  onClick={() => setMode('rfid')}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    mode === 'rfid'
                      ? 'bg-white text-[#1a3d2b]'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-3 h-3 inline-block mr-1" />
                  RFID
                </button>
                <button
                  onClick={() => setMode('manual')}
                  className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                    mode === 'manual'
                      ? 'bg-white text-[#1a3d2b]'
                      : 'text-white/70 hover:text-white'
                  }`}
                >
                  <User className="w-3 h-3 inline-block mr-1" />
                  Manual
                </button>
              </div>
            </div>
          )}

          <div className="mb-6">
            <label className="block text-sm font-medium mb-2 text-white/80">
              {mode === 'rfid' ? 'RFID Card Number' : 'Employee ID'}
            </label>
            {mode === 'rfid' ? (
              <form onSubmit={handleRfidSubmit}>
                <Input
                  ref={rfidInputRef}
                  type="text"
                  value=""
                  onChange={() => {}}
                  placeholder="Waiting for RFID scan..."
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12 text-center caret-transparent cursor-default"
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading}
                  readOnly
                  style={{ color: 'transparent' }}
                  onKeyDown={handleRfidKeyDown}
                  onBlur={() => {
                    if (mode === 'rfid' && !result && !isLoading) {
                      setTimeout(() => rfidInputRef.current?.focus(), 100);
                    }
                  }}
                />
              </form>
            ) : (
              <form onSubmit={handleManualSubmit}>
                <Input
                  ref={manualInputRef}
                  type="text"
                  value={employeeIdInput}
                  onChange={(e) => setEmployeeIdInput(e.target.value.toUpperCase())}
                  placeholder="Enter Employee ID"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/50 h-12 text-center uppercase"
                  autoComplete="off"
                  disabled={isLoading}
                />
              </form>
            )}
          </div>

          {/* Submit Button - Only for manual mode */}
          {mode === 'manual' && (
            <div>
              <Button
                onClick={() => {
                  if (employeeIdInput.trim()) {
                    submitManualAttendance(employeeIdInput);
                  }
                }}
                disabled={isLoading || !employeeIdInput.trim()}
                className="w-full h-12 bg-white text-[#1a3d2b] font-semibold hover:bg-white/90"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                )}
                Submit
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 text-center text-xs text-white/50 border-t border-white/10">
          © {new Date().getFullYear()} MVC Corporation
        </div>
      </div>

      {/* Right Main Panel - Force light mode */}
      <div className="flex-1 bg-white flex flex-col">
        {/* Clock Display */}
        <div className="text-center py-8 border-b border-gray-200">
          <div className="text-6xl md:text-7xl font-bold text-gray-900 tracking-tight mb-2">
            {format(currentTime, 'hh:mm:ss')}
            <span className="text-3xl md:text-4xl ml-2 text-gray-500">{format(currentTime, 'a')}</span>
          </div>
          <p className="text-gray-500">
            Scan your ID card or enter your Employee ID to log attendance
          </p>
        </div>

        {/* Date Display */}
        <div className="flex items-center justify-center px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>{format(new Date(), 'EEEE, MMMM d, yyyy')}</span>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="flex-1 min-h-0 p-6 overflow-hidden">
          <div className="bg-card rounded-xl border border-border shadow-sm h-full overflow-hidden">
            <div className="attendance-terminal-scroll h-full overflow-y-auto overflow-x-auto">
              <table className="w-full min-w-[980px] border-separate border-spacing-0 text-sm">
                <thead>
                  <tr className="border-0 hover:bg-transparent">
                    <th className="sticky top-0 z-20 w-20 bg-sidebar px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">Photo</th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">Employee ID</th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">Full Name</th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-left text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">Position</th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">
                      <div className="flex flex-col items-center">
                        <span>Morning</span>
                        <span className="text-[10px] font-normal text-sidebar-foreground/70">In</span>
                      </div>
                    </th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">
                      <div className="flex flex-col items-center">
                        <span>Morning</span>
                        <span className="text-[10px] font-normal text-sidebar-foreground/70">Out</span>
                      </div>
                    </th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">
                      <div className="flex flex-col items-center">
                        <span>Afternoon</span>
                        <span className="text-[10px] font-normal text-sidebar-foreground/70">In</span>
                      </div>
                    </th>
                    <th className="sticky top-0 z-20 bg-sidebar px-4 py-4 text-center text-xs font-semibold uppercase tracking-wider text-sidebar-foreground">
                      <div className="flex flex-col items-center">
                        <span>Afternoon</span>
                        <span className="text-[10px] font-normal text-sidebar-foreground/70">Out</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords && attendanceRecords.length > 0 ? (
                    attendanceRecords.map((record: any, index: number) => (
                      <tr
                        key={record.id}
                        className="border-b border-gray-100 bg-white"
                      >
                        <td className="border-b border-gray-100 px-4 py-4 align-middle">
                          <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
                            <AvatarImage src={record.employees?.avatar_url} className="object-cover" />
                            <AvatarFallback className="text-xs font-semibold bg-gradient-to-br from-green-100 to-green-200 text-green-700">
                              {record.employees?.first_name?.[0]}{record.employees?.last_name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 align-middle">
                          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-xs font-mono font-medium text-gray-700">
                            {record.employees?.employee_id || '-'}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 align-middle">
                          <div className="font-medium text-gray-900">
                            {formatFullName(record.employees?.first_name, record.employees?.last_name, record.employees?.suffix_name, record.employees?.middle_name)}
                          </div>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 align-middle">
                          <span className="text-sm text-gray-600">
                            {record.employees?.position || '-'}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 text-center align-middle">
                          {record.morning_in ? (
                            <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                              {format(new Date(record.morning_in), 'hh:mm a')}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 text-center align-middle">
                          {record.morning_out ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                              {format(new Date(record.morning_out), 'hh:mm a')}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 text-center align-middle">
                          {record.afternoon_in ? (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                              {format(new Date(record.afternoon_in), 'hh:mm a')}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                        <td className="border-b border-gray-100 px-4 py-4 text-center align-middle">
                          {record.afternoon_out ? (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-1 text-xs font-medium text-purple-700">
                              {format(new Date(record.afternoon_out), 'hh:mm a')}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                            <Clock className="h-8 w-8 text-gray-400" />
                          </div>
                          <p className="font-medium text-gray-500">No attendance records for today</p>
                          <p className="text-sm text-gray-400">Records will appear here as employees clock in</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Result Overlay - Enhanced with animation */}
      {result && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-md flex items-center justify-center z-50 animate-in fade-in duration-300">
          <div className={`bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] p-10 max-w-lg w-full mx-4 text-center animate-in zoom-in-95 slide-in-from-bottom-4 duration-500 border-t-4 ${
            result.success ? 'border-t-green-500' : 'border-t-red-500'
          }`}>
            {/* Animated icon with pulse ring */}
            <div className="relative mx-auto mb-8 w-24 h-24">
              <div className={`absolute inset-0 rounded-full animate-ping opacity-20 ${
                result.success ? 'bg-green-400' : 'bg-red-400'
              }`} />
              <div className={`relative w-24 h-24 rounded-full flex items-center justify-center ${
                result.success 
                  ? 'bg-gradient-to-br from-green-100 to-green-200' 
                  : 'bg-gradient-to-br from-red-100 to-red-200'
              }`}>
                {result.success ? (
                  <CheckCircle2 className="w-14 h-14 text-green-600" />
                ) : (
                  <XCircle className="w-14 h-14 text-red-600" />
                )}
              </div>
            </div>

            {result.success ? (
              <>
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold mb-4 ${
                  result.action?.includes('in') 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-amber-100 text-amber-700'
                }`}>
                  <Clock className="w-4 h-4" />
                  {getActionLabel(result.action || '')}
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">
                  {result.employee_name}
                </h2>
                <p className="text-lg text-gray-500 font-mono">{result.employee_id}</p>
                {result.timestamp && (
                  <p className="text-4xl font-bold text-gray-800 mt-4 tracking-tight">
                    {format(new Date(result.timestamp), 'hh:mm a')}
                  </p>
                )}
                {result.late_minutes && result.late_minutes > 0 && (
                  <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-xl text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" />
                    Late by {result.late_minutes} minutes
                  </div>
                )}
                {result.status === 'present' && result.action === 'morning_in' && !result.late_minutes && (
                  <div className="mt-5 inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
                    <CheckCircle2 className="w-4 h-4" />
                    On Time — Great job!
                  </div>
                )}
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-red-600 mb-3">
                  {result.error_title || 'Attendance Failed'}
                </h2>
                {result.employee_name && (
                  <p className="text-gray-600 text-lg mb-2">{result.employee_name}</p>
                )}
                <p className="text-gray-500 mt-2 text-sm leading-relaxed">{result.error || 'Please try again or contact HR'}</p>
              </>
            )}

          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && !result && (
        <div className="fixed inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white border border-gray-200 p-8 rounded-xl shadow-2xl text-center">
            <Loader2 className="w-12 h-12 text-green-700 mx-auto mb-4 animate-spin" />
            <p className="text-lg font-medium text-gray-900">Processing attendance...</p>
          </div>
        </div>
      )}
    </div>
  );
}
