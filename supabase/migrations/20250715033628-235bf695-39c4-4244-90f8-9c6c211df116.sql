-- Habilitar realtime para a tabela de mensagens de chat
ALTER TABLE public.project_chat_messages REPLICA IDENTITY FULL;

-- Adicionar a tabela à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;