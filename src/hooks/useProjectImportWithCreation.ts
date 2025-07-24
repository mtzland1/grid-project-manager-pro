
import { useState } from 'react';
import { useProjectImport } from './useProjectImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useProjectImportWithCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { importProjects, loading, error, setError } = useProjectImport();
  const { toast } = useToast();

  const importAndCreateProject = async (file: File, projectName: string, projectDescription?: string) => {
    setIsCreating(true);
    
    try {
      // Primeiro, importar os dados do arquivo
      const projects = await importProjects(file);
      
      if (projects.length === 0) {
        throw new Error('Nenhum projeto foi importado do arquivo');
      }
      
      // Obter o usuário atual
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Usuário não autenticado');
      }
      
      console.log('Criando projeto com nome:', projectName);
      console.log('Descrição do projeto:', projectDescription);
      
      // Criar o projeto no banco com os dados fornecidos pelo usuário
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert([
          {
            name: projectName,
            description: projectDescription || 'Projeto importado',
            created_by: user.id
          }
        ])
        .select()
        .single();
      
      if (projectError) {
        console.error('Erro ao criar projeto:', projectError);
        throw new Error(`Erro ao criar projeto: ${projectError.message}`);
      }
      
      console.log('Projeto criado com sucesso:', project);
      
      // Agora inserir os itens do projeto
      const projectItems = projects.map(item => ({
        project_id: project.id,
        descricao: item.descricao || item.description || item.desc || 'Item importado',
        qtd: parseFloat(item.qtd || item.quantidade || item.qty || '0') || 0,
        unidade: item.unidade || item.unit || item.un || '',
        mat_uni_pr: parseFloat(item.mat_uni_pr || item.preco_unitario || item.unit_price || '0') || 0,
        desconto: parseFloat(item.desconto || item.discount || '0') || 0,
        cc_mat_uni: parseFloat(item.cc_mat_uni || '0') || 0,
        cc_mat_total: parseFloat(item.cc_mat_total || '0') || 0,
        cc_mo_uni: parseFloat(item.cc_mo_uni || '0') || 0,
        cc_mo_total: parseFloat(item.cc_mo_total || '0') || 0,
        ipi: parseFloat(item.ipi || '0') || 0,
        vlr_total_estimado: parseFloat(item.vlr_total_estimado || item.valor_total || item.total || '0') || 0,
        vlr_total_venda: parseFloat(item.vlr_total_venda || item.valor_venda || '0') || 0,
        distribuidor: item.distribuidor || item.supplier || item.fornecedor || '',
        // Mapear campos adicionais se existirem
        reanalise_escopo: item.reanalise_escopo || '',
        prioridade_compra: item.prioridade_compra || '',
        reanalise_mo: item.reanalise_mo || '',
        conferencia_estoque: item.conferencia_estoque || '',
        a_comprar: item.a_comprar || '',
        comprado: item.comprado || '',
        previsao_chegada: item.previsao_chegada || null,
        expedicao: item.expedicao || '',
        cronograma_inicio: item.cronograma_inicio || null,
        data_medicoes: item.data_medicoes || null,
        data_conclusao: item.data_conclusao || null,
        manutencao: item.manutencao || '',
        status_global: item.status_global || '',
        dynamic_data: item.dynamic_data || {}
      }));
      
      console.log('Inserindo', projectItems.length, 'itens no projeto');
      
      const { error: itemsError } = await supabase
        .from('project_items')
        .insert(projectItems);
      
      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error(`Erro ao inserir itens: ${itemsError.message}`);
      }
      
      console.log('Itens inseridos com sucesso');
      
      toast({
        title: "Sucesso!",
        description: `Projeto "${projectName}" criado com ${projectItems.length} itens`,
      });
      
      return project;
      
    } catch (error) {
      console.error('Erro completo:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
      
      throw error;
    } finally {
      setIsCreating(false);
    }
  };

  return {
    importAndCreateProject,
    loading: loading || isCreating,
    error,
    setError
  };
};
