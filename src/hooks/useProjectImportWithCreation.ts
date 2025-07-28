
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectImport } from './useProjectImport';
import { useToast } from '@/components/ui/use-toast';

interface ProjectColumn {
  column_key: string;
  column_label: string;
  column_type: string;
  column_width: string;
  column_order: number;
  is_system_column: boolean;
  is_calculated: boolean;
}

interface ProjectItem {
  [key: string]: any;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

export const useProjectImportWithCreation = () => {
  const { importProjects, loading: importLoading, error: importError, setError } = useProjectImport();
  const [loading, setLoading] = useState(false);
  const [error, setLocalError] = useState<string | null>(null);
  const { toast } = useToast();

  const mapColumnType = (headerName: string): string => {
    const upperHeader = headerName.toUpperCase();
    
    if (upperHeader.includes('PREÇO') || upperHeader.includes('VALOR') || 
        upperHeader.includes('TOTAL') || upperHeader.includes('UNITARIO') ||
        upperHeader.includes('CC') || upperHeader.includes('VLR') ||
        upperHeader.includes('MINIIMO') || upperHeader.includes('MINIMO') ||
        upperHeader.includes('PV')) {
      return 'currency';
    }
    
    if (upperHeader.includes('QTD') || upperHeader.includes('QUANTIDADE')) {
      return 'number';
    }
    
    if (upperHeader.includes('DATA') || upperHeader.includes('PREVISAO')) {
      return 'date';
    }
    
    if (upperHeader.includes('%') || upperHeader.includes('PERCENT')) {
      return 'percentage';
    }
    
    return 'text';
  };

  const generateColumnKey = (label: string): string => {
    return label
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
  };

  const importAndCreateProject = async (
    file: File, 
    projectName: string, 
    projectDescription?: string
  ): Promise<Project> => {
    setLoading(true);
    setLocalError(null);

    try {
      console.log('=== INICIANDO IMPORTAÇÃO E CRIAÇÃO DO PROJETO ===');
      
      // 1. Importar dados do arquivo
      const projectData = await importProjects(file);
      console.log('Dados importados:', projectData);

      if (!projectData.headers || !projectData.rows) {
        throw new Error('Dados do arquivo inválidos: headers ou rows ausentes');
      }

      if (projectData.rows.length === 0) {
        throw new Error('Nenhuma linha válida encontrada no arquivo');
      }

      // 2. Criar o projeto no banco
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName,
          description: projectDescription || '',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (projectError) {
        console.error('Erro ao criar projeto:', projectError);
        throw new Error(`Erro ao criar projeto: ${projectError.message}`);
      }

      console.log('Projeto criado:', newProject);

      // 3. Criar as colunas baseadas nos headers
      const columnsToInsert: Omit<ProjectColumn, 'id' | 'created_at' | 'updated_at'>[] = 
        projectData.headers.map((header, index) => ({
          project_id: newProject.id,
          column_key: generateColumnKey(header),
          column_label: header,
          column_type: mapColumnType(header),
          column_width: '120px',
          column_order: index + 1,
          is_system_column: false,
          is_calculated: false
        }));

      console.log('Colunas a inserir:', columnsToInsert);

      // Buscar colunas existentes para obter a ordem correta
      const { data: existingColumns, error: columnsSelectError } = await supabase
        .from('project_columns')
        .select('column_key')
        .eq('project_id', newProject.id);

      if (columnsSelectError) {
        console.error('Erro ao buscar colunas existentes:', columnsSelectError);
        throw new Error(`Erro ao buscar colunas: ${columnsSelectError.message}`);
      }

      // Deletar colunas padrão se existirem
      if (existingColumns && existingColumns.length > 0) {
        const { error: deleteError } = await supabase
          .from('project_columns')
          .delete()
          .eq('project_id', newProject.id);

        if (deleteError) {
          console.error('Erro ao deletar colunas padrão:', deleteError);
          throw new Error(`Erro ao deletar colunas padrão: ${deleteError.message}`);
        }
      }

      // Inserir as novas colunas
      const { error: columnsError } = await supabase
        .from('project_columns')
        .insert(columnsToInsert);

      if (columnsError) {
        console.error('Erro ao criar colunas:', columnsError);
        throw new Error(`Erro ao criar colunas: ${columnsError.message}`);
      }

      // 4. Preparar e inserir os itens do projeto
      const itemsToInsert = projectData.rows.map((row: ProjectItem) => {
        const dynamicData: { [key: string]: any } = {};
        
        // Mapear todos os campos do row para dynamic_data
        projectData.headers.forEach((header) => {
          const columnKey = generateColumnKey(header);
          dynamicData[columnKey] = row[header] || '';
        });

        return {
          project_id: newProject.id,
          descricao: row['DESCRIÇÃO'] || row['DESCRICAO'] || '',
          qtd: parseFloat(row['QTD'] || '0') || 0,
          unidade: row['UNIDADE'] || '',
          mat_uni_pr: parseFloat(row['MINIIMO UNITARIO'] || row['MINIMO UNITARIO'] || '0') || 0,
          dynamic_data: dynamicData
        };
      });

      console.log('Itens a inserir:', itemsToInsert);

      const { error: itemsError } = await supabase
        .from('project_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error(`Erro ao inserir itens: ${itemsError.message}`);
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
      
      toast({
        title: "Projeto importado com sucesso!",
        description: `${projectData.rows.length} itens foram importados para o projeto "${projectName}".`
      });

      return newProject;

    } catch (error) {
      console.error('=== ERRO NA IMPORTAÇÃO ===', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na importação';
      setLocalError(errorMessage);
      
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive"
      });
      
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    importAndCreateProject,
    loading: loading || importLoading,
    error: error || importError,
    setError: (error: string | null) => {
      setLocalError(error);
      setError(error);
    }
  };
};
