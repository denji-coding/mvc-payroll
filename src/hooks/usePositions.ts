import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import type { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';

export type Position = Tables<'positions'>;
export type PositionInsert = TablesInsert<'positions'>;
export type PositionUpdate = TablesUpdate<'positions'>;

export function usePositions() {
  return useQuery({
    queryKey: ['positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useAllPositions() {
  return useQuery({
    queryKey: ['positions', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('positions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (position: PositionInsert) => {
      const { data, error } = await supabase
        .from('positions')
        .insert(position)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      notifySuccess(context, 'Position created successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Position', error.message, 'save');
    },
  });
}

export function useUpdatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: PositionUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('positions')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      notifySuccess(context, 'Position updated successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Position', error.message, 'save');
    },
  });
}

export function useDeletePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('positions')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      notifySuccess(context, 'Position deleted successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Position', error.message, 'delete');
    },
  });
}
