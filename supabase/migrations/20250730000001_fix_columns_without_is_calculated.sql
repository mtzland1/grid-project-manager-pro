-- Corrigir função create_default_project_columns sem usar is_calculated
-- A coluna is_calculated foi removida em migração anterior

CREATE OR REPLACE FUNCTION public.create_default_project_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
BEGIN
  -- Só criar colunas padrão se não existirem ainda
  IF NOT EXISTS (SELECT 1 FROM project_columns WHERE project_id = NEW.id) THEN
    INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column) VALUES
      (NEW.id, 'descricao', 'Descrição', 'text', '200px', 1, true),
      (NEW.id, 'qtd', 'Quantidade', 'number', '100px', 2, true),
      (NEW.id, 'unidade', 'Unidade', 'text', '80px', 3, true),
      (NEW.id, 'mat_uni_pr', 'MAT UNI - PR (R$)', 'currency', '120px', 4, true),
      (NEW.id, 'desconto', 'Desconto (%)', 'percentage', '100px', 5, true),
      (NEW.id, 'cc_mat_uni', 'CC MAT UNI (R$)', 'currency', '120px', 6, true),
      (NEW.id, 'cc_mat_total', 'CC MAT TOTAL (R$)', 'currency', '130px', 7, true),
      (NEW.id, 'ipi', 'IPI', 'percentage', '80px', 8, true),
      (NEW.id, 'vlr_total_estimado', 'Valor Total Estimado', 'currency', '150px', 9, true),
      (NEW.id, 'vlr_total_venda', 'Valor Total Venda', 'currency', '150px', 10, true),
      (NEW.id, 'distribuidor', 'Distribuidor', 'text', '120px', 11, true),
      (NEW.id, 'reanalise_escopo', 'Reanalise Escopo', 'text', '130px', 12, true),
      (NEW.id, 'prioridade_compra', 'Prioridade Compra', 'text', '130px', 13, true),
      (NEW.id, 'reanalise_mo', 'Reanalise MO', 'text', '120px', 14, true),
      (NEW.id, 'conferencia_estoque', 'Conferencia Estoque', 'text', '140px', 15, true),
      (NEW.id, 'a_comprar', 'A Comprar', 'text', '100px', 16, true),
      (NEW.id, 'comprado', 'Comprado', 'text', '100px', 17, true),
      (NEW.id, 'previsao_chegada', 'Previsão de Chegada', 'date', '140px', 18, true),
      (NEW.id, 'expedicao', 'Expedição', 'text', '100px', 19, true),
      (NEW.id, 'cronograma_inicio', 'Cronograma Inicio', 'date', '140px', 20, true),
      (NEW.id, 'data_medicoes', 'Data Medições', 'date', '120px', 21, true),
      (NEW.id, 'data_conclusao', 'Data Conclusão', 'date', '120px', 22, true),
      (NEW.id, 'manutencao', 'Manutenção', 'text', '100px', 23, true),
      (NEW.id, 'status_global', 'Status Global', 'text', '120px', 24, true);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Remover colunas indesejadas da tabela project_items (apenas as antigas)
ALTER TABLE public.project_items
DROP COLUMN IF EXISTS cc_mo_uni,
DROP COLUMN IF EXISTS cc_mo_total;

-- Remover colunas indesejadas de project_columns para projetos existentes
DELETE FROM public.project_columns
WHERE column_key IN ('cc_mo_uni', 'cc_mo_total', 'miniimo_unitario', 'minimo_unitario', 'miniimo_total', 'minimo_total');

-- Limpar dados dinâmicos existentes removendo as colunas indesejadas
UPDATE public.project_items
SET dynamic_data = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(dynamic_data)
  WHERE key NOT IN ('cc_mo_uni', 'cc_mo_total', 'miniimo_unitario', 'minimo_unitario', 'miniimo_total', 'minimo_total')
)
WHERE dynamic_data IS NOT NULL;

-- Adicionar as colunas que faltam para projetos existentes
INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'mat_uni_pr',
  'MAT UNI - PR (R$)',
  'currency',
  '120px',
  4,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'mat_uni_pr'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'desconto',
  'Desconto (%)',
  'percentage',
  '100px',
  5,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'desconto'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'cc_mat_uni',
  'CC MAT UNI (R$)',
  'currency',
  '120px',
  6,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'cc_mat_uni'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'cc_mat_total',
  'CC MAT TOTAL (R$)',
  'currency',
  '130px',
  7,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'cc_mat_total'
);

-- Adicionar todas as colunas de workflow para projetos existentes
INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'reanalise_escopo',
  'Reanalise Escopo',
  'text',
  '130px',
  12,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'reanalise_escopo'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'prioridade_compra',
  'Prioridade Compra',
  'text',
  '130px',
  13,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'prioridade_compra'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'reanalise_mo',
  'Reanalise MO',
  'text',
  '120px',
  14,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'reanalise_mo'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'conferencia_estoque',
  'Conferencia Estoque',
  'text',
  '140px',
  15,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'conferencia_estoque'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'a_comprar',
  'A Comprar',
  'text',
  '100px',
  16,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'a_comprar'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'comprado',
  'Comprado',
  'text',
  '100px',
  17,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'comprado'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'previsao_chegada',
  'Previsão de Chegada',
  'date',
  '140px',
  18,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'previsao_chegada'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'expedicao',
  'Expedição',
  'text',
  '100px',
  19,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'expedicao'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'cronograma_inicio',
  'Cronograma Inicio',
  'date',
  '140px',
  20,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'cronograma_inicio'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'data_medicoes',
  'Data Medições',
  'date',
  '120px',
  21,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'data_medicoes'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'data_conclusao',
  'Data Conclusão',
  'date',
  '120px',
  22,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'data_conclusao'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'manutencao',
  'Manutenção',
  'text',
  '100px',
  23,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'manutencao'
);

INSERT INTO public.project_columns (project_id, column_key, column_label, column_type, column_width, column_order, is_system_column)
SELECT 
  p.id,
  'status_global',
  'Status Global',
  'text',
  '120px',
  24,
  true
FROM public.projects p
WHERE NOT EXISTS (
  SELECT 1 FROM public.project_columns pc 
  WHERE pc.project_id = p.id AND pc.column_key = 'status_global'
);