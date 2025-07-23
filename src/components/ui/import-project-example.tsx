
import React from 'react';
import { ImportProjectDialog } from './import-project-dialog';
import { useProjectImport } from '../../hooks/useProjectImport';

export const ImportProjectExample: React.FC = () => {
  const { importProjects, loading, error, setError } = useProjectImport();

  const handleImport = async (file: File) => {
    try {
      const projects = await importProjects(file);
      console.log('Projetos importados:', projects);
      
      // Aqui você pode adicionar a lógica para salvar os projetos no banco de dados
      // Por exemplo, usando Supabase:
      // await supabase.from('projects').insert(projects);
      
      alert(`${projects.length} projetos importados com sucesso!`);
    } catch (error) {
      console.error('Erro na importação:', error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Exemplo de Importação de Projetos</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
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
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800">Processando arquivo...</p>
        </div>
      )}
    </div>
  );
};
