-- Habilitar realtime para mensagens de chat
ALTER TABLE public.project_chat_messages REPLICA IDENTITY FULL;

-- Adicionar a tabela ao publication do realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_chat_messages;

-- Atualizar a política para garantir que usuários possam ver mensagens de projetos onde têm acesso
DROP POLICY IF EXISTS "Users can view project chat messages" ON public.project_chat_messages;

CREATE POLICY "Users can view project chat messages"
ON public.project_chat_messages
FOR SELECT
USING (
  -- Admin pode ver tudo
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  ))
  OR
  -- Usuários podem ver mensagens de projetos onde têm role específico
  (EXISTS (
    SELECT 1 FROM user_project_roles 
    WHERE user_project_roles.user_id = auth.uid() 
    AND user_project_roles.project_id = project_chat_messages.project_id
  ))
  OR
  -- Criador do projeto pode ver as mensagens
  (EXISTS (
    SELECT 1 FROM projects 
    WHERE projects.id = project_chat_messages.project_id 
    AND projects.created_by = auth.uid()
  ))
);

-- Atualizar política de inserção
DROP POLICY IF EXISTS "Users can insert messages in their projects" ON public.project_chat_messages;

CREATE POLICY "Users can insert messages in their projects"
ON public.project_chat_messages
FOR INSERT
WITH CHECK (
  -- User deve estar autenticado e ser o dono da mensagem
  auth.uid() = user_id 
  AND (
    -- Admin pode inserir em qualquer projeto
    (EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role = 'admin'
    ))
    OR
    -- Usuários podem inserir em projetos onde têm role específico
    (EXISTS (
      SELECT 1 FROM user_project_roles 
      WHERE user_project_roles.user_id = auth.uid() 
      AND user_project_roles.project_id = project_chat_messages.project_id
    ))
    OR
    -- Criador do projeto pode inserir mensagens
    (EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = project_chat_messages.project_id 
      AND projects.created_by = auth.uid()
    ))
  )
);