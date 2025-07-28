import { useState } from 'react';
import * as XLSX from 'xlsx';

interface ProjectRow {
  [key: string]: any;
}

interface ProjectData {
  headers: string[];
  rows: ProjectRow[];
}

// -----------------------------------------------------
// FUNÇÕES AUXILIARES REUTILIZÁVEIS
// -----------------------------------------------------

/**
 * Lê o conteúdo de um arquivo de forma assíncrona.
 */
const readFileAs = <T extends 'text' | 'arrayBuffer'>(
  file: File,
  format: T
): Promise<T extends 'text' ? string : ArrayBuffer> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as any);
    reader.onerror = (e) => reject(new Error('Erro ao ler o arquivo: ' + e));
    if (format === 'text') {
      reader.readAsText(file, 'UTF-8');
    } else {
      reader.readAsArrayBuffer(file);
    }
  });
};

/**
 * Processa um conjunto de dados brutos (array de arrays) e os transforma em um array de objetos de linha,
 * aplicando a filtragem necessária (ex: coluna ITEM não pode ser vazia).
 */
const processAndFilterRows = (allRowsData: any[][], headers: string[]): ProjectRow[] => {
  const rows: ProjectRow[] = [];
  const REQUIRED_COLUMN_NAME = 'ITEM'; // Centraliza a regra de negócio

  for (const rowData of allRowsData) {
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
      continue; // Pula linhas totalmente vazias
    }

    const row: ProjectRow = {};
    headers.forEach((header, index) => {
      if (header) { // Ignora colunas sem cabeçalho
        const value = rowData[index];
        row[header] = value !== null && value !== undefined ? String(value).trim() : '';
      }
    });

    // Encontra a chave 'ITEM' de forma case-insensitive
    const itemKey = Object.keys(row).find(key => key.toUpperCase() === REQUIRED_COLUMN_NAME);
    
    // Filtra a linha se o valor da coluna 'ITEM' for válido
    if (itemKey && row[itemKey] && String(row[itemKey]).trim() !== '') {
      rows.push(row);
    }
  }
  return rows;
};

// -----------------------------------------------------
// HOOK PRINCIPAL
// -----------------------------------------------------
export const useProjectImport = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parseCSV = (content: string): ProjectData => {
    const lines = content.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('CSV precisa de cabeçalho e pelo menos uma linha de dados.');

    const parseCSVLine = (line: string): string[] => {
        // Seu parser de linha CSV (mantido como está, pois é específico)
        const result = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') inQuotes = !inQuotes;
            else if (char === ',' && !inQuotes) {
                result.push(current.trim().replace(/^"|"$/g, ''));
                current = '';
            } else current += char;
        }
        result.push(current.trim().replace(/^"|"$/g, ''));
        return result;
    };
    
    const headers = parseCSVLine(lines[0]);
    const allRowsData = lines.slice(1).map(line => parseCSVLine(line));
    const rows = processAndFilterRows(allRowsData, headers);

    return { headers, rows };
  };

  const parseXLSX = async (file: File): Promise<ProjectData> => {
    const data = await readFileAs(file, 'arrayBuffer');
    const workbook = XLSX.read(data, { type: 'array' });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: '', blankrows: false });
    if (jsonData.length < 2) throw new Error('XLSX precisa de cabeçalho e pelo menos uma linha de dados.');
    
    // ✅ CORREÇÃO: Remova o .filter() daqui para manter os índices alinhados.
    const headers = jsonData[0].map(h => String(h).trim());
  
    const allRowsData = jsonData.slice(1);
    const rows = processAndFilterRows(allRowsData, headers);
  
    return { headers, rows };
  };

  const importProjects = async (file: File): Promise<ProjectData> => {
    setLoading(true);
    setError(null);
    try {
      console.log('=== INICIANDO PARSE DO ARQUIVO ===');
      let projectData: ProjectData;

      if (file.name.endsWith('.csv') || file.type === 'text/csv') {
        const content = await readFileAs(file, 'text');
        projectData = parseCSV(content);
      } else if (file.name.endsWith('.xlsx') || file.type.includes('spreadsheetml')) {
        projectData = await parseXLSX(file);
      } else {
        throw new Error('Formato de arquivo não suportado. Use CSV ou XLSX.');
      }

      console.log('=== PARSE CONCLUÍDO ===');
      if (projectData.rows.length === 0) {
        throw new Error('Nenhum dado válido encontrado. Verifique se o arquivo não está vazio e se a coluna ITEM está preenchida.');
      }
      return projectData;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      console.error('=== ERRO NO PARSE ===', errorMessage);
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { importProjects, loading, error, setError };
};