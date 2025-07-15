-- Enable realtime for project_columns table
ALTER TABLE public.project_columns REPLICA IDENTITY FULL;

-- Add project_columns to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_columns;