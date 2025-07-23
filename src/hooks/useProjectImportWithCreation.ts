
import { useState } from 'react';
import { useProjectImport } from './useProjectImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const useProjectImportWithCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { importProjects, loading, error, setError } = useProjectImport();
  const { toast } = useToast();

  const importAndCreateProject = async (file: File) => {
    setIsCreating(true);
    
    try {
      // Importar dados do arquivo
      const projects = await importProjects(file);
      
      if (projects.length === 0) {
        throw new Error('Nenhum projeto válido encontrado no arquivo');
      }

      // Criar projeto no Supabase
      const { data: user } = await supabase.auth.getUser();
      
      if (!user.user) {
        throw new Error('Usuário não autenticado');
      }

      // Usar o primeiro projeto como base para criar o projeto principal
      const mainProject = projects[0];
      
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: mainProject.nome || 'Projeto Importado',
          description: mainProject.descricao || 'Projeto importado de arquivo',
          status: mainProject.status || 'planning',
          start_date: mainProject.data_inicio || null,
          end_date: mainProject.data_fim || null,
          created_by: user.user.id
        })
        .select()
        .single();

      if (projectError) {
        throw projectError;
      }

      console.log('Projeto criado:', newProject);

      // Inserir os itens do projeto
      const projectItems = projects.map(project => ({
        project_id: newProject.id,
        dynamic_data: project
      }));

      const { error: itemsError } = await supabase
        .from('project_items')
        .insert(projectItems);

      if (itemsError) {
        throw itemsError;
      }

      toast({
        title: "Projeto importado com sucesso!",
        description: `${projects.length} itens foram importados para o projeto "${newProject.name}"`,
      });

      return newProject;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('Erro na importação:', errorMessage);
      
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    importAndCreateProject,
    isCreating,
    loading: loading || isCreating,
    error,
    setError
  };
};
