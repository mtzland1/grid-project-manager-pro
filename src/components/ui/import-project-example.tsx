
import React from 'react';
import { ImportProjectDialog } from './import-project-dialog';
import { useProjectImportWithCreation } from '../../hooks/useProjectImportWithCreation';

export const ImportProjectExample: React.FC = () => {
  const { importAndCreateProject, loading, error, setError } = useProjectImportWithCreation();

  const handleImport = async (file: File) => {
    try {
      const newProject = await importAndCreateProject(file);
      console.log('Projeto criado com sucesso:', newProject);
      
      // Opcional: redirecionar para o projeto criado ou atualizar a lista
      window.location.reload(); // Recarrega a página para mostrar o novo projeto
    } catch (error) {
      console.error('Erro na importação:', error);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm underline"
          >
            Fechar
          </button>
        </div>
      )}
      
      <ImportProjectDialog onImport={handleImport} />
      
      {loading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800">Processando arquivo e criando projeto...</p>
        </div>
      )}
    </div>
  );
};
