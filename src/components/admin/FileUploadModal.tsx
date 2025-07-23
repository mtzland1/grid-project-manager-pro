
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import FileUpload from './FileUpload';

interface FileUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onUploadComplete?: () => void;
}

const FileUploadModal: React.FC<FileUploadModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onUploadComplete
}) => {
  const handleUploadComplete = () => {
    if (onUploadComplete) {
      onUploadComplete();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Dados para o Projeto</DialogTitle>
        </DialogHeader>
        <FileUpload 
          projectId={projectId} 
          onUploadComplete={handleUploadComplete}
        />
      </DialogContent>
    </Dialog>
  );
};

export default FileUploadModal;
