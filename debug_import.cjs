const XLSX = require('xlsx');

// Ler o arquivo Excel
const workbook = XLSX.readFile('/root/grid-project-manager-pro/13372 V4.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

// Processar como o código atual faz
const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
  header: 1, 
  defval: null, 
  blankrows: true,
  raw: false
});

const headers = jsonData[0];
const allRowsData = jsonData.slice(1);

console.log('=== HEADERS ENCONTRADOS ===');
headers.forEach((header, index) => {
  console.log(`${index}: "${header}"`);
});

console.log('\n=== PROCURANDO COLUNAS PROBLEMÁTICAS ===');
const colunasProblema = ['Desconto (%)', 'CC MAT UNI (R$)', 'CC MAT TOTAL (R$)', 'CC MO UNI (R$)', 'CC MO TOTAL (R$)', 'PV UNI', 'PV TOTAL'];

// Buscar por correspondências parciais
colunasProblema.forEach(coluna => {
  console.log(`\nProcurando por: "${coluna}"`);
  
  // Busca exata
  const exactIndex = headers.indexOf(coluna);
  if (exactIndex !== -1) {
    console.log(`  Encontrada exata no índice ${exactIndex}`);
    return;
  }
  
  // Busca parcial (case insensitive)
  const partialMatches = headers.map((header, index) => ({ header, index }))
    .filter(({ header }) => {
      const headerUpper = String(header).toUpperCase();
      const colunaUpper = coluna.toUpperCase();
      return headerUpper.includes(colunaUpper.split(' ')[0]) || // Primeira palavra
             colunaUpper.includes(headerUpper.split(' ')[0]) || // Primeira palavra invertida
             headerUpper.includes('CC MAT') && colunaUpper.includes('CC MAT') ||
             headerUpper.includes('CC MO') && colunaUpper.includes('CC MO') ||
             headerUpper.includes('PV') && colunaUpper.includes('PV') ||
             headerUpper.includes('DESCONTO') && colunaUpper.includes('DESCONTO');
    });
  
  if (partialMatches.length > 0) {
    console.log(`  Correspondências parciais:`);
    partialMatches.forEach(({ header, index }) => {
      console.log(`    ${index}: "${header}"`);
    });
  } else {
    console.log(`  Nenhuma correspondência encontrada`);
  }
});

// Analisar colunas que podem conter valores numéricos
console.log('\n=== ANÁLISE DE COLUNAS NUMÉRICAS ===');
headers.forEach((header, index) => {
  const headerStr = String(header).toUpperCase();
  if (headerStr.includes('R$') || headerStr.includes('%') || headerStr.includes('PV') || headerStr.includes('CC')) {
    const valores = allRowsData.map(row => row[index]);
    const naoNulos = valores.filter(v => v !== null && v !== undefined && v !== '');
    const numericos = valores.filter(v => typeof v === 'number' && v !== 0);
    
    console.log(`\n${header} (índice ${index}):`);
    console.log(`  Total de linhas: ${valores.length}`);
    console.log(`  Valores não nulos/vazios: ${naoNulos.length}`);
    console.log(`  Valores numéricos não zero: ${numericos.length}`);
    
    if (naoNulos.length > 0) {
      console.log(`  Primeiros valores não nulos: ${naoNulos.slice(0, 3).map(v => JSON.stringify(v)).join(', ')}`);
      console.log(`  Tipos dos primeiros valores: ${naoNulos.slice(0, 3).map(v => typeof v).join(', ')}`);
    }
  }
});