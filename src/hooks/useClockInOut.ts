import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function useTodayAttendance() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];

  return useQuery({
    queryKey: ['my-attendance-today', user?.id, today],
    queryFn: async () => {
      if (!user?.id) return null;

      // Get employee record for current user
      const { data: employee, error: empError } = await supabase
        .from('employees')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (empError || !employee) return null;

      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('date', today)
        .maybeSingle();

      if (error) throw error;
      return { attendance: data, employeeId: employee.id };
    },
    enabled: !!user?.id,
  });
}
