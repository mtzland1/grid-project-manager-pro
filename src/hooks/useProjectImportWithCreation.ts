import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectImport } from './useProjectImport';
import { useToast } from '@/components/ui/use-toast';

// Tipos para clareza
interface Project {
  id: string;
  name: string;
}

interface ProjectColumn {
  project_id: string;
  column_key: string;
  column_label: string;
  column_type: string;
  column_width: string;
  column_order: number;
  is_system_column: boolean;
}

// --- FUNÇÕES AUXILIARES ROBUSTAS ---

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
  // Adicione outras regras se necessário
  return 'text';
};

// 3. Função CONFIÁVEL para converter strings formatadas em números
const parseCurrency = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0;
    const stringValue = String(value)
        .replace("R$", "")      // Remove o símbolo de real
        .replace(/\./g, "")     // Remove o separador de milhar
        .replace(",", ".")      // Substitui a vírgula decimal por ponto
        .trim();
    const number = parseFloat(stringValue);
    return isNaN(number) ? 0 : number;
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
      // ETAPA 1: Parse do arquivo (seu código aqui já está bom)
      const projectData = await importProjects(file);
      if (!projectData || !projectData.rows || projectData.rows.length === 0) {
        throw new Error('Nenhuma linha de dados válida foi encontrada no arquivo.');
      }

      // ETAPA 2: Criação do projeto
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado.");

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({ name: projectName, description: projectDescription, created_by: user.id })
        .select()
        .single();

      if (projectError) throw new Error(`Erro ao criar projeto: ${projectError.message}`);

      // ETAPA 3: Gerenciamento de Colunas (LÓGICA CORRIGIDA)
      // Não vamos mais deletar. Vamos apenas adicionar o que falta.
      const { data: existingColumns, error: columnsSelectError } = await supabase
        .from('project_columns')
        .select('column_key, column_order')
        .eq('project_id', newProject.id);

      if (columnsSelectError) throw new Error(`Erro ao buscar colunas existentes: ${columnsSelectError.message}`);

      const existingColumnKeys = new Set(existingColumns.map(c => c.column_key));
      const maxOrder = existingColumns.length > 0 ? Math.max(...existingColumns.map(c => c.column_order)) : 0;

      const columnsToInsert = projectData.headers
        .map((header, index) => {
          const key = generateColumnKey(header);
          // Garantir que nunca tenhamos uma chave vazia
          if (!key) {
            console.warn(`Header vazio ou inválido encontrado: "${header}". Será ignorado.`);
            return null;
          }
          return {
            key,
            label: header,
            order: maxOrder + index + 1 // Garante ordem correta
          };
        })
        // Filtramos para remover colunas nulas e que já existem
        .filter(col => col !== null && !existingColumnKeys.has(col.key)); // Filtra para inserir apenas as NOVAS

      if (columnsToInsert.length > 0) {
        const { error: columnsInsertError } = await supabase
          .from('project_columns')
          .insert(columnsToInsert.map(col => ({
            project_id: newProject.id,
            column_key: col.key,
            column_label: col.label,
            column_type: mapColumnType(col.label),
            column_width: '150px',
            column_order: col.order,
            is_system_column: false
          })));
        if (columnsInsertError) throw new Error(`Erro ao criar novas colunas: ${columnsInsertError.message}`);
      }

      // ETAPA 4: Preparação e Inserção dos Itens (LÓGICA ROBUSTA)
      const headerToKeyMap = new Map<string, string>();
      projectData.headers.forEach(header => {
        const key = generateColumnKey(header);
        // Só adicionamos ao mapa se a chave não for vazia
        if (key) {
          headerToKeyMap.set(header, key);
        } else {
          console.warn(`Header vazio ou inválido ignorado no mapeamento: "${header}"`);
        }
      });

      const itemsToInsert = projectData.rows.map((row: any) => {
        const dynamicData: { [key: string]: any } = {};
        
        for (const header of projectData.headers) {
          const key = headerToKeyMap.get(header);
          // Verificamos se a chave existe e não é vazia antes de adicionar ao dynamicData
          if (key && key.trim() !== '') {
            dynamicData[key] = row[header] !== undefined ? row[header] : '';
          }
        }

        return {
          project_id: newProject.id,
          descricao: row['DESCRIÇÃO'] || row['DESCRICAO'] || '',
          qtd: parseCurrency(row['QTD'] || row['QUANTIDADE']),
          unidade: row['UNIDADE'] || '',
          mat_uni_pr: parseCurrency(row['MAT UNI - PR (R$)'] || row['MAT UNI PR'] || row['PREÇO UNITÁRIO'] || row['PRECO UNITARIO']),
          cc_mat_uni: parseCurrency(row['CC MAT UNI (R$)'] || row['CC MAT UNI']),
          desconto: parseCurrency(row['DESCONTO (%)'] || row['DESCONTO']),
          cc_mo_uni: parseCurrency(row['CC MO UNI (R$)'] || row['CC MO UNI']),
          ipi: parseCurrency(row['IPI'] || row['IPI (%)']),
          vlr_total_estimado: parseCurrency(row['VALOR TOTAL ESTIMADO'] || row['VLR TOTAL ESTIMADO']),
          vlr_total_venda: parseCurrency(row['VALOR TOTAL VENDA'] || row['VLR TOTAL VENDA']),
          distribuidor: row['DISTRIBUIDOR'] || '',
          dynamic_data: dynamicData
        };
      });

      const { error: itemsError } = await supabase.from('project_items').insert(itemsToInsert);
      if (itemsError) throw new Error(`Erro ao inserir itens: ${itemsError.message}`);

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
    error: importError, // Apenas um estado de erro é necessário
    setError
  };
};