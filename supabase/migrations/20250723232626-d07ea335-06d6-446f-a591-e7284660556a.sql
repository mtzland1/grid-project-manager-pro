
-- Adicionar colunas de gerenciamento à tabela project_items
ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS reanalise_escopo TEXT,
ADD COLUMN IF NOT EXISTS prioridade_compra TEXT,
ADD COLUMN IF NOT EXISTS reanalise_mo TEXT,
ADD COLUMN IF NOT EXISTS conferencia_estoque TEXT,
ADD COLUMN IF NOT EXISTS a_comprar TEXT,
ADD COLUMN IF NOT EXISTS comprado TEXT,
ADD COLUMN IF NOT EXISTS previsao_chegada DATE,
ADD COLUMN IF NOT EXISTS expedicao TEXT,
ADD COLUMN IF NOT EXISTS cronograma_inicio DATE,
ADD COLUMN IF NOT EXISTS data_medicoes DATE,
ADD COLUMN IF NOT EXISTS data_conclusao DATE,
ADD COLUMN IF NOT EXISTS manutencao TEXT,
ADD COLUMN IF NOT EXISTS status_global TEXT;

-- Atualizar a função que cria colunas padrão para incluir as colunas de gerenciamento
CREATE OR REPLACE FUNCTION public.create_default_project_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
    (NEW.id, 'distribuidor', 'Distribuidor', 'text', '120px', 13, true, false),
    -- Colunas de gerenciamento
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
  
  RETURN NEW;
END;
$$;

-- Adicionar colunas de gerenciamento para projetos existentes que não as possuem
INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column, is_calculated)
SELECT 
  p.id,
  column_info.column_key,
  column_info.column_label,
  column_info.column_type,
  column_info.column_width,
  (SELECT COALESCE(MAX(column_order), 0) FROM project_columns WHERE project_id = p.id) + column_info.order_increment,
  true,
  false
FROM public.projects p
CROSS JOIN (
  VALUES 
    ('reanalise_escopo', 'Reanalise Escopo', 'text', '130px', 1),
    ('prioridade_compra', 'Prioridade Compra', 'text', '130px', 2),
    ('reanalise_mo', 'Reanalise MO', 'text', '120px', 3),
    ('conferencia_estoque', 'Conferencia Estoque', 'text', '140px', 4),
    ('a_comprar', 'A Comprar', 'text', '100px', 5),
    ('comprado', 'Comprado', 'text', '100px', 6),
    ('previsao_chegada', 'Previsão de Chegada', 'date', '140px', 7),
    ('expedicao', 'Expedição', 'text', '100px', 8),
    ('cronograma_inicio', 'Cronograma Inicio', 'date', '140px', 9),
    ('data_medicoes', 'Data Medições', 'date', '120px', 10),
    ('data_conclusao', 'Data Conclusão', 'date', '120px', 11),
    ('manutencao', 'Manutenção', 'text', '100px', 12),
    ('status_global', 'Status Global', 'text', '120px', 13)
) AS column_info(column_key, column_label, column_type, column_width, order_increment)
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = column_info.column_key
);
