
-- Função para criar colunas padrão quando um projeto é criado
CREATE OR REPLACE FUNCTION public.create_default_project_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserir colunas padrão do sistema
  INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column, is_calculated) VALUES
    (NEW.id, 'descricao', 'Descrição', 'text', '200px', 1, true, false),
    (NEW.id, 'qtd', 'Quantidade', 'number', '100px', 2, true, false),
    (NEW.id, 'unidade', 'Unidade', 'text', '80px', 3, true, false),
    (NEW.id, 'mat_uni_pr', 'Mat. Uni. Preço', 'currency', '120px', 4, true, false),
    (NEW.id, 'desconto', 'Desconto (%)', 'percentage', '100px', 5, true, false),
    (NEW.id, 'cc_mat_uni', 'CC Mat. Uni.', 'currency', '120px', 6, true, true),
    (NEW.id, 'cc_mat_total', 'CC Mat. Total', 'currency', '130px', 7, true, true),
    (NEW.id, 'cc_mo_uni', 'CC MO Uni.', 'currency', '120px', 8, true, false),
    (NEW.id, 'cc_mo_total', 'CC MO Total', 'currency', '130px', 9, true, true),
    (NEW.id, 'ipi', 'IPI', 'percentage', '80px', 10, true, false),
    (NEW.id, 'vlr_total_estimado', 'Valor Total Estimado', 'currency', '150px', 11, true, false),
    (NEW.id, 'vlr_total_venda', 'Valor Total Venda', 'currency', '150px', 12, true, false),
    (NEW.id, 'distribuidor', 'Distribuidor', 'text', '120px', 13, true, false);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para executar a função quando um projeto é criado
CREATE OR REPLACE TRIGGER create_default_columns_on_project_creation
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_project_columns();
