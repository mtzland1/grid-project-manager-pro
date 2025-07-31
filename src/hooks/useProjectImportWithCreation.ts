
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
  
  // Mapeamentos específicos para garantir compatibilidade com as colunas do trigger
  const specificMappings: { [key: string]: string } = {
    'MAT UNI - PR (R$)': 'mat_uni_pr',
    'CC MAT UNI (R$)': 'cc_mat_uni', 
    'CC MAT TOTAL (R$)': 'cc_mat_total',
    'IPI (R$):': 'ipi',
    'IPI': 'ipi',
    'VLR. TOTAL ESTIMADO': 'vlr_total_estimado',
    'VALOR TOTAL ESTIMADO': 'vlr_total_estimado',
    'Reanalise escop': 'reanalise_escopo',
    'Reanalise Escopo': 'reanalise_escopo', 
    'Previsão de chegada': 'previsao_chegada',
    'PREVISÃO DE CHEGADA': 'previsao_chegada',
    'DESCRIÇÃO': 'descricao',
    'ITEM': 'item',
    'QTD': 'qtd',
    'QUANTIDADE': 'qtd',
    'UNIDADE': 'unidade',
    'Desconto (%)': 'desconto',
    'DESCONTO (%)': 'desconto',
    'DISTRIBUIDOR': 'distribuidor',
    'Prioridade compra': 'prioridade_compra',
    'PRIORIDADE COMPRA': 'prioridade_compra',
    'Reanalise MO': 'reanalise_mo',
    'REANALISE MO': 'reanalise_mo',
    'Conferencia estoque': 'conferencia_estoque',
    'CONFERENCIA ESTOQUE': 'conferencia_estoque',
    'A comprar': 'a_comprar',
    'A COMPRAR': 'a_comprar',
    'Comprado': 'comprado',
    'COMPRADO': 'comprado',
    'Expedição': 'expedicao',
    'EXPEDIÇÃO': 'expedicao',
    'Cronograma Inicio': 'cronograma_inicio',
    'CRONOGRAMA INICIO': 'cronograma_inicio',
    'Data medições': 'data_medicoes',
    'DATA MEDIÇÕES': 'data_medicoes',
    'Data Conclusão': 'data_conclusao',
    'DATA CONCLUSÃO': 'data_conclusao',
    'Manutenção': 'manutencao',
    'MANUTENÇÃO': 'manutencao',
    'Status Global': 'status_global',
    'STATUS GLOBAL': 'status_global'
  };
  
  // Verificar se existe um mapeamento específico
  if (specificMappings[label]) {
    return specificMappings[label];
  }
  
  // Caso contrário, usar a normalização padrão
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
  
  // Verificar se é uma das colunas específicas que não queremos (apenas as antigas indesejadas)
  if (upperHeader === 'MINIIMO UNITARIO' || upperHeader === 'MINIMO UNITARIO' || 
      upperHeader === 'MINIIMO TOTAL' || upperHeader === 'MINIMO TOTAL') {
    // Retornamos um tipo especial que podemos filtrar depois
    return 'ignored';
  }
  
  if (upperHeader.includes('PREÇO') || upperHeader.includes('VALOR') || 
      upperHeader.includes('TOTAL') || upperHeader.includes('UNITARIO') || 
      upperHeader.includes('CC') || upperHeader.includes('VLR') || 
      upperHeader.includes('PV') || upperHeader.includes('MAT')) {
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

      // ETAPA 4: Buscar colunas existentes criadas pelo trigger
      console.log('=== VERIFICANDO COLUNAS EXISTENTES DO TRIGGER ===');
      const { data: existingColumns, error: fetchError } = await supabase
        .from('project_columns')
        .select('column_key, column_label')
        .eq('project_id', newProject.id);

      if (fetchError) {
        console.error('Erro ao buscar colunas existentes:', fetchError);
        throw new Error(`Erro ao verificar colunas existentes: ${fetchError.message}`);
      }
      
      const existingColumnKeys = new Set(existingColumns?.map(col => col.column_key) || []);
      console.log('Colunas já existentes do trigger:', Array.from(existingColumnKeys));

      // ETAPA 5: Criar APENAS as colunas do CSV que NÃO existem ainda
      console.log('=== CRIANDO COLUNAS ADICIONAIS BASEADAS NO CSV ===');
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
          
          // Verificar se a coluna já existe (criada pelo trigger)
          if (existingColumnKeys.has(key)) {
            console.log(`Coluna "${header}" (${key}) já existe, pulando criação`);
            return null;
          }
          
          const columnType = mapColumnType(header);
          // Ignorar colunas marcadas como 'ignored'
          if (columnType === 'ignored') {
            console.log(`Ignorando coluna indesejada: ${header}`);
            return null;
          }
          
          console.log(`Criando nova coluna: "${header}" -> "${key}" (tipo: ${columnType})`);
          
          return {
            project_id: newProject.id,
            column_key: key,
            column_label: header,
            column_type: columnType,
            column_width: '150px',
            column_order: (existingColumns?.length || 0) + index + 1,
            is_system_column: false
          };
        })
        .filter(col => col !== null);

      console.log(`Criando ${columnsToInsert.length} colunas adicionais baseadas no CSV`);
      console.log('Novas colunas que serão criadas:', columnsToInsert.map(col => `${col?.column_label} (${col?.column_key})`));
      console.log(`Total de colunas após importação: ${(existingColumns?.length || 0) + columnsToInsert.length}`);

      if (columnsToInsert.length > 0) {
        const { data: insertedColumns, error: columnsInsertError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert)
          .select();
        
        if (columnsInsertError) {
          console.error('Erro ao inserir colunas:', columnsInsertError);
          throw new Error(`Erro ao criar colunas: ${columnsInsertError.message}`);
        }
        
        console.log(`${insertedColumns?.length} colunas adicionais criadas com sucesso`);
        console.log(`Total de colunas no projeto: ${(existingColumns?.length || 0) + (insertedColumns?.length || 0)}`);
      }

      // ETAPA 6: Preparar mapeamento de dados (incluindo colunas existentes)
      console.log('=== PREPARANDO MAPEAMENTO DE DADOS ===');
      const headerToKeyMap = new Map<string, string>();
      
      // Mapear headers do CSV
      projectData.headers.forEach(header => {
        if (header && header.trim() !== '') {
          const key = generateColumnKey(header);
          if (key) {
            headerToKeyMap.set(header, key);
            console.log(`Mapeamento CSV: "${header}" -> "${key}"`);
          }
        }
      });
      
      // Também mapear colunas existentes do trigger para garantir que sejam incluídas
      existingColumns?.forEach(col => {
        console.log(`Coluna existente disponível: "${col.column_label}" (${col.column_key})`);
      });

      // ETAPA 7: Preparar e inserir itens com valores PRESERVADOS
      console.log('=== PREPARANDO ITENS PARA INSERÇÃO ===');
      const itemsToInsert = projectData.rows.map((row: any, rowIndex: number) => {
        console.log(`\n--- Processando linha ${rowIndex + 1} ---`);
        console.log('Dados originais da linha:', row);
        
        // Criar dynamic_data preservando valores originais, exceto colunas indesejadas
        const dynamicData: { [key: string]: any } = {};
        
        for (const header of projectData.headers) {
          if (header && header.trim() !== '') {
            // Verificar se é uma coluna indesejada
            const upperHeader = header.toUpperCase();
            if (upperHeader === 'MINIIMO UNITARIO' || upperHeader === 'MINIMO UNITARIO' || 
                upperHeader === 'MINIIMO TOTAL' || upperHeader === 'MINIMO TOTAL' || 
                upperHeader === 'CC MO UNI' || upperHeader === 'CC MO TOTAL') {
              console.log(`  Ignorando coluna indesejada no dynamic_data: "${header}"`);
              continue; // Pular esta coluna
            }
            
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

        // Mapear apenas campos obrigatórios para as colunas principais (evitar duplicação)
        const descricao = getValueFromRow(['DESCRIÇÃO', 'DESCRICAO', 'ITEM']) || 'Item importado';
        const qtd = getValueFromRow(['QTD', 'QUANTIDADE']) || 1;
        const unidade = getValueFromRow(['UNIDADE', 'UNIT']) || '';
        const distribuidor = getValueFromRow(['DISTRIBUIDOR']) || '';
        
        // Campos financeiros importantes que devem estar nas colunas principais
        const mat_uni_pr = getValueFromRow(['MAT UNI - PR (R$)', 'MAT UNI PR', 'MATERIAL UNITARIO PRECO']) || 0;
        const desconto = getValueFromRow(['Desconto (%)', 'DESCONTO (%)', 'DESCONTO']) || 0;
        const cc_mat_uni = getValueFromRow(['CC MAT UNI (R$)', 'CC MAT UNI', 'CC_MAT_UNI']) || 0;
        const cc_mat_total = getValueFromRow(['CC MAT TOTAL (R$)', 'CC MAT TOTAL', 'CC_MAT_TOTAL']) || 0;
        const ipi = getValueFromRow(['IPI (R$):', 'IPI', 'IPI (R$)']) || 0;
        const vlr_total_estimado = getValueFromRow(['VLR. TOTAL ESTIMADO', 'VLR TOTAL ESTIMADO', 'VALOR TOTAL ESTIMADO']) || 0;
        
        // Campos de controle de projeto que devem estar nas colunas principais
        const reanalise_escopo = getValueFromRow(['Reanalise escop', 'Reanalise Escopo', 'REANALISE ESCOPO']) || null;
        const prioridade_compra = getValueFromRow(['Prioridade compra', 'PRIORIDADE COMPRA']) || null;
        const reanalise_mo = getValueFromRow(['Reanalise MO', 'REANALISE MO']) || null;
        const conferencia_estoque = getValueFromRow(['Conferencia estoque', 'CONFERENCIA ESTOQUE']) || null;
        const a_comprar = getValueFromRow(['A comprar', 'A COMPRAR']) || null;
        const comprado = getValueFromRow(['Comprado', 'COMPRADO']) || null;
        const previsao_chegada = getValueFromRow(['Previsão de chegada', 'PREVISÃO DE CHEGADA']) || null;
        const expedicao = getValueFromRow(['Expedição', 'EXPEDIÇÃO']) || null;
        const cronograma_inicio = getValueFromRow(['Cronograma Inicio', 'CRONOGRAMA INICIO']) || null;
        const data_medicoes = getValueFromRow(['Data medições', 'DATA MEDIÇÕES']) || null;
        const data_conclusao = getValueFromRow(['Data Conclusão', 'DATA CONCLUSÃO']) || null;
        const manutencao = getValueFromRow(['Manutenção', 'MANUTENÇÃO']) || null;
        const status_global = getValueFromRow(['Status Global', 'STATUS GLOBAL']) || null;

        // Remover campos das colunas principais do dynamic_data para evitar duplicação
        const fieldsInMainColumns = [
          'descricao', 'qtd', 'unidade', 'distribuidor', 'mat_uni_pr', 'desconto', 
          'cc_mat_uni', 'cc_mat_total', 'ipi', 'vlr_total_estimado',
          'reanalise_escopo', 'prioridade_compra', 'reanalise_mo', 'conferencia_estoque',
          'a_comprar', 'comprado', 'previsao_chegada', 'expedicao', 'cronograma_inicio',
          'data_medicoes', 'data_conclusao', 'manutencao', 'status_global'
        ];
        
        // Filtrar dynamic_data para remover campos que já estão nas colunas principais
        const filteredDynamicData: { [key: string]: any } = {};
        Object.keys(dynamicData).forEach(key => {
          if (!fieldsInMainColumns.includes(key)) {
            filteredDynamicData[key] = dynamicData[key];
          }
        });

        console.log('Valores mapeados para campos do banco:');
        console.log(`  descricao: "${descricao}"`);
        console.log(`  qtd: ${qtd}`);
        console.log(`  mat_uni_pr: ${mat_uni_pr}`);
        console.log(`  desconto: ${desconto}`);
        console.log(`  cc_mat_uni: ${cc_mat_uni}`);
        console.log(`  cc_mat_total: ${cc_mat_total}`);
        console.log(`  ipi: ${ipi}`);
        console.log(`  vlr_total_estimado: ${vlr_total_estimado}`);
        console.log(`  reanalise_escopo: ${reanalise_escopo}`);
        console.log(`  dynamic_data (filtrado):`, filteredDynamicData);

        // Criar item final com todos os campos mapeados
        const item = {
          project_id: newProject.id,
          descricao: String(descricao),
          qtd: Number(qtd) || 1,
          unidade: String(unidade),
          mat_uni_pr: Number(mat_uni_pr) || 0,
          desconto: Number(desconto) || 0,
          cc_mat_uni: Number(cc_mat_uni) || 0,
          cc_mat_total: Number(cc_mat_total) || 0,
          cc_mo_uni: 0,
          cc_mo_total: 0,
          ipi: Number(ipi) || 0,
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
          reanalise_escopo: reanalise_escopo,
          prioridade_compra: prioridade_compra,
          reanalise_mo: reanalise_mo,
          conferencia_estoque: conferencia_estoque,
          a_comprar: a_comprar,
          comprado: comprado,
          previsao_chegada: previsao_chegada,
          expedicao: expedicao,
          cronograma_inicio: cronograma_inicio,
          data_medicoes: data_medicoes,
          data_conclusao: data_conclusao,
          manutencao: manutencao,
          status_global: status_global,
          dynamic_data: filteredDynamicData
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
