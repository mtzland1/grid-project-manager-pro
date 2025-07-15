import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2, Edit, Search, Download, MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import ProjectChat from './ProjectChat';

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
  is_calculated: boolean;
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
  const { toast } = useToast();
  
  // Usar hook de permissões
  const { permissions, canViewColumn, canEditColumn } = useUserPermissions(project.id);

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
      const { data, error } = await supabase
        .from('project_items')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching rows:', error);
        toast({
          title: "Erro ao carregar dados",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // Merge static columns with dynamic data
      setRows((data || []).map(item => ({
        ...item,
        distribuidor: item.distribuidor || '',
        ...((item.dynamic_data as Record<string, any>) || {})
      })));
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

  useEffect(() => {
    loadProjectData();
    fetchRows();
    
    // Setup realtime subscription for columns
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
        () => {
          // Recarregar colunas quando houver mudanças
          loadProjectData();
        }
      )
      .subscribe();

    // Setup realtime subscription for project items (rows)
    const itemsChannel = supabase
      .channel(`project-items-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_items',
          filter: `project_id=eq.${project.id}`,
        },
        () => {
          // Recarregar dados quando houver mudanças
          fetchRows();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(columnsChannel);
      supabase.removeChannel(itemsChannel);
    };
  }, [project.id]);

  const calculateRow = (row: ProjectRow): ProjectRow => {
    const qtd = row.qtd || 0;
    const matUniPr = row.mat_uni_pr || 0;
    const desconto = row.desconto || 0;
    const ccMoUni = row.cc_mo_uni || 0;

    // Calculate unit cost with discount
    const ccMatUni = matUniPr * (1 - desconto / 100);
    
    return {
      ...row,
      cc_mat_uni: ccMatUni,
      cc_mat_total: ccMatUni * qtd,
      cc_mo_total: ccMoUni * qtd,
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

  const handleUpdateRow = async (rowId: string, updates: Partial<ProjectRow>) => {
    console.log('Starting update for row:', rowId, 'with updates:', updates);
    
    try {
      // Verificação de permissão simplificada
      const isAdmin = permissions.role === 'admin' || permissions.projectRole === 'admin';
      const isCollaborator = permissions.role === 'collaborator' || permissions.projectRole === 'collaborator';
      
      if (!isAdmin && !isCollaborator) {
        console.log('User does not have permission to edit');
        toast({
          title: "Acesso negado",
          description: "Você não tem permissão para editar",
          variant: "destructive",
        });
        return;
      }
      
      // Colunas estáticas do sistema
      const staticColumns = ['id', 'project_id', 'descricao', 'qtd', 'unidade', 'mat_uni_pr', 'desconto', 
                            'cc_mat_uni', 'cc_mat_total', 'cc_mo_uni', 'cc_mo_total', 'ipi', 'cc_pis_cofins',
                            'cc_icms_pr', 'cc_icms_revenda', 'cc_lucro_porcentagem', 'cc_lucro_valor', 
                            'cc_encargos_valor', 'cc_total', 'vlr_total_venda', 'vlr_total_estimado', 
                            'created_at', 'updated_at', 'distribuidor'];

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

      console.log('Static updates:', staticUpdates);
      console.log('Dynamic updates:', dynamicUpdates);

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

      console.log('Final update data:', updateData);

      // Executar a atualização
      const { error } = await supabase
        .from('project_items')
        .update(updateData)
        .eq('id', rowId);

      if (error) {
        console.error('Error updating row:', error);
        toast({
          title: "Erro ao salvar",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('Row updated successfully');

      // Atualizar estado local
      setRows(rows.map(row => 
        row.id === rowId 
          ? calculateRow({ ...row, ...updates })
          : row
      ));

      toast({
        title: "Dados salvos!",
        description: "Alterações salvas com sucesso",
      });
    } catch (err) {
      console.error('Error updating row:', err);
      toast({
        title: "Erro inesperado",
        description: "Não foi possível salvar os dados",
        variant: "destructive",
      });
    }
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
          currency: 'BRL'
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <p className="text-sm text-gray-500">
                  {rows.length} {rows.length === 1 ? 'item' : 'itens'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar itens..."
                  className="pl-10 w-64"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              {permissions.canCreate && (
                <Button onClick={handleAddRow}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Linha
                </Button>
              )}
              
              <Dialog open={showChat} onOpenChange={setShowChat}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Chat
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[80vh]">
                  <DialogHeader>
                    <DialogTitle>Chat do Projeto</DialogTitle>
                  </DialogHeader>
                  <ProjectChat project={project} />
                </DialogContent>
              </Dialog>
              
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Totals Summary */}
      <div className="bg-gray-50 border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Material</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatValue(totals.cc_mat_total, 'currency')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Mão de Obra</p>
            <p className="text-lg font-semibold text-green-600">
              {formatValue(totals.cc_mo_total, 'currency')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Estimado</p>
            <p className="text-lg font-semibold text-purple-600">
              {formatValue(totals.vlr_total_estimado, 'currency')}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Venda</p>
            <p className="text-lg font-semibold text-orange-600">
              {formatValue(totals.vlr_total_venda, 'currency')}
            </p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 sm:p-6 lg:p-8">
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="h-[calc(100vh-300px)]">
              <div className="overflow-x-auto">
                <div className="min-w-max">
                  {/* Header */}
                  <div className="flex bg-gray-50 border-b border-gray-200 sticky top-0">
                    {/* Ações sempre visíveis */}
                    <div className="w-20 p-3 border-r border-gray-200 font-medium text-sm text-gray-700">
                      Ações
                    </div>
                    {visibleColumns.map((column) => (
                      <div 
                        key={column.column_key}
                        className="p-3 border-r border-gray-200 font-medium text-sm text-gray-700"
                        style={{ width: column.column_width, minWidth: column.column_width }}
                      >
                        {column.column_label}
                        {column.is_calculated && (
                          <span className="ml-1 text-xs text-blue-600">*</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Rows */}
                  {filteredRows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {searchTerm ? 'Nenhum item encontrado' : 'Nenhum item adicionado ainda'}
                    </div>
                  ) : (
                    filteredRows.map((row, index) => (
                      <div key={row.id} className={`flex hover:bg-gray-50 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                        {/* Ações sempre visíveis */}
                        <div className="w-20 p-2 border-r border-gray-200 flex space-x-1">
                          {editingRow === row.id ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRow(null)}
                              className="cursor-pointer"
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingRow(row.id)}
                              className="cursor-pointer hover:bg-gray-100"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => permissions.canDelete ? handleDeleteRow(row.id) : null}
                            className={`text-red-600 ${!permissions.canDelete ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:text-red-700 hover:bg-red-50'}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        {visibleColumns.map((column) => {
                          const canEditThisColumn = canEditColumn(column.column_key);

                          return (
                            <div 
                              key={column.column_key}
                              className="p-2 border-r border-gray-200"
                              style={{ width: column.column_width, minWidth: column.column_width }}
                            >
                              {editingRow === row.id && !column.is_calculated && canEditThisColumn ? (
                                <Input
                                  type={column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' ? 'number' : 'text'}
                                  value={row[column.column_key as keyof ProjectRow] || ''}
                                  onChange={(e) => {
                                    // Atualizar estado local imediatamente
                                    const value = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                      ? Number(e.target.value) || 0
                                      : e.target.value;
                                    
                                    setRows(rows.map(r => 
                                      r.id === row.id 
                                        ? { ...r, [column.column_key]: value }
                                        : r
                                    ));
                                  }}
                                  onBlur={(e) => {
                                    // Salvar no banco apenas quando sair do campo
                                    const value = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                      ? Number(e.target.value) || 0
                                      : e.target.value;
                                    console.log('Saving field:', column.column_key, 'with value:', value);
                                    handleUpdateRow(row.id, { [column.column_key]: value });
                                  }}
                                  className="h-8 text-sm"
                                  step={column.column_type === 'currency' ? '0.01' : column.column_type === 'percentage' ? '0.1' : '1'}
                                />
                              ) : (
                                <span className={`text-sm ${column.is_calculated ? 'font-medium text-blue-600' : ''}`}>
                                  {formatValue(row[column.column_key as keyof ProjectRow], column.column_type)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
        
        <div className="mt-4 text-xs text-gray-500">
          * Campos calculados automaticamente
        </div>
      </div>
    </div>
  );
};

export default ProjectGrid;
