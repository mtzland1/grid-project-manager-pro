import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UserPermissions {
  role: string;
  projectRole?: string;
  canEdit: boolean;
  canDelete: boolean;
  canCreate: boolean;
  columnPermissions: { [key: string]: 'none' | 'view' | 'edit' };
}

export const useUserPermissions = (projectId?: string) => {
  const [permissions, setPermissions] = useState<UserPermissions>({
    role: '',
    canEdit: false,
    canDelete: false,
    canCreate: false,
    columnPermissions: {}
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserPermissions();
  }, [projectId]);

  const loadUserPermissions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Obter role do perfil
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();

      const userRole = profile?.role || 'collaborator';
      
      // Se há um projeto específico, verificar role específica do projeto
      let projectRole = userRole;
      if (projectId) {
        const { data: userProjectRole } = await supabase
          .from('user_project_roles')
          .select('role_name')
          .eq('user_id', user.id)
          .eq('project_id', projectId)
          .maybeSingle();

        if (userProjectRole) {
          projectRole = userProjectRole.role_name;
        }
      }

      // Determinar permissões baseadas no role
      const isAdmin = userRole === 'admin' || projectRole === 'admin';
      
      // Carregar permissões de coluna para o projeto
      let columnPermissions: { [key: string]: 'none' | 'view' | 'edit' } = {};
      
      if (projectId) {
        const { data: rolePermissions } = await supabase
          .from('role_column_permissions')
          .select('column_key, permission_level')
          .eq('project_id', projectId)
          .eq('role_name', projectRole);

        // Se é admin, todas as colunas têm permissão de edit
        if (isAdmin) {
          const { data: columns } = await supabase
            .from('project_columns')
            .select('column_key')
            .eq('project_id', projectId);

          columns?.forEach(col => {
            columnPermissions[col.column_key] = 'edit';
          });
        } else {
          // Para outros roles, usar as permissões definidas
          rolePermissions?.forEach(perm => {
            columnPermissions[perm.column_key] = perm.permission_level;
          });
        }
      }

      // Determinar se pode editar baseado nas permissões de coluna
      const hasEditPermission = isAdmin || Object.values(columnPermissions).some(p => p === 'edit');

      setPermissions({
        role: userRole,
        projectRole,
        canEdit: hasEditPermission,
        canDelete: isAdmin,
        canCreate: isAdmin,
        columnPermissions
      });

    } catch (error) {
      console.error('Error loading user permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  const canViewColumn = (columnKey: string): boolean => {
    const permission = permissions.columnPermissions[columnKey];
    return permission === 'view' || permission === 'edit';
  };

  const canEditColumn = (columnKey: string): boolean => {
    return permissions.columnPermissions[columnKey] === 'edit';
  };

  return {
    permissions,
    loading,
    canViewColumn,
    canEditColumn,
    refetch: loadUserPermissions
  };
};