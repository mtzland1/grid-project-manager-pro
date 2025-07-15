
-- Remover todas as permissões específicas para orcamentista e apontador
DELETE FROM role_column_permissions 
WHERE role_name IN ('orcamentista', 'apontador');

-- Remover todas as atribuições de usuários para essas roles
DELETE FROM user_project_roles 
WHERE role_name IN ('orcamentista', 'apontador');

-- Remover as roles customizadas orcamentista e apontador
DELETE FROM custom_roles 
WHERE name IN ('orcamentista', 'apontador');

-- Atualizar a função de validação de roles para aceitar apenas admin e collaborator
DROP FUNCTION IF EXISTS public.is_valid_role(text);

CREATE OR REPLACE FUNCTION public.is_valid_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role_name IN ('admin', 'collaborator') 
    OR EXISTS (SELECT 1 FROM public.custom_roles WHERE name = role_name);
$$;

-- Atualizar profiles que possam ter roles antigas para collaborator
UPDATE profiles 
SET role = 'collaborator' 
WHERE role IN ('orcamentista', 'apontador');

-- Atualizar as políticas RLS para remover referências às roles antigas
DROP POLICY IF EXISTS "Collaborators can view project items" ON public.project_items;

-- Criar nova política simplificada para collaborators
CREATE POLICY "Collaborators can view project items" 
ON public.project_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'collaborator'
));

-- Adicionar política para collaborators poderem inserir itens
CREATE POLICY "Collaborators can insert project items" 
ON public.project_items FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'collaborator'
));

-- Adicionar política para collaborators poderem atualizar itens
CREATE POLICY "Collaborators can update project items" 
ON public.project_items FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'collaborator'
));

-- Adicionar política para collaborators poderem deletar itens (se necessário)
CREATE POLICY "Collaborators can delete project items" 
ON public.project_items FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'collaborator'
));
