-- Enable real-time for project_items table
ALTER TABLE project_items REPLICA IDENTITY FULL;

-- Add project_items to realtime publication
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE project_columns, project_items;