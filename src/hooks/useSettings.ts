import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';

export interface TerminalSettings {
  terminal_enabled: boolean;
  work_start_time: string;
  work_end_time: string;
  grace_period_minutes: number;
  allow_manual_entry: boolean;
}

export interface LwpConfig {
  paid_leave_credits: number;
  refresh_months: number;
}

export function useTerminalSettings() {
  return useQuery({
    queryKey: ['settings', 'terminal'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'terminal')
        .single();
      if (error) throw error;
      return data.value as unknown as TerminalSettings;
    },
  });
}

export function useUpdateTerminalSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (settings: TerminalSettings) => {
      const { error } = await supabase
        .from('settings')
        .update({ value: JSON.parse(JSON.stringify(settings)) })
        .eq('key', 'terminal');
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'terminal'] });
      notifySuccess(context, 'Terminal settings updated');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Settings', 'Failed to update settings', 'save');
    },
  });
}

export function useLwpConfig() {
  return useQuery({
    queryKey: ['settings', 'lwp_config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'lwp_config')
        .single();
      if (error) {
        return { paid_leave_credits: 3, refresh_months: 1 } as LwpConfig;
      }
      return data.value as unknown as LwpConfig;
    },
  });
}

export function useUpdateLwpConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: LwpConfig) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'lwp_config')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: JSON.parse(JSON.stringify(config)) })
          .eq('key', 'lwp_config');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: 'lwp_config', value: JSON.parse(JSON.stringify(config)) });
        if (error) throw error;
      }
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'lwp_config'] });
      notifySuccess(context, 'Leave With Pay settings saved successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Settings', 'Failed to save Leave With Pay settings', 'save');
    },
  });
}
