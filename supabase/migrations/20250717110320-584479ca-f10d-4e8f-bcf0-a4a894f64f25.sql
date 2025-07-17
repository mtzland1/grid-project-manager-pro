
-- Criar tabela para rastrear mensagens lidas por usuário
CREATE TABLE public.message_read_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  message_id UUID NOT NULL REFERENCES public.project_chat_messages(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, message_id)
);

-- Enable RLS
ALTER TABLE public.message_read_status ENABLE ROW LEVEL SECURITY;

-- Policy para usuários visualizarem seus próprios status de leitura
CREATE POLICY "Users can view their own read status"
ON public.message_read_status
FOR SELECT
USING (auth.uid() = user_id);

-- Policy para usuários inserir seus próprios status de leitura
CREATE POLICY "Users can insert their own read status"
ON public.message_read_status
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy para usuários atualizarem seus próprios status de leitura
CREATE POLICY "Users can update their own read status"
ON public.message_read_status
FOR UPDATE
USING (auth.uid() = user_id);

-- Índices para melhor performance
CREATE INDEX idx_message_read_status_user_id ON public.message_read_status(user_id);
CREATE INDEX idx_message_read_status_message_id ON public.message_read_status(message_id);
