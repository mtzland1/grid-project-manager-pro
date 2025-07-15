import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Settings, Users, Shield, Eye, Edit, EyeOff, Plus, Trash2 } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface ProjectColumn {
  id: string;
  project_id: string;
  column_key: string;
  column_label: string;
  column_type: string;
  column_width: string;
  column_order: number;
  is_system_column: boolean;
  is_calculated: boolean;
}

interface RolePermission {
  id: string;
  role_name: string;
  project_id: string;
  column_key: string;
  permission_level: 'none' | 'view' | 'edit';
}

interface Project {
  id: string;
  name: string;
}

interface RolePermissionManagerProps {
  project: Project;
}

const RolePermissionManager = ({ project }: RolePermissionManagerProps) => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<string>('');
  const { toast } = useToast();

  // Estados para criar nova role
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRoleColor, setNewRoleColor] = useState('#6366f1');
  const [showCreateRole, setShowCreateRole] = useState(false);

  // Estados para criar nova coluna
  const [newColumnKey, setNewColumnKey] = useState('');
  const [newColumnLabel, setNewColumnLabel] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');
  const [showCreateColumn, setShowCreateColumn] = useState(false);

  useEffect(() => {
    loadData();
  }, [project.id]);

  const loadData = async () => {
    try {
      // Carregar roles
      const { data: rolesData, error: rolesError } = await supabase
        .from('custom_roles')
        .select('*')
        .order('name');

      if (rolesError) throw rolesError;

      // Carregar colunas do projeto
      const { data: columnsData, error: columnsError } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', project.id)
        .order('column_order');

      if (columnsError) throw columnsError;

      // Se não há colunas para este projeto, criar as colunas padrão
      if (!columnsData || columnsData.length === 0) {
        await createDefaultColumns();
        return loadData(); // Recarregar após criar colunas padrão
      }

      // Carregar permissões
      const { data: permissionsData, error: permissionsError } = await supabase
        .from('role_column_permissions')
        .select('*')
        .eq('project_id', project.id);

      if (permissionsError) throw permissionsError;

      setRoles(rolesData || []);
      setColumns(columnsData || []);
      setPermissions(permissionsData || []);

      if (rolesData && rolesData.length > 0 && !selectedRole) {
        setSelectedRole(rolesData[0].name);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as configurações de permissão",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createDefaultColumns = async () => {
    const defaultColumns = [
      { column_key: 'descricao', column_label: 'DESCRIÇÃO', column_type: 'text', column_width: '200px', column_order: 1, is_system_column: true },
      { column_key: 'qtd', column_label: 'QTD', column_type: 'number', column_width: '80px', column_order: 2, is_system_column: true },
      { column_key: 'unidade', column_label: 'UNIDADE', column_type: 'text', column_width: '80px', column_order: 3, is_system_column: true },
      { column_key: 'mat_uni_pr', column_label: 'MAT UNI - PR (R$)', column_type: 'currency', column_width: '120px', column_order: 4, is_system_column: true },
      { column_key: 'desconto', column_label: 'Desconto (%)', column_type: 'percentage', column_width: '100px', column_order: 5, is_system_column: true },
      { column_key: 'cc_mat_uni', column_label: 'CC MAT UNI (R$)', column_type: 'currency', column_width: '120px', column_order: 6, is_system_column: true, is_calculated: true },
      { column_key: 'cc_mat_total', column_label: 'CC MAT TOTAL (R$)', column_type: 'currency', column_width: '130px', column_order: 7, is_system_column: true, is_calculated: true },
      { column_key: 'cc_mo_uni', column_label: 'CC MO UNI (R$)', column_type: 'currency', column_width: '120px', column_order: 8, is_system_column: true },
      { column_key: 'cc_mo_total', column_label: 'CC MO TOTAL (R$)', column_type: 'currency', column_width: '130px', column_order: 9, is_system_column: true, is_calculated: true },
      { column_key: 'ipi', column_label: 'IPI (R$)', column_type: 'currency', column_width: '90px', column_order: 10, is_system_column: true },
      { column_key: 'distribuidor', column_label: 'DISTRIBUIDOR', column_type: 'text', column_width: '120px', column_order: 11, is_system_column: true },
      { column_key: 'vlr_total_estimado', column_label: 'VLR. TOTAL ESTIMADO', column_type: 'currency', column_width: '150px', column_order: 12, is_system_column: true, is_calculated: true },
      { column_key: 'vlr_total_venda', column_label: 'VLR. TOTAL VENDA', column_type: 'currency', column_width: '150px', column_order: 13, is_system_column: true, is_calculated: true },
    ];

    const columnsToInsert = defaultColumns.map(col => ({
      ...col,
      project_id: project.id,
    }));

    const { error } = await supabase
      .from('project_columns')
      .insert(columnsToInsert);

    if (error) {
      console.error('Error creating default columns:', error);
      throw error;
    }

    // Criar permissões padrão para o role "apontador"
    await createApontadorDefaultPermissions();
  };

  const createApontadorDefaultPermissions = async () => {
    // Definir permissões específicas para o role "apontador"
    const apontadorPermissions = [
      { column_key: 'descricao', permission_level: 'view' as const },
      { column_key: 'qtd', permission_level: 'view' as const },
      { column_key: 'unidade', permission_level: 'edit' as const }, // Única coluna editável
      { column_key: 'mat_uni_pr', permission_level: 'view' as const },
      { column_key: 'desconto', permission_level: 'view' as const },
      { column_key: 'cc_mat_uni', permission_level: 'view' as const },
      { column_key: 'cc_mat_total', permission_level: 'view' as const },
      { column_key: 'cc_mo_uni', permission_level: 'view' as const },
      { column_key: 'cc_mo_total', permission_level: 'view' as const },
      { column_key: 'ipi', permission_level: 'view' as const },
      { column_key: 'distribuidor', permission_level: 'none' as const }, // Coluna invisível
      { column_key: 'vlr_total_estimado', permission_level: 'view' as const },
      { column_key: 'vlr_total_venda', permission_level: 'view' as const },
    ];

    const permissionsToInsert = apontadorPermissions.map(perm => ({
      ...perm,
      role_name: 'apontador',
      project_id: project.id,
    }));

    const { error } = await supabase
      .from('role_column_permissions')
      .insert(permissionsToInsert);

    if (error) {
      console.error('Error creating apontador permissions:', error);
    }
  };

  const getPermissionLevel = (roleName: string, columnKey: string): 'none' | 'view' | 'edit' => {
    const permission = permissions.find(p => 
      p.role_name === roleName && p.column_key === columnKey
    );
    
    // Admin tem acesso total por padrão
    if (roleName === 'admin') return 'edit';
    
    return permission?.permission_level || 'view';
  };

  const updatePermission = async (roleName: string, columnKey: string, level: 'none' | 'view' | 'edit') => {
    try {
      const existingPermission = permissions.find(p => 
        p.role_name === roleName && p.column_key === columnKey
      );

      if (existingPermission) {
        // Atualizar permissão existente
        const { error } = await supabase
          .from('role_column_permissions')
          .update({ permission_level: level })
          .eq('id', existingPermission.id);

        if (error) throw error;

        setPermissions(permissions.map(p => 
          p.id === existingPermission.id 
            ? { ...p, permission_level: level }
            : p
        ));
      } else {
        // Criar nova permissão
        const { data, error } = await supabase
          .from('role_column_permissions')
          .insert({
            role_name: roleName,
            project_id: project.id,
            column_key: columnKey,
            permission_level: level
          })
          .select()
          .single();

        if (error) throw error;

        setPermissions([...permissions, data]);
      }

      toast({
        title: "Permissão atualizada",
        description: `Permissão para ${roleName} na coluna ${columnKey} foi alterada para ${level}`,
      });
    } catch (error) {
      console.error('Error updating permission:', error);
      toast({
        title: "Erro ao atualizar permissão",
        description: "Não foi possível salvar a alteração",
        variant: "destructive",
      });
    }
  };

  const createRole = async () => {
    if (!newRoleName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "O nome da role é obrigatório",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('custom_roles')
        .insert({
          name: newRoleName.toLowerCase().replace(/\s+/g, '_'),
          description: newRoleDescription,
          color: newRoleColor
        })
        .select()
        .single();

      if (error) throw error;

      setRoles([...roles, data]);
      setNewRoleName('');
      setNewRoleDescription('');
      setNewRoleColor('#6366f1');
      setShowCreateRole(false);

      toast({
        title: "Role criada",
        description: `Role "${data.name}" foi criada com sucesso`,
      });
    } catch (error) {
      console.error('Error creating role:', error);
      toast({
        title: "Erro ao criar role",
        description: "Não foi possível criar a nova role",
        variant: "destructive",
      });
    }
  };

  const createColumn = async () => {
    if (!newColumnKey.trim() || !newColumnLabel.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Chave e rótulo da coluna são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    try {
      const maxOrder = Math.max(...columns.map(c => c.column_order), 0);
      
      const { data, error } = await supabase
        .from('project_columns')
        .insert({
          project_id: project.id,
          column_key: newColumnKey.toLowerCase().replace(/\s+/g, '_'),
          column_label: newColumnLabel,
          column_type: newColumnType,
          column_order: maxOrder + 1,
          is_system_column: false
        })
        .select()
        .single();

      if (error) throw error;

      // Criar permissões 'view' automáticas para todas as roles
      const { data: allRoles } = await supabase
        .from('custom_roles')
        .select('name');

      const defaultRoles = ['admin', 'collaborator', 'orcamentista', 'apontador'];
      const allRoleNames = [
        ...defaultRoles,
        ...(allRoles?.map(r => r.name) || [])
      ];

      // Remover duplicatas
      const uniqueRoles = [...new Set(allRoleNames)];

      // Criar permissões para cada role
      const permissionsToCreate = uniqueRoles.map(roleName => ({
        project_id: project.id,
        role_name: roleName,
        column_key: data.column_key,
        permission_level: 'view' as const
      }));

      if (permissionsToCreate.length > 0) {
        const { error: permissionsError } = await supabase
          .from('role_column_permissions')
          .insert(permissionsToCreate);

        if (permissionsError) {
          console.error('Error creating default permissions:', permissionsError);
        }
      }

      setColumns([...columns, data]);
      setNewColumnKey('');
      setNewColumnLabel('');
      setNewColumnType('text');
      setShowCreateColumn(false);

      toast({
        title: "Coluna criada",
        description: `Coluna "${data.column_label}" foi criada com permissões automáticas para todas as roles`,
      });
    } catch (error) {
      console.error('Error creating column:', error);
      toast({
        title: "Erro ao criar coluna",
        description: "Não foi possível criar a nova coluna",
        variant: "destructive",
      });
    }
  };

  const deleteColumn = async (columnId: string) => {
    try {
      const { error } = await supabase
        .from('project_columns')
        .delete()
        .eq('id', columnId);

      if (error) throw error;

      setColumns(columns.filter(c => c.id !== columnId));

      toast({
        title: "Coluna removida",
        description: "Coluna foi removida com sucesso",
      });
    } catch (error) {
      console.error('Error deleting column:', error);
      toast({
        title: "Erro ao remover coluna",
        description: "Não foi possível remover a coluna",
        variant: "destructive",
      });
    }
  };

  const deleteRole = async (roleName: string) => {
    if (roleName === 'admin') {
      toast({
        title: "Ação não permitida",
        description: "Não é possível excluir a role admin",
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir a role "${roleName}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      // Primeiro, remover todas as permissões relacionadas
      const { error: permissionsError } = await supabase
        .from('role_column_permissions')
        .delete()
        .eq('role_name', roleName);

      if (permissionsError) throw permissionsError;

      // Remover atribuições de usuários
      const { error: userRolesError } = await supabase
        .from('user_project_roles')
        .delete()
        .eq('role_name', roleName);

      if (userRolesError) throw userRolesError;

      // Remover a role
      const { error: roleError } = await supabase
        .from('custom_roles')
        .delete()
        .eq('name', roleName);

      if (roleError) throw roleError;

      // Atualizar estado local
      setRoles(roles.filter(r => r.name !== roleName));
      setPermissions(permissions.filter(p => p.role_name !== roleName));
      
      // Selecionar outra role
      const remainingRoles = roles.filter(r => r.name !== roleName);
      if (remainingRoles.length > 0) {
        setSelectedRole(remainingRoles[0].name);
      }

      toast({
        title: "Role excluída",
        description: `Role "${roleName}" foi excluída com sucesso`,
      });
    } catch (error) {
      console.error('Error deleting role:', error);
      toast({
        title: "Erro ao excluir role",
        description: "Não foi possível excluir a role",
        variant: "destructive",
      });
    }
  };

  const getPermissionIcon = (level: 'none' | 'view' | 'edit') => {
    switch (level) {
      case 'none':
        return <EyeOff className="h-4 w-4 text-gray-400" />;
      case 'view':
        return <Eye className="h-4 w-4 text-blue-500" />;
      case 'edit':
        return <Edit className="h-4 w-4 text-green-500" />;
    }
  };

  const getPermissionColor = (level: 'none' | 'view' | 'edit') => {
    switch (level) {
      case 'none':
        return 'bg-gray-100 text-gray-600';
      case 'view':
        return 'bg-blue-100 text-blue-700';
      case 'edit':
        return 'bg-green-100 text-green-700';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando configurações de permissão...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Gerenciamento de Permissões - {project.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {roles.map((role) => (
              <Button
                key={role.id}
                variant={selectedRole === role.name ? "default" : "outline"}
                onClick={() => setSelectedRole(role.name)}
                className="flex items-center gap-2"
              >
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: role.color }}
                />
                {role.name}
              </Button>
            ))}
            
            <Dialog open={showCreateRole} onOpenChange={setShowCreateRole}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Plus className="h-4 w-4 mr-1" />
                  Nova Role
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Nova Role</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="roleName">Nome da Role</Label>
                    <Input
                      id="roleName"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      placeholder="Ex: supervisor, tecnico"
                    />
                  </div>
                  <div>
                    <Label htmlFor="roleDescription">Descrição</Label>
                    <Input
                      id="roleDescription"
                      value={newRoleDescription}
                      onChange={(e) => setNewRoleDescription(e.target.value)}
                      placeholder="Descrição da role"
                    />
                  </div>
                  <div>
                    <Label htmlFor="roleColor">Cor</Label>
                    <Input
                      id="roleColor"
                      type="color"
                      value={newRoleColor}
                      onChange={(e) => setNewRoleColor(e.target.value)}
                    />
                  </div>
                  <Button onClick={createRole} className="w-full">
                    Criar Role
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {selectedRole && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">
                  Permissões para: {selectedRole}
                </h3>
                
                <Dialog open={showCreateColumn} onOpenChange={setShowCreateColumn}>
                  <DialogTrigger asChild>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Nova Coluna
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => deleteRole(selectedRole)}
                      className="text-red-600 hover:text-red-700"
                      disabled={selectedRole === 'admin'}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir Role
                    </Button>
                  </div>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Criar Nova Coluna</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="columnKey">Chave da Coluna</Label>
                        <Input
                          id="columnKey"
                          value={newColumnKey}
                          onChange={(e) => setNewColumnKey(e.target.value)}
                          placeholder="Ex: observacoes, codigo_interno"
                        />
                      </div>
                      <div>
                        <Label htmlFor="columnLabel">Rótulo</Label>
                        <Input
                          id="columnLabel"
                          value={newColumnLabel}
                          onChange={(e) => setNewColumnLabel(e.target.value)}
                          placeholder="Ex: Observações, Código Interno"
                        />
                      </div>
                      <div>
                        <Label htmlFor="columnType">Tipo</Label>
                        <Select value={newColumnType} onValueChange={setNewColumnType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="text">Texto</SelectItem>
                            <SelectItem value="number">Número</SelectItem>
                            <SelectItem value="currency">Moeda</SelectItem>
                            <SelectItem value="percentage">Porcentagem</SelectItem>
                            <SelectItem value="date">Data</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button onClick={createColumn} className="w-full">
                        Criar Coluna
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-2">
                {columns.map((column) => {
                  const currentPermission = getPermissionLevel(selectedRole, column.column_key);
                  const isAdminRole = selectedRole === 'admin';
                  
                  return (
                    <div key={column.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          {getPermissionIcon(currentPermission)}
                          <span className="font-medium">{column.column_label}</span>
                          {column.is_calculated && (
                            <Badge variant="secondary" className="text-xs">Calculada</Badge>
                          )}
                          {!column.is_system_column && (
                            <Badge variant="outline" className="text-xs">Customizada</Badge>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {!isAdminRole && (
                          <div className="flex gap-1">
                            {(['none', 'view', 'edit'] as const).map((level) => (
                              <Button
                                key={level}
                                size="sm"
                                variant={currentPermission === level ? "default" : "outline"}
                                onClick={() => updatePermission(selectedRole, column.column_key, level)}
                                className={`px-2 py-1 text-xs ${
                                  currentPermission === level ? '' : getPermissionColor(level)
                                }`}
                              >
                                {getPermissionIcon(level)}
                                <span className="ml-1 capitalize">{level === 'none' ? 'Ocultar' : level === 'view' ? 'Ver' : 'Editar'}</span>
                              </Button>
                            ))}
                          </div>
                        )}
                        
                        {isAdminRole && (
                          <Badge className="bg-red-100 text-red-700">
                            Acesso Total
                          </Badge>
                        )}
                        
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteColumn(column.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Caso de uso específico do Apontador */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Caso de Uso: Role "Apontador"
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              O role "Apontador" foi configurado com permissões específicas para apontamentos de campo:
            </p>
            <ul className="space-y-2">
              <li className="flex items-center gap-2">
                <EyeOff className="h-4 w-4 text-gray-400" />
                <span><strong>DISTRIBUIDOR:</strong> Coluna completamente invisível</span>
              </li>
              <li className="flex items-center gap-2">
                <Edit className="h-4 w-4 text-green-500" />
                <span><strong>UNIDADE:</strong> Única coluna editável</span>
              </li>
              <li className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-blue-500" />
                <span><strong>Demais colunas:</strong> Apenas visualização</span>
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolePermissionManager;