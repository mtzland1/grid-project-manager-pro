
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectImport } from './useProjectImport';
import { useToast } from '@/components/ui/use-toast';

// Tipos para clareza
interface Project {
  id: string;
  name: string;
}

// --- FUNÇÕES AUXILIARES CORRIGIDAS ---

// 1. Função para normalizar chaves de coluna de forma consistente
const generateColumnKey = (label: string): string => {
  if (!label) return '';
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
};

// 2. Função para mapear tipo de dado com base no nome do header
const mapColumnType = (headerName: string): string => {
  const upperHeader = headerName.toUpperCase();
  if (upperHeader.includes('PREÇO') || upperHeader.includes('VALOR') || upperHeader.includes('TOTAL') || upperHeader.includes('UNITARIO') || upperHeader.includes('CC') || upperHeader.includes('VLR') || upperHeader.includes('PV')) {
    return 'currency';
  }
  if (upperHeader.includes('QTD') || upperHeader.includes('QUANTIDADE')) {
    return 'number';
  }
  return 'text';
};

// 3. Função CORRIGIDA para preservar valores originais
const parseValue = (value: string | number | null | undefined): any => {
  if (value === null || value === undefined || value === '') return '';
  
  // Se já é um número, retorna como está
  if (typeof value === 'number') return value;
  
  const stringValue = String(value).trim();
  
  // Se é uma string vazia, retorna vazia
  if (!stringValue) return '';
  
  // Tenta converter para número apenas se parece com número
  if (/^-?\d*[.,]?\d+$/.test(stringValue.replace(/\s/g, ''))) {
    const cleanValue = stringValue
      .replace(/\s/g, '')
      .replace("R$", "")
      .replace(/\./g, "")
      .replace(",", ".");
    
    const number = parseFloat(cleanValue);
    return isNaN(number) ? stringValue : number;
  }
  
  // Caso contrário, retorna o valor original como string
  return stringValue;
};

// --- HOOK PRINCIPAL CORRIGIDO ---

export const useProjectImportWithCreation = () => {
  const { importProjects, loading: importLoading, error: importError, setError } = useProjectImport();
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const importAndCreateProject = async (
    file: File,
    projectName: string,
    projectDescription?: string
  ): Promise<Project> => {
    setLoading(true);

    try {
      console.log('=== INICIANDO IMPORTAÇÃO ===');
      
      // ETAPA 1: Parse do arquivo
      const projectData = await importProjects(file);
      if (!projectData || !projectData.rows || projectData.rows.length === 0) {
        throw new Error('Nenhuma linha de dados válida foi encontrada no arquivo.');
      }

      console.log('Headers encontrados:', projectData.headers);
      console.log('Primeira linha de dados:', projectData.rows[0]);

      // ETAPA 2: Criação do projeto
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({ name: projectName, description: projectDescription, created_by: user.id })
        .select()
        .single();

      if (projectError) throw new Error(`Erro ao criar projeto: ${projectError.message}`);

      console.log('Projeto criado:', newProject);

      // ETAPA 3: CORREÇÃO - Criar APENAS as colunas que existem no arquivo
      // Primeiro, limpar todas as colunas existentes do projeto
      const { error: deleteColumnsError } = await supabase
        .from('project_columns')
        .delete()
        .eq('project_id', newProject.id);

      if (deleteColumnsError) {
        console.warn('Aviso ao deletar colunas existentes:', deleteColumnsError.message);
      }

      // Criar apenas as colunas que existem no arquivo CSV
      const columnsToInsert = projectData.headers
        .map((header, index) => {
          const key = generateColumnKey(header);
          if (!key) {
            console.warn(`Header vazio ou inválido encontrado: "${header}". Será ignorado.`);
            return null;
          }
          return {
            project_id: newProject.id,
            column_key: key,
            column_label: header,
            column_type: mapColumnType(header),
            column_width: '150px',
            column_order: index + 1,
            is_system_column: false
          };
        })
        .filter(col => col !== null);

      console.log('Colunas a serem criadas:', columnsToInsert);

      if (columnsToInsert.length > 0) {
        const { error: columnsInsertError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert);
        if (columnsInsertError) throw new Error(`Erro ao criar colunas: ${columnsInsertError.message}`);
      }

      // ETAPA 4: CORREÇÃO - Preparação e Inserção dos Itens preservando valores originais
      const headerToKeyMap = new Map<string, string>();
      projectData.headers.forEach(header => {
        const key = generateColumnKey(header);
        if (key) {
          headerToKeyMap.set(header, key);
        }
      });

      console.log('Mapeamento header->key:', Object.fromEntries(headerToKeyMap));

      const itemsToInsert = projectData.rows.map((row: any, rowIndex: number) => {
        console.log(`Processando linha ${rowIndex + 1}:`, row);
        
        const dynamicData: { [key: string]: any } = {};
        
        // Processar todos os headers do arquivo
        for (const header of projectData.headers) {
          const key = headerToKeyMap.get(header);
          if (key && key.trim() !== '') {
            const originalValue = row[header];
            const processedValue = parseValue(originalValue);
            dynamicData[key] = processedValue;
            
            console.log(`  ${header} -> ${key}: "${originalValue}" -> "${processedValue}"`);
          }
        }

        // Definir apenas os campos obrigatórios do banco com valores padrão
        const item = {
          project_id: newProject.id,
          descricao: parseValue(row['DESCRIÇÃO'] || row['DESCRICAO'] || row['ITEM'] || '') || 'Item importado',
          qtd: 1, // Valor padrão
          unidade: parseValue(row['UNIDADE'] || row['UNIT'] || '') || '',
          mat_uni_pr: 0, // Valor padrão
          cc_mat_uni: 0, // Valor padrão
          cc_mat_total: 0, // Valor padrão
          cc_mo_uni: 0, // Valor padrão
          cc_mo_total: 0, // Valor padrão
          ipi: 0, // Valor padrão
          cc_pis_cofins: 0, // Valor padrão
          cc_icms_pr: 0, // Valor padrão
          cc_icms_revenda: 0, // Valor padrão
          cc_lucro_porcentagem: 0, // Valor padrão
          cc_lucro_valor: 0, // Valor padrão
          cc_encargos_valor: 0, // Valor padrão
          cc_total: 0, // Valor padrão
          vlr_total_estimado: 0, // Valor padrão
          vlr_total_venda: 0, // Valor padrão
          distribuidor: '',
          dynamic_data: dynamicData // TODOS os dados ficam aqui
        };

        console.log(`Item final linha ${rowIndex + 1}:`, item);
        return item;
      });

      console.log('Total de itens a inserir:', itemsToInsert.length);

      const { error: itemsError } = await supabase.from('project_items').insert(itemsToInsert);
      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error(`Erro ao inserir itens: ${itemsError.message}`);
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');

      toast({
        title: "Projeto importado com sucesso!",
        description: `${itemsToInsert.length} itens foram importados para "${projectName}".`
      });

      return newProject;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido na importação';
      console.error('=== ERRO FINAL NA IMPORTAÇÃO ===', error);
      toast({ title: "Erro na Importação", description: errorMessage, variant: "destructive" });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    importAndCreateProject,
    loading: loading || importLoading,
    error: importError,
    setError
  };
};
