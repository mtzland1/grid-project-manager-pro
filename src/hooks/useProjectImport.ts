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
/**
 * Converte valores monetários e percentuais de strings formatadas para números
 */
const parseNumericValue = (value: any, header: string): any => {
  if (value === null || value === undefined || value === '') {
    return '';
  }
  
  const stringValue = String(value).trim();
  
  // Se já é um número, retorna como está
  if (typeof value === 'number') {
    return value;
  }
  
  // Verifica se é uma coluna que deve conter valores numéricos
  const headerUpper = header.toUpperCase();
  const isNumericColumn = headerUpper.includes('R$') || 
                         headerUpper.includes('%') || 
                         headerUpper.includes('QTD') ||
                         headerUpper.includes('TOTAL') ||
                         headerUpper.includes('UNI') && (headerUpper.includes('MAT') || headerUpper.includes('MO') || headerUpper.includes('PV')) ||
                         headerUpper.includes('IPI') ||
                         headerUpper.includes('ST') ||
                         headerUpper.includes('ESTIMADO');
  
  if (!isNumericColumn) {
    return stringValue;
  }
  
  // Remove formatação monetária e converte para número
  let cleanValue = stringValue
    .replace(/R\$\s*/g, '') // Remove R$ e espaços
    .replace(/\s+/g, '') // Remove espaços extras
    .replace(/-/g, '0') // Converte traços para zero
    .replace(/%/g, ''); // Remove símbolo de porcentagem
  
  // Tratar separadores de milhares e decimais (formato brasileiro)
  // Se tem vírgula seguida de exatamente 2 dígitos no final, é decimal
  // Se tem vírgula em outras posições, é separador de milhares
  if (cleanValue.includes(',')) {
    const parts = cleanValue.split('.');
    if (parts.length > 1) {
      // Tem ponto e vírgula - formato: 123,456.78
      cleanValue = cleanValue.replace(/,/g, ''); // Remove vírgulas (separadores de milhares)
    } else {
      // Só tem vírgula - pode ser decimal ou separador de milhares
      const commaIndex = cleanValue.lastIndexOf(',');
      const afterComma = cleanValue.substring(commaIndex + 1);
      
      if (afterComma.length === 2 && /^\d{2}$/.test(afterComma)) {
        // Vírgula seguida de exatamente 2 dígitos - é decimal
        cleanValue = cleanValue.replace(',', '.');
      } else {
        // Vírgula em outra posição - é separador de milhares
        cleanValue = cleanValue.replace(/,/g, '');
      }
    }
  }
  
  // Se ficou vazio após limpeza, retorna 0
  if (cleanValue === '' || cleanValue === '.') {
    return 0;
  }
  
  // Tenta converter para número
  const numericValue = parseFloat(cleanValue);
  
  // Se a conversão foi bem-sucedida, retorna o número
  if (!isNaN(numericValue)) {
    return numericValue;
  }
  
  // Se não conseguiu converter, retorna o valor original
  return stringValue;
};

const processAndFilterRows = (allRowsData: any[][], headers: string[]): ProjectRow[] => {
  const rows: ProjectRow[] = [];
  
  // Detectar onde termina a tabela principal
  const validTableEnd = findTableEnd(allRowsData, headers);
  const validRowsData = allRowsData.slice(0, validTableEnd);
  
  console.log(`=== PROCESSAMENTO DE LINHAS ===`);
  console.log(`Total de linhas brutas: ${allRowsData.length}`);
  console.log(`Linhas válidas da tabela principal: ${validRowsData.length}`);
  console.log(`Linhas descartadas (fim da tabela): ${allRowsData.length - validTableEnd}`);

  for (let i = 0; i < validRowsData.length; i++) {
    const rowData = validRowsData[i];
    
    if (!rowData || rowData.every(cell => cell === null || cell === undefined || cell === '')) {
      continue; // Pula linhas totalmente vazias
    }

    const row: ProjectRow = {};
    headers.forEach((header, index) => {
      if (header && header.trim() !== '') { // Ignora colunas sem cabeçalho
        const value = rowData[index];
        row[header] = parseNumericValue(value, header);
      }
    });

    // Encontra as chaves 'ITEM' e 'DESCRIÇÃO' de forma case-insensitive
    const itemKey = Object.keys(row).find(key => key.toUpperCase().includes('ITEM'));
    const descricaoKey = Object.keys(row).find(key => key.toUpperCase().includes('DESCRIÇÃO') || key.toUpperCase().includes('DESCRICAO'));
    
    // Inclui a linha se:
    // 1. Tem ITEM válido (não vazio), OU
    // 2. Tem DESCRIÇÃO válida (não vazia) mesmo que ITEM seja nulo
    const hasValidItem = itemKey && row[itemKey] && String(row[itemKey]).trim() !== '';
    const hasValidDescricao = descricaoKey && row[descricaoKey] && String(row[descricaoKey]).trim() !== '';
    
    if (hasValidItem || hasValidDescricao) {
      console.log(`Linha ${i + 1} incluída: ITEM="${row[itemKey] || 'N/A'}" DESCRIÇÃO="${(row[descricaoKey] || '').substring(0, 30)}..."`);
      rows.push(row);
    } else {
      console.log(`Linha ${i + 1} descartada: sem ITEM nem DESCRIÇÃO válidos`);
    }
  }
  
  console.log(`Total de linhas processadas: ${rows.length}`);
  return rows;
};

/**
 * Detecta onde termina a tabela principal baseado em padrões do arquivo
 */
const findTableEnd = (allRowsData: any[][], headers: string[]): number => {
  for (let i = 0; i < allRowsData.length; i++) {
    const rowData = allRowsData[i];
    
    if (!rowData) continue;
    
    // Converte a linha para objeto para facilitar análise
    const row: any = {};
    headers.forEach((header, index) => {
      if (header) {
        const value = rowData[index];
        row[header] = value !== null && value !== undefined ? String(value).trim() : '';
      }
    });
    
    // Procura por padrões que indicam fim da tabela principal
    const rowText = Object.values(row).join(' ').toLowerCase();
    
    // Se encontrar texto indicativo de totais, administração, ou resumos
    if (rowText.includes('cc mo total:') || 
        rowText.includes('administração') || 
        rowText.includes('administracao') ||
        rowText.includes('total:') ||
        rowText.includes('despesas operacionais') ||
        rowText.includes('frete estimado') ||
        rowText.includes('seguro caução') ||
        rowText.includes('disputa:')) {
      console.log(`Fim da tabela principal detectado na linha ${i + 1}: "${rowText.substring(0, 50)}..."`);
      return i;
    }
    
    // Se a linha tem apenas valores em poucas colunas e parece ser resumo/total
    const nonEmptyValues = Object.values(row).filter(v => v && String(v).trim() !== '').length;
    if (nonEmptyValues <= 2 && i > 10) { // Após linha 10 e com poucos valores
      const itemKey = Object.keys(row).find(key => key.toUpperCase().includes('ITEM'));
      const descricaoKey = Object.keys(row).find(key => key.toUpperCase().includes('DESCRIÇÃO') || key.toUpperCase().includes('DESCRICAO'));
      
      // Se não tem ITEM nem DESCRIÇÃO válidos após linha 10
      if ((!itemKey || !row[itemKey]) && (!descricaoKey || !row[descricaoKey])) {
        console.log(`Possível fim da tabela na linha ${i + 1} (poucos valores e sem ITEM/DESCRIÇÃO)`);
        return i;
      }
    }
  }
  
  console.log('Fim da tabela não detectado automaticamente, usando todas as linhas');
  return allRowsData.length;
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
  
    // Usar blankrows: true para manter linhas vazias e defval: null para detectar células vazias
    const jsonData = XLSX.utils.sheet_to_json<any[]>(worksheet, { 
      header: 1, 
      defval: null, 
      blankrows: true,
      raw: false // Garante que valores sejam convertidos para string quando apropriado
    });
    
    if (jsonData.length < 2) throw new Error('XLSX precisa de cabeçalho e pelo menos uma linha de dados.');
    
    console.log('=== PARSE XLSX ===');
    console.log(`Total de linhas brutas do Excel: ${jsonData.length}`);
    console.log(`Primeira linha (headers): ${JSON.stringify(jsonData[0])}`);
    
    // Processar headers - garantir que todas as colunas sejam capturadas
    const rawHeaders = jsonData[0] || [];
    
    // Encontrar a maior linha para determinar o número máximo de colunas
    const maxColumns = Math.max(...jsonData.map(row => row ? row.length : 0));
    console.log(`Número máximo de colunas detectado: ${maxColumns}`);
    
    // Expandir headers para cobrir todas as colunas
    const headers: string[] = [];
    for (let i = 0; i < maxColumns; i++) {
      const headerValue = rawHeaders[i];
      if (headerValue !== null && headerValue !== undefined && String(headerValue).trim() !== '') {
        headers[i] = String(headerValue).trim();
      } else {
        // Para colunas sem cabeçalho, criar um nome genérico
        headers[i] = `Coluna_${i + 1}`;
      }
    }
    
    console.log(`Headers processados (${headers.length}): ${JSON.stringify(headers)}`);
    
    // Normalizar todas as linhas para ter o mesmo número de colunas
    const allRowsData = jsonData.slice(1).map(row => {
      const normalizedRow = new Array(maxColumns).fill(null);
      if (row) {
        for (let i = 0; i < Math.min(row.length, maxColumns); i++) {
          normalizedRow[i] = row[i];
        }
      }
      return normalizedRow;
    });
    
    console.log(`Linhas de dados normalizadas: ${allRowsData.length}`);
    
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