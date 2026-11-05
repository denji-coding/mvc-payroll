import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import { useAuth } from './useAuth';
import { getSafeErrorMessage } from '@/lib/errorHandler';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type LeaveRequest = Tables<'leave_requests'>;
export type LeaveRequestInsert = TablesInsert<'leave_requests'>;
export type LeaveCredit = Tables<'leave_credits'>;

type LeaveTypeConfig = {
  name: string;
  default_credits: number | null;
  credits_per_application: number | null;
};

const normalizeLeaveTypeKey = (value?: string | null) =>
  (value || '')
    .toLowerCase()
    .replace(/\s+leave$/i, '')
    .replace(/\s+/g, '_')
    .trim();

const enumToLeaveTypeName: Record<string, string> = {
  sick: 'Sick Leave',
  vacation: 'Vacation Leave',
  emergency: 'Emergency Leave',
  maternity: 'Maternity/Paternity Leave',
  paternity: 'Paternity Leave',
  bereavement: 'Bereavement Leave',
  unpaid: 'Unpaid Leave',
};

async function getMatchingLeaveTypeConfig(leaveType: string): Promise<LeaveTypeConfig | null> {
  const normalizedLeaveType = normalizeLeaveTypeKey(leaveType);

  const { data, error } = await supabase
    .from('leave_types')
    .select('name, default_credits, credits_per_application');

  if (error) throw error;

  return data?.find((item) => normalizeLeaveTypeKey(item.name) === normalizedLeaveType) || null;
}

async function deductLeaveCreditsOnce(
  employeeId: string,
  leaveType: string,
  startDate?: string | null,
) {
  const currentYear = startDate
    ? new Date(`${startDate}T00:00:00`).getFullYear()
    : new Date().getFullYear();
  const rawLeaveType = leaveType;
  const leaveTypeConfig = await getMatchingLeaveTypeConfig(rawLeaveType);
  const candidateKeys = new Set(
    [rawLeaveType, leaveTypeConfig?.name, enumToLeaveTypeName[rawLeaveType]]
      .filter(Boolean)
      .map((value) => normalizeLeaveTypeKey(value))
  );

  const { data: allCredits, error: allCreditsError } = await supabase
    .from('leave_credits')
    .select('id, used_credits, leave_type, total_credits')
    .eq('employee_id', employeeId)
    .eq('year', currentYear);

  if (allCreditsError) throw allCreditsError;

  let creditRecord: Pick<LeaveCredit, 'id' | 'used_credits' | 'leave_type' | 'total_credits'> | null =
    allCredits?.find((credit) => candidateKeys.has(normalizeLeaveTypeKey(credit.leave_type))) || null;

  if (!creditRecord && leaveTypeConfig) {
    const { data: createdCredit, error: createCreditError } = await supabase
      .from('leave_credits')
      .insert({
        employee_id: employeeId,
        leave_type: leaveTypeConfig.name,
        year: currentYear,
        total_credits: leaveTypeConfig.credits_per_application || leaveTypeConfig.default_credits || 0,
        used_credits: 0,
      })
      .select('id, used_credits, leave_type, total_credits')
      .single();

    if (createCreditError) throw createCreditError;
    creditRecord = createdCredit;
  }

  if (!creditRecord) return;

  // Deduct exactly 1 credit per approved application, regardless of number of days requested
  const creditsToDeduct = 1;
  const { error: creditUpdateError } = await supabase
    .from('leave_credits')
    .update({
      used_credits: Number(creditRecord.used_credits || 0) + creditsToDeduct,
    })
    .eq('id', creditRecord.id);

  if (creditUpdateError) throw creditUpdateError;
}

export function useLeaveRequests(status?: 'pending' | 'manager_approved' | 'hr_approved' | 'rejected' | 'cancelled') {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('leave-requests-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
          queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['leave-requests', status],
    queryFn: async () => {
      let query = supabase
        .from('leave_requests')
        .select('*, employees(first_name, middle_name, last_name, suffix_name, employee_id, branch_id)')
        .order('created_at', { ascending: false });
      
      if (status) {
        query = query.eq('status', status);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useMyLeaveRequests() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-leave-requests', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!employee) return [];

      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });
}

export function useLeaveCredits(employeeId?: string) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['leave-credits', employeeId || user?.id],
    queryFn: async () => {
      let empId = employeeId;
      
      if (!empId && user?.id) {
        const { data: employee } = await supabase
          .from('employees')
          .select('id')
          .eq('user_id', user.id)
          .single();
        
        empId = employee?.id;
      }
      
      if (!empId) return [];

      const currentYear = new Date().getFullYear();
      const { data, error } = await supabase
        .from('leave_credits')
        .select('*')
        .eq('employee_id', empId)
        .eq('year', currentYear);
      
      if (error) throw error;
      return data;
    },
    enabled: !!(employeeId || user?.id),
  });
}

