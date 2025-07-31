-- Adicionar colunas de workflow à tabela project_items
ALTER TABLE public.project_items 
ADD COLUMN IF NOT EXISTS reanalise_escopo text,
ADD COLUMN IF NOT EXISTS prioridade_compra text,
ADD COLUMN IF NOT EXISTS reanalise_mo text,
ADD COLUMN IF NOT EXISTS conferencia_estoque text,
ADD COLUMN IF NOT EXISTS a_comprar text,
ADD COLUMN IF NOT EXISTS comprado text,
ADD COLUMN IF NOT EXISTS previsao_chegada date,
ADD COLUMN IF NOT EXISTS expedicao text,
ADD COLUMN IF NOT EXISTS cronograma_inicio date,
ADD COLUMN IF NOT EXISTS data_medicoes date,
ADD COLUMN IF NOT EXISTS data_conclusao date,
ADD COLUMN IF NOT EXISTS manutencao text,
ADD COLUMN IF NOT EXISTS status_global text;

-- Comentário: Adicionando colunas de workflow que estavam sendo tratadas
-- apenas como configurações de colunas mas não existiam fisicamente na tabela.
-- Isso resolve o problema de edição dessas colunas no ProjectGrid.