
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Upload, Users, FileText, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import ProjectGrid from '../project/ProjectGrid';
import FileUploadModal from '../admin/FileUploadModal';

const AdminDashboard = () => {
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: projects, isLoading, refetch } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => {
      const [projectsResult, itemsResult, usersResult] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }),
        supabase.from('project_items').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true })
      ]);

      return {
        projects: projectsResult.count || 0,
        items: itemsResult.count || 0,
        users: usersResult.count || 0,
      };
    },
  });

  const handleCreateProject = async () => {
    const projectName = prompt('Nome do projeto:');
    if (!projectName) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName,
            created_by: user.id,
          },
        ]);

      if (error) throw error;

      toast({
        title: 'Projeto criado com sucesso!',
        description: `O projeto "${projectName}" foi criado.`,
      });

      refetch();
    } catch (error) {
      toast({
        title: 'Erro ao criar projeto',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    }
  };

  const handleUploadClick = (projectId: string) => {
    setSelectedProjectId(projectId);
    setShowFileUpload(true);
  };

  const handleUploadComplete = () => {
    toast({
      title: 'Upload concluído!',
      description: 'Os dados foram importados com sucesso.',
    });
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Administrativo</h1>
        <div className="flex gap-2">
          <Button onClick={handleCreateProject} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
          <Button 
            onClick={() => navigate('/admin/roles')} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <Settings className="h-4 w-4" />
            Gerenciar Roles
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.projects || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Upload className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.items || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Projetos</CardTitle>
          <CardDescription>
            Gerencie todos os projetos do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectGrid 
            projects={projects || []} 
            onUploadClick={handleUploadClick}
            showUploadButton={true}
          />
        </CardContent>
      </Card>

      {/* File Upload Modal */}
      <FileUploadModal
        isOpen={showFileUpload}
        onClose={() => setShowFileUpload(false)}
        projectId={selectedProjectId}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
};

export default AdminDashboard;
