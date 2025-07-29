-- Remover a coluna is_calculated da tabela project_columns
-- Esta coluna estava causando problemas na importação de arquivos Excel

-- Primeiro, atualizar a função que cria colunas padrão para remover is_calculated
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
      (NEW.id, 'mat_uni_pr', 'Mat. Uni. Preço', 'currency', '120px', 4, true),
      (NEW.id, 'desconto', 'Desconto (%)', 'percentage', '100px', 5, true),
      (NEW.id, 'cc_mo_uni', 'CC MO Uni.', 'currency', '120px', 6, true),
      (NEW.id, 'ipi', 'IPI', 'percentage', '80px', 7, true),
      (NEW.id, 'vlr_total_estimado', 'Valor Total Estimado', 'currency', '150px', 8, true),
      (NEW.id, 'vlr_total_venda', 'Valor Total Venda', 'currency', '150px', 9, true),
      (NEW.id, 'distribuidor', 'Distribuidor', 'text', '120px', 10, true);
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Agora remover a coluna is_calculated da tabela project_columns
ALTER TABLE public.project_columns DROP COLUMN IF EXISTS is_calculated;

-- Comentário: A remoção da coluna is_calculated simplifica a estrutura da tabela
-- e resolve problemas de importação de arquivos Excel que dependiam dessa propriedade.
-- As colunas calculadas agora serão tratadas diretamente no frontend sem necessidade
-- de marcação especial no banco de dados.