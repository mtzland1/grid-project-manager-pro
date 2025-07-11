
-- Adicionar coluna distribuidor na tabela project_items
ALTER TABLE public.project_items 
ADD COLUMN distribuidor text DEFAULT ''::text;

-- Adicionar coluna distribuidor na configuração de colunas dos projetos existentes
INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column, is_calculated)
SELECT 
  p.id,
  'distribuidor',
  'Distribuidor',
  'text',
  '150px',
  (SELECT COALESCE(MAX(column_order), 0) + 1 FROM project_columns WHERE project_id = p.id),
  false,
  false
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'distribuidor'
);

-- Corrigir a constraint de roles para aceitar roles personalizadas
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Adicionar nova constraint que aceita roles básicas ou referencia roles customizadas
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (
  role IN ('admin', 'collaborator', 'orcamentista', 'apontador') 
  OR EXISTS (SELECT 1 FROM public.custom_roles WHERE name = profiles.role)
);
