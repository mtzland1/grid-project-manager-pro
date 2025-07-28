
import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProjectData {
  [key: string]: any;
}

export const useProjectImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (content: string): ProjectData[] => {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
    
    console.log('Headers encontrados no CSV:', headers);
    
    const projects = lines.slice(1)
      .filter(line => line.trim())
      .map(line => {
        const values = line.split(',').map(v => v.trim());
        const project: ProjectData = {};
        
        headers.forEach((header, index) => {
          project[header] = values[index] || '';
        });
        
        return project;
      });
    
    console.log('Projetos parseados do CSV:', projects);
    return projects;
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
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length === 0) {
            reject(new Error('Arquivo vazio'));
            return;
          }
          
          const headers = (jsonData[0] as string[])
            .map(h => h?.toString().toLowerCase().replace(/\s+/g, '_') || '');
          
          console.log('Headers encontrados no XLSX:', headers);
          
          const projects: ProjectData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            
            // Verifica se a linha tem algum conteúdo
            if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
              const project: ProjectData = {};
              headers.forEach((header, index) => {
                project[header] = row[index]?.toString() || '';
              });
              projects.push(project);
            }
          }
          
          console.log('Projetos parseados do XLSX:', projects);
          resolve(projects);
        } catch (error) {
          reject(error);
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
      let projects: ProjectData[];
      
      if (file.name.endsWith('.csv')) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error('Erro ao ler arquivo CSV'));
          reader.readAsText(file);
        });
        
        projects = parseCSV(content);
      } else if (file.name.endsWith('.xlsx')) {
        projects = await parseXLSX(file);
      } else {
        throw new Error('Formato de arquivo não suportado');
      }
      
      console.log('Total de linhas processadas:', projects.length);
      
      if (projects.length === 0) {
        throw new Error('Nenhum dado encontrado no arquivo. Verifique se o arquivo contém dados válidos.');
      }
      
      return projects;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      console.error('Erro na importação:', errorMessage);
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
