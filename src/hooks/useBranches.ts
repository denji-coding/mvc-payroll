import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import { getSafeErrorMessage } from '@/lib/errorHandler';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Branch = Tables<'branches'>;
export type BranchInsert = TablesInsert<'branches'>;
export type BranchUpdate = TablesUpdate<'branches'>;

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
  });
}

export function useBranch(id: string | undefined) {
  return useQuery({
    queryKey: ['branch', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (branch: BranchInsert) => {
      const { data, error } = await supabase
        .from('branches')
        .insert(branch)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      notifySuccess(context, 'Branch created successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Branch', getSafeErrorMessage(error, 'Failed to create branch'), 'save');
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, ...updates }: BranchUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('branches')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      notifySuccess(context, 'Branch updated successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Branch', getSafeErrorMessage(error, 'Failed to update branch'), 'save');
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('branches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      notifySuccess(context, 'Branch deleted successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Branch', getSafeErrorMessage(error, 'Failed to delete branch'), 'delete');
    },
  });
}

export function useBranchEmployeeCount(branchId: string | undefined) {
  return useQuery({
    queryKey: ['branch-employee-count', branchId],
    queryFn: async () => {
      if (!branchId) return 0;
      const { count, error } = await supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .eq('employment_status', 'active');
      
      if (error) throw error;
      return count || 0;
    },
    enabled: !!branchId,
  });
}
