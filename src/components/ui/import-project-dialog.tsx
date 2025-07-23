
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './dialog';
import { Button } from './button';
import { Upload, FileText, AlertCircle } from 'lucide-react';

interface ImportProjectDialogProps {
  onImport: (file: File) => Promise<void>;
}

export const ImportProjectDialog: React.FC<ImportProjectDialogProps> = ({ onImport }) => {
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileSelect = (file: File) => {
    if (file.type === 'text/csv' || file.name.endsWith('.csv') || 
        file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
        file.name.endsWith('.xlsx')) {
      setSelectedFile(file);
    } else {
      alert('Por favor, selecione apenas arquivos CSV ou XLSX');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleImport = async () => {
    if (selectedFile && onImport) {
      setIsImporting(true);
      try {
        await onImport(selectedFile);
        setSelectedFile(null);
        setOpen(false);
      } catch (error) {
        console.error('Erro na importação:', error);
      } finally {
        setIsImporting(false);
      }
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isImporting) {
      setOpen(newOpen);
      if (!newOpen) {
        setSelectedFile(null);
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Upload className="h-4 w-4" />
          Importar Projeto
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Importar Projeto</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            Suporte para arquivos CSV e XLSX
          </div>
          
          <div
            className={`
              border-2 border-dashed rounded-lg p-8 text-center transition-colors relative
              ${dragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'}
              ${selectedFile ? 'border-green-500 bg-green-50' : ''}
            `}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            {selectedFile ? (
              <div className="space-y-2">
                <FileText className="h-12 w-12 mx-auto text-green-500" />
                <p className="font-medium">{selectedFile.name}</p>
                <p className="text-sm text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                <p className="font-medium">Arraste e solte seu arquivo aqui</p>
                <p className="text-sm text-muted-foreground">ou clique para selecionar</p>
              </div>
            )}
            
            <input
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileInputChange}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isImporting}
            />
          </div>
          
          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => handleOpenChange(false)}
              disabled={isImporting}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={!selectedFile || isImporting}
            >
              {isImporting ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
