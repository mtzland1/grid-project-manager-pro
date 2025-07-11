-- Primeiro vamos adicionar a coluna distribuidor na tabela project_items
ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS distribuidor text DEFAULT '';

-- Verificar e corrigir a constraint de roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Criar uma função para verificar se uma role é válida
CREATE OR REPLACE FUNCTION public.is_valid_role(role_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role_name IN ('admin', 'collaborator', 'orcamentista', 'apontador') 
    OR EXISTS (SELECT 1 FROM public.custom_roles WHERE name = role_name);
$$;

-- Adicionar nova constraint usando a função
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_role_check 
CHECK (is_valid_role(role));

-- Inserir configuração da coluna distribuidor para projetos existentes que não a possuem
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

-- Habilitar realtime para as mensagens de chat
ALTER TABLE public.project_chat_messages REPLICA IDENTITY FULL;

-- Adicionar tabela de realtime se necessário
INSERT INTO supabase_realtime.subscription VALUES 
  ('realtime', 'public', 'project_chat_messages', null, null, null, null)
ON CONFLICT DO NOTHING;