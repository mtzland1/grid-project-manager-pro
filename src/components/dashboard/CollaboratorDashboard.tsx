
import { useState, useEffect } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Grid3X3, LogOut, Search, Calendar, Loader2, Users, Eye } from 'lucide-react';
import ProjectGrid from '@/components/project/ProjectGrid';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { usePagination } from '@/hooks/usePagination';
import { ProjectPagination } from '@/components/ui/project-pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  archived: boolean;
}

interface CollaboratorDashboardProps {
  user: User;
}

const ITEMS_PER_PAGE = 6;

const CollaboratorDashboard = ({ user }: CollaboratorDashboardProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectToViewDescription, setProjectToViewDescription] = useState<Project | null>(null);
  const [showViewDescriptionDialog, setShowViewDescriptionDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();
  const { unreadCounts, markProjectMessagesAsRead } = useUnreadMessages(user);

  const fetchProjects = async () => {
    try {
      // Para colaboradores, buscar apenas projetos onde estão atribuídos E que não estão arquivados
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          user_project_roles!inner(
            user_id,
            role_name
          )
        `)
        .eq('user_project_roles.user_id', user.id)
        .eq('archived', false) // Explicitamente filtrar projetos não arquivados
        .order('updated_at', { ascending: false }); // Order by most recently updated

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

  const handleProjectOpen = (project: Project) => {
    // Marcar mensagens como lidas ao abrir o projeto
    if (unreadCounts[project.id] > 0) {
      markProjectMessagesAsRead(project.id);
    }
    setSelectedProject(project);
  };

  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const {
    currentPage,
    totalPages,
    paginatedData: paginatedProjects,
    goToPage,
    canGoNext,
    canGoPrevious,
    startIndex,
    endIndex,
    totalItems
  } = usePagination({
    data: filteredProjects,
    itemsPerPage: ITEMS_PER_PAGE
  });

  if (selectedProject) {
    return (
      <ProjectGrid 
        project={selectedProject} 
        onBack={() => setSelectedProject(null)}
        userRole="collaborator"
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-600 p-2 rounded-lg">
                <Grid3X3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Gerencidor de Projetos</h1>
                <p className="text-sm text-gray-500">Dashboard do Colaborador</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Users className="h-3 w-3 mr-1" />
                Colaborador
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Projetos Disponíveis</p>
                  <p className="text-3xl font-bold text-gray-900">{totalItems}</p>
                </div>
                <div className="bg-emerald-100 p-3 rounded-full">
                  <Grid3X3 className="h-6 w-6 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-white shadow-sm">
            <CardContent className="p-6">
              <div>
                <p className="text-sm font-medium text-gray-600">Acesso</p>
                <p className="text-3xl font-bold text-gray-900">Visualização</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Section */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <div>
              <CardTitle className="text-xl">Projetos Disponíveis</CardTitle>
              <CardDescription>
                Visualize os projetos disponíveis no sistema
              </CardDescription>
            </div>
            
            {/* Search */}
            <div className="flex items-center space-x-2 mt-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar projetos (nome ou descrição)..."
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
                <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                <span className="ml-2 text-gray-600">Carregando projetos...</span>
              </div>
            ) : totalItems === 0 ? (
              <div className="text-center py-12">
                <Grid3X3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchTerm ? 'Nenhum projeto encontrado' : 'Nenhum projeto disponível'}
                </h3>
                <p className="text-gray-500">
                  {searchTerm 
                    ? 'Tente buscar com termos diferentes' 
                    : 'Aguarde a criação de projetos pelo administrador'
                  }
                </p>
              </div>
            ) : (
              <>
                {/* Projects Info */}
                {totalItems > 0 && (
                  <div className="mb-4 text-sm text-gray-600">
                    Mostrando {startIndex + 1}-{endIndex} de {totalItems} projetos
                  </div>
                )}

                {/* Projects Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {paginatedProjects.map((project) => (
                    <Card key={project.id} className="hover:shadow-md transition-shadow cursor-pointer">
                      <CardContent className="p-6">
                        <div className="mb-3">
                          <div className="flex items-center">
                            <h3 
                              className="font-semibold text-lg text-gray-900 hover:text-emerald-600 cursor-pointer"
                              onClick={() => handleProjectOpen(project)}
                            >
                              {project.name}
                            </h3>
                            <NotificationBadge 
                              count={unreadCounts[project.id] || 0}
                              onClick={() => handleProjectOpen(project)}
                            />
                          </div>
                          {project.description && (
                            <div className="mt-2">
                              <p className="text-sm text-gray-600 line-clamp-2 max-w-md">
                                {project.description.length > 25 
                                  ? `${project.description.substring(0, 25)}...` 
                                  : project.description}
                              </p>
                              {project.description.length > 25 && (
                                <Button 
                                  variant="link" 
                                  className="text-xs p-0 h-auto mt-1 text-blue-600"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setProjectToViewDescription(project);
                                    setShowViewDescriptionDialog(true);
                                  }}
                                >
                                  Leia mais
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2 text-sm text-gray-600">
                          <p>
                            <strong>Criado em:</strong> {new Date(project.created_at).toLocaleDateString('pt-BR')}
                          </p>
                          {project.updated_at !== project.created_at && (
                            <p>
                              <strong>Atualizado:</strong> {new Date(project.updated_at).toLocaleDateString('pt-BR')}
                            </p>
                          )}
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant="outline"
                          onClick={() => handleProjectOpen(project)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar Projeto
                          {unreadCounts[project.id] > 0 && (
                            <NotificationBadge 
                              count={unreadCounts[project.id]}
                              className="ml-auto"
                            />
                          )}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Pagination */}
                <ProjectPagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  canGoPrevious={canGoPrevious}
                  canGoNext={canGoNext}
                />
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* View Description Dialog */}
      <Dialog open={showViewDescriptionDialog} onOpenChange={setShowViewDescriptionDialog}>
        <DialogContent className="max-w-2xl w-full">
          <DialogHeader>
            <DialogTitle>Descrição do Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="max-h-[60vh] overflow-y-auto p-2">
              <p className="text-sm text-gray-600 whitespace-pre-wrap break-all">
                {projectToViewDescription?.description}
              </p>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowViewDescriptionDialog(false)}>
                Fechar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollaboratorDashboard;
