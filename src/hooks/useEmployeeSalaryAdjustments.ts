import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';

export interface EmployeeSalaryAdjustment {
  id: string;
  employee_id: string;
  component_id: string;
  amount: number;
  is_recurring: boolean;
  effective_from: string | null;
  effective_to: string | null;
  created_at: string;
  component?: {
    id: string;
    name: string;
    type: string;
  };
}

export function useEmployeeSalaryAdjustments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ['employee-salary-adjustments', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from('employee_salary_adjustments')
        .select(`
          *,
          component:salary_components(id, name, type)
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as EmployeeSalaryAdjustment[];
    },
    enabled: !!employeeId,
  });
}

export function useCreateEmployeeSalaryAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (adjustment: {
      employee_id: string;
      component_id: string;
      amount: number;
      is_recurring?: boolean;
      effective_from?: string;
      effective_to?: string;
    }) => {
      const { data, error } = await supabase
        .from('employee_salary_adjustments')
        .insert(adjustment)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary-adjustments', variables.employee_id] });
      notifySuccess(context, 'Salary adjustment added');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Salary adjustment', 'Failed to add adjustment: ' + error.message, 'save');
    },
  });
}

export function useUpdateEmployeeSalaryAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, employee_id, ...updates }: {
      id: string;
      employee_id: string;
      amount?: number;
      is_recurring?: boolean;
      effective_from?: string | null;
      effective_to?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('employee_salary_adjustments')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary-adjustments', variables.employee_id] });
      notifySuccess(context, 'Salary adjustment updated');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Salary adjustment', 'Failed to update adjustment: ' + error.message, 'save');
    },
  });
}

export function useDeleteEmployeeSalaryAdjustment() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, employee_id }: { id: string; employee_id: string }) => {
      const { error } = await supabase
        .from('employee_salary_adjustments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary-adjustments', variables.employee_id] });
      notifySuccess(context, 'Salary adjustment deleted');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Salary adjustment', 'Failed to delete adjustment: ' + error.message, 'delete');
    },
  });
}
