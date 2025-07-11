
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Grid3X3, LogOut, Search, Calendar, Edit, Trash2, Loader2, Users, BarChart3 } from 'lucide-react';
import ProjectGrid from '@/components/project/ProjectGrid';

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
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
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
        .insert([
          {
            name: newProjectName.trim(),
            created_by: user.id,
          }
        ])
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
      setIsCreateDialogOpen(false);
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
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite um novo nome para o projeto",
        variant: "destructive",
      });
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
      setIsRenameDialogOpen(false);
      setProjectToRename(null);
      fetchProjects();
    } catch (err) {
      console.error('Error renaming project:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível renomear o projeto",
        variant: "destructive",
      });
    }
  };

  const handleDeleteProject = async (project: Project) => {
    if (!confirm(`Tem certeza que deseja deletar o projeto "${project.name}"? Esta ação não pode ser desfeita.`)) {
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
      toast({
        title: "Erro inesperado",
        description: "Não foi possível deletar o projeto",
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

  const openRenameDialog = (project: Project) => {
    setProjectToRename(project);
    setRenameProjectName(project.name);
    setIsRenameDialogOpen(true);
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (selectedProject) {
    return (
      <ProjectGrid 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        userRole="admin"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Grid3X3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Project Manager Grid</h1>
                <p className="text-sm text-gray-500">Dashboard Administrativo</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <Users className="h-3 w-3 mr-1" />
                Administrador
              </Badge>
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
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total de Projetos</p>
                  <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-full">
                  <Grid3X3 className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Projetos Ativos</p>
                  <p className="text-3xl font-bold text-gray-900">{projects.length}</p>
                </div>
                <div className="bg-green-100 p-3 rounded-full">
                  <BarChart3 className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Criados Hoje</p>
                  <p className="text-3xl font-bold text-gray-900">
                    {projects.filter(p => 
                      new Date(p.created_at).toDateString() === new Date().toDateString()
                    ).length}
                  </p>
                </div>
                <div className="bg-purple-100 p-3 rounded-full">
                  <Calendar className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-xl">Gerenciamento de Projetos</CardTitle>
                <CardDescription>
                  Crie, edite e gerencie seus projetos de forma centralizada
                </CardDescription>
              </div>
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-indigo-600 hover:bg-indigo-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Projeto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Projeto</DialogTitle>
                    <DialogDescription>
                      Digite um nome para o novo projeto. Ele será criado com todas as colunas padrão.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="project-name">Nome do Projeto</Label>
                      <Input
                        id="project-name"
                        placeholder="Ex: Orçamento Reforma Escritório"
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateProject}>
                      Criar Projeto
                    </Button>
                  </DialogFooter>
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
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                <span className="ml-2 text-gray-600">Carregando projetos...</span>
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'Nenhum projeto encontrado' : 'Nenhum projeto criado'}
                </h3>
                <p className="text-gray-500 mb-4">
                  {searchTerm 
                    ? 'Tente buscar com termos diferentes' 
                    : 'Comece criando seu primeiro projeto'
                  }
                </p>
                {!searchTerm && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Projeto
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map((project) => (
                  <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 
                          className="font-semibold text-lg text-gray-900 hover:text-indigo-600 cursor-pointer"
                          onClick={() => setSelectedProject(project)}
                        >
                          {project.name}
                        </h3>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openRenameDialog(project)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteProject(project)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>
                          <strong>Criado em:</strong> {new Date(project.created_at).toLocaleDateString('pt-BR')}
                        </p>
                        <p>
                          <strong>Atualizado:</strong> {new Date(project.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <Button 
                        className="w-full mt-4" 
                        variant="outline"
                        onClick={() => setSelectedProject(project)}
                      >
                        Abrir Projeto
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Rename Dialog */}
      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear Projeto</DialogTitle>
            <DialogDescription>
              Digite o novo nome para o projeto "{projectToRename?.name}"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rename-project">Novo Nome</Label>
              <Input
                id="rename-project"
                value={renameProjectName}
                onChange={(e) => setRenameProjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleRenameProject()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRenameProject}>
              Renomear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
