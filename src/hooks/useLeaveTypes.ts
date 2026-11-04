import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import { getSafeErrorMessage } from '@/lib/errorHandler';

export interface LeaveType {
  id: string;
  name: string;
  default_credits: number;
  description: string | null;
  is_active: boolean;
  credits_per_application: number;
  max_days_per_application: number | null;
  calendar_config: 'disable_past' | 'disable_future' | 'no_disable';
  required_fields: string[];
  upload_condition_days: number | null;
  created_at: string;
  updated_at: string;
}

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave-types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_types')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as LeaveType[];
    },
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (leaveType: {
      name: string;
      default_credits: number;
      description?: string;
      applyToAll?: boolean;
      credits_per_application?: number;
      max_days_per_application?: number | null;
      calendar_config?: string;
      required_fields?: string[];
      upload_condition_days?: number | null;
    }) => {
      const { applyToAll, ...insertData } = leaveType;
      const { data, error } = await supabase
        .from('leave_types')
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;

      if (applyToAll) {
        const { data: employees } = await supabase
          .from('employees')
          .select('id');

        if (employees && employees.length > 0) {
          const currentYear = new Date().getFullYear();
          const credits = employees.map((emp) => ({
            employee_id: emp.id,
            leave_type: leaveType.name as any,
            year: currentYear,
            total_credits: leaveType.credits_per_application || data.credits_per_application || 1,
            used_credits: 0,
          }));

          await supabase.from('leave_credits').insert(credits);
        }
      }

      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-credits'] });
      notifySuccess(context, 'Leave type created successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave type', getSafeErrorMessage(error, 'Failed to create leave type'), 'save');
    },
  });
}

export function useUpdateLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<LeaveType> & { id: string }) => {
      const { data, error } = await supabase
        .from('leave_types')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      notifySuccess(context, 'Leave type updated successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave type', getSafeErrorMessage(error, 'Failed to update leave type'), 'save');
    },
  });
}

export function useDeleteLeaveType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('leave_types')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-types'] });
      notifySuccess(context, 'Leave type deleted successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave type', getSafeErrorMessage(error, 'Failed to delete leave type'), 'delete');
    },
  });
}
