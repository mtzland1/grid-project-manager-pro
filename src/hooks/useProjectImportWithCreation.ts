
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useProjectImport } from './useProjectImport';
import { useToast } from '@/components/ui/use-toast';

interface ProjectRow {
  [key: string]: any;
}

interface ProjectData {
  headers: string[];
  rows: ProjectRow[];
}

export const useProjectImportWithCreation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { importProjects } = useProjectImport();
  const { toast } = useToast();

  const normalizeColumnKey = (header: string): string => {
    return header
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  const importAndCreateProject = async (
    file: File, 
    projectName: string, 
    projectDescription?: string
  ) => {
    console.log('=== INICIANDO IMPORTAÇÃO COM CRIAÇÃO ===');
    console.log('Arquivo:', file.name);
    console.log('Nome do projeto:', projectName);
    console.log('Descrição:', projectDescription);

    setLoading(true);
    setError(null);

    try {
      // Validação do nome do projeto
      if (!projectName || typeof projectName !== 'string') {
        throw new Error('Nome do projeto é obrigatório');
      }

      const trimmedName = projectName.trim();
      if (trimmedName.length < 3) {
        throw new Error('Nome do projeto deve ter pelo menos 3 caracteres');
      }

      // Verificar se já existe um projeto com esse nome
      const { data: existingProject, error: checkError } = await supabase
        .from('projects')
        .select('id')
        .eq('name', trimmedName)
        .maybeSingle();

      if (checkError) {
        console.error('Erro ao verificar projeto existente:', checkError);
        throw new Error('Erro ao verificar projetos existentes');
      }

      if (existingProject) {
        throw new Error(`Já existe um projeto com o nome "${trimmedName}"`);
      }

      // Fazer o parse do arquivo - retorna um único objeto com headers e rows
      console.log('Iniciando parse do arquivo...');
      const projectData: ProjectData = await importProjects(file);
      
      if (!projectData || projectData.rows.length === 0) {
        throw new Error('Nenhum dado válido encontrado no arquivo');
      }

      console.log('Dados parseados - projeto único com', projectData.rows.length, 'linhas');

      // Criar UM ÚNICO projeto
      console.log('Criando projeto...');
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: trimmedName,
          description: projectDescription || '',
          created_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single();

      if (projectError) {
        console.error('Erro ao criar projeto:', projectError);
        throw new Error('Erro ao criar projeto: ' + projectError.message);
      }

      console.log('Projeto criado com sucesso:', newProject.id);

      // Esperar um pouco para garantir que as colunas padrão foram criadas
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Buscar colunas existentes do projeto
      const { data: existingColumns, error: columnsError } = await supabase
        .from('project_columns')
        .select('column_key')
        .eq('project_id', newProject.id);

      if (columnsError) {
        console.error('Erro ao buscar colunas:', columnsError);
        throw new Error('Erro ao buscar colunas do projeto');
      }

      const existingColumnKeys = new Set(existingColumns?.map(col => col.column_key) || []);
      console.log('Colunas existentes:', existingColumnKeys);

      // Identificar colunas personalizadas dos dados importados
      const customColumns = projectData.headers.filter(header => {
        const normalizedKey = normalizeColumnKey(header);
        return !existingColumnKeys.has(normalizedKey);
      });

      console.log('Colunas personalizadas encontradas:', customColumns);

      // Criar colunas personalizadas
      if (customColumns.length > 0) {
        const maxOrder = Math.max(...Array.from(existingColumnKeys).map(() => 1)) || 0;
        
        const customColumnInserts = customColumns.map((header, index) => ({
          project_id: newProject.id,
          column_key: normalizeColumnKey(header),
          column_label: header,
          column_type: 'text',
          column_width: '120px',
          column_order: maxOrder + index + 1,
          is_system_column: false,
          is_calculated: false
        }));

        const { error: customColumnsError } = await supabase
          .from('project_columns')
          .insert(customColumnInserts);

        if (customColumnsError) {
          console.error('Erro ao criar colunas personalizadas:', customColumnsError);
          throw new Error('Erro ao criar colunas personalizadas');
        }

        console.log('Colunas personalizadas criadas:', customColumnInserts.length);
      }

      // Preparar dados para inserção - cada ROW vira um ITEM do projeto
      console.log('Preparando dados para inserção...');
      const itemsToInsert = projectData.rows.map(row => {
        const item: any = {
          project_id: newProject.id,
          dynamic_data: {}
        };

        // Processar cada campo da row
        projectData.headers.forEach(header => {
          const value = row[header];
          const normalizedKey = normalizeColumnKey(header);
          
          if (existingColumnKeys.has(normalizedKey)) {
            // Campo existe na tabela - mapear diretamente
            item[normalizedKey] = value || '';
          } else {
            // Campo personalizado - salvar no dynamic_data
            item.dynamic_data[normalizedKey] = value || '';
          }
        });

        return item;
      });

      console.log('Inserindo', itemsToInsert.length, 'itens no projeto único...');

      // Inserir itens em lotes para evitar timeout
      const batchSize = 100;
      let totalInserted = 0;

      for (let i = 0; i < itemsToInsert.length; i += batchSize) {
        const batch = itemsToInsert.slice(i, i + batchSize);
        
        const { error: insertError } = await supabase
          .from('project_items')
          .insert(batch);

        if (insertError) {
          console.error('Erro ao inserir lote:', insertError);
          throw new Error(`Erro ao inserir itens (lote ${Math.floor(i/batchSize) + 1}): ${insertError.message}`);
        }

        totalInserted += batch.length;
        console.log(`Lote ${Math.floor(i/batchSize) + 1} inserido. Total: ${totalInserted}/${itemsToInsert.length}`);
      }

      console.log('=== IMPORTAÇÃO CONCLUÍDA COM SUCESSO ===');
      console.log('Projeto único criado:', newProject.name);
      console.log('Itens importados:', totalInserted);

      toast({
        title: "Projeto importado com sucesso!",
        description: `"${newProject.name}" foi criado com ${totalInserted} itens.`,
      });

      return newProject;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na importação';
      console.error('=== ERRO NA IMPORTAÇÃO ===', errorMessage);
      setError(errorMessage);
      
      toast({
        title: "Erro na importação",
        description: errorMessage,
        variant: "destructive",
      });
      
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
