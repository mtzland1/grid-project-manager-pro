-- Criar tabela para mensagens do chat do projeto
CREATE TABLE public.project_chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS para project_chat_messages
ALTER TABLE public.project_chat_messages ENABLE ROW LEVEL SECURITY;

-- Policy para usuários visualizarem mensagens do projeto
CREATE POLICY "Users can view project chat messages"
ON public.project_chat_messages
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_project_roles
    WHERE user_project_roles.user_id = auth.uid()
    AND user_project_roles.project_id = project_chat_messages.project_id
  )
  OR
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.user_id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy para usuários inserir mensagens em projetos que participam
CREATE POLICY "Users can insert messages in their projects"
ON public.project_chat_messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  (
    EXISTS (
      SELECT 1 FROM public.user_project_roles
      WHERE user_project_roles.user_id = auth.uid()
      AND user_project_roles.project_id = project_chat_messages.project_id
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
);

-- Trigger para atualizar timestamp
CREATE TRIGGER update_project_chat_messages_updated_at
BEFORE UPDATE ON public.project_chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();