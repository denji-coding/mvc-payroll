import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEmployees } from "@/hooks/useEmployees";
import { useCreateManualPayroll, usePayrollPeriods } from "@/hooks/usePayroll";
import { calculateSalary } from "@/lib/salaryCalculations";
import { useEmployeeAttendance } from "@/hooks/useAttendance";
import { useBenefitRates } from "@/hooks/useBenefitRates";

interface ManualPayrollDialogProps {
  periodId: string;
  open: boolean;
  onClose: () => void;
}

export function ManualPayrollDialog({ periodId, open, onClose }: ManualPayrollDialogProps) {
  const { data: employees } = useEmployees();
  const { data: periods } = usePayrollPeriods();
  const { data: benefitRates } = useBenefitRates();
  const createManualPayroll = useCreateManualPayroll();

  const [employeeId, setEmployeeId] = useState("");
  const [daysWorkedStr, setDaysWorkedStr] = useState("11");
  const [lateMinutesStr, setLateMinutesStr] = useState("0");
  const [lwpDaysStr, setLwpDaysStr] = useState("0");

  const daysWorked = parseFloat(daysWorkedStr) || 0;
  const lateMinutes = parseInt(lateMinutesStr) || 0;
  const lwpDays = parseFloat(lwpDaysStr) || 0;

  const activeEmployees = employees?.filter((e) => e.employment_status === "active") || [];
  const selectedEmployee = activeEmployees.find((e) => e.id === employeeId);
  const monthlySalary = selectedEmployee?.basic_salary || 0;

  // Get period date range
  const selectedPeriod = periods?.find((p) => p.id === periodId);
  const periodStart = selectedPeriod?.period_start;
  const periodEnd = selectedPeriod?.period_end;

  // Fetch attendance records for this employee within the payroll period
  const { data: attendanceRecords } = useEmployeeAttendance(
    employeeId || undefined,
    periodStart,
    periodEnd
  );

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setEmployeeId("");
      setDaysWorkedStr("11");
      setLateMinutesStr("0");
      setLwpDaysStr("0");
    }
  }, [open]);

  // Auto-calculate days worked from attendance hours (hours / 8 = days)
  useEffect(() => {
    if (attendanceRecords && attendanceRecords.length > 0) {
      const totalHours = attendanceRecords.reduce((sum, a) => sum + (a.hours_worked || 0), 0);
      const days = Math.round((totalHours / 8) * 100) / 100;
      setDaysWorkedStr(String(days));

      // Also sum late minutes from attendance
      const totalLate = attendanceRecords.reduce((sum, a) => sum + (a.late_minutes || 0), 0);
      setLateMinutesStr(String(totalLate));
    }
  }, [attendanceRecords]);

  // basic_salary is the daily rate
  const dailyRate = monthlySalary;

  const calc = useMemo(() => {
    if (!dailyRate) return null;
    return calculateSalary({
      basicMonthlySalary: dailyRate * 22, // convert daily to monthly for calculation
      daysWorked,
      overtimeHours: 0,
      allowances: 0,
      loanDeductions: 0,
      otherDeductions: 0,
      workingDaysPerMonth: 22,
      leaveWithPayDays: lwpDays,
      leaveWithoutPayDays: 0,
    });
  }, [dailyRate, daysWorked, lwpDays]);

  // Late deduction: daily rate / 8 hours / 60 mins * late minutes
  const lateDeduction = Math.round((dailyRate / 8 / 60) * lateMinutes * 100) / 100;

  const grossPay = calc ? calc.grossPay : 0;
  const totalDeductions = calc ? calc.sssContribution + calc.philhealthContribution + calc.pagibigContribution + lateDeduction : 0;
  const netPay = grossPay - totalDeductions;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !calc) return;

    await createManualPayroll.mutateAsync({
      payroll_period_id: periodId,
      employee_id: employeeId,
      basic_pay: calc.basicPay,
      days_worked: daysWorked,
      overtime_pay: 0,
      holiday_pay: 0,
      night_differential: 0,
      total_allowances: calc.leaveWithPayEarnings,
      sss_contribution: calc.sssContribution,
      philhealth_contribution: calc.philhealthContribution,
      pagibig_contribution: calc.pagibigContribution,
      withholding_tax: 0,
      other_deductions: lateDeduction,
    });

    onClose();
  };

  const fmt = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Manual Payroll</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Employee Selection */}
          <div className="space-y-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {activeEmployees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.employee_id} - {emp.first_name} {emp.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {employeeId && selectedEmployee && (
            <>
              {/* Work Details Card */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Work Details</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Days Worked</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      max="22"
                      value={daysWorkedStr}
                      onChange={(e) => setDaysWorkedStr(e.target.value)}
                      onBlur={() => { if (daysWorkedStr.trim() === "") setDaysWorkedStr("0"); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Late (mins)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={lateMinutesStr}
                      onChange={(e) => setLateMinutesStr(e.target.value)}
                      onBlur={() => { if (lateMinutesStr.trim() === "") setLateMinutesStr("0"); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">LWP (days)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      value={lwpDaysStr}
                      onChange={(e) => setLwpDaysStr(e.target.value)}
                      onBlur={() => { if (lwpDaysStr.trim() === "") setLwpDaysStr("0"); }}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Daily Rate</Label>
                    <div className="h-8 flex items-center text-sm font-medium">{fmt(dailyRate)}</div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Earnings */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-sm" style={{ color: 'hsl(var(--success))' }}>Earnings</h4>
                  <div className="rounded-lg p-3 space-y-2 bg-success/5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Basic Pay ({daysWorked} days)</span>
                      <span>{fmt(calc?.basicPay || 0)}</span>
                    </div>
                    {lwpDays > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">LWP ({lwpDays} days)</span>
                        <span>{fmt(calc?.leaveWithPayEarnings || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-semibold text-sm">
                      <span>Gross Pay</span>
                      <span style={{ color: 'hsl(var(--success))' }}>{fmt(grossPay)}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions */}
                <div className="space-y-3">
                  <h4 className="font-semibold text-destructive text-sm">Deductions</h4>
                  <div className="bg-destructive/5 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">SSS</span>
                      <span>{fmt(calc?.sssContribution || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">PhilHealth</span>
                      <span>{fmt(calc?.philhealthContribution || 0)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Pag-IBIG</span>
                      <span>{fmt(calc?.pagibigContribution || 0)}</span>
                    </div>
                    {lateMinutes > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Late Deduction ({lateMinutes} mins)</span>
                        <span>{fmt(lateDeduction)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t font-semibold text-sm">
                      <span>Total Deductions</span>
                      <span className="text-destructive">{fmt(totalDeductions)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Net Pay Summary */}
              <div className="bg-primary/10 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground">Net Pay</p>
                <p className="text-2xl font-bold text-primary">{fmt(netPay)}</p>
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!employeeId || createManualPayroll.isPending}>
              {createManualPayroll.isPending ? "Creating..." : "Create Payroll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
