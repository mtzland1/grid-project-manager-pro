
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface ProjectColumn {
  id: string;
  project_id: string;
  column_key: string;
  column_label: string;
  column_type: string;
  column_width: string;
  column_order: number;
  is_system_column: boolean;
}

interface ProjectItem {
  [key: string]: any;
}

export const useExcelExport = () => {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined || value === '') return '';
    
    switch (type) {
      case 'currency':
        return Number(value) || 0;
      case 'percentage':
        return `${Number(value) || 0}%`;
      case 'number':
        return Number(value) || 0;
      default:
        return String(value);
    }
  };

  const exportProjectToExcel = async (projectId: string, projectName: string) => {
    setIsExporting(true);
    
    try {
      // Buscar colunas do projeto
      const { data: columnsData, error: columnsError } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', projectId)
        .order('column_order');

      if (columnsError) throw columnsError;

      // Buscar itens do projeto
      const { data: itemsData, error: itemsError } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (itemsError) throw itemsError;

      if (!columnsData || !itemsData) {
        toast({
          title: "Dados não encontrados",
          description: "Não há dados para exportar neste projeto",
          variant: "destructive",
        });
        return;
      }

      // Preparar dados para exportação
      const headers = columnsData.map(col => col.column_label);
      const rows = itemsData.map(item => {
        return columnsData.map(col => {
          let value = item[col.column_key as keyof typeof item];
          
          // Se for uma coluna dinâmica, buscar no dynamic_data
          if (value === undefined && item.dynamic_data) {
            value = (item.dynamic_data as Record<string, any>)[col.column_key];
          }
          
          return formatValue(value, col.column_type);
        });
      });

      // Criar workbook
      const workbook = XLSX.utils.book_new();
      const worksheetData = [headers, ...rows];
      const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);

      // Configurar largura das colunas
      const columnWidths = columnsData.map(col => ({
        wch: Math.max(col.column_label.length, 15)
      }));
      worksheet['!cols'] = columnWidths;

      // Adicionar worksheet ao workbook
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Dados do Projeto');

      // Gerar arquivo e fazer download
      const fileName = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Exportação concluída!",
        description: `Arquivo ${fileName} foi baixado com sucesso`,
      });

    } catch (error) {
      console.error('Erro na exportação:', error);
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados do projeto",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return {
    exportProjectToExcel,
    isExporting
  };
};
