-- Add a JSONB column to store dynamic column data
ALTER TABLE public.project_items 
ADD COLUMN dynamic_data JSONB DEFAULT '{}';

-- Create an index for better performance on JSONB queries
CREATE INDEX idx_project_items_dynamic_data ON public.project_items USING GIN(dynamic_data);