import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, Save, Trash2, Edit, Search, Download, MessageCircle, Filter, MoreVertical } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
    <div className="min-h-screen bg-background">
      {/* Header moderno com gradiente sutil */}
      <header className="bg-card/95 backdrop-blur-sm shadow-sm border-b sticky top-0 z-50">
        <div className="container mx-auto px-6">
          <div className="flex justify-between items-center h-16">
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar itens..."
                  className="pl-10 w-72 bg-background/50"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              
              <Button variant="outline" size="sm">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
              
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
                  <DropdownMenuItem>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar Excel
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Cards de totais mais modernos */}
      <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <div className="container mx-auto px-6 py-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Material</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatValue(totals.cc_mat_total, 'currency')}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-blue-500 rounded-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-green-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Mão de Obra</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatValue(totals.cc_mo_total, 'currency')}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-green-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-green-500 rounded-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-purple-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Estimado</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatValue(totals.vlr_total_estimado, 'currency')}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-purple-500 rounded-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-orange-500 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Venda</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatValue(totals.vlr_total_venda, 'currency')}
                    </p>
                  </div>
                  <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <div className="h-4 w-4 bg-orange-500 rounded-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Tabela moderna */}
      <div className="container mx-auto px-6 py-6">
        <Card className="shadow-lg border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Itens do Projeto</CardTitle>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-xs">
                  {filteredRows.length} de {rows.length} itens
                </Badge>
                {editingRow && (
                  <Badge variant="outline" className="text-xs animate-pulse">
                    Editando...
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="p-0">
            <div className="rounded-lg border bg-background overflow-hidden">
              <ScrollArea className="h-[calc(100vh-400px)]">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-24 font-semibold">Ações</TableHead>
                      {visibleColumns.map((column) => (
                        <TableHead 
                          key={column.column_key}
                          className="font-semibold text-foreground"
                          style={{ width: column.column_width, minWidth: column.column_width }}
                        >
                          <div className="flex items-center space-x-2">
                            <span>{column.column_label}</span>
                            {column.is_calculated && (
                              <Badge variant="outline" className="text-xs px-1 py-0">
                                Calc
                              </Badge>
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
                          className={`hover:bg-muted/30 transition-colors ${
                            editingRow === row.id ? 'bg-primary/5 border-primary/20' : ''
                          }`}
                        >
                          <TableCell className="p-3">
                            <div className="flex items-center space-x-1">
                              {editingRow === row.id ? (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => setEditingRow(null)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Save className="h-3 w-3" />
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingRow(row.id)}
                                  className="h-8 w-8 p-0 hover:bg-primary/10"
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => permissions.canDelete ? handleDeleteRow(row.id) : null}
                                disabled={!permissions.canDelete}
                                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </TableCell>
                          
                          {visibleColumns.map((column) => {
                            const canEditThisColumn = canEditColumn(column.column_key);
                            const value = row[column.column_key as keyof ProjectRow];

                            return (
                              <TableCell 
                                key={column.column_key}
                                className="p-3"
                                style={{ width: column.column_width, minWidth: column.column_width }}
                              >
                                {editingRow === row.id && !column.is_calculated && canEditThisColumn ? (
                                  <Input
                                    type={column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' ? 'number' : 'text'}
                                    value={value || ''}
                                    onChange={(e) => {
                                      const newValue = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                        ? Number(e.target.value) || 0
                                        : e.target.value;
                                      
                                      setRows(rows.map(r => 
                                        r.id === row.id 
                                          ? { ...r, [column.column_key]: newValue }
                                          : r
                                      ));
                                    }}
                                    onBlur={(e) => {
                                      const newValue = column.column_type === 'number' || column.column_type === 'currency' || column.column_type === 'percentage' 
                                        ? Number(e.target.value) || 0
                                        : e.target.value;
                                      handleUpdateRow(row.id, { [column.column_key]: newValue });
                                    }}
                                    className="h-8 border-primary/20 focus:border-primary"
                                    step={column.column_type === 'currency' ? '0.01' : column.column_type === 'percentage' ? '0.1' : '1'}
                                  />
                                ) : (
                                  <div className={`text-sm ${
                                    column.is_calculated 
                                      ? 'font-semibold text-primary' 
                                      : column.column_type === 'currency' 
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground'
                                  }`}>
                                    {formatValue(value, column.column_type)}
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
              <div className="p-4 bg-muted/20 border-t text-xs text-muted-foreground flex items-center justify-between">
                <span>* Campos marcados como "Calc" são calculados automaticamente</span>
                <span>{filteredRows.length} itens exibidos</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProjectGrid;
