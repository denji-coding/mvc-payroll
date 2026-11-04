import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { notifyError, notifyProcessing, notifySuccess } from '@/lib/formNotifications';
import { getSafeErrorMessage } from '@/lib/errorHandler';

export interface Announcement {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  published_at: string | null;
  branch_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useAnnouncements() {
  return useQuery({
    queryKey: ['announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Announcement[];
    },
  });
}

export function usePublishedAnnouncements() {
  return useQuery({
    queryKey: ['announcements', 'published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_published', true)
        .order('published_at', { ascending: false });
      
      if (error) throw error;
      return data as Announcement[];
    },
  });
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (announcement: { title: string; content: string; branch_id?: string | null }) => {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('announcements')
        .insert({
          ...announcement,
          created_by: userData.user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      notifySuccess(context, 'Announcement created successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Announcement', getSafeErrorMessage(error, 'Failed to create announcement'), 'save');
    },
  });
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Announcement> & { id: string }) => {
      const { data, error } = await supabase
        .from('announcements')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Saving...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      notifySuccess(context, 'Announcement updated successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Announcement', getSafeErrorMessage(error, 'Failed to update announcement'), 'save');
    },
  });
}

export function useToggleAnnouncementPublish() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, is_published }: { id: string; is_published: boolean }) => {
      const { data, error } = await supabase
        .from('announcements')
        .update({
          is_published,
          published_at: is_published ? new Date().toISOString() : null,
        })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      notifySuccess(context, variables.is_published ? 'Announcement published' : 'Announcement unpublished');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Announcement', getSafeErrorMessage(error, 'Failed to update announcement'), 'save');
    },
  });
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onMutate: () => notifyProcessing('Deleting...'),
    onSuccess: (_data, _vars, context) => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      notifySuccess(context, 'Announcement deleted successfully');
    },
    onError: (error: Error, _vars, context) => {
      notifyError(context, 'Announcement', getSafeErrorMessage(error, 'Failed to delete announcement'), 'delete');
    },
  });
}
