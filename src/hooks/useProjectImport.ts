
import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProjectData {
  nome: string;
  descricao?: string;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  responsavel?: string;
  [key: string]: any;
}

export const useProjectImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (content: string): ProjectData[] => {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).filter(line => line.trim()).map(line => {
      const values = line.split(',').map(v => v.trim());
      const project: ProjectData = { nome: '' };
      
      headers.forEach((header, index) => {
        const normalizedHeader = header.toLowerCase().replace(/\s+/g, '_');
        project[normalizedHeader] = values[index] || '';
      });
      
      return project;
    });
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
          
          const headers = (jsonData[0] as string[]).map(h => h?.toString().toLowerCase().replace(/\s+/g, '_') || '');
          const projects: ProjectData[] = [];
          
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (row.some(cell => cell !== null && cell !== undefined && cell !== '')) {
              const project: ProjectData = { nome: '' };
              headers.forEach((header, index) => {
                project[header] = row[index]?.toString() || '';
              });
              projects.push(project);
            }
          }
          
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
      
      // Validar projetos
      const validProjects = projects.filter(project => {
        return project.nome && project.nome.trim().length > 0;
      });
      
      if (validProjects.length === 0) {
        throw new Error('Nenhum projeto válido encontrado no arquivo');
      }
      
      console.log(`${validProjects.length} projetos importados com sucesso`);
      return validProjects;
      
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
