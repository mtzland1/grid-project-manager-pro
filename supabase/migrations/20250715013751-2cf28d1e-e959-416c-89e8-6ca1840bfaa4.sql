-- Limpar permissões desnecessárias (manter apenas admin e collaborator como padrão)
-- Remover permissões de apontador e orcamentista que foram criadas automaticamente
-- Apenas manter permissões específicas criadas manualmente pelo admin

DELETE FROM role_column_permissions 
WHERE role_name IN ('apontador', 'orcamentista') 
AND project_id IS NOT NULL
AND NOT EXISTS (
  -- Manter apenas as permissões específicas para apontador criadas manualmente
  SELECT 1 FROM role_column_permissions rcp2 
  WHERE rcp2.role_name = 'apontador' 
  AND rcp2.column_key = role_column_permissions.column_key
  AND rcp2.project_id = role_column_permissions.project_id
  AND rcp2.permission_level != 'view'
);