import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2, Edit, Search, Download, MessageCircle, MoreVertical, X } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import ProjectChat from './ProjectChat';
import { useExcelExport } from '@/hooks/useExcelExport';

interface Project {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

interface ProjectRow {
  id: string;
  project_id: string;
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
  cc_pis_cofins: number;
  cc_icms_pr: number;
  cc_icms_revenda: number;
  cc_lucro_porcentagem: number;
  cc_lucro_valor: number;
  cc_encargos_valor: number;
  cc_total: number;
  vlr_total_estimado: number;
  vlr_total_venda: number;
  distribuidor: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: any; // Permite propriedades dinâmicas
}

interface ProjectColumn {
  id: string;
  project_id: string;
  column_key: string;
  column_label: string;
  column_type: string;
  column_width: string;
  column_order: number;
  is_system_column: boolean;
}

interface RolePermission {
  id: string;
  role_name: string;
  project_id: string;
  column_key: string;
  permission_level: 'none' | 'view' | 'edit';
}

interface ProjectGridProps {
  project: Project;
  onBack: () => void;
  userRole: 'admin' | 'collaborator';
}

const ProjectGrid = ({ project, onBack, userRole }: ProjectGridProps) => {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const { toast } = useToast();
  const { exportProjectToExcel, isExporting } = useExcelExport();
  
  // Usar hook de permissões
  const { permissions, canViewColumn, canEditColumn } = useUserPermissions(project.id);
  
  // Debug log para verificar permissões carregadas
  useEffect(() => {
    console.log('ProjectGrid permissions loaded:', {
      userRole,
      permissions,
      projectId: project.id
    });
  }, [permissions, userRole, project.id]);

  const defaultRow: Omit<ProjectRow, 'id' | 'project_id'> = {
    descricao: '',
    qtd: 0,
    unidade: '',
    mat_uni_pr: 0,
    desconto: 0,
    cc_mat_uni: 0,
    cc_mat_total: 0,
    cc_mo_uni: 0,
    cc_mo_total: 0,
    ipi: 0,
    cc_pis_cofins: 0,
    cc_icms_pr: 0,
    cc_icms_revenda: 0,
    cc_lucro_porcentagem: 0,
    cc_lucro_valor: 0,
    cc_encargos_valor: 0,
    cc_total: 0,
    vlr_total_estimado: 0,
    vlr_total_venda: 0,
    distribuidor: '',
  };

  const loadProjectData = async () => {
    try {
      // Carregar colunas do projeto
      const { data: columnsData, error: columnsError } = await supabase
        .from('project_columns')
        .select('*')
        .eq('project_id', project.id)
        .order('column_order');

      if (columnsError) throw columnsError;

      setColumns(columnsData || []);
    } catch (error) {
      console.error('Error loading project data:', error);
      toast({
        title: "Erro ao carregar configurações",
        description: "Não foi possível carregar as configurações do projeto",
        variant: "destructive",
      });
    }
  };

  const fetchRows = async () => {
    try {
      console.log('🔄 Iniciando fetchRows para projeto:', project.id);
      console.log('⏰ Timestamp:', new Date().toISOString());
      
      // Verificar status da conexão com Supabase
      const session = await supabase.auth.getSession();
      console.log('🔐 Status da sessão:', session.data.session ? 'Autenticado' : 'Não autenticado');
      
      const { data, error } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', project.id)
        .order('id', { ascending: true });

      if (error) {
        console.error('❌ Error fetching rows:', error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Merge static columns with dynamic data
      console.log('📥 Dados carregados do banco:', {
        projectId: project.id,
        totalItems: data?.length || 0,
        rawData: data,
        timestamp: new Date().toISOString()
      });
      
      const processedRows = (data || []).map(item => {
        // Primeiro mesclar dynamic_data, depois sobrescrever com colunas estáticas
        const dynamicData = (item.dynamic_data as Record<string, any>) || {};
        const mergedData = {
          ...dynamicData,  // Dados dinâmicos primeiro
          ...item,         // Dados estáticos sobrescrevem os dinâmicos
          distribuidor: item.distribuidor || ''
        };
        
        // Log específico para verificar conflito de descrição
        if (dynamicData.descricao && item.descricao) {
          console.log('⚠️ CONFLITO DETECTADO - Coluna descricao:', {
            id: item.id,
            staticDescricao: item.descricao,
            dynamicDescricao: dynamicData.descricao,
            finalDescricao: mergedData.descricao
          });
        }
        
        console.log('🔄 Processando item:', {
          id: item.id,
          originalItem: item,
          dynamicData: item.dynamic_data,
          mergedData: mergedData
        });
        
        return calculateRow(mergedData);
      });
      
      setRows(processedRows);
      console.log('✅ Dados carregados e processados:', processedRows.length, 'itens');
    } catch (err) {
      console.error('Error fetching rows:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível carregar os dados do projeto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportToExcel = () => {
    exportProjectToExcel(project.id, project.name);
  };

  useEffect(() => {
    loadProjectData();
    fetchRows();
    
    // Setup realtime subscription for columns
    console.log('🔗 Configurando subscrição realtime para colunas do projeto:', project.id);
    const columnsChannel = supabase
      .channel(`project-columns-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_columns',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          console.log('📊 Mudança detectada nas colunas:', payload);
          // Recarregar colunas quando houver mudanças
          loadProjectData();
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscrição de colunas:', status);
      });

    // Setup realtime subscription for project items (rows) - INSERT, UPDATE e DELETE
    console.log('🔗 Configurando subscrição realtime para itens do projeto:', project.id);
    const itemsChannel = supabase
      .channel(`project-items-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_items',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          console.log('➕ Novo item inserido via realtime:', payload.new);
          const newItem = payload.new as ProjectRow;
          
          setRows(prevRows => {
            const exists = prevRows.some(row => row.id === newItem.id);
            if (!exists) {
              // Primeiro mesclar dynamic_data, depois sobrescrever com colunas estáticas
              const dynamicData = (newItem.dynamic_data as Record<string, any>) || {};
              const mergedData = {
                ...dynamicData,  // Dados dinâmicos primeiro
                ...newItem,      // Dados estáticos sobrescrevem os dinâmicos
                distribuidor: newItem.distribuidor || ''
              };
              
              console.log('✅ Adicionando novo item ao estado:', {
                id: newItem.id,
                originalItem: newItem,
                dynamicData: newItem.dynamic_data,
                mergedData: mergedData
              });
              
              return [...prevRows, calculateRow(mergedData)];
            }
            
            console.log('⚠️ Item já existe, ignorando inserção:', newItem.id);
            return prevRows;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'project_items',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          console.log('🔄 Item updated via realtime:', {
            old: payload.old,
            new: payload.new,
            eventType: payload.eventType,
            timestamp: new Date().toISOString()
          });
          const updatedItem = payload.new as ProjectRow;
          
          // Verificar se a linha está sendo editada antes de atualizar
          setEditingRow(currentEditingRow => {
            if (currentEditingRow === updatedItem.id) {
              // Se está editando esta linha, não atualiza os dados
              console.log('⚠️ Linha sendo editada, ignorando atualização realtime:', updatedItem.id);
              return currentEditingRow;
            }
            
            // Se não está editando, atualiza os dados
            setRows(prevRows => {
              const updatedRows = [...prevRows];
              const rowIndex = updatedRows.findIndex(row => row.id === updatedItem.id);
              if (rowIndex !== -1) {
                // Primeiro mesclar dynamic_data, depois sobrescrever com colunas estáticas
                const dynamicData = (updatedItem.dynamic_data as Record<string, any>) || {};
                const mergedData = {
                  ...dynamicData,     // Dados dinâmicos primeiro
                  ...updatedItem,     // Dados estáticos sobrescrevem os dinâmicos
                  distribuidor: updatedItem.distribuidor || ''
                };
                
                console.log('✅ Atualizando linha via realtime:', {
                  id: updatedItem.id,
                  mergedData: mergedData
                });
                
                updatedRows[rowIndex] = calculateRow(mergedData, true);
              }
              return updatedRows;
            });
            
            return currentEditingRow;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'project_items',
          filter: `project_id=eq.${project.id}`,
        },
        (payload) => {
          console.log('🗑️ Item deletado via realtime:', payload.old);
          const deletedItem = payload.old as ProjectRow;
          setRows(prevRows => prevRows.filter(row => row.id !== deletedItem.id));
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da subscrição de itens:', status);
      });

    return () => {
      console.log('🔌 Removendo subscrições realtime para projeto:', project.id);
      supabase.removeChannel(columnsChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [project.id]);

  const calculateRow = (row: ProjectRow, skipCalculations: boolean = false): ProjectRow => {
    // Se skipCalculations for true, retorna a linha sem recalcular
    // Isso evita sobrescrever valores editados manualmente
    if (skipCalculations) {
      return row;
    }
    
    const qtd = row.qtd || 0;
    const ccMoUni = row.cc_mo_uni || 0;
    const ccMatUni = row.cc_mat_uni || 0;
    const matUniPr = row.mat_uni_pr || 0;
    const ipi = row.ipi || 0;
    const st = row.st || 0;
    
    // Calcular cc_mo_total
    const ccMoTotal = ccMoUni * qtd;
    
    // Calcular cc_mat_total se necessário
    const ccMatTotal = ccMatUni * qtd;
    
    // Calcular vlr_unit_estimado
    const vlrUnitEstimado = matUniPr + ipi + st;
    
    // Calcular vlr_total_estimado
    const vlrTotalEstimado = vlrUnitEstimado * qtd;
    
    return {
      ...row,
      cc_mo_total: ccMoTotal,
      cc_mat_total: ccMatTotal,
      vlr_unit_estimado: vlrUnitEstimado,
      vlr_total_estimado: vlrTotalEstimado
    };
  };

  const handleAddRow = async () => {
    if (!permissions.canCreate) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para adicionar linhas",
        variant: "destructive",
      });
      return;
    }

    try {
      const newRow = {
        ...defaultRow,
        project_id: project.id,
        descricao: 'Nova linha',
        dynamic_data: {}
      };

      const { data, error } = await supabase
        .from('project_items')
        .insert(newRow)
        .select()
        .maybeSingle();

      if (error) {
        console.error('Error adding row:', error);
        toast({
          title: "Erro ao adicionar linha",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data) {
        const rowWithDistribuidor = {
          ...data,
          distribuidor: data.distribuidor || ''
        };
        setRows([...rows, calculateRow(rowWithDistribuidor)]);
        setEditingRow(data.id);
      }
      
      toast({
        title: "Linha adicionada!",
        description: "Nova linha criada com sucesso",
      });
    } catch (err) {
      console.error('Error adding row:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível adicionar a linha",
        variant: "destructive",
      });
    }
  };

  const handleSaveRow = async (rowId: string) => {
    if (isUpdating) return;
    
    setIsUpdating(true);
    
    try {
      // Verificação de permissão
      const isAdmin = permissions.role === 'admin' || permissions.projectRole === 'admin';
      const isCollaborator = permissions.role === 'collaborator' || permissions.projectRole === 'collaborator';
      
      if (!isAdmin && !isCollaborator) {
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para editar",
          variant: "destructive",
        });
        return;
      }
      
      const updates = editedData[rowId] || {};
      
      console.log('💾 Iniciando salvamento:', {
        rowId,
        updates,
        timestamp: new Date().toISOString()
      });
      
      if (Object.keys(updates).length === 0) {
        console.log('⚠️ Nenhuma alteração para salvar');
        setEditingRow(null);
        setEditedData(prev => {
          const newData = { ...prev };
          delete newData[rowId];
          return newData;
        });
        return;
      }

      // Colunas estáticas do sistema
      const staticColumns = ['id', 'project_id', 'descricao', 'qtd', 'unidade', 'mat_uni_pr', 'desconto', 
                            'cc_mat_uni', 'cc_mat_total', 'cc_mo_uni', 'cc_mo_total', 'ipi', 'st',
                            'cc_pis_cofins', 'cc_icms_pr', 'cc_icms_revenda', 'cc_lucro_porcentagem', 
                            'cc_lucro_valor', 'cc_encargos_valor', 'cc_total', 'vlr_total_venda', 
                            'vlr_total_estimado', 'vlr_unit_estimado', 'created_at', 'updated_at', 'distribuidor',
                            'reanalise_escopo', 'prioridade_compra', 'reanalise_mo', 'conferencia_estoque',
                            'a_comprar', 'comprado', 'previsao_chegada', 'expedicao', 'cronograma_inicio',
                            'data_medicoes', 'data_conclusao', 'manutencao', 'status_global'];

      // Separar colunas estáticas das dinâmicas
      const staticUpdates: any = {};
      const dynamicUpdates: any = {};
      
      Object.entries(updates).forEach(([key, value]) => {
        if (staticColumns.includes(key)) {
          staticUpdates[key] = value;
        } else {
          dynamicUpdates[key] = value;
        }
      });

      // Preparar dados para atualização
      const updateData: any = { ...staticUpdates };
      
      // Se há atualizações dinâmicas, buscar dados atuais e fazer merge
      if (Object.keys(dynamicUpdates).length > 0) {
        const { data: currentRow } = await supabase
          .from('project_items')
          .select('dynamic_data')
          .eq('id', rowId)
          .single();

        const currentDynamicData = (currentRow?.dynamic_data as Record<string, any>) || {};
        updateData.dynamic_data = { ...currentDynamicData, ...dynamicUpdates };
      }

      // Executar a atualização
      console.log('🔄 Enviando atualização para o banco:', {
        rowId,
        updateData,
        timestamp: new Date().toISOString()
      });
      
      const { data, error } = await supabase
        .from('project_items')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', rowId)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating row:', error);
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }
      
      console.log('✅ Atualização bem-sucedida no banco:', {
        rowId,
        updatedData: data,
        timestamp: new Date().toISOString()
      });

      // Atualizar estado local com dados do servidor
      if (data) {
        // Primeiro mesclar dynamic_data, depois sobrescrever com colunas estáticas
        const dynamicData = (data.dynamic_data as Record<string, any>) || {};
        const mergedData = {
          ...dynamicData,  // Dados dinâmicos primeiro
          ...data,         // Dados estáticos sobrescrevem os dinâmicos
          distribuidor: data.distribuidor || ''
        };
        
        console.log('💾 Atualizando estado local após salvar:', {
          rowId,
          originalData: data,
          mergedData: mergedData,
          dynamicData: data.dynamic_data
        });
        
        setRows(prevRows => {
          const updatedRows = [...prevRows];
          const rowIndex = updatedRows.findIndex(row => row.id === rowId);
          if (rowIndex !== -1) {
            // Não recalcular para preservar os valores editados
            const newRow = calculateRow(mergedData, true);
            updatedRows[rowIndex] = newRow;
            
            console.log('✅ Linha atualizada no estado local:', {
              oldRow: prevRows[rowIndex],
              newRow: newRow
            });
          }
          return updatedRows;
        });
      }

      // Limpar dados de edição e sair do modo de edição
      setEditingRow(null);
      setEditedData(prev => {
        const newData = { ...prev };
        delete newData[rowId];
        return newData;
      });
      
      toast({
        title: "✅ Dados salvos!",
        description: "Alterações salvas com sucesso",
        variant: "default",
      });
    } catch (err) {
      console.error('Error updating row:', err);
      toast({
        title: "❌ Erro inesperado",
        description: "Não foi possível salvar os dados",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = (rowId: string) => {
    setEditingRow(null);
    setEditedData(prev => {
      const newData = { ...prev };
      delete newData[rowId];
      return newData;
    });
  };

  const handleFieldChange = (rowId: string, field: string, value: any) => {
    setEditedData(prev => ({
      ...prev,
      [rowId]: {
        ...prev[rowId],
        [field]: value
      }
    }));
  };

  const handleDeleteRow = async (rowId: string) => {
    if (!permissions.canDelete) {
      toast({
        title: "Acesso negado",
        description: "Você não tem permissão para deletar linhas",
        variant: "destructive",
      });
      return;
    }

    if (!confirm('Tem certeza que deseja deletar esta linha?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('project_items')
        .delete()
        .eq('id', rowId);

      if (error) {
        console.error('Error deleting row:', error);
        toast({
          title: "Erro ao deletar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      setRows(rows.filter(row => row.id !== rowId));
      
      toast({
        title: "Linha deletada!",
        description: "Linha removida com sucesso",
      });
    } catch (err) {
      console.error('Error deleting row:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível deletar a linha",
        variant: "destructive",
      });
    }
  };

  const formatValue = (value: any, type: string) => {
    if (value === null || value === undefined) return '';
    
    switch (type) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(Number(value) || 0);
      case 'percentage':
        return `${Number(value) || 0}%`;
      case 'number':
        return String(Number(value) || 0);
      default:
        return String(value);
    }
  };

  const filteredRows = rows.filter(row =>
    row.descricao.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filtrar colunas visíveis baseado nas permissões
  const visibleColumns = columns.filter(column => canViewColumn(column.column_key));

  const totals = filteredRows.reduce((acc, row) => ({
    cc_mat_total: acc.cc_mat_total + (row.cc_mat_total || 0),
    cc_mo_total: acc.cc_mo_total + (row.cc_mo_total || 0),
    vlr_total_estimado: acc.vlr_total_estimado + (row.vlr_total_estimado || 0),
    vlr_total_venda: acc.vlr_total_venda + (row.vlr_total_venda || 0),
  }), { cc_mat_total: 0, cc_mo_total: 0, vlr_total_estimado: 0, vlr_total_venda: 0 });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30">
      {/* Header moderno com gradiente sutil */}
      <header className="bg-white/95 backdrop-blur-sm shadow-lg border-b border-slate-200/60 sticky top-0 z-50">
        <div className="max-w-[98vw] mx-auto px-4">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack} className="hover:bg-accent">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary" className="text-xs">
                    {rows.length} {rows.length === 1 ? 'item' : 'itens'}
                  </Badge>
                  {searchTerm && (
                    <Badge variant="outline" className="text-xs">
                      {filteredRows.length} filtrados
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => {
                  console.log('🔄 Forçando recarregamento dos dados...');
                  fetchRows();
                }}
                variant="outline"
                size="sm"
                className="hover:bg-blue-50 hover:text-blue-600 transition-all duration-200"
              >
                🔄 Recarregar
              </Button>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar itens..."
                  className="pl-10 w-72 bg-background/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {permissions.canCreate && (
                <Button onClick={handleAddRow} className="shadow-md">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Linha
                </Button>
              )}
              
              <Dialog open={showChat} onOpenChange={setShowChat}>
                <DialogTrigger asChild>
                  <Button variant="default" className="shadow-md bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat em Tempo Real
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl max-h-[90vh] w-[95vw]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      Chat do Projeto - {project.name}
                    </DialogTitle>
                  </DialogHeader>
                  <ProjectChat project={project} />
                </DialogContent>
              </Dialog>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handleExportToExcel} disabled={isExporting}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exportando...' : 'Exportar Excel'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>



      {/* Tabela moderna */}
      <div className="max-w-[98vw] mx-auto px-4 py-4">
        <Card className="shadow-xl border border-slate-200/60 bg-white/95 backdrop-blur-sm">
          <CardHeader className="pb-3 bg-gradient-to-r from-slate-50 to-blue-50/50 border-b border-slate-200/40">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold text-slate-800 flex items-center">
                <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full mr-3"></div>
                Itens do Projeto
              </CardTitle>
              <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700">
                📊 {filteredRows.length} de {rows.length} itens
              </Badge>
              {editingRow && (
                <Badge variant="outline" className="text-xs animate-pulse bg-blue-50 text-blue-700 border-blue-200">
                  ✏️ Editando linha...
                </Badge>
              )}
              {isUpdating && (
                <Badge variant="outline" className="text-xs animate-pulse bg-green-50 text-green-700 border-green-200">
                  💾 Salvando alterações...
                </Badge>
              )}
            </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="rounded-lg border border-slate-200/60 bg-white overflow-hidden">
              <ScrollArea className="h-[calc(100vh-280px)] scroll-area">
                <Table className="text-sm">
                  <TableHeader className="bg-gradient-to-r from-slate-100 to-blue-50 border-b-2 border-slate-200">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-28 font-bold text-slate-700 text-center sticky left-0 bg-gradient-to-r from-slate-100 to-blue-50 z-10 border-r border-slate-200">Ações</TableHead>
                      {visibleColumns.map((column) => (
                        <TableHead 
                          key={column.column_key}
                          className="font-bold text-slate-700 text-center border-r border-slate-200/60 last:border-r-0"
                          style={{ 
                  width: column.column_width === '120px' ? '160px' : column.column_width === '100px' ? '140px' : column.column_width === '80px' ? '120px' : column.column_width,
                  minWidth: column.column_width === '120px' ? '160px' : column.column_width === '100px' ? '140px' : column.column_width === '80px' ? '120px' : column.column_width
                }}
                        >
                          <div className="flex items-center justify-center space-x-1">
                            <span className="text-xs font-semibold">{column.column_label}</span>
                            {column.column_type === 'currency' && (
                              <span className="text-xs text-blue-600 font-medium">(R$)</span>
                            )}
                            {column.column_type === 'percentage' && (
                              <span className="text-xs text-green-600 font-medium">(%)</span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell 
                          colSpan={visibleColumns.length + 1} 
                          className="h-32 text-center text-muted-foreground"
                        >
                          <div className="flex flex-col items-center space-y-2">
                            <div className="h-8 w-8 bg-muted rounded-full flex items-center justify-center">
                              <Search className="h-4 w-4" />
                            </div>
                            <p>
                              {searchTerm ? 'Nenhum item encontrado para sua busca' : 'Nenhum item adicionado ainda'}
                            </p>
                            {!searchTerm && permissions.canCreate && (
                              <Button size="sm" onClick={handleAddRow}>
                                <Plus className="h-4 w-4 mr-2" />
                                Adicionar primeiro item
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row, index) => (
                        <TableRow 
                          key={row.id} 
                          className={`hover:bg-slate-50/80 transition-all duration-200 border-b border-slate-100 ${
                            editingRow === row.id ? 'bg-gradient-to-r from-blue-50/90 to-indigo-50/60 border-l-4 border-l-blue-500 shadow-lg ring-2 ring-blue-200/40 transform scale-[1.001]' : index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                          }`}
                        >
                          <TableCell className="p-2 sticky left-0 bg-inherit z-10 border-r border-slate-200">
                            <div className="flex items-center justify-center space-x-1">
                              {editingRow === row.id ? (
                                <div className="flex items-center space-x-1">
                                  <Button
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleSaveRow(row.id)}
                                      disabled={isUpdating}
                                      className="h-7 px-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all duration-200 disabled:opacity-50 shadow-md text-xs font-medium"
                                    >
                                    {isUpdating ? (
                                      <div className="animate-spin h-3 w-3 mr-1 border border-white border-t-transparent rounded-full" />
                                    ) : (
                                      <Save className="h-3 w-3 mr-1" />
                                    )}
                                    <span>{isUpdating ? 'Salvando...' : 'Salvar'}</span>
                                  </Button>
                                  <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleCancelEdit(row.id)}
                                      disabled={isUpdating}
                                      className="h-7 px-2 hover:bg-red-50 hover:text-red-600 hover:border-red-300 transition-all duration-200 disabled:opacity-50 text-xs font-medium"
                                    >
                                    <X className="h-3 w-3 mr-1" />
                                    <span>Cancelar</span>
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-1">
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingRow(row.id)}
                                      className="h-7 px-2 hover:bg-blue-50 hover:text-blue-600 transition-all duration-200 shadow-sm border border-transparent hover:border-blue-200 text-xs font-medium"
                                    >
                                    <Edit className="h-3 w-3 mr-1" />
                                    <span>Editar</span>
                                  </Button>
                                  {permissions.canDelete && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteRow(row.id)}
                                      className="h-7 px-2 hover:bg-red-50 hover:text-red-600 text-xs font-medium"
                                    >
                                      <Trash2 className="h-3 w-3 mr-1" />
                                      <span>Excluir</span>
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          
                          {visibleColumns.map((column) => {
                            const canEditThisColumn = canEditColumn(column.column_key);
                            
                            // Para colunas estáticas (como descricao), usar diretamente a propriedade da linha
                            // Para colunas dinâmicas, usar o valor do dynamic_data
                            let value;
                            if (column.is_system_column && column.column_key in row && column.column_key !== 'dynamic_data') {
                              // Coluna estática - usar valor direto da linha
                              value = row[column.column_key as keyof ProjectRow];
                            } else {
                              // Coluna dinâmica - usar valor do dynamic_data ou propriedade mesclada
                              value = row[column.column_key as keyof ProjectRow];
                            }
                            
                            // Debug específico para coluna descrição
                            if (column.column_key === 'descricao') {
                              console.log('🔍 Debug descrição:', {
                                rowId: row.id,
                                isEditing: editingRow === row.id,
                                canEdit: canEditThisColumn,
                                isSystemColumn: column.is_system_column,
                                staticValue: row.descricao,
                                dynamicValue: (row.dynamic_data as any)?.descricao,
                                mergedValue: row[column.column_key],
                                editedValue: editedData[row.id]?.[column.column_key],
                                finalValue: value
                              });
                            }

                            return (
                              <TableCell 
                                key={column.column_key}
                                className="p-2 text-center border-r border-slate-100/60 last:border-r-0"
                                style={{ 
                                  width: column.column_width === '120px' ? '140px' : column.column_width === '100px' ? '120px' : column.column_width,
                                  minWidth: column.column_width === '120px' ? '140px' : column.column_width === '100px' ? '120px' : column.column_width
                                }}
                              >
                                {editingRow === row.id && canEditThisColumn ? (
                                  <div className="relative group">
                                    <Input
                                      type={column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' ? 'number' : 'text'}
                                      value={editedData[row.id]?.[column.column_key] !== undefined ? editedData[row.id][column.column_key] : (value ?? '')}
                                      onChange={(e) => {
                                        const newValue = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                          ? Number(e.target.value) || 0
                                          : e.target.value;
                                        
                                        handleFieldChange(row.id, column.column_key, newValue);
                                      }}
                                      onBlur={(e) => {
                                        const newValue = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                          ? Number(e.target.value) || 0
                                          : e.target.value;
                                        
                                        handleFieldChange(row.id, column.column_key, newValue);
                                      }}
                                      onFocus={(e) => {
                                        // Preservar posição do scroll ao focar
                                        const scrollContainer = e.currentTarget.closest('.scroll-area');
                                        if (scrollContainer) {
                                          const currentScrollLeft = scrollContainer.scrollLeft;
                                          setTimeout(() => {
                                            scrollContainer.scrollLeft = currentScrollLeft;
                                          }, 0);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                        if (e.key === 'Escape') {
                                          handleCancelEdit(row.id);
                                        }
                                      }}
                                      className="h-8 text-sm border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200/50 transition-all duration-200 bg-white shadow-sm text-center w-full"
                                      step={column.column_type === 'currency' ? '0.01' : column.column_type === 'percentage' ? '0.1' : '1'}
                                      autoFocus={column.column_key === 'descricao'}
                                      placeholder={`${column.column_label}...`}
                                    />
                                    {column.column_type === 'currency' && (
                                      <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 pointer-events-none font-medium">
                                        R$
                                      </span>
                                    )}
                                    {column.column_type === 'percentage' && (
                                      <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-blue-600 pointer-events-none font-medium">
                                        %
                                      </span>
                                    )}
                                    <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 to-blue-400 transform scale-x-0 group-focus-within:scale-x-100 transition-transform duration-200"></div>
                                  </div>
                                ) : (
                                <div 
                                  className="group cursor-pointer hover:bg-blue-50/70 transition-all duration-200 p-2 rounded border border-transparent hover:border-blue-200 hover:shadow-sm min-h-[32px] flex items-center justify-center"
                                  onClick={(e) => {
                                    if (canEditThisColumn) {
                                      // Preservar posição do scroll antes de editar
                                      const scrollContainer = e.currentTarget.closest('.scroll-area');
                                      const currentScrollLeft = scrollContainer?.scrollLeft || 0;
                                      
                                      setEditingRow(row.id);
                                      
                                      // Restaurar posição do scroll após a edição começar
                                      setTimeout(() => {
                                        if (scrollContainer) {
                                          scrollContainer.scrollLeft = currentScrollLeft;
                                        }
                                      }, 0);
                                    }
                                  }}
                                  title={canEditThisColumn ? `✏️ Clique para editar ${column.column_label}` : 'Sem permissão para editar'}
                                >
                                  <div className="flex items-center justify-center relative w-full">
                                    <span className="text-sm text-slate-700 font-medium break-words text-center">
                                      {formatValue(value, column.column_type)}
                                    </span>
                                    {canEditThisColumn && (
                                      <Edit className="h-3 w-3 text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow-sm" />
                                    )}
                                  </div>
                                </div>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
            
            {filteredRows.length > 0 && (
              <div className="p-4 bg-muted/20 border-t">
                <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-6 rounded-xl border border-blue-100 shadow-sm">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                    📈 Resumo Financeiro
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="text-center bg-white/60 p-4 rounded-lg border border-blue-100">
                      <p className="text-sm text-blue-600 font-medium mb-1">CC MAT Total</p>
                      <p className="text-xl font-bold text-blue-800">
                        {formatValue(totals.cc_mat_total, 'currency')}
                      </p>
                    </div>
                    <div className="text-center bg-white/60 p-4 rounded-lg border border-green-100">
                      <p className="text-sm text-green-600 font-medium mb-1">CC MO Total</p>
                      <p className="text-xl font-bold text-green-800">
                        {formatValue(totals.cc_mo_total, 'currency')}
                      </p>
                    </div>
                    <div className="text-center bg-white/60 p-4 rounded-lg border border-purple-100">
                      <p className="text-sm text-purple-600 font-medium mb-1">Valor Estimado</p>
                      <p className="text-xl font-bold text-purple-800">
                        {formatValue(totals.vlr_total_estimado, 'currency')}
                      </p>
                    </div>
                    <div className="text-center bg-white/60 p-4 rounded-lg border border-orange-100">
                      <p className="text-sm text-orange-600 font-medium mb-1">Valor Venda</p>
                      <p className="text-xl font-bold text-orange-800">
                        {formatValue(totals.vlr_total_venda, 'currency')}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground flex items-center justify-end mt-4">
                  <span>{filteredRows.length} itens exibidos</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectGrid;
