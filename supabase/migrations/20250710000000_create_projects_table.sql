-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar tabela de projetos
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Criar tabela de itens do projeto
CREATE TABLE public.project_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  descricao TEXT,
  qtd DECIMAL(10,2) DEFAULT 0,
  unidade VARCHAR(50),
  mat_uni_pr DECIMAL(10,2) DEFAULT 0,
  desconto DECIMAL(5,2) DEFAULT 0,
  cc_mat_uni DECIMAL(10,2) DEFAULT 0,
  cc_mat_total DECIMAL(10,2) DEFAULT 0,
  cc_mo_uni DECIMAL(10,2) DEFAULT 0,
  cc_mo_total DECIMAL(10,2) DEFAULT 0,
  ipi DECIMAL(5,2) DEFAULT 0,
  vlr_total_estimado DECIMAL(10,2) DEFAULT 0,
  vlr_total_venda DECIMAL(10,2) DEFAULT 0,
  distribuidor VARCHAR(255),
  dynamic_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);