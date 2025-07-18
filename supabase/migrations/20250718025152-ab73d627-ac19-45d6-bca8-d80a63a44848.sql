
-- Adicionar campo de descrição na tabela de projetos
ALTER TABLE public.projects 
ADD COLUMN description TEXT DEFAULT '';

-- Criar função para atualizar o timestamp updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o campo updated_at do projeto quando project_items for modificado
  UPDATE public.projects 
  SET updated_at = now() 
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Criar função para atualizar o timestamp updated_at quando project_columns for modificado
CREATE OR REPLACE FUNCTION public.update_projects_updated_at_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o campo updated_at do projeto quando project_columns for modificado
  UPDATE public.projects 
  SET updated_at = now() 
  WHERE id = COALESCE(NEW.project_id, OLD.project_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Adicionar trigger para atualizar updated_at quando project_items for modificado
DROP TRIGGER IF EXISTS trigger_update_projects_updated_at_items ON public.project_items;
CREATE TRIGGER trigger_update_projects_updated_at_items
  AFTER INSERT OR UPDATE OR DELETE ON public.project_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_projects_updated_at();

-- Adicionar trigger para atualizar updated_at quando project_columns for modificado  
DROP TRIGGER IF EXISTS trigger_update_projects_updated_at_columns ON public.project_columns;
CREATE TRIGGER trigger_update_projects_updated_at_columns
  AFTER INSERT OR UPDATE OR DELETE ON public.project_columns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_projects_updated_at_columns();

-- Garantir que o trigger de updated_at já existe na tabela projects
DROP TRIGGER IF EXISTS trigger_update_projects_updated_at ON public.projects;
CREATE TRIGGER trigger_update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Atualizar política RLS para permitir que admins editem a descrição
DROP POLICY IF EXISTS "Admins can update project description" ON public.projects;
CREATE POLICY "Admins can update project description"
  ON public.projects
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.role = 'admin'
  ));
