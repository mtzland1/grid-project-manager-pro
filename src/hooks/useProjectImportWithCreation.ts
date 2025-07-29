
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
  if (upperHeader.includes('PREÇO') || upperHeader.includes('VALOR') || upperHeader.includes('TOTAL') || upperHeader.includes('UNITARIO') || upperHeader.includes('CC') || upperHeader.includes('VLR') || upperHeader.includes('PV') || upperHeader.includes('MAT') || upperHeader.includes('MINIIMO') || upperHeader.includes('MINIMO')) {
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

// 3. Função CORRIGIDA para preservar valores originais SEM conversão automática
const preserveOriginalValue = (value: string | number | null | undefined): any => {
  if (value === null || value === undefined) return null;
  
  // Se é string vazia, retorna string vazia
  if (value === '') return '';
  
  // Se já é um número, retorna como está
  if (typeof value === 'number') return value;
  
  // Para strings, retorna exatamente como está sem tentar converter
  return String(value).trim();
};

// --- HOOK PRINCIPAL TOTALMENTE CORRIGIDO ---

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
      console.log('Arquivo:', file.name);
      console.log('Nome do projeto:', projectName);
      
      // ETAPA 1: Parse do arquivo
      const projectData = await importProjects(file);
      if (!projectData || !projectData.rows || projectData.rows.length === 0) {
        throw new Error('Nenhuma linha de dados válida foi encontrada no arquivo.');
      }

      console.log('=== DADOS DO ARQUIVO PARSEADO ===');
      console.log('Headers encontrados no arquivo:', projectData.headers);
      console.log('Total de linhas válidas:', projectData.rows.length);
      console.log('Primeira linha de exemplo:', projectData.rows[0]);

      // ETAPA 2: Criação do projeto
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      console.log('=== CRIANDO PROJETO ===');
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({ name: projectName, description: projectDescription, created_by: user.id })
        .select()
        .single();

      if (projectError) throw new Error(`Erro ao criar projeto: ${projectError.message}`);
      console.log('Projeto criado com sucesso:', newProject);

      // ETAPA 3: AGUARDAR um pouco para garantir que o trigger seja executado
      await new Promise(resolve => setTimeout(resolve, 100));

      // ETAPA 4: DELETAR TODAS as colunas criadas pelo trigger (incluindo as indesejadas)
      console.log('=== REMOVENDO COLUNAS PADRÃO DO TRIGGER ===');
      const { error: deleteError } = await supabase
        .from('project_columns')
        .delete()
        .eq('project_id', newProject.id);

      if (deleteError) {
        console.error('Erro ao deletar colunas padrão:', deleteError);
        throw new Error(`Erro ao limpar colunas padrão: ${deleteError.message}`);
      }
      
      console.log('Todas as colunas padrão foram removidas com sucesso');

      // ETAPA 5: Criar APENAS as colunas que existem no CSV
      console.log('=== CRIANDO COLUNAS BASEADAS NO CSV ===');
      const columnsToInsert = projectData.headers
        .map((header, index) => {
          if (!header || header.trim() === '') {
            console.warn(`Header vazio encontrado no índice ${index}, será ignorado`);
            return null;
          }
          
          const key = generateColumnKey(header);
          if (!key) {
            console.warn(`Não foi possível gerar chave para o header: "${header}"`);
            return null;
          }
          
          console.log(`Mapeando coluna: "${header}" -> "${key}" (tipo: ${mapColumnType(header)})`);
          
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

      console.log(`Criando ${columnsToInsert.length} colunas baseadas no CSV`);
      console.log('Colunas que serão criadas:', columnsToInsert.map(col => `${col?.column_label} (${col?.column_key})`));

      if (columnsToInsert.length > 0) {
        const { data: insertedColumns, error: columnsInsertError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert)
          .select();
        
        if (columnsInsertError) {
          console.error('Erro ao inserir colunas:', columnsInsertError);
          throw new Error(`Erro ao criar colunas: ${columnsInsertError.message}`);
        }
        
        console.log(`${insertedColumns?.length} colunas criadas com sucesso`);
      }

      // ETAPA 6: Preparar mapeamento de dados
      console.log('=== PREPARANDO MAPEAMENTO DE DADOS ===');
      const headerToKeyMap = new Map<string, string>();
      projectData.headers.forEach(header => {
        if (header && header.trim() !== '') {
          const key = generateColumnKey(header);
          if (key) {
            headerToKeyMap.set(header, key);
            console.log(`Mapeamento: "${header}" -> "${key}"`);
          }
        }
      });

      // ETAPA 7: Preparar e inserir itens com valores PRESERVADOS
      console.log('=== PREPARANDO ITENS PARA INSERÇÃO ===');
      const itemsToInsert = projectData.rows.map((row: any, rowIndex: number) => {
        console.log(`\n--- Processando linha ${rowIndex + 1} ---`);
        console.log('Dados originais da linha:', row);
        
        // Criar dynamic_data preservando TODOS os valores originais
        const dynamicData: { [key: string]: any } = {};
        
        for (const header of projectData.headers) {
          if (header && header.trim() !== '') {
            const key = headerToKeyMap.get(header);
            if (key) {
              const originalValue = row[header];
              const preservedValue = preserveOriginalValue(originalValue);
              dynamicData[key] = preservedValue;
              
              console.log(`  "${header}" -> "${key}": "${originalValue}" -> "${preservedValue}"`);
            }
          }
        }

        // Função auxiliar para buscar valor da linha (SEM conversão)
        const getValueFromRow = (possibleKeys: string[]) => {
          for (const key of possibleKeys) {
            if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
              return preserveOriginalValue(row[key]);
            }
          }
          return null;
        };

        // Mapear campos obrigatórios
        const descricao = getValueFromRow(['DESCRIÇÃO', 'DESCRICAO', 'ITEM']) || 'Item importado';
        const qtd = getValueFromRow(['QTD', 'QUANTIDADE']) || 1;
        const unidade = getValueFromRow(['UNIDADE', 'UNIT']) || '';
        const mat_uni_pr = getValueFromRow(['MAT UNI - PR (R$)', 'MAT UNI PR', 'MATERIAL UNITARIO PRECO']) || 0;
        const cc_mat_uni = getValueFromRow(['CC MAT UNI (R$)', 'CC MAT UNI', 'CC_MAT_UNI']) || 0;
        const cc_mat_total = getValueFromRow(['CC MAT TOTAL (R$)', 'CC MAT TOTAL', 'CC_MAT_TOTAL']) || 0;
        const vlr_total_estimado = getValueFromRow(['VLR. TOTAL ESTIMADO', 'VLR TOTAL ESTIMADO', 'VALOR TOTAL ESTIMADO']) || 0;
        const distribuidor = getValueFromRow(['DISTRIBUIDOR']) || '';

        console.log('Valores mapeados para campos do banco:');
        console.log(`  descricao: "${descricao}"`);
        console.log(`  qtd: ${qtd}`);
        console.log(`  cc_mat_uni: ${cc_mat_uni}`);
        console.log(`  vlr_total_estimado: ${vlr_total_estimado}`);
        console.log(`  dynamic_data:`, dynamicData);

        // Criar item final
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
          distribuidor: String(distribuidor),
          dynamic_data: dynamicData
        };

        return item;
      });

      console.log(`=== INSERINDO ${itemsToInsert.length} ITENS ===`);
      
      const { data: insertedItems, error: itemsError } = await supabase
        .from('project_items')
        .insert(itemsToInsert)
        .select();

      if (itemsError) {
        console.error('Erro ao inserir itens:', itemsError);
        throw new Error(`Erro ao inserir itens: ${itemsError.message}`);
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
      console.log(`${itemsToInsert.length} itens inseridos com sucesso`);
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
