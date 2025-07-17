
-- Adicionar coluna archived à tabela projects
ALTER TABLE public.projects 
ADD COLUMN archived BOOLEAN NOT NULL DEFAULT false;

-- Adicionar coluna archived_at para rastrear quando foi arquivado
ALTER TABLE public.projects 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;

-- Atualizar a política de visualização para ocultar projetos arquivados dos colaboradores
DROP POLICY IF EXISTS "Users can view projects" ON public.projects;

CREATE POLICY "Users can view projects" 
ON public.projects 
FOR SELECT 
USING (
  -- Admins podem ver todos os projetos (arquivados e não arquivados)
  (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin')) 
  OR 
  -- Colaboradores só podem ver projetos não arquivados
  (archived = false)
);

-- Criar política específica para atualização do status de arquivamento (apenas admins)
CREATE POLICY "Admins can archive/unarchive projects" 
ON public.projects 
FOR UPDATE 
USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'))
WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'));
