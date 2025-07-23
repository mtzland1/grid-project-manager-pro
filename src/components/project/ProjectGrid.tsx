
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FileText, Calendar, Upload, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Project {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  archived: boolean;
}

interface ProjectGridProps {
  projects: Project[];
  onUploadClick?: (projectId: string) => void;
  showUploadButton?: boolean;
}

const ProjectGrid: React.FC<ProjectGridProps> = ({ 
  projects, 
  onUploadClick, 
  showUploadButton = false 
}) => {
  const navigate = useNavigate();

  const handleProjectClick = (projectId: string) => {
    navigate(`/project/${projectId}`);
  };

  const handleChatClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    navigate(`/project/${projectId}/chat`);
  };

  const handleUploadClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (onUploadClick) {
      onUploadClick(projectId);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-16 w-16 mx-auto mb-4 text-gray-300" />
        <p className="text-lg">Nenhum projeto encontrado</p>
        <p className="text-sm">Crie um novo projeto para começar</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {projects.map((project) => (
        <Card 
          key={project.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleProjectClick(project.id)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg line-clamp-1">{project.name}</CardTitle>
              {project.archived && (
                <Badge variant="secondary" className="text-xs">
                  Arquivado
                </Badge>
              )}
            </div>
            {project.description && (
              <CardDescription className="line-clamp-2">
                {project.description}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 mr-2" />
              Criado em {format(new Date(project.created_at), "dd/MM/yyyy", { locale: ptBR })}
            </div>
            
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="h-4 w-4 mr-2" />
              Atualizado em {format(new Date(project.updated_at), "dd/MM/yyyy", { locale: ptBR })}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => handleChatClick(e, project.id)}
                className="flex items-center gap-1"
              >
                <MessageSquare className="h-3 w-3" />
                Chat
              </Button>

              {showUploadButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => handleUploadClick(e, project.id)}
                  className="flex items-center gap-1"
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ProjectGrid;
