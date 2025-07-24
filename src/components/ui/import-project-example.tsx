
import React from 'react';
import { ImportProjectDialog } from './import-project-dialog';
import { useProjectImportWithCreation } from '../../hooks/useProjectImportWithCreation';

export const ImportProjectExample: React.FC = () => {
  const { importAndCreateProject, loading, error, setError } = useProjectImportWithCreation();

  const handleImport = async (file: File, projectName: string, projectDescription?: string) => {
    console.log('ImportProjectExample - handleImport chamado com:', {
      fileName: file.name,
      projectName,
      projectDescription,
      projectNameType: typeof projectName,
      projectNameLength: projectName.length
    });

    try {
      // Validação rigorosa antes de chamar o hook
      if (!projectName || typeof projectName !== 'string') {
        throw new Error('Nome do projeto é obrigatório e deve ser uma string');
      }

      const trimmedName = projectName.trim();
      if (trimmedName.length < 3) {
        throw new Error('Nome do projeto deve ter pelo menos 3 caracteres');
      }

      console.log('Validação passou, chamando importAndCreateProject com:', {
        fileName: file.name,
        name: trimmedName,
        description: projectDescription || ''
      });
      
      const newProject = await importAndCreateProject(file, trimmedName, projectDescription);
      
      console.log('Projeto criado com sucesso:', newProject);
      
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
        <div className="p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-red-800 font-medium">Erro:</p>
          <p className="text-red-700">{error}</p>
          <button 
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-800 text-sm underline mt-1"
          >
            Fechar
          </button>
        </div>
      )}
      
      <ImportProjectDialog onImport={handleImport} />
      
      {loading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 font-medium">Processando...</p>
          <p className="text-blue-700">Importando arquivo e criando projeto no banco de dados...</p>
        </div>
      )}
    </div>
  );
};
