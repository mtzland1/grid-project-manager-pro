
import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  projectId: string;
  onUploadComplete?: () => void;
}

interface ParsedData {
  item?: string;
  descricao: string;
  qtd: number;
  unidade: string;
  mat_uni_pr: number;
  desconto: number;
  cc_mat_uni: number;
  cc_mat_total: number;
  cc_mo_uni: number;
  cc_mo_total: number;
  ipi: number;
  vlr_total_estimado: number;
  vlr_total_venda: number;
  distribuidor: string;
}

const FileUpload: React.FC<FileUploadProps> = ({ projectId, onUploadComplete }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [uploadedCount, setUploadedCount] = useState(0);
  const { toast } = useToast();

  const parseCSV = (text: string): ParsedData[] => {
    const lines = text.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const data: ParsedData[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length < headers.length) continue;

      const item: any = {};
      headers.forEach((header, index) => {
        const value = values[index]?.trim();
        
        // Map CSV headers to database columns
        switch (header) {
          case 'item':
            item.item = value;
            break;
          case 'descrição':
          case 'descricao':
            item.descricao = value || '';
            break;
          case 'qtd':
          case 'quantidade':
            item.qtd = parseFloat(value) || 0;
            break;
          case 'unidade':
            item.unidade = value || '';
            break;
          case 'mat. uni. preço':
          case 'mat_uni_pr':
            item.mat_uni_pr = parseFloat(value) || 0;
            break;
          case 'desconto (%)':
          case 'desconto':
            item.desconto = parseFloat(value) || 0;
            break;
          case 'cc mat. uni.':
          case 'cc_mat_uni':
            item.cc_mat_uni = parseFloat(value) || 0;
            break;
          case 'cc mat. total':
          case 'cc_mat_total':
            item.cc_mat_total = parseFloat(value) || 0;
            break;
          case 'cc mo uni.':
          case 'cc_mo_uni':
            item.cc_mo_uni = parseFloat(value) || 0;
            break;
          case 'cc mo total':
          case 'cc_mo_total':
            item.cc_mo_total = parseFloat(value) || 0;
            break;
          case 'ipi':
            item.ipi = parseFloat(value) || 0;
            break;
          case 'vlr. total estimado':
          case 'vlr_total_estimado':
            item.vlr_total_estimado = parseFloat(value) || 0;
            break;
          case 'vlr. total venda':
          case 'vlr_total_venda':
            item.vlr_total_venda = parseFloat(value) || 0;
            break;
          case 'distribuidor':
            item.distribuidor = value || '';
            break;
        }
      });

      if (item.descricao) {
        data.push(item);
      }
    }

    return data;
  };

  const parseXLSX = (file: File): Promise<ParsedData[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject(new Error('Arquivo deve conter pelo menos um cabeçalho e uma linha de dados'));
            return;
          }

          const headers = (jsonData[0] as string[]).map(h => h?.toString().trim().toLowerCase() || '');
          const parsedData: ParsedData[] = [];

          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.length === 0) continue;

            const item: any = {};
            headers.forEach((header, index) => {
              const value = row[index]?.toString().trim() || '';
              
              // Same mapping logic as CSV
              switch (header) {
                case 'item':
                  item.item = value;
                  break;
                case 'descrição':
                case 'descricao':
                  item.descricao = value || '';
                  break;
                case 'qtd':
                case 'quantidade':
                  item.qtd = parseFloat(value) || 0;
                  break;
                case 'unidade':
                  item.unidade = value || '';
                  break;
                case 'mat. uni. preço':
                case 'mat_uni_pr':
                  item.mat_uni_pr = parseFloat(value) || 0;
                  break;
                case 'desconto (%)':
                case 'desconto':
                  item.desconto = parseFloat(value) || 0;
                  break;
                case 'cc mat. uni.':
                case 'cc_mat_uni':
                  item.cc_mat_uni = parseFloat(value) || 0;
                  break;
                case 'cc mat. total':
                case 'cc_mat_total':
                  item.cc_mat_total = parseFloat(value) || 0;
                  break;
                case 'cc mo uni.':
                case 'cc_mo_uni':
                  item.cc_mo_uni = parseFloat(value) || 0;
                  break;
                case 'cc mo total':
                case 'cc_mo_total':
                  item.cc_mo_total = parseFloat(value) || 0;
                  break;
                case 'ipi':
                  item.ipi = parseFloat(value) || 0;
                  break;
                case 'vlr. total estimado':
                case 'vlr_total_estimado':
                  item.vlr_total_estimado = parseFloat(value) || 0;
                  break;
                case 'vlr. total venda':
                case 'vlr_total_venda':
                  item.vlr_total_venda = parseFloat(value) || 0;
                  break;
                case 'distribuidor':
                  item.distribuidor = value || '';
                  break;
              }
            });

            if (item.descricao) {
              parsedData.push(item);
            }
          }

          resolve(parsedData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler o arquivo'));
      reader.readAsArrayBuffer(file);
    });
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setUploadStatus('idle');
    
    try {
      let parsedData: ParsedData[];
      
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const text = await file.text();
        parsedData = parseCSV(text);
      } else if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
                 file.name.endsWith('.xlsx')) {
        parsedData = await parseXLSX(file);
      } else {
        throw new Error('Formato de arquivo não suportado. Use CSV ou XLSX.');
      }

      if (parsedData.length === 0) {
        throw new Error('Nenhum dado válido encontrado no arquivo');
      }

      // Prepare data for database insertion with management columns
      const itemsToInsert = parsedData.map(item => ({
        project_id: projectId,
        descricao: item.descricao,
        qtd: item.qtd,
        unidade: item.unidade,
        mat_uni_pr: item.mat_uni_pr,
        desconto: item.desconto,
        cc_mat_uni: item.cc_mat_uni,
        cc_mat_total: item.cc_mat_total,
        cc_mo_uni: item.cc_mo_uni,
        cc_mo_total: item.cc_mo_total,
        ipi: item.ipi,
        vlr_total_estimado: item.vlr_total_estimado,
        vlr_total_venda: item.vlr_total_venda,
        distribuidor: item.distribuidor,
        // Management columns with default empty values
        reanalise_escopo: '',
        prioridade_compra: '',
        reanalise_mo: '',
        conferencia_estoque: '',
        a_comprar: '',
        comprado: '',
        previsao_chegada: null,
        expedicao: '',
        cronograma_inicio: null,
        data_medicoes: null,
        data_conclusao: null,
        manutencao: '',
        status_global: ''
      }));

      // Insert items into database
      const { error } = await supabase
        .from('project_items')
        .insert(itemsToInsert);

      if (error) {
        throw error;
      }

      setUploadedCount(parsedData.length);
      setUploadStatus('success');
      
      toast({
        title: 'Upload concluído com sucesso!',
        description: `${parsedData.length} itens foram importados para o projeto.`,
      });

      if (onUploadComplete) {
        onUploadComplete();
      }

    } catch (error) {
      console.error('Erro no upload:', error);
      setUploadStatus('error');
      
      toast({
        title: 'Erro no upload',
        description: error instanceof Error ? error.message : 'Erro desconhecido ao processar o arquivo',
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      processFile(acceptedFiles[0]);
    }
  }, [projectId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importar Dados do Projeto
        </CardTitle>
        <CardDescription>
          Faça upload de arquivos CSV ou XLSX contendo os dados do projeto. 
          As colunas de gerenciamento serão automaticamente adicionadas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragActive 
              ? 'border-primary bg-primary/5' 
              : 'border-gray-300 hover:border-gray-400'
          } ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input {...getInputProps()} />
          <div className="space-y-2">
            <FileText className="h-12 w-12 text-gray-400 mx-auto" />
            {isDragActive ? (
              <p className="text-lg">Solte o arquivo aqui...</p>
            ) : (
              <div>
                <p className="text-lg">Arraste um arquivo aqui ou clique para selecionar</p>
                <p className="text-sm text-gray-500">Formatos suportados: CSV, XLSX</p>
              </div>
            )}
          </div>
        </div>

        {isProcessing && (
          <div className="flex items-center justify-center space-x-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Processando arquivo...</span>
          </div>
        )}

        {uploadStatus === 'success' && (
          <div className="flex items-center space-x-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            <span>Upload concluído! {uploadedCount} itens importados.</span>
          </div>
        )}

        {uploadStatus === 'error' && (
          <div className="flex items-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>Erro no upload. Verifique o arquivo e tente novamente.</span>
          </div>
        )}

        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Formato esperado:</strong></p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>ITEM, DESCRIÇÃO, QTD, UNIDADE, MAT. UNI. PREÇO, DESCONTO (%), etc.</li>
            <li>As colunas de gerenciamento serão automaticamente adicionadas</li>
            <li>Valores numéricos devem usar ponto como separador decimal</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
