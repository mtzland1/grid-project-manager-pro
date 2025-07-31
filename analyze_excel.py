import pandas as pd
import numpy as np

# Ler o arquivo Excel
df = pd.read_excel('/root/grid-project-manager-pro/13372 V4.xlsx', header=0)

print('=== ANÁLISE DAS COLUNAS PROBLEMÁTICAS ===')
print(f'Total de linhas: {len(df)}')
print(f'Total de colunas: {len(df.columns)}')

# Verificar valores específicos das primeiras linhas
print('\n=== VALORES DAS PRIMEIRAS 5 LINHAS ===')
for idx in range(min(5, len(df))):
    row = df.iloc[idx]
    print(f'\nLinha {idx+1}:')
    print(f'  ITEM: {row.get("ITEM", "N/A")}')
    print(f'  Desconto (%): {row.get("Desconto (%)", "N/A")}')
    print(f'  CC MAT UNI (R$): {row.get("CC MAT UNI (R$)", "N/A")}')
    print(f'  CC MAT TOTAL (R$): {row.get("CC MAT TOTAL (R$)", "N/A")}')
    print(f'  CC MO UNI (R$): {row.get("CC MO UNI (R$)", "N/A")}')
    print(f'  CC MO TOTAL (R$): {row.get("CC MO TOTAL (R$)", "N/A")}')
    print(f'  PV UNI: {row.get("PV UNI", "N/A")}')
    print(f'  PV TOTAL: {row.get("PV TOTAL", "N/A")}')

# Verificar se há valores não nulos nessas colunas
print('\n=== ESTATÍSTICAS DAS COLUNAS ===')
cols_problema = ['Desconto (%)', 'CC MAT UNI (R$)', 'CC MAT TOTAL (R$)', 'CC MO UNI (R$)', 'CC MO TOTAL (R$)', 'PV UNI', 'PV TOTAL']

for col in cols_problema:
    if col in df.columns:
        serie = df[col]
        valores_nao_nulos = serie.dropna()
        valores_nao_zero = valores_nao_nulos[valores_nao_nulos != 0]
        
        print(f'\n{col}:')
        print(f'  Total de valores: {len(serie)}')
        print(f'  Valores não nulos: {len(valores_nao_nulos)}')
        print(f'  Valores não zero: {len(valores_nao_zero)}')
        print(f'  Tipo: {serie.dtype}')
        
        if len(valores_nao_zero) > 0:
            print(f'  Primeiros valores não zero: {list(valores_nao_zero.head(3))}')
        else:
            print('  Todos os valores são nulos ou zero')

print('\n=== TODAS AS COLUNAS ===')
for i, col in enumerate(df.columns):
    print(f'{i+1:2d}. "{col}"')