
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
      const isCollaborator = projectRole === 'collaborator' || userRole === 'collaborator';
      
      // Carregar permissões de coluna para o projeto
      let columnPermissions: { [key: string]: 'none' | 'view' | 'edit' } = {};
      
      if (projectId) {
        // Primeiro, obter todas as colunas do projeto
        const { data: allColumns } = await supabase
          .from('project_columns')
          .select('column_key')
          .eq('project_id', projectId);

        // Para admins, todas as colunas têm permissão de edit
        if (isAdmin) {
          allColumns?.forEach(col => {
            columnPermissions[col.column_key] = 'edit';
          });
        } else if (isCollaborator) {
          // Para colaboradores, começar com 'edit' como padrão
          allColumns?.forEach(col => {
            columnPermissions[col.column_key] = 'edit';
          });

          // Buscar permissões específicas restritivas
          const { data: rolePermissions } = await supabase
            .from('role_column_permissions')
            .select('column_key, permission_level')
            .eq('project_id', projectId)
            .eq('role_name', projectRole);

          // Aplicar apenas restrições explícitas
          rolePermissions?.forEach(perm => {
            if (perm.permission_level === 'none' || perm.permission_level === 'view') {
              columnPermissions[perm.column_key] = perm.permission_level;
            }
          });
        } else {
          // Para outros roles, usar apenas permissões explícitas
          const { data: rolePermissions } = await supabase
            .from('role_column_permissions')
            .select('column_key, permission_level')
            .eq('project_id', projectId)
            .eq('role_name', projectRole);

          rolePermissions?.forEach(perm => {
            columnPermissions[perm.column_key] = perm.permission_level;
          });
        }
      }

      console.log('User permissions loaded:', {
        userRole,
        projectRole,
        isAdmin,
        isCollaborator,
        columnPermissions
      });

      setPermissions({
        role: userRole,
        projectRole,
        canEdit: isAdmin || isCollaborator,
        canDelete: isAdmin,
        canCreate: isAdmin || isCollaborator,
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
    // Se não há permissão definida, colaboradores e admins podem ver por padrão
    if (permission === undefined) {
      return permissions.role === 'admin' || permissions.projectRole === 'admin' || 
             permissions.role === 'collaborator' || permissions.projectRole === 'collaborator';
    }
    return permission === 'view' || permission === 'edit';
  };

  const canEditColumn = (columnKey: string): boolean => {
    const permission = permissions.columnPermissions[columnKey];
    
    // Administradores sempre podem editar
    if (permissions.role === 'admin' || permissions.projectRole === 'admin') {
      return true;
    }
    
    // Para colaboradores, se não há permissão definida, pode editar por padrão
    if (permission === undefined) {
      return permissions.projectRole === 'collaborator' || permissions.role === 'collaborator';
    }
    
    return permission === 'edit';
  };

  return {
    permissions,
    loading,
    canViewColumn,
    canEditColumn,
    refetch: loadUserPermissions
  };
};
