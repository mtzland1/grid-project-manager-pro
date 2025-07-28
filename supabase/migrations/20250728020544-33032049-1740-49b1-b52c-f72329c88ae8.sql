
-- Remover o trigger que pode estar causando problemas
DROP TRIGGER IF EXISTS create_default_project_columns_trigger ON projects;

-- Recriar a função para criar colunas padrão de forma mais controlada
CREATE OR REPLACE FUNCTION public.create_default_project_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Só criar colunas padrão se não existirem ainda
  IF NOT EXISTS (SELECT 1 FROM project_columns WHERE project_id = NEW.id) THEN
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
      (NEW.id, 'distribuidor', 'Distribuidor', 'text', '120px', 13, true, false),
      (NEW.id, 'reanalise_escopo', 'Reanalise Escopo', 'text', '130px', 14, true, false),
      (NEW.id, 'prioridade_compra', 'Prioridade Compra', 'text', '130px', 15, true, false),
      (NEW.id, 'reanalise_mo', 'Reanalise MO', 'text', '120px', 16, true, false),
      (NEW.id, 'conferencia_estoque', 'Conferencia Estoque', 'text', '140px', 17, true, false),
      (NEW.id, 'a_comprar', 'A Comprar', 'text', '100px', 18, true, false),
      (NEW.id, 'comprado', 'Comprado', 'text', '100px', 19, true, false),
      (NEW.id, 'previsao_chegada', 'Previsão de Chegada', 'date', '140px', 20, true, false),
      (NEW.id, 'expedicao', 'Expedição', 'text', '100px', 21, true, false),
      (NEW.id, 'cronograma_inicio', 'Cronograma Inicio', 'date', '140px', 22, true, false),
      (NEW.id, 'data_medicoes', 'Data Medições', 'date', '120px', 23, true, false),
      (NEW.id, 'data_conclusao', 'Data Conclusão', 'date', '120px', 24, true, false),
      (NEW.id, 'manutencao', 'Manutenção', 'text', '100px', 25, true, false),
      (NEW.id, 'status_global', 'Status Global', 'text', '120px', 26, true, false);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recriar o trigger
CREATE TRIGGER create_default_project_columns_trigger
    AFTER INSERT ON projects
    FOR EACH ROW
    EXECUTE FUNCTION create_default_project_columns();
