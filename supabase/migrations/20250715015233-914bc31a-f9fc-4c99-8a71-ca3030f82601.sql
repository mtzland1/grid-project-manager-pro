-- Remover TODAS as permissões de apontador e orcamentista criadas automaticamente
-- para garantir que apenas admin e collaborator sejam roles padrão

DELETE FROM role_column_permissions 
WHERE role_name IN ('apontador', 'orcamentista');

-- Comentário: Esta migração garante que nenhum projeto terá permissões
-- automáticas para apontador ou orcamentista, deixando apenas admin e collaborator
-- como roles padrão. Roles customizadas só existirão se criadas manualmente pelo admin.