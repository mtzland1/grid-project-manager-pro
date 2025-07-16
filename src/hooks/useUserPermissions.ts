
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
        } else {
          // Para outras roles, começar com 'edit' como padrão
          allColumns?.forEach(col => {
            columnPermissions[col.column_key] = 'edit';
          });

          // Buscar permissões específicas
          const { data: rolePermissions } = await supabase
            .from('role_column_permissions')
            .select('column_key, permission_level')
            .eq('project_id', projectId)
            .eq('role_name', projectRole);

          // Aplicar permissões específicas (sobrescrever padrão)
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
    
    // Administradores sempre podem ver
    if (permissions.role === 'admin' || permissions.projectRole === 'admin') {
      return true;
    }
    
    // Se não há permissão definida, pode ver por padrão
    if (permission === undefined) {
      return permissions.role === 'collaborator' || permissions.projectRole === 'collaborator';
    }
    
    // Não pode ver se a permissão é 'none'
    return permission !== 'none';
  };

  const canEditColumn = (columnKey: string): boolean => {
    const permission = permissions.columnPermissions[columnKey];
    
    // Administradores sempre podem editar
    if (permissions.role === 'admin' || permissions.projectRole === 'admin') {
      return true;
    }
    
    // Se não há permissão definida, pode editar por padrão se for colaborador
    if (permission === undefined) {
      return permissions.projectRole === 'collaborator' || permissions.role === 'collaborator';
    }
    
    // Só pode editar se a permissão for 'edit'
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
