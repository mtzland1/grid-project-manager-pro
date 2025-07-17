
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';

interface UnreadCount {
  project_id: string;
  count: number;
}

export const useUnreadMessages = (user: User | null) => {
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchUnreadCounts = async () => {
    if (!user) {
      setUnreadCounts({});
      setLoading(false);
      return;
    }

    try {
      // Buscar todas as mensagens de projetos que o usuário tem acesso
      const { data: messages, error: messagesError } = await supabase
        .from('project_chat_messages')
        .select('id, project_id, created_at');

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return;
      }

      if (!messages || messages.length === 0) {
        setUnreadCounts({});
        return;
      }

      // Buscar status de leitura para o usuário atual
      const { data: readStatus, error: readError } = await supabase
        .from('message_read_status')
        .select('message_id')
        .eq('user_id', user.id);

      if (readError) {
        console.error('Error fetching read status:', readError);
        return;
      }

      // Criar um Set com IDs das mensagens lidas
      const readMessageIds = new Set(readStatus?.map(rs => rs.message_id) || []);

      // Contar mensagens não lidas por projeto
      const counts: Record<string, number> = {};
      messages.forEach(message => {
        if (!readMessageIds.has(message.id)) {
          counts[message.project_id] = (counts[message.project_id] || 0) + 1;
        }
      });

      setUnreadCounts(counts);
    } catch (err) {
      console.error('Error in fetchUnreadCounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const markProjectMessagesAsRead = async (projectId: string) => {
    if (!user) return;

    try {
      // Buscar mensagens do projeto que ainda não foram lidas
      const { data: messages, error: messagesError } = await supabase
        .from('project_chat_messages')
        .select('id')
        .eq('project_id', projectId);

      if (messagesError || !messages) {
        console.error('Error fetching project messages:', messagesError);
        return;
      }

      // Buscar quais mensagens já foram lidas pelo usuário
      const { data: readStatus, error: readError } = await supabase
        .from('message_read_status')
        .select('message_id')
        .eq('user_id', user.id)
        .in('message_id', messages.map(m => m.id));

      if (readError) {
        console.error('Error fetching read status:', readError);
        return;
      }

      const readMessageIds = new Set(readStatus?.map(rs => rs.message_id) || []);
      const unreadMessages = messages.filter(m => !readMessageIds.has(m.id));

      if (unreadMessages.length === 0) return;

      // Marcar mensagens como lidas
      const readStatusInserts = unreadMessages.map(message => ({
        user_id: user.id,
        message_id: message.id,
      }));

      const { error: insertError } = await supabase
        .from('message_read_status')
        .insert(readStatusInserts);

      if (insertError) {
        console.error('Error marking messages as read:', insertError);
        return;
      }

      // Atualizar contadores localmente
      setUnreadCounts(prev => ({
        ...prev,
        [projectId]: 0
      }));

    } catch (err) {
      console.error('Error in markProjectMessagesAsRead:', err);
    }
  };

  useEffect(() => {
    fetchUnreadCounts();

    // Configurar realtime para atualizar quando novas mensagens chegarem
    const channel = supabase
      .channel('unread-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages'
        },
        () => fetchUnreadCounts()
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'message_read_status'
        },
        () => fetchUnreadCounts()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return {
    unreadCounts,
    loading,
    markProjectMessagesAsRead,
    refetch: fetchUnreadCounts
  };
};
