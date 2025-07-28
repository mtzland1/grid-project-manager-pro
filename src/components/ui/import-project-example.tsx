
import React from 'react';
import { ImportProjectDialog } from './import-project-dialog';
import { useProjectImportWithCreation } from '../../hooks/useProjectImportWithCreation';

export const ImportProjectExample: React.FC = () => {
  const { importAndCreateProject, loading, error, setError } = useProjectImportWithCreation();

  const handleImport = async (file: File, projectName: string, projectDescription?: string) => {
    console.log('ImportProjectExample - handleImport chamado com:', {
      fileName: file.name,
      projectName,
      projectDescription
    });

    try {
      // Validação do nome do projeto
      if (!projectName || typeof projectName !== 'string') {
        throw new Error('Nome do projeto é obrigatório');
      }

      const trimmedName = projectName.trim();
      if (trimmedName.length < 3) {
        throw new Error('Nome do projeto deve ter pelo menos 3 caracteres');
      }

      console.log('Iniciando importação do projeto:', {
        arquivo: file.name,
        nome: trimmedName,
        descricao: projectDescription || ''
      });
      
      const newProject = await importAndCreateProject(file, trimmedName, projectDescription);
      
      console.log('Projeto importado com sucesso:', newProject);
      
      // Recarrega a página para mostrar o novo projeto
      window.location.reload();
      
    } catch (error) {
      console.error('Erro na importação:', error);
      // O erro já é tratado pelo hook useProjectImportWithCreation
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-red-500">⚠️</div>
            <p className="text-red-800 font-medium">Erro na importação</p>
          </div>
          <p className="text-red-700 mt-1">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm underline mt-2"
          >
            Fechar
          </button>
        </div>
      )}
      
      <ImportProjectDialog onImport={handleImport} />
      
      {loading && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 text-blue-500 animate-spin">⟳</div>
            <p className="text-blue-800 font-medium">Processando importação...</p>
          </div>
          <p className="text-blue-700 mt-1">
            Criando projeto e importando dados do arquivo. Por favor, aguarde...
          </p>
        </div>
      )}
    </div>
  );
};
