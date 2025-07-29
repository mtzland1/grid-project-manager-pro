-- Criar tipos enum para as permissões
CREATE TYPE permission_level AS ENUM ('none', 'view', 'edit');

-- Tabela para definir roles customizadas
CREATE TABLE public.custom_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  color VARCHAR(7) DEFAULT '#6366f1', -- Hex color for UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela para colunas customizadas por projeto
CREATE TABLE public.project_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  column_key VARCHAR(100) NOT NULL,
  column_label VARCHAR(200) NOT NULL,
  column_type VARCHAR(50) DEFAULT 'text', -- text, number, currency, percentage, date
  column_width VARCHAR(20) DEFAULT '120px',
  column_order INTEGER DEFAULT 0,
  is_system_column BOOLEAN DEFAULT false, -- true para colunas padrão do sistema
  is_calculated BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(project_id, column_key)
);

-- Tabela para permissões específicas por role, projeto e coluna
CREATE TABLE public.role_column_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name VARCHAR(100) NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  column_key VARCHAR(100) NOT NULL,
  permission_level permission_level NOT NULL DEFAULT 'view',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(role_name, project_id, column_key)
);

-- Tabela para atribuir roles customizadas aos usuários por projeto
CREATE TABLE public.user_project_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  role_name VARCHAR(100) NOT NULL,
  assigned_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, project_id)
);

-- Povoar roles padrão
INSERT INTO public.custom_roles (name, description, color) VALUES 
('admin', 'Administrador com acesso total', '#dc2626'),
('collaborator', 'Colaborador padrão', '#059669'),
('orcamentista', 'Responsável por orçamentos e custos', '#7c3aed'),
('apontador', 'Responsável por apontamentos de campo', '#ea580c');

-- Triggers para updated_at
CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_columns_updated_at
  BEFORE UPDATE ON public.project_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_role_column_permissions_updated_at
  BEFORE UPDATE ON public.role_column_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_project_roles_updated_at
  BEFORE UPDATE ON public.user_project_roles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_column_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_project_roles ENABLE ROW LEVEL SECURITY;

-- Policies para custom_roles
CREATE POLICY "Authenticated users can view custom roles" 
ON public.custom_roles FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage custom roles" 
ON public.custom_roles FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Policies para project_columns
CREATE POLICY "Authenticated users can view project columns" 
ON public.project_columns FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage project columns" 
ON public.project_columns FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Policies para role_column_permissions
CREATE POLICY "Authenticated users can view role permissions" 
ON public.role_column_permissions FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage role permissions" 
ON public.role_column_permissions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

-- Policies para user_project_roles
CREATE POLICY "Users can view their project roles" 
ON public.user_project_roles FOR SELECT 
USING (user_id = auth.uid() OR EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));

CREATE POLICY "Admins can manage user project roles" 
ON public.user_project_roles FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.profiles 
  WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
));