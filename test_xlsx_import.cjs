const XLSX = require('xlsx');

// Ler o arquivo Excel
const workbook = XLSX.readFile('/root/grid-project-manager-pro/13372 V4.xlsx');
const worksheet = workbook.Sheets[workbook.SheetNames[0]];

console.log('=== INFORMAÇÕES DA PLANILHA ===');
console.log('Nome da planilha:', workbook.SheetNames[0]);
console.log('Range da planilha:', worksheet['!ref']);

// Testar diferentes opções de parsing
console.log('\n=== TESTE COM raw: false ===');
const jsonData1 = XLSX.utils.sheet_to_json(worksheet, { 
  header: 1, 
  defval: null, 
  blankrows: true,
  raw: false
});

console.log('Total de linhas:', jsonData1.length);
console.log('\nHeaders (primeira linha):');
if (jsonData1[0]) {
  jsonData1[0].forEach((header, index) => {
    console.log(`  ${index}: "${header}" (tipo: ${typeof header})`);
  });
} else {
  console.log('Primeira linha não encontrada!');
}

console.log('\n=== TESTE COM raw: true ===');
const jsonData2 = XLSX.utils.sheet_to_json(worksheet, { 
  header: 1, 
  defval: null, 
  blankrows: true,
  raw: true
});

console.log('\nHeaders (raw: true):');
if (jsonData2[0]) {
  jsonData2[0].forEach((header, index) => {
    console.log(`  ${index}: "${header}" (tipo: ${typeof header})`);
  });
}

// Verificar células específicas diretamente
console.log('\n=== VERIFICAÇÃO DIRETA DAS CÉLULAS ===');
const range = XLSX.utils.decode_range(worksheet['!ref']);
console.log('Range decodificado:', range);

// Verificar primeira linha (headers)
console.log('\nPrimeira linha (A1 até última coluna):');
for (let col = range.s.c; col <= range.e.c; col++) {
  const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
  const cell = worksheet[cellAddress];
  if (cell) {
    console.log(`  ${cellAddress}: "${cell.v}" (tipo: ${cell.t})`);
  } else {
    console.log(`  ${cellAddress}: [vazio]`);
  }
}

// Verificar segunda linha (primeira linha de dados)
console.log('\nSegunda linha (primeira linha de dados):');
for (let col = range.s.c; col <= Math.min(range.e.c, 15); col++) { // Limitar a 15 colunas para não poluir
  const cellAddress = XLSX.utils.encode_cell({ r: 1, c: col });
  const cell = worksheet[cellAddress];
  if (cell) {
    console.log(`  ${cellAddress}: "${cell.v}" (tipo: ${cell.t})`);
  } else {
    console.log(`  ${cellAddress}: [vazio]`);
  }
}