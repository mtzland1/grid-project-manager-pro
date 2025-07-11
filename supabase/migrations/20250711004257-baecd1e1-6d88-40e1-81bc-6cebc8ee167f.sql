-- Atualizar políticas para garantir acesso total do admin

-- Atualizar política dos project_items para admin ter acesso total
DROP POLICY IF EXISTS "Authenticated users can view all project items" ON public.project_items;
DROP POLICY IF EXISTS "Authenticated users can create project items" ON public.project_items;
DROP POLICY IF EXISTS "Authenticated users can update project items" ON public.project_items;
DROP POLICY IF EXISTS "Authenticated users can delete project items" ON public.project_items;

-- Novas políticas com controle granular por role
CREATE POLICY "Admins can manage all project items" 
ON public.project_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Collaborators can view project items" 
ON public.project_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role IN ('collaborator', 'orcamentista', 'apontador')
));

-- Atualizar política dos projects para admin ter acesso total
DROP POLICY IF EXISTS "Authenticated users can view all projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can create projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can update projects" ON public.projects;
DROP POLICY IF EXISTS "Authenticated users can delete projects" ON public.projects;

-- Novas políticas para projects
CREATE POLICY "Admins can manage all projects" 
ON public.projects FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Users can view projects" 
ON public.projects FOR SELECT
USING (true);

CREATE POLICY "Users can create their own projects" 
ON public.projects FOR INSERT
WITH CHECK (auth.uid() = created_by);

-- Criar permissões padrão para collaborator (exemplo: QTD oculta)
INSERT INTO public.role_column_permissions (role_name, project_id, column_key, permission_level) 
SELECT 'collaborator', p.id, 'qtd', 'none'
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_column_permissions rcp 
  WHERE rcp.role_name = 'collaborator' 
  AND rcp.project_id = p.id 
  AND rcp.column_key = 'qtd'
);

-- Garantir que outras colunas tenham permissão de view por padrão para collaborator
INSERT INTO public.role_column_permissions (role_name, project_id, column_key, permission_level) 
SELECT 'collaborator', p.id, pc.column_key, 'view'
FROM public.projects p
CROSS JOIN public.project_columns pc
WHERE pc.project_id = p.id
AND pc.column_key != 'qtd'
AND NOT EXISTS (
  SELECT 1 FROM public.role_column_permissions rcp 
  WHERE rcp.role_name = 'collaborator' 
  AND rcp.project_id = p.id 
  AND rcp.column_key = pc.column_key
);