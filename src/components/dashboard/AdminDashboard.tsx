import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Edit, Trash2, LogOut, FolderOpen, Settings, Users, Copy, Archive, ArchiveRestore, FileText, MoreVertical, Upload } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import ProjectGrid from '@/components/project/ProjectGrid';
import RolePermissionManager from '@/components/admin/RolePermissionManager';
import UserRoleAssignment from '@/components/admin/UserRoleAssignment';
import { useUnreadMessages } from '@/hooks/useUnreadMessages';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { usePagination } from '@/hooks/usePagination';
import { ProjectPagination } from '@/components/ui/project-pagination';
import { ImportProjectDialog } from '@/components/ui/import-project-dialog';
import { useProjectImport } from '@/hooks/useProjectImport';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  archived: boolean;
  archived_at: string | null;
}

interface AdminDashboardProps {
  user: User;
}

const ITEMS_PER_PAGE = 8;

const AdminDashboard = ({ user }: AdminDashboardProps) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [showDescriptionDialog, setShowDescriptionDialog] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [renameProjectName, setRenameProjectName] = useState('');
  const [projectToRename, setProjectToRename] = useState<Project | null>(null);
  const [projectToEditDescription, setProjectToEditDescription] = useState<Project | null>(null);
  const [editDescription, setEditDescription] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const { toast } = useToast();
  const { unreadCounts, markProjectMessagesAsRead } = useUnreadMessages(user);

  const { importProjects, loading: importLoading, error: importError, setError: setImportError } = useProjectImport();

  // All hooks must be called before any conditional logic
  const activeProjects = projects.filter(project => !project.archived);
  const archivedProjects = projects.filter(project => project.archived);

  const getFilteredProjects = (projectList: Project[]) => {
    return projectList.filter(project => {
      // Add null safety checks for project name and description
      const projectName = project.name || '';
      const projectDescription = project.description || '';
      const searchTermLower = searchTerm.toLowerCase();
      
      return projectName.toLowerCase().includes(searchTermLower) ||
             projectDescription.toLowerCase().includes(searchTermLower);
    });
  };

  const filteredActiveProjects = getFilteredProjects(activeProjects);
  const filteredArchivedProjects = getFilteredProjects(archivedProjects);

  const {
    currentPage: activeCurrentPage,
    totalPages: activeTotalPages,
    paginatedData: paginatedActiveProjects,
    goToPage: activeGoToPage,
    canGoNext: activeCanGoNext,
    canGoPrevious: activeCanGoPrevious,
    startIndex: activeStartIndex,
    endIndex: activeEndIndex,
    totalItems: activeTotalItems
  } = usePagination({
    data: filteredActiveProjects,
    itemsPerPage: ITEMS_PER_PAGE
  });

  const {
    currentPage: archivedCurrentPage,
    totalPages: archivedTotalPages,
    paginatedData: paginatedArchivedProjects,
    goToPage: archivedGoToPage,
    canGoNext: archivedCanGoNext,
    canGoPrevious: archivedCanGoPrevious,
    startIndex: archivedStartIndex,
    endIndex: archivedEndIndex,
    totalItems: archivedTotalItems
  } = usePagination({
    data: filteredArchivedProjects,
    itemsPerPage: ITEMS_PER_PAGE
  });

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
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
          description: newProjectDescription.trim() || '',
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
      setNewProjectDescription('');
      setShowCreateDialog(false);
      
      setTimeout(() => {
        fetchProjects();
        setSelectedProject(data);
      }, 500);

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

  const handleUpdateDescription = async () => {
    if (!projectToEditDescription) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ description: editDescription.trim() })
        .eq('id', projectToEditDescription.id);

      if (error) {
        console.error('Error updating description:', error);
        toast({
          title: "Erro ao atualizar descrição",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Descrição atualizada!",
        description: "A descrição do projeto foi atualizada com sucesso",
      });

      setEditDescription('');
      setShowDescriptionDialog(false);
      setProjectToEditDescription(null);
      fetchProjects();
    } catch (err) {
      console.error('Error updating description:', err);
    }
  };

  const handleArchiveProject = async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          archived: true,
          archived_at: new Date().toISOString()
        })
        .eq('id', project.id);

      if (error) {
        console.error('Error archiving project:', error);
        toast({
          title: "Erro ao arquivar projeto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projeto arquivado!",
        description: `O projeto "${project.name}" foi arquivado`,
      });

      fetchProjects();
    } catch (err) {
      console.error('Error archiving project:', err);
    }
  };

  const handleUnarchiveProject = async (project: Project) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          archived: false,
          archived_at: null
        })
        .eq('id', project.id);

      if (error) {
        console.error('Error unarchiving project:', error);
        toast({
          title: "Erro ao desarquivar projeto",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projeto desarquivado!",
        description: `O projeto "${project.name}" foi desarquivado`,
      });

      fetchProjects();
    } catch (err) {
      console.error('Error unarchiving project:', err);
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
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert([{
          name: newName.trim(),
          description: project.description || '',
          created_by: user.id,
        }])
        .select()
        .single();

      if (projectError) throw projectError;

      console.log('Novo projeto criado:', newProject);

      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: originalColumns, error: originalColumnsError } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', project.id);

      if (originalColumnsError) throw originalColumnsError;

      const { data: existingColumns, error: existingColumnsError } = await supabase
        .from('project_columns')
        .select('column_key')
        .eq('project_id', newProject.id);

      if (existingColumnsError) throw existingColumnsError;

      const existingColumnKeys = new Set(existingColumns?.map(col => col.column_key) || []);

      const columnsToInsert = originalColumns
        ?.filter(col => !existingColumnKeys.has(col.column_key))
        .map(col => ({
          project_id: newProject.id,
          column_key: col.column_key,
          column_label: col.column_label,
          column_type: col.column_type,
          column_width: col.column_width,
          column_order: col.column_order,
          is_system_column: col.is_system_column,
          is_calculated: col.is_calculated
        })) || [];

      if (columnsToInsert.length > 0) {
        const { error: insertColumnsError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert);

        if (insertColumnsError) throw insertColumnsError;
        console.log('Colunas adicionais clonadas:', columnsToInsert.length);
      } else {
        console.log('Nenhuma coluna adicional para clonar (todas já existem)');
      }

      if (originalColumns && originalColumns.length > 0) {
        for (const originalCol of originalColumns) {
          if (existingColumnKeys.has(originalCol.column_key)) {
            const { error: updateError } = await supabase
              .from('project_columns')
              .update({
                column_label: originalCol.column_label,
                column_type: originalCol.column_type,
                column_width: originalCol.column_width,
                column_order: originalCol.column_order,
                is_calculated: originalCol.is_calculated
              })
              .eq('project_id', newProject.id)
              .eq('column_key', originalCol.column_key);

            if (updateError) throw updateError;
          }
        }
        console.log('Configurações das colunas existentes atualizadas');
      }

      const { data: permissions, error: permissionsError } = await supabase
        .from('role_column_permissions')
        .select('*')
        .eq('project_id', project.id);

      if (permissionsError) throw permissionsError;

      if (permissions && permissions.length > 0) {
        const permissionsToInsert = permissions.map(perm => ({
          project_id: newProject.id,
          role_name: perm.role_name,
          column_key: perm.column_key,
          permission_level: perm.permission_level
        }));

        const { error: insertPermissionsError } = await supabase
          .from('role_column_permissions')
          .insert(permissionsToInsert);

        if (insertPermissionsError) throw insertPermissionsError;
        console.log('Permissões clonadas:', permissionsToInsert.length);
      }

      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_project_roles')
        .select('*')
        .eq('project_id', project.id);

      if (userRolesError) throw userRolesError;

      if (userRoles && userRoles.length > 0) {
        const userRolesToInsert = userRoles.map(userRole => ({
          user_id: userRole.user_id,
          project_id: newProject.id,
          role_name: userRole.role_name,
          assigned_by: user.id
        }));

        const { error: insertUserRolesError } = await supabase
          .from('user_project_roles')
          .insert(userRolesToInsert);

        if (insertUserRolesError) throw insertUserRolesError;
        console.log('Usuários e roles clonados:', userRolesToInsert.length);
      }

      toast({
        title: "Projeto clonado com sucesso!",
        description: `O projeto "${newName}" foi criado como uma cópia estrutural de "${project.name}". Os dados e chat não foram copiados, o projeto está limpo e pronto para uso.`,
      });

      fetchProjects();
    } catch (err) {
      console.error('Error cloning project:', err);
      toast({
        title: "Erro ao clonar projeto",
        description: "Não foi possível clonar o projeto. Verifique o console para mais detalhes.",
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

  const openDescriptionDialog = (project: Project) => {
    setProjectToEditDescription(project);
    setEditDescription(project.description || '');
    setShowDescriptionDialog(true);
  };

  const handleProjectOpen = (project: Project) => {
    if (unreadCounts[project.id] > 0) {
      markProjectMessagesAsRead(project.id);
    }
    setSelectedProject(project);
  };

  const handleImportProject = async (file: File) => {
    try {
      const projects = await importProjects(file);
      console.log('Projetos importados:', projects);
      
      // Salvar os projetos no banco de dados
      const projectsToInsert = projects.map(project => ({
        name: project.name,
        description: project.description || '',
        created_by: user.id,
      }));

      const { data, error } = await supabase
        .from('projects')
        .insert(projectsToInsert)
        .select();

      if (error) {
        console.error('Erro ao salvar projetos:', error);
        toast({
          title: "Erro ao salvar projetos",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Projetos importados com sucesso!",
        description: `${projects.length} projetos foram importados e salvos`,
      });

      // Recarregar a lista de projetos
      fetchProjects();
    } catch (error) {
      console.error('Erro na importação:', error);
      toast({
        title: "Erro na importação",
        description: "Não foi possível importar os projetos",
        variant: "destructive",
      });
    }
  };

  // Now handle conditional rendering AFTER all hooks have been called
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

  if (selectedProject && !showPermissions && !showUserManagement) {
    return (
      <ProjectGrid 
        project={selectedProject} 
        onBack={handleBackToProjects}
        userRole="admin" 
      />
    );
  }

  const ProjectList = ({ projectList, isArchived = false, pagination }: { 
    projectList: Project[], 
    isArchived?: boolean,
    pagination: any 
  }) => (
    <div className="space-y-4">
      {pagination.totalItems > 0 && (
        <div className="mb-4 text-sm text-gray-600">
          Mostrando {pagination.startIndex + 1}-{pagination.endIndex} de {pagination.totalItems} projetos
        </div>
      )}

      {projectList.map((project) => (
        <div key={project.id} className="flex items-start justify-between p-4 border rounded-lg">
          <div className="flex-1">
            <div className="flex items-center">
              <h3 className="font-semibold text-lg">{project.name || 'Projeto sem nome'}</h3>
              <NotificationBadge 
                count={unreadCounts[project.id] || 0}
                onClick={() => handleProjectOpen(project)}
              />
              {isArchived && (
                <Badge variant="secondary" className="ml-2 bg-gray-100 text-gray-600">
                  Arquivado
                </Badge>
              )}
            </div>
            {project.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2 max-w-md">
                {project.description}
              </p>
            )}
            <p className="text-sm text-gray-500 mt-2">
              Criado em: {new Date(project.created_at).toLocaleDateString('pt-BR')}
              {project.updated_at !== project.created_at && (
                <span className="ml-2">
                  • Atualizado em: {new Date(project.updated_at).toLocaleDateString('pt-BR')}
                </span>
              )}
              {isArchived && project.archived_at && (
                <span className="ml-2">
                  • Arquivado em: {new Date(project.archived_at).toLocaleDateString('pt-BR')}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex flex-wrap gap-2 ml-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleProjectOpen(project)}
            >
              <FolderOpen className="h-4 w-4 mr-1" />
              Abrir
            </Button>
            
            {!isArchived && (
              <>
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
              </>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {!isArchived && (
                  <>
                    <DropdownMenuItem onClick={() => openDescriptionDialog(project)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Descrição
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openRenameDialog(project)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Renomear
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleCloneProject(project)}>
                      <Copy className="h-4 w-4 mr-2" />
                      Clonar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => handleArchiveProject(project)}
                      className="text-orange-600 focus:text-orange-700"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      Arquivar
                    </DropdownMenuItem>
                  </>
                )}
                
                {isArchived && (
                  <>
                    <DropdownMenuItem 
                      onClick={() => handleUnarchiveProject(project)}
                      className="text-green-600 focus:text-green-700"
                    >
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      Desarquivar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                
                <DropdownMenuItem 
                  onClick={() => handleDeleteProject(project)}
                  className="text-red-600 focus:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      ))}

      <ProjectPagination
        currentPage={pagination.currentPage}
        totalPages={pagination.totalPages}
        onPageChange={pagination.goToPage}
        canGoPrevious={pagination.canGoPrevious}
        canGoNext={pagination.canGoNext}
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Projetos Ativos</p>
                <p className="text-3xl font-bold text-blue-600">{activeProjects.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Projetos Arquivados</p>
                <p className="text-3xl font-bold text-gray-600">{archivedProjects.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <p className="text-sm text-gray-600">Total de Projetos</p>
                <p className="text-3xl font-bold text-green-600">{projects.length}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Gerenciamento de Projetos</CardTitle>
              <div className="flex items-center space-x-2">
                <ImportProjectDialog onImport={handleImportProject} />
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
                        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleCreateProject()}
                      />
                      <Textarea
                        placeholder="Descrição do projeto (opcional)"
                        value={newProjectDescription}
                        onChange={(e) => setNewProjectDescription(e.target.value)}
                        rows={3}
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
            </div>
            
            {/* Error message for import */}
            {importError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-red-800">{importError}</p>
                <button 
                  onClick={() => setImportError(null)}
                  className="text-red-600 hover:text-red-800 text-sm underline"
                >
                  Fechar
                </button>
              </div>
            )}
            
            {/* Loading indicator for import */}
            {importLoading && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-blue-800">Processando arquivo...</p>
              </div>
            )}
            
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
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="active">
                  Projetos Ativos ({activeTotalItems})
                </TabsTrigger>
                <TabsTrigger value="archived">
                  Arquivados ({archivedTotalItems})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="active" className="mt-6">
                {loading ? (
                  <div className="text-center py-8">Carregando projetos...</div>
                ) : activeTotalItems === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'Nenhum projeto ativo encontrado' : 'Nenhum projeto ativo'}
                    </h3>
                    <p className="text-gray-500 mb-4">
                      {searchTerm 
                        ? 'Tente buscar com termos diferentes' 
                        : 'Comece criando seu primeiro projeto'
                      }
                    </p>
                  </div>
                ) : (
                  <ProjectList 
                    projectList={paginatedActiveProjects} 
                    pagination={{
                      currentPage: activeCurrentPage,
                      totalPages: activeTotalPages,
                      goToPage: activeGoToPage,
                      canGoPrevious: activeCanGoPrevious,
                      canGoNext: activeCanGoNext,
                      startIndex: activeStartIndex,
                      endIndex: activeEndIndex,
                      totalItems: activeTotalItems
                    }}
                  />
                )}
              </TabsContent>
              
              <TabsContent value="archived" className="mt-6">
                {loading ? (
                  <div className="text-center py-8">Carregando projetos arquivados...</div>
                ) : archivedTotalItems === 0 ? (
                  <div className="text-center py-12">
                    <Archive className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      {searchTerm ? 'Nenhum projeto arquivado encontrado' : 'Nenhum projeto arquivado'}
                    </h3>
                    <p className="text-gray-500">
                      {searchTerm 
                        ? 'Tente buscar com termos diferentes' 
                        : 'Projetos arquivados aparecerão aqui'
                      }
                    </p>
                  </div>
                ) : (
                  <ProjectList 
                    projectList={paginatedArchivedProjects} 
                    isArchived={true}
                    pagination={{
                      currentPage: archivedCurrentPage,
                      totalPages: archivedTotalPages,
                      goToPage: archivedGoToPage,
                      canGoPrevious: archivedCanGoPrevious,
                      canGoNext: archivedCanGoNext,
                      startIndex: archivedStartIndex,
                      endIndex: archivedEndIndex,
                      totalItems: archivedTotalItems
                    }}
                  />
                )}
              </TabsContent>
            </Tabs>
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

      {/* Description Dialog */}
      <Dialog open={showDescriptionDialog} onOpenChange={setShowDescriptionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Descrição do Projeto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Descrição do projeto..."
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              rows={4}
            />
            <div className="flex space-x-2">
              <Button variant="outline" onClick={() => setShowDescriptionDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleUpdateDescription}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminDashboard;
