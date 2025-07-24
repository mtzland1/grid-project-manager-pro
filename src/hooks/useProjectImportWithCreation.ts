
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
          created_by: user.user.id
        })
        .select()
        .single();

      if (projectError) {
        throw projectError;
      }

      console.log('Projeto criado:', newProject);

      // Mapear os dados importados para o formato da tabela project_items
      const projectItems = projects.map(project => {
        // Extrair campos conhecidos da tabela
        const knownFields = {
          project_id: newProject.id,
          descricao: project.descricao || project.nome || '',
          qtd: Number(project.qtd) || 0,
          unidade: project.unidade || '',
          mat_uni_pr: Number(project.mat_uni_pr) || 0,
          desconto: Number(project.desconto) || 0,
          cc_mat_uni: Number(project.cc_mat_uni) || 0,
          cc_mat_total: Number(project.cc_mat_total) || 0,
          cc_mo_uni: Number(project.cc_mo_uni) || 0,
          cc_mo_total: Number(project.cc_mo_total) || 0,
          ipi: Number(project.ipi) || 0,
          vlr_total_estimado: Number(project.vlr_total_estimado) || 0,
          vlr_total_venda: Number(project.vlr_total_venda) || 0,
          distribuidor: project.distribuidor || '',
          reanalise_escopo: project.reanalise_escopo || null,
          prioridade_compra: project.prioridade_compra || null,
          reanalise_mo: project.reanalise_mo || null,
          conferencia_estoque: project.conferencia_estoque || null,
          a_comprar: project.a_comprar || null,
          comprado: project.comprado || null,
          previsao_chegada: project.previsao_chegada || null,
          expedicao: project.expedicao || null,
          cronograma_inicio: project.cronograma_inicio || null,
          data_medicoes: project.data_medicoes || null,
          data_conclusao: project.data_conclusao || null,
          manutencao: project.manutencao || null,
          status_global: project.status_global || null
        };

        // Criar um objeto com campos extras para dynamic_data
        const dynamicData = { ...project };
        
        // Remover campos conhecidos do dynamic_data para evitar duplicação
        const knownFieldKeys = [
          'descricao', 'qtd', 'unidade', 'mat_uni_pr', 'desconto', 'cc_mat_uni',
          'cc_mat_total', 'cc_mo_uni', 'cc_mo_total', 'ipi', 'vlr_total_estimado',
          'vlr_total_venda', 'distribuidor', 'reanalise_escopo', 'prioridade_compra',
          'reanalise_mo', 'conferencia_estoque', 'a_comprar', 'comprado',
          'previsao_chegada', 'expedicao', 'cronograma_inicio', 'data_medicoes',
          'data_conclusao', 'manutencao', 'status_global', 'nome'
        ];

        knownFieldKeys.forEach(key => {
          delete dynamicData[key];
        });

        return {
          ...knownFields,
          dynamic_data: dynamicData
        };
      });

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
