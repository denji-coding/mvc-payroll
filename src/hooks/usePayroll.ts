import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import { getSafeErrorMessage } from '@/lib/errorHandler';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type PayrollPeriod = Tables<'payroll_periods'>;
export type PayrollRecord = Tables<'payroll_records'>;

export function usePayrollPeriods() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('payroll-periods-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_periods',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['payroll-periods'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payroll_periods')
        .select('*')
        .order('period_start', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function usePayrollRecords(periodId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!periodId) return;

    const channel = supabase
      .channel('payroll-records-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payroll_records',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['payroll-records', periodId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, periodId]);

  return useQuery({
    queryKey: ['payroll-records', periodId],
    queryFn: async () => {
      if (!periodId) return [];
      
      const { data, error } = await supabase
        .from('payroll_records')
        .select('*, employees(employee_id, first_name, middle_name, last_name, suffix_name)')
        .eq('payroll_period_id', periodId)
        .order('employees(last_name)', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!periodId,
  });
}

export function useCreatePayrollPeriod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (period: TablesInsert<'payroll_periods'>) => {
      const { data, error } = await supabase
        .from('payroll_periods')
        .insert(period)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
      notifySuccess(context, 'Payroll period created');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll period', getSafeErrorMessage(error, 'Failed to create payroll period'), 'save');
    },
  });
}

export function useRunPayroll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ periodId, employeeIds }: { periodId: string; employeeIds?: string[] }) => {
      const { data, error } = await supabase.functions.invoke('compute-payroll', {
        body: { payroll_period_id: periodId, employee_ids: employeeIds },
      });
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Processing...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      notifySuccess(context, 'Payroll computed successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll', getSafeErrorMessage(error, 'Failed to compute payroll'), 'process');
    },
  });
}

export function useApprovePayroll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (periodId: string) => {
      const { data, error } = await supabase
        .from('payroll_periods')
        .update({ 
          status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', periodId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Send email notifications to employees
      try {
        const { error: emailError } = await supabase.functions.invoke('send-payslip-emails', {
          body: { payroll_period_id: periodId },
        });
        
        if (emailError) {
          console.error('Failed to send payslip emails:', emailError);
          // Don't throw - approval succeeded, just email failed
        }
      } catch (emailErr) {
        console.error('Error invoking send-payslip-emails:', emailErr);
      }
      
      return data;
    },
    onMutate: () => notifyProcessing('Processing...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
      notifySuccess(context, 'Payroll approved and employees notified');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll', getSafeErrorMessage(error, 'Failed to approve payroll'), 'process');
    },
  });
}

export function useSalaryComponents() {
  return useQuery({
    queryKey: ['salary-components'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('salary_components')
        .select('*')
        .order('type', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useDeletePayrollPeriod() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (periodId: string) => {
      // First delete related records
      const { error: recordsError } = await supabase
        .from('payroll_records')
        .delete()
        .eq('payroll_period_id', periodId);
      
      if (recordsError) throw recordsError;
      
      // Then delete the period
      const { error } = await supabase
        .from('payroll_periods')
        .delete()
        .eq('id', periodId);
      
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      notifySuccess(context, 'Payroll period deleted');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll period', getSafeErrorMessage(error, 'Failed to delete payroll period'), 'delete');
    },
  });
}

export function useDeletePayrollRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (recordId: string) => {
      const { error } = await supabase
        .from('payroll_records')
        .delete()
        .eq('id', recordId);
      
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      notifySuccess(context, 'Payroll record deleted');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll record', getSafeErrorMessage(error, 'Failed to delete payroll record'), 'delete');
    },
  });
}

export interface ManualPayrollData {
  payroll_period_id: string;
  employee_id: string;
  basic_pay: number;
  days_worked: number;
  overtime_pay: number;
  holiday_pay: number;
  night_differential: number;
  total_allowances: number;
  sss_contribution: number;
  philhealth_contribution: number;
  pagibig_contribution: number;
  withholding_tax: number;
  other_deductions: number;
  allowances_breakdown?: Record<string, number>;
  deductions_breakdown?: Record<string, number>;
}

export function useCreateManualPayroll() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: ManualPayrollData) => {
      const grossPay = data.basic_pay + data.overtime_pay + data.holiday_pay + 
                       data.night_differential + data.total_allowances;
      const totalDeductions = data.sss_contribution + data.philhealth_contribution + 
                              data.pagibig_contribution + data.withholding_tax + data.other_deductions;
      const netPay = grossPay - totalDeductions;
      
      const { data: result, error } = await supabase
        .from('payroll_records')
        .insert({
          payroll_period_id: data.payroll_period_id,
          employee_id: data.employee_id,
          basic_pay: data.basic_pay,
          days_worked: data.days_worked,
          overtime_pay: data.overtime_pay,
          holiday_pay: data.holiday_pay,
          night_differential: data.night_differential,
          total_allowances: data.total_allowances,
          sss_contribution: data.sss_contribution,
          philhealth_contribution: data.philhealth_contribution,
          pagibig_contribution: data.pagibig_contribution,
          withholding_tax: data.withholding_tax,
          other_deductions: data.other_deductions,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          is_manual: true,
          allowances_breakdown: data.allowances_breakdown || {},
          deductions_breakdown: data.deductions_breakdown || {},
        })
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      notifySuccess(context, 'Manual payroll record created');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Manual payroll record', getSafeErrorMessage(error, 'Failed to create manual payroll'), 'save');
    },
  });
}

export function useUpdatePayrollRecord() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...data }: ManualPayrollData & { id: string }) => {
      const grossPay = data.basic_pay + data.overtime_pay + data.holiday_pay + 
                       data.night_differential + data.total_allowances;
      const totalDeductions = data.sss_contribution + data.philhealth_contribution + 
                              data.pagibig_contribution + data.withholding_tax + data.other_deductions;
      const netPay = grossPay - totalDeductions;
      
      const { data: result, error } = await supabase
        .from('payroll_records')
        .update({
          basic_pay: data.basic_pay,
          days_worked: data.days_worked,
          overtime_pay: data.overtime_pay,
          holiday_pay: data.holiday_pay,
          night_differential: data.night_differential,
          total_allowances: data.total_allowances,
          sss_contribution: data.sss_contribution,
          philhealth_contribution: data.philhealth_contribution,
          pagibig_contribution: data.pagibig_contribution,
          withholding_tax: data.withholding_tax,
          other_deductions: data.other_deductions,
          gross_pay: grossPay,
          total_deductions: totalDeductions,
          net_pay: netPay,
          is_manual: true,
          allowances_breakdown: data.allowances_breakdown || {},
          deductions_breakdown: data.deductions_breakdown || {},
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return result;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['payroll-records'] });
      notifySuccess(context, 'Payroll record updated');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Payroll record', getSafeErrorMessage(error, 'Failed to update payroll record'), 'save');
    },
  });
}
