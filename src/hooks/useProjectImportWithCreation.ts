
import { useState } from 'react';
import { useProjectImport } from './useProjectImport';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

export const useProjectImportWithCreation = () => {
  const [isCreating, setIsCreating] = useState(false);
  const { importProjects, loading, error, setError } = useProjectImport();
  const { toast } = useToast();

  const extractProjectName = (project: any, fileName: string): string => {
    console.log('Extracting project name from:', project);
    
    // Try multiple possible name fields in order of preference
    const possibleNameFields = [
      'nome', 'name', 'projeto', 'title', 'titulo',
      'descricao', 'description', 'descrição', 'desc',
      'item', 'codigo', 'code', 'id'
    ];
    
    let projectName = '';
    
    for (const field of possibleNameFields) {
      const value = project[field];
      if (value && typeof value === 'string' && value.trim() !== '') {
        projectName = value.trim();
        break;
      }
    }
    
    // If still no name found, create one based on the file name
    if (!projectName) {
      const baseName = fileName.replace(/\.[^/.]+$/, "");
      projectName = `Projeto Importado - ${baseName} - ${new Date().toLocaleDateString()}`;
    }
    
    console.log('Final project name:', projectName);
    return projectName;
  };

  const extractProjectDescription = (project: any): string => {
    const possibleDescFields = [
      'descricao', 'description', 'descrição',
      'observacoes', 'obs', 'notes', 'comentarios'
    ];
    
    for (const field of possibleDescFields) {
      const value = project[field];
      if (value && typeof value === 'string' && value.trim() !== '') {
        return value.trim();
      }
    }
    
    return 'Projeto importado de arquivo';
  };

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

      console.log('Projetos importados:', projects);
      
      // Usar o primeiro projeto como base para criar o projeto principal
      const mainProject = projects[0];
      
      // Extract project name with robust fallback
      const projectName = extractProjectName(mainProject, file.name);
      const projectDescription = extractProjectDescription(mainProject);
      
      // Ensure name is not empty
      if (!projectName || projectName.trim() === '') {
        throw new Error('Não foi possível extrair um nome válido para o projeto');
      }
      
      console.log('Criando projeto com nome:', projectName);
      console.log('Descrição do projeto:', projectDescription);
      
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: projectDescription,
          created_by: user.user.id
        })
        .select()
        .single();

      if (projectError) {
        console.error('Erro ao criar projeto:', projectError);
        throw projectError;
      }

      console.log('Projeto criado:', newProject);

      // Mapear os dados importados para o formato da tabela project_items
      const projectItems = projects.map(project => {
        // Extrair campos conhecidos da tabela de forma mais flexível
        const knownFields = {
          project_id: newProject.id,
          descricao: project.descricao || project.description || project.descrição || project.nome || project.name || project.item || 'Item importado',
          qtd: Number(project.qtd || project.quantidade || project.qty || project.quantity) || 1,
          unidade: project.unidade || project.unit || project.un || 'un',
          mat_uni_pr: Number(project.mat_uni_pr || project.preco_unitario || project.price || project.valor_unitario || project.miniimo_unitario || project.minimo_unitario) || 0,
          desconto: Number(project.desconto || project.discount) || 0,
          cc_mat_uni: Number(project.cc_mat_uni || project.custo_material) || 0,
          cc_mat_total: Number(project.cc_mat_total || project.custo_total_material || project.minimo_total) || 0,
          cc_mo_uni: Number(project.cc_mo_uni || project.custo_mo || project['cc_mo_uni_(r$)']) || 0,
          cc_mo_total: Number(project.cc_mo_total || project.custo_total_mo || project['cc_mo_total_(r$)']) || 0,
          ipi: Number(project.ipi) || 0,
          vlr_total_estimado: Number(project.vlr_total_estimado || project.valor_estimado || project.total_estimado || project['vlr._total_estimado'] || project.vlr_total_estimado) || 0,
          vlr_total_venda: Number(project.vlr_total_venda || project.valor_venda || project.total_venda || project.pv_total || project.pv_uni) || 0,
          distribuidor: project.distribuidor || project.fornecedor || project.supplier || project.marca || '',
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
          'descricao', 'description', 'descrição', 'nome', 'name', 'item', 'qtd', 'quantidade', 'qty', 'quantity',
          'unidade', 'unit', 'un', 'mat_uni_pr', 'preco_unitario', 'price', 'valor_unitario', 'miniimo_unitario', 'minimo_unitario',
          'desconto', 'discount', 'cc_mat_uni', 'custo_material', 'cc_mat_total', 'custo_total_material', 'minimo_total',
          'cc_mo_uni', 'custo_mo', 'cc_mo_uni_(r$)', 'cc_mo_total', 'custo_total_mo', 'cc_mo_total_(r$)', 'ipi', 
          'vlr_total_estimado', 'valor_estimado', 'total_estimado', 'vlr._total_estimado', 'vlr_total_venda', 
          'valor_venda', 'total_venda', 'pv_total', 'pv_uni', 'distribuidor', 'fornecedor', 'supplier', 'marca',
          'reanalise_escopo', 'prioridade_compra', 'reanalise_mo', 'conferencia_estoque', 'a_comprar', 'comprado',
          'previsao_chegada', 'expedicao', 'cronograma_inicio', 'data_medicoes', 'data_conclusao', 'manutencao', 'status_global'
        ];

        knownFieldKeys.forEach(key => {
          delete dynamicData[key];
        });

        return {
          ...knownFields,
          dynamic_data: dynamicData
        };
      });

      console.log('Inserindo itens do projeto:', projectItems.length);

      const { error: itemsError } = await supabase
        .from('project_items')
        .insert(projectItems);

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
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