export function useAllLeaveCredits() {
  const currentYear = new Date().getFullYear();
  
  return useQuery({
    queryKey: ['all-leave-credits', currentYear],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leave_credits')
        .select('*, employees(id, first_name, middle_name, last_name, suffix_name, employee_id)')
        .eq('year', currentYear)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateLeaveCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (credit: {
      employee_id: string;
      leave_type: string;
      total_credits: number;
    }) => {
      const currentYear = new Date().getFullYear();
      
      // Check if credit already exists for this employee/type/year
      const { data: existing } = await supabase
        .from('leave_credits')
        .select('id')
        .eq('employee_id', credit.employee_id)
        .eq('leave_type', credit.leave_type)
        .eq('year', currentYear)
        .single();
      
      if (existing) {
        throw new Error('Leave credit already exists for this employee and leave type');
      }
      
      const { data, error } = await supabase
        .from('leave_credits')
        .insert({
          employee_id: credit.employee_id,
          leave_type: credit.leave_type,
          year: currentYear,
          total_credits: credit.total_credits,
          used_credits: 0,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-credits'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-credits'] });
      notifySuccess(context, 'Leave credit added successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave credit', getSafeErrorMessage(error, 'Failed to add leave credit'), 'save');
    },
  });
}

export function useUpdateLeaveCredit() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, total_credits, used_credits }: { 
      id: string; 
      total_credits?: number;
      used_credits?: number;
    }) => {
      const updates: TablesUpdate<'leave_credits'> = {};
      if (total_credits !== undefined) updates.total_credits = total_credits;
      if (used_credits !== undefined) updates.used_credits = used_credits;
      
      const { data, error } = await supabase
        .from('leave_credits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-credits'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-credits'] });
      notifySuccess(context, 'Leave credit updated successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave credit', getSafeErrorMessage(error, 'Failed to update leave credit'), 'save');
    },
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async (request: Omit<LeaveRequestInsert, 'employee_id'>) => {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (!employee) throw new Error('Employee record not found');

      const { data, error } = await supabase
        .from('leave_requests')
        .insert({ ...request, employee_id: employee.id })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      notifySuccess(context, 'Leave request submitted successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave request', getSafeErrorMessage(error, 'Failed to submit leave request'), 'save');
    },
  });
}

export function useApproveLeaveRequest() {
  const queryClient = useQueryClient();
  const { user, role } = useAuth();
  
  return useMutation({
    mutationFn: async ({ id, remarks, action }: { id: string; remarks?: string; action: 'approve' | 'reject' }) => {
      // First get the leave request details
      const { data: leaveRequest, error: fetchError } = await supabase
        .from('leave_requests')
        .select('employee_id, leave_type, start_date, status')
        .eq('id', id)
        .single();
      
      if (fetchError) throw fetchError;

      const wasAlreadyApproved = leaveRequest?.status === 'manager_approved' || leaveRequest?.status === 'hr_approved';
      
      const updates: TablesUpdate<'leave_requests'> = {};
      
      if (role === 'branch_manager') {
        updates.manager_id = user?.id;
        updates.manager_action_at = new Date().toISOString();
        updates.manager_remarks = remarks;
        updates.status = action === 'approve' ? 'manager_approved' : 'rejected';

        if (action === 'approve' && leaveRequest && !wasAlreadyApproved) {
          await deductLeaveCreditsOnce(leaveRequest.employee_id, leaveRequest.leave_type, leaveRequest.start_date);
        }
      } else if ((role === 'hr_admin' || role === 'super_admin')) {
        updates.hr_id = user?.id;
        updates.hr_action_at = new Date().toISOString();
        updates.hr_remarks = remarks;
        updates.status = action === 'approve' ? 'hr_approved' : 'rejected';
        
        if (action === 'approve' && leaveRequest && !wasAlreadyApproved) {
          await deductLeaveCreditsOnce(leaveRequest.employee_id, leaveRequest.leave_type, leaveRequest.start_date);
        }
      }

      const { data, error } = await supabase
        .from('leave_requests')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Processing...'),
    onSuccess: (_, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave-credits'] });
      queryClient.invalidateQueries({ queryKey: ['all-leave-credits'] });
      notifySuccess(context, `Leave request ${variables.action === 'approve' ? 'approved' : 'rejected'}`);
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave request', getSafeErrorMessage(error, 'Failed to process leave request'), 'process');
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('leave_requests')
        .update({ status: 'cancelled' as any })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-leave-requests'] });
      notifySuccess(context, 'Leave request cancelled');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Leave request', getSafeErrorMessage(error, 'Failed to cancel leave request'), 'delete');
    },
  });
}

// Calculate working days between two dates
export function calculateWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current <= endDate) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
