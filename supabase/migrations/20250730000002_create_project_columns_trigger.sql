-- Criar trigger para criar colunas padrão automaticamente quando um projeto é criado
CREATE TRIGGER create_project_columns_trigger
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_columns();