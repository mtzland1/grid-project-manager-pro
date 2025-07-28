
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectImport } from './useProjectImport';

export const useProjectImportWithCreation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { importProjects } = useProjectImport();

  const importAndCreateProject = async (file: File, projectName: string, projectDescription?: string) => {
    setLoading(true);
    setError(null);

    try {
      console.log('Iniciando importação do projeto:', { projectName, projectDescription });

      // Valida se o nome do projeto é válido
      if (!projectName || typeof projectName !== 'string' || projectName.trim().length < 3) {
        throw new Error('Nome do projeto deve ter pelo menos 3 caracteres');
      }

      // Importa os dados do arquivo
      const importedData = await importProjects(file);
      console.log('Dados importados:', importedData);

      if (!importedData || importedData.length === 0) {
        throw new Error('Nenhum dado válido encontrado no arquivo');
      }

      // Cria o projeto
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: projectName.trim(),
          description: projectDescription?.trim() || '',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (projectError) {
        console.error('Erro ao criar projeto:', projectError);
        throw new Error('Erro ao criar projeto: ' + projectError.message);
      }

      console.log('Projeto criado:', project);

      // Obtém as colunas do primeiro item para definir a estrutura
      const sampleData = importedData[0];
      const columnKeys = Object.keys(sampleData);
      
      // Remove as colunas padrão do sistema que já existem
      const systemColumns = [
        'descricao', 'qtd', 'unidade', 'mat_uni_pr', 'desconto', 'cc_mat_uni', 'cc_mat_total',
        'cc_mo_uni', 'cc_mo_total', 'ipi', 'vlr_total_estimado', 'vlr_total_venda', 'distribuidor',
        'reanalise_escopo', 'prioridade_compra', 'reanalise_mo', 'conferencia_estoque', 'a_comprar',
        'comprado', 'previsao_chegada', 'expedicao', 'cronograma_inicio', 'data_medicoes',
        'data_conclusao', 'manutencao', 'status_global'
      ];

      // Criar colunas personalizadas para campos que não são do sistema
      const customColumns = columnKeys.filter(key => !systemColumns.includes(key));
      
      if (customColumns.length > 0) {
        const columnsToInsert = customColumns.map((key, index) => ({
          project_id: project.id,
          column_key: key,
          column_label: key.charAt(0).toUpperCase() + key.slice(1),
          column_type: 'text',
          column_width: '120px',
          column_order: 100 + index, // Ordem alta para aparecer depois das colunas do sistema
          is_system_column: false,
          is_calculated: false
        }));

        const { error: columnsError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert);

        if (columnsError) {
          console.error('Erro ao criar colunas personalizadas:', columnsError);
          throw new Error('Erro ao criar colunas personalizadas: ' + columnsError.message);
        }
      }

      // Filtra as linhas válidas (remove linhas com item nulo ou vazio)
      const validItems = importedData.filter(item => {
        const itemValue = item.item || item.descricao || '';
        return itemValue !== null && itemValue !== undefined && itemValue.toString().trim() !== '';
      });

      console.log(`Filtrando itens: ${importedData.length} itens originais, ${validItems.length} itens válidos`);

      if (validItems.length === 0) {
        throw new Error('Nenhum item válido encontrado no arquivo. Verifique se há dados na coluna "item" ou "descricao".');
      }

      // Converte os dados para o formato esperado pela tabela project_items
      const itemsToInsert = validItems.map(item => {
        const baseItem = {
          project_id: project.id,
          descricao: item.descricao || item.item || '',
          qtd: parseFloat(item.qtd || '0') || 0,
          unidade: item.unidade || '',
          mat_uni_pr: parseFloat(item.mat_uni_pr || '0') || 0,
          desconto: parseFloat(item.desconto || '0') || 0,
          cc_mat_uni: parseFloat(item.cc_mat_uni || '0') || 0,
          cc_mat_total: parseFloat(item.cc_mat_total || '0') || 0,
          cc_mo_uni: parseFloat(item.cc_mo_uni || '0') || 0,
          cc_mo_total: parseFloat(item.cc_mo_total || '0') || 0,
          ipi: parseFloat(item.ipi || '0') || 0,
          vlr_total_estimado: parseFloat(item.vlr_total_estimado || '0') || 0,
          vlr_total_venda: parseFloat(item.vlr_total_venda || '0') || 0,
          distribuidor: item.distribuidor || '',
          reanalise_escopo: item.reanalise_escopo || null,
          prioridade_compra: item.prioridade_compra || null,
          reanalise_mo: item.reanalise_mo || null,
          conferencia_estoque: item.conferencia_estoque || null,
          a_comprar: item.a_comprar || null,
          comprado: item.comprado || null,
          previsao_chegada: item.previsao_chegada || null,
          expedicao: item.expedicao || null,
          cronograma_inicio: item.cronograma_inicio || null,
          data_medicoes: item.data_medicoes || null,
          data_conclusao: item.data_conclusao || null,
          manutencao: item.manutencao || null,
          status_global: item.status_global || null
        };

        // Adiciona dados customizados para campos que não são do sistema
        const dynamicData: Record<string, any> = {};
        customColumns.forEach(key => {
          if (item[key] !== undefined) {
            dynamicData[key] = item[key];
          }
        });

        return {
          ...baseItem,
          dynamic_data: dynamicData
        };
      });

      // Insere os itens no banco
      const { error: itemsError } = await supabase
        .from('project_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error('Erro ao inserir itens: ' + itemsError.message);
      }

      console.log(`Projeto importado com sucesso: ${validItems.length} itens inseridos`);

      return project;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na importação';
      console.error('Erro na importação:', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    importAndCreateProject,
    loading,
    error,
    setError
  };
};
