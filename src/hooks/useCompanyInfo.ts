import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';

export interface CompanyInfo {
  company_name: string;
  company_logo_url: string | null;
}

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  company_name: 'Migrants Venture Corporation',
  company_logo_url: null,
};

export function useCompanyInfo() {
  return useQuery({
    queryKey: ['settings', 'company_info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'company_info')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (!data) return DEFAULT_COMPANY_INFO;
      return data.value as unknown as CompanyInfo;
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateCompanyInfo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (info: CompanyInfo) => {
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'company_info')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: JSON.parse(JSON.stringify(info)) })
          .eq('key', 'company_info');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: 'company_info', value: JSON.parse(JSON.stringify(info)) });
        if (error) throw error;
      }
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'company_info'] });
      notifySuccess(context, 'Company information updated');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Company information', 'Failed to update company information', 'save');
    },
  });
}
