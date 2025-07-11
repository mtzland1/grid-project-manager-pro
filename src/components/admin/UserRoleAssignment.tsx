import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Users, Mail, Trash2 } from 'lucide-react';

interface CustomRole {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface UserProjectRole {
  id: string;
  user_id: string;
  role_name: string;
  user_email?: string;
}

interface Project {
  id: string;
  name: string;
}

interface UserRoleAssignmentProps {
  project: Project;
}

const UserRoleAssignment = ({ project }: UserRoleAssignmentProps) => {
  const [roles, setRoles] = useState<CustomRole[]>([]);
  const [userRoles, setUserRoles] = useState<UserProjectRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAssignUser, setShowAssignUser] = useState(false);
  
  // Estados para atribuir usuário
  const [userEmail, setUserEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  const { toast } = useToast();

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

      // Carregar atribuições de usuários para este projeto
      const { data: userRolesData, error: userRolesError } = await supabase
        .from('user_project_roles')
        .select('*')
        .eq('project_id', project.id);

      if (userRolesError) throw userRolesError;

      // Buscar emails dos usuários
      const userIds = userRolesData?.map(ur => ur.user_id) || [];
      const userEmails: { [key: string]: string } = {};
      
      if (userIds.length > 0) {
        // Como não podemos acessar auth.users diretamente, vamos usar profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id')
          .in('user_id', userIds);
        
        // Para demonstração, vamos simular os emails
        // Em um sistema real, você precisaria de uma forma de mapear user_id para email
        profilesData?.forEach(profile => {
          userEmails[profile.user_id] = `user${profile.user_id.slice(-4)}@exemplo.com`;
        });
      }

      const enrichedUserRoles = userRolesData?.map(ur => ({
        ...ur,
        user_email: userEmails[ur.user_id] || 'Email não encontrado'
      })) || [];

      setRoles(rolesData || []);
      setUserRoles(enrichedUserRoles);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar as atribuições de usuários",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignUserToRole = async () => {
    if (!userEmail.trim() || !selectedRole) {
      toast({
        title: "Campos obrigatórios",
        description: "Email do usuário e role são obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setIsAssigning(true);

    try {
      // Primeiro, verificar se o usuário existe através do email
      // Em um sistema real, você teria uma função para buscar usuário por email
      // Para demonstração, vamos simular um user_id
      const simulatedUserId = `user-${Date.now()}`;

      // Verificar se o usuário já tem uma role neste projeto
      const existingAssignment = userRoles.find(ur => ur.user_email === userEmail);
      
      if (existingAssignment) {
        // Atualizar role existente
        const { error } = await supabase
          .from('user_project_roles')
          .update({ role_name: selectedRole })
          .eq('id', existingAssignment.id);

        if (error) throw error;

        setUserRoles(userRoles.map(ur => 
          ur.id === existingAssignment.id 
            ? { ...ur, role_name: selectedRole }
            : ur
        ));

        toast({
          title: "Role atualizada",
          description: `Role do usuário ${userEmail} foi alterada para ${selectedRole}`,
        });
      } else {
        // Criar nova atribuição
        const { data, error } = await supabase
          .from('user_project_roles')
          .insert({
            user_id: simulatedUserId,
            project_id: project.id,
            role_name: selectedRole,
            assigned_by: (await supabase.auth.getUser()).data.user?.id || ''
          })
          .select()
          .single();

        if (error) throw error;

        const newUserRole = {
          ...data,
          user_email: userEmail
        };

        setUserRoles([...userRoles, newUserRole]);

        toast({
          title: "Usuário atribuído",
          description: `Usuário ${userEmail} foi atribuído à role ${selectedRole}`,
        });
      }

      setUserEmail('');
      setSelectedRole('');
      setShowAssignUser(false);
    } catch (error) {
      console.error('Error assigning user:', error);
      toast({
        title: "Erro ao atribuir usuário",
        description: "Não foi possível atribuir o usuário à role",
        variant: "destructive",
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const removeUserFromProject = async (userRoleId: string, userEmail: string) => {
    try {
      const { error } = await supabase
        .from('user_project_roles')
        .delete()
        .eq('id', userRoleId);

      if (error) throw error;

      setUserRoles(userRoles.filter(ur => ur.id !== userRoleId));

      toast({
        title: "Usuário removido",
        description: `Usuário ${userEmail} foi removido do projeto`,
      });
    } catch (error) {
      console.error('Error removing user:', error);
      toast({
        title: "Erro ao remover usuário",
        description: "Não foi possível remover o usuário do projeto",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (roleName: string) => {
    const role = roles.find(r => r.name === roleName);
    return role?.color || '#6366f1';
  };

  const getRolesByName = () => {
    const roleGroups: { [key: string]: UserProjectRole[] } = {};
    
    userRoles.forEach(ur => {
      if (!roleGroups[ur.role_name]) {
        roleGroups[ur.role_name] = [];
      }
      roleGroups[ur.role_name].push(ur);
    });

    return roleGroups;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">Carregando atribuições de usuários...</div>
        </CardContent>
      </Card>
    );
  }

  const roleGroups = getRolesByName();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários do Projeto - {project.name}
          </div>
          
          <Dialog open={showAssignUser} onOpenChange={setShowAssignUser}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Atribuir Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atribuir Usuário à Role</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="userEmail">Email do Usuário</Label>
                  <Input
                    id="userEmail"
                    type="email"
                    value={userEmail}
                    onChange={(e) => setUserEmail(e.target.value)}
                    placeholder="usuario@exemplo.com"
                  />
                </div>
                <div>
                  <Label htmlFor="roleSelect">Role</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma role" />
                    </SelectTrigger>
                    <SelectContent>
                      {roles.map((role) => (
                        <SelectItem key={role.id} value={role.name}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: role.color }}
                            />
                            {role.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={assignUserToRole} 
                  className="w-full"
                  disabled={isAssigning}
                >
                  {isAssigning ? 'Atribuindo...' : 'Atribuir'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {Object.keys(roleGroups).length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            Nenhum usuário atribuído a este projeto ainda.
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(roleGroups).map(([roleName, users]) => (
              <div key={roleName} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full" 
                    style={{ backgroundColor: getRoleColor(roleName) }}
                  />
                  <h3 className="font-medium text-lg">{roleName}</h3>
                  <Badge variant="secondary">{users.length} usuário(s)</Badge>
                </div>
                
                <div className="grid gap-2">
                  {users.map((userRole) => (
                    <div 
                      key={userRole.id} 
                      className="flex items-center justify-between p-3 border rounded-lg bg-gray-50"
                    >
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="font-medium">{userRole.user_email}</span>
                        <Badge 
                          style={{ 
                            backgroundColor: getRoleColor(roleName),
                            color: 'white'
                          }}
                        >
                          {roleName}
                        </Badge>
                      </div>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeUserFromProject(userRole.id, userRole.user_email || '')}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Estatísticas */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="font-medium mb-3">Estatísticas do Projeto</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{userRoles.length}</div>
              <div className="text-sm text-blue-700">Total de Usuários</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {Object.keys(roleGroups).length}
              </div>
              <div className="text-sm text-green-700">Roles Ativas</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {roleGroups['admin']?.length || 0}
              </div>
              <div className="text-sm text-purple-700">Administradores</div>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {roleGroups['apontador']?.length || 0}
              </div>
              <div className="text-sm text-orange-700">Apontadores</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserRoleAssignment;