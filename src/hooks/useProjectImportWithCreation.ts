
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
  if (upperHeader.includes('DATA') || upperHeader.includes('PREVISÃO') || upperHeader.includes('CRONOGRAMA')) {
    return 'date';
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
      console.log('=== INICIANDO IMPORTAÇÃO CORRIGIDA ===');
      
      // ETAPA 1: Parse do arquivo
      const projectData = await importProjects(file);
      if (!projectData || !projectData.rows || projectData.rows.length === 0) {
        throw new Error('Nenhuma linha de dados válida foi encontrada no arquivo.');
      }

      console.log('Headers do CSV:', projectData.headers);
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

      // ETAPA 3: CORREÇÃO CRÍTICA - Deletar TODAS as colunas padrão criadas automaticamente
      console.log('Deletando colunas padrão criadas automaticamente...');
      const { error: deleteAllColumnsError } = await supabase
        .from('project_columns')
        .delete()
        .eq('project_id', newProject.id);

      if (deleteAllColumnsError) {
        console.error('Erro ao deletar colunas padrão:', deleteAllColumnsError.message);
      } else {
        console.log('Colunas padrão deletadas com sucesso');
      }

      // ETAPA 4: Criar APENAS as colunas que existem no arquivo CSV
      const columnsToInsert = projectData.headers
        .map((header, index) => {
          const key = generateColumnKey(header);
          if (!key) {
            console.warn(`Header vazio ou inválido encontrado: "${header}". Será ignorado.`);
            return null;
          }
          console.log(`Criando coluna: "${header}" -> "${key}"`);
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

      console.log('Total de colunas a criar:', columnsToInsert.length);
      console.log('Colunas que serão criadas:', columnsToInsert.map(col => col?.column_label));

      if (columnsToInsert.length > 0) {
        const { data: insertedColumns, error: columnsInsertError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert)
          .select();
        
        if (columnsInsertError) throw new Error(`Erro ao criar colunas: ${columnsInsertError.message}`);
        console.log('Colunas inseridas com sucesso:', insertedColumns?.length);
      }

      // ETAPA 5: CORREÇÃO - Mapeamento direto dos dados do CSV
      const headerToKeyMap = new Map<string, string>();
      projectData.headers.forEach(header => {
        const key = generateColumnKey(header);
        if (key) {
          headerToKeyMap.set(header, key);
        }
      });

      console.log('Mapeamento header->key:', Object.fromEntries(headerToKeyMap));

      // ETAPA 6: Preparar itens com valores corretos
      const itemsToInsert = projectData.rows.map((row: any, rowIndex: number) => {
        console.log(`\n--- Processando linha ${rowIndex + 1} ---`);
        console.log('Dados da linha:', row);
        
        const dynamicData: { [key: string]: any } = {};
        
        // Processar TODOS os headers do arquivo e mapear corretamente
        for (const header of projectData.headers) {
          const key = headerToKeyMap.get(header);
          if (key && key.trim() !== '') {
            const originalValue = row[header];
            const processedValue = parseValue(originalValue);
            dynamicData[key] = processedValue;
            
            console.log(`  "${header}" -> "${key}": "${originalValue}" -> "${processedValue}"`);
          }
        }

        // CORREÇÃO CRÍTICA: Mapear valores específicos para campos obrigatórios
        const getValueFromRow = (possibleKeys: string[]) => {
          for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              return parseValue(row[key]);
            }
          }
          return null;
        };

        const descricao = getValueFromRow(['DESCRIÇÃO', 'DESCRICAO', 'ITEM']) || 'Item importado';
        const qtd = getValueFromRow(['QTD', 'QUANTIDADE']) || 1;
        const unidade = getValueFromRow(['UNIDADE', 'UNIT']) || '';
        const mat_uni_pr = getValueFromRow(['MAT UNI - PR (R$)', 'MAT UNI PR', 'MATERIAL UNITARIO PRECO']) || 0;
        const cc_mat_uni = getValueFromRow(['CC MAT UNI (R$)', 'CC MAT UNI', 'CC_MAT_UNI']) || 0;
        const cc_mat_total = getValueFromRow(['CC MAT TOTAL (R$)', 'CC MAT TOTAL', 'CC_MAT_TOTAL']) || 0;
        const vlr_total_estimado = getValueFromRow(['VLR. TOTAL ESTIMADO', 'VLR TOTAL ESTIMADO', 'VALOR TOTAL ESTIMADO']) || 0;

        console.log('Valores mapeados:');
        console.log(`  descricao: "${descricao}"`);
        console.log(`  qtd: ${qtd}`);
        console.log(`  cc_mat_uni: ${cc_mat_uni}`);
        console.log(`  cc_mat_total: ${cc_mat_total}`);
        console.log(`  vlr_total_estimado: ${vlr_total_estimado}`);

        const item = {
          project_id: newProject.id,
          descricao: String(descricao),
          qtd: Number(qtd) || 1,
          unidade: String(unidade),
          mat_uni_pr: Number(mat_uni_pr) || 0,
          cc_mat_uni: Number(cc_mat_uni) || 0,
          cc_mat_total: Number(cc_mat_total) || 0,
          cc_mo_uni: 0,
          cc_mo_total: 0,
          ipi: 0,
          cc_pis_cofins: 0,
          cc_icms_pr: 0,
          cc_icms_revenda: 0,
          cc_lucro_porcentagem: 0,
          cc_lucro_valor: 0,
          cc_encargos_valor: 0,
          cc_total: 0,
          vlr_total_estimado: Number(vlr_total_estimado) || 0,
          vlr_total_venda: 0,
          distribuidor: getValueFromRow(['DISTRIBUIDOR']) || '',
          dynamic_data: dynamicData
        };

        console.log(`Item final linha ${rowIndex + 1}:`, item);
        return item;
      });

      console.log('Total de itens a inserir:', itemsToInsert.length);

      const { data: insertedItems, error: itemsError } = await supabase
        .from('project_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error(`Erro ao inserir itens: ${itemsError.message}`);
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
      console.log(`${itemsToInsert.length} itens inseridos`);
      console.log('Primeiros itens inseridos:', insertedItems?.slice(0, 2));

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
