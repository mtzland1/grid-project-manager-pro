
import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProjectData {
  [key: string]: any;
}

export const useProjectImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (content: string): ProjectData[] => {
    try {
      const lines = content.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('Arquivo CSV deve ter pelo menos uma linha de cabeçalho e uma linha de dados');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
      console.log('CSV Headers:', headers);
      
      const projects: ProjectData[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        
        // Pula linhas completamente vazias
        if (values.every(val => val === '')) {
          continue;
        }
        
        const project: ProjectData = {};
        headers.forEach((header, index) => {
          project[header] = values[index] || '';
        });
        
        projects.push(project);
      }
      
      console.log('CSV Parsed projects:', projects.length);
      return projects;
    } catch (error) {
      console.error('Erro ao processar CSV:', error);
      throw new Error('Erro ao processar arquivo CSV: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
  };

  const parseXLSX = (file: File): Promise<ProjectData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          if (jsonData.length < 2) {
            reject(new Error('Arquivo XLSX deve ter pelo menos uma linha de cabeçalho e uma linha de dados'));
            return;
          }
          
          const headers = (jsonData[0] as string[])
            .map(h => (h || '').toString().trim().toLowerCase().replace(/\s+/g, '_'));
          
          console.log('XLSX Headers:', headers);
          
          const projects: ProjectData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            
            // Pula linhas completamente vazias
            if (!row || row.every(cell => cell === null || cell === undefined || cell === '')) {
              continue;
            }
            
            const project: ProjectData = {};
            headers.forEach((header, index) => {
              const value = row[index];
              project[header] = value !== null && value !== undefined ? value.toString() : '';
            });
            
            projects.push(project);
          }
          
          console.log('XLSX Parsed projects:', projects.length);
          resolve(projects);
        } catch (error) {
          console.error('Erro ao processar XLSX:', error);
          reject(new Error('Erro ao processar arquivo XLSX: ' + (error instanceof Error ? error.message : 'Erro desconhecido')));
        }
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsArrayBuffer(file);
    });
  };

  const importProjects = async (file: File): Promise<ProjectData[]> => {
    setLoading(true);
    setError(null);
    
    try {
      console.log('=== INICIANDO PARSE DO ARQUIVO ===');
      console.log('Arquivo:', file.name, 'Tamanho:', file.size, 'bytes');
      
      let projects: ProjectData[];
      
      if (file.name.endsWith('.csv')) {
        console.log('Processando como CSV...');
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Erro ao ler arquivo CSV'));
          reader.readAsText(file);
        });
        
        projects = parseCSV(content);
      } else if (file.name.endsWith('.xlsx')) {
        console.log('Processando como XLSX...');
        projects = await parseXLSX(file);
      } else {
        throw new Error('Formato de arquivo não suportado. Use apenas CSV ou XLSX.');
      }
      
      console.log('=== PARSE CONCLUÍDO ===');
      console.log('Total de linhas processadas:', projects.length);
      
      if (projects.length === 0) {
        throw new Error('Nenhum dado encontrado no arquivo. Verifique se o arquivo contém dados válidos.');
      }
      
      return projects;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('=== ERRO NO PARSE ===', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    importProjects,
    loading,
    error,
    setError
  };
};
