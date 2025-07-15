import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Edit, Trash2, LogOut, FolderOpen, Settings, Users, Copy } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import ProjectGrid from '@/components/project/ProjectGrid';
import RolePermissionManager from '@/components/admin/RolePermissionManager';
import UserRoleAssignment from '@/components/admin/UserRoleAssignment';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const { toast } = useToast();

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching projects:', error);
        toast({
          title: "Erro ao carregar projetos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setProjects(data || []);
    } catch (err) {
      console.error('Error fetching projects:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível carregar os projetos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite um nome para o projeto",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from('projects')
        .insert([{
          name: newProjectName.trim(),
          created_by: user.id,
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creating project:', error);
        toast({
          title: "Erro ao criar projeto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projeto criado!",
        description: `O projeto "${newProjectName}" foi criado com sucesso`,
      });

      setNewProjectName('');
      setShowCreateDialog(false);
      fetchProjects();
    } catch (err) {
      console.error('Error creating project:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível criar o projeto",
        variant: "destructive",
      });
    }
  };

  const handleRenameProject = async () => {
    if (!renameProjectName.trim() || !projectToRename) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .update({ name: renameProjectName.trim() })
        .eq('id', projectToRename.id);

      if (error) {
        console.error('Error renaming project:', error);
        toast({
          title: "Erro ao renomear projeto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projeto renomeado!",
        description: `O projeto foi renomeado para "${renameProjectName}"`,
      });

      setRenameProjectName('');
      setShowRenameDialog(false);
      setProjectToRename(null);
      fetchProjects();
    } catch (err) {
      console.error('Error renaming project:', err);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Tem certeza que deseja deletar o projeto "${project.name}"?`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', project.id);

      if (error) {
        console.error('Error deleting project:', error);
        toast({
          title: "Erro ao deletar projeto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projeto deletado!",
        description: `O projeto "${project.name}" foi deletado`,
      });

      fetchProjects();
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleCloneProject = async (project: Project) => {
    const newName = prompt(`Digite o nome do novo projeto (clonado de "${project.name}"):`);
    if (!newName?.trim()) return;

    try {
      // 1. Criar novo projeto
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: newName.trim(),
          created_by: user.id,
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      // 2. Clonar colunas do projeto
      const { data: columns, error: columnsError } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', project.id);

      if (columnsError) throw columnsError;

      if (columns && columns.length > 0) {
        const columnsToInsert = columns.map(col => ({
          ...col,
          id: undefined, // Remove o ID para criar novo
          project_id: newProject.id, // Novo projeto ID
          created_at: undefined,
          updated_at: undefined
        }));

        const { error: insertColumnsError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert);

        if (insertColumnsError) throw insertColumnsError;
      }

      // 3. Clonar itens do projeto (sem o chat)
      const { data: items, error: itemsError } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', project.id);

      if (itemsError) throw itemsError;

      if (items && items.length > 0) {
        const itemsToInsert = items.map(item => ({
          ...item,
          id: undefined, // Remove o ID para criar novo
          project_id: newProject.id, // Novo projeto ID
          created_at: undefined,
          updated_at: undefined
        }));

        const { error: insertItemsError } = await supabase
          .from('project_items')
          .insert(itemsToInsert);

        if (insertItemsError) throw insertItemsError;
      }

      // 4. Clonar permissões de roles
      const { data: permissions, error: permissionsError } = await supabase
        .from('role_column_permissions')
        .select('*')
        .eq('project_id', project.id);

      if (permissionsError) throw permissionsError;

      if (permissions && permissions.length > 0) {
        const permissionsToInsert = permissions.map(perm => ({
          ...perm,
          id: undefined, // Remove o ID para criar novo
          project_id: newProject.id, // Novo projeto ID
          created_at: undefined,
          updated_at: undefined
        }));

        const { error: insertPermissionsError } = await supabase
          .from('role_column_permissions')
          .insert(permissionsToInsert);

        if (insertPermissionsError) throw insertPermissionsError;
      }

      toast({
        title: "Projeto clonado com sucesso!",
        description: `O projeto "${newName}" foi criado como cópia de "${project.name}"`,
      });

      fetchProjects();
    } catch (err) {
      console.error('Error cloning project:', err);
      toast({
        title: "Erro ao clonar projeto",
        description: "Não foi possível clonar o projeto",
        variant: "destructive",
      });
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logout realizado",
        description: "Você foi desconectado com sucesso",
      });
    } catch (err) {
      console.error('Error logging out:', err);
    }
  };

  const handleBackToProjects = () => {
    setSelectedProject(null);
    setShowPermissions(false);
    setShowUserManagement(false);
  };

  const openRenameDialog = (project: Project) => {
    setProjectToRename(project);
    setRenameProjectName(project.name);
    setShowRenameDialog(true);
  };

  // Renderizar gerenciamento de permissões
  if (selectedProject && showPermissions) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={handleBackToProjects}>
                  ← Voltar para Projetos
                </Button>
                <h1 className="text-xl font-bold text-gray-900">
                  Permissões - {selectedProject.name}
                </h1>
              </div>
              <Button variant="outline" onClick={() => setShowUserManagement(true)}>
                <Users className="h-4 w-4 mr-2" />
                Gerenciar Usuários
              </Button>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <RolePermissionManager project={selectedProject} />
        </div>
      </div>
    );
  }

  // Renderizar gerenciamento de usuários
  if (selectedProject && showUserManagement) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
        <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center space-x-4">
                <Button variant="ghost" onClick={handleBackToProjects}>
                  ← Voltar para Projetos
                </Button>
                <h1 className="text-xl font-bold text-gray-900">
                  Usuários - {selectedProject.name}
                </h1>
              </div>
              <Button variant="outline" onClick={() => setShowPermissions(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Configurar Permissões
              </Button>
            </div>
          </div>
        </header>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <UserRoleAssignment project={selectedProject} />
        </div>
      </div>
    );
  }

  // Renderizar grid do projeto
  if (selectedProject && !showPermissions && !showUserManagement) {
    return (
      <ProjectGrid 
        project={selectedProject} 
        onBack={handleBackToProjects}
        userRole="admin" 
      />
    );
  }

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <h1 className="text-xl font-bold text-gray-900">Project Manager Grid</h1>
              <Badge variant="secondary" className="bg-red-100 text-red-800">
                Admin
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total de Projetos</p>
                <p className="text-3xl font-bold text-blue-600">{projects.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Gerenciamento de Projetos</CardTitle>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Projeto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Projeto</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Input
                      placeholder="Nome do projeto"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    />
                    <div className="flex space-x-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={handleCreateProject}>
                        Criar
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            
            {/* Search */}
            <div className="flex items-center space-x-2 mt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar projetos..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Carregando projetos...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'Nenhum projeto encontrado' : 'Nenhum projeto criado'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? 'Tente buscar com termos diferentes' 
                    : 'Comece criando seu primeiro projeto'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredProjects.map((project) => (
                  <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h3 className="font-semibold text-lg">{project.name}</h3>
                      <p className="text-sm text-gray-600">
                        Criado em: {new Date(project.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedProject(project)}
                      >
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Abrir
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(project);
                          setShowPermissions(true);
                        }}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Permissões
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedProject(project);
                          setShowUserManagement(true);
                        }}
                      >
                        <Users className="h-4 w-4 mr-1" />
                        Usuários
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openRenameDialog(project)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Renomear
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCloneProject(project)}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Clonar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteProject(project)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Deletar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Rename Dialog */}
      <Dialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={renameProjectName}
              onChange={(e) => setRenameProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRenameProject()}
            />
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowRenameDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleRenameProject}>
                Renomear
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;