import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';

export interface BenefitRates {
  sss_contribution: number;
  philhealth_rate: number;
  pagibig_employee_rate: number;
}

const DEFAULT_RATES: BenefitRates = {
  sss_contribution: 1350,
  philhealth_rate: 500,
  pagibig_employee_rate: 200,
};

export function useBenefitRates() {
  return useQuery({
    queryKey: ['settings', 'benefit_rates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'benefit_rates')
        .single();
      
      if (error) {
        if (error.code === 'PGRST116') {
          // No rows returned, use defaults
          return DEFAULT_RATES;
        }
        throw error;
      }
      return (data.value as unknown as BenefitRates) || DEFAULT_RATES;
    },
  });
}

export function useUpdateBenefitRates() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (rates: BenefitRates) => {
      // Try update first
      const { data: existing } = await supabase
        .from('settings')
        .select('id')
        .eq('key', 'benefit_rates')
        .single();

      if (existing) {
        const { error } = await supabase
          .from('settings')
          .update({ value: JSON.parse(JSON.stringify(rates)) })
          .eq('key', 'benefit_rates');
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('settings')
          .insert({ key: 'benefit_rates', value: JSON.parse(JSON.stringify(rates)) });
        
        if (error) throw error;
      }
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['settings', 'benefit_rates'] });
      notifySuccess(context, 'Benefit rates updated');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Benefit rates', 'Failed to update benefit rates', 'save');
    },
  });
}
