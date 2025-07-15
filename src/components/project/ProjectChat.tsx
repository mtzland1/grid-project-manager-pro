import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Wifi, WifiOff, Loader2, CheckCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChatMessage {
  id: string;
  project_id: string;
  user_id: string;
  message: string;
  created_at: string;
  user_email?: string;
}

interface Project {
  id: string;
  name: string;
}

interface ProjectChatProps {
  project: Project;
}

const ProjectChat = ({ project }: ProjectChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const userMapRef = useRef<Map<string, string>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();

  // Auto-scroll instantâneo sempre que mensagens mudarem
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const getUserDisplayName = (userId: string): string => {
    if (userId === currentUserId) return 'Você';
    
    const email = userMapRef.current.get(userId);
    if (email) return email;
    
    return `Usuário ${userId.slice(-4)}`;
  };

  const loadMessages = useCallback(async () => {
    try {
      console.log('📥 Carregando mensagens do projeto:', project.id);
      
      const { data: messagesData, error: messagesError } = await supabase
        .from('project_chat_messages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });

      if (messagesError) throw messagesError;

      // Buscar informações dos usuários únicos
      const userIds = [...new Set(messagesData?.map(msg => msg.user_id) || [])];
      
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from('user_emails')
          .select('id, email')
          .in('id', userIds);

        // Atualizar mapa de usuários
        usersData?.forEach(user => {
          userMapRef.current.set(user.id, user.email);
        });
      }

      // Mapear mensagens com informações dos usuários
      const messagesWithUsers = messagesData?.map(msg => ({
        ...msg,
        user_email: getUserDisplayName(msg.user_id)
      })) || [];

      setMessages(messagesWithUsers);
      console.log('✅ Carregadas', messagesWithUsers.length, 'mensagens');
      
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar o histórico do chat",
        variant: "destructive",
      });
    }
  }, [project.id, currentUserId, toast]);

  const handleNewMessage = useCallback(async (payload: any) => {
    const newMsg = payload.new as ChatMessage;
    console.log('📨 Nova mensagem recebida em tempo real:', newMsg);

    // Se não temos informações do usuário, buscar
    if (!userMapRef.current.has(newMsg.user_id) && newMsg.user_id !== currentUserId) {
      try {
        const { data: userData } = await supabase
          .from('user_emails')
          .select('email')
          .eq('id', newMsg.user_id)
          .maybeSingle();
        
        if (userData?.email) {
          userMapRef.current.set(newMsg.user_id, userData.email);
        }
      } catch (error) {
        console.error('Erro ao buscar dados do usuário:', error);
      }
    }

    const messageWithUser = {
      ...newMsg,
      user_email: getUserDisplayName(newMsg.user_id)
    };

    // Adicionar à lista de mensagens INSTANTANEAMENTE
    setMessages(prev => {
      // Evitar duplicatas
      if (prev.some(msg => msg.id === newMsg.id)) {
        console.log('📝 Mensagem já existe, ignorando...');
        return prev;
      }
      
      console.log('✅ Adicionando nova mensagem INSTANTANEAMENTE');
      return [...prev, messageWithUser];
    });
  }, [currentUserId]);

  const setupRealtime = useCallback(() => {
    // Limpar conexão anterior
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Limpar timeout de reconexão
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    console.log('🔌 Configurando canal realtime para chat instantâneo...');
    
    const channel = supabase
      .channel(`realtime-chat-${project.id}`, {
        config: {
          broadcast: { self: false },
          presence: { key: currentUserId }
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        handleNewMessage
      )
      .subscribe((status) => {
        console.log('📡 Status da conexão realtime:', status);
        setConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao chat em tempo real!');
          // Focus no input quando conectar
          setTimeout(() => {
            inputRef.current?.focus();
          }, 100);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Erro na conexão, tentando reconectar em 2s...');
          reconnectTimeoutRef.current = setTimeout(() => {
            setupRealtime();
          }, 2000);
        }
      });

    channelRef.current = channel;
  }, [project.id, currentUserId, handleNewMessage]);

  const initializeChat = useCallback(async () => {
    try {
      setLoading(true);
      
      // 1. Buscar usuário atual
      console.log('👤 Buscando usuário atual...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado');
      }
      
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || '');
      console.log('✅ Usuário encontrado:', user.email);
      
      // 2. Carregar mensagens existentes
      await loadMessages();
      
      // 3. Configurar realtime INSTANTÂNEO
      setupRealtime();
      
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      toast({
        title: "Erro no chat",
        description: "Não foi possível inicializar o chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [loadMessages, setupRealtime, toast]);

  useEffect(() => {
    initializeChat();
    
    return () => {
      console.log('🧹 Limpando chat...');
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [initializeChat]);

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !currentUserId) {
      console.log('⚠️ Não é possível enviar mensagem');
      return;
    }

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage(''); // Limpar IMEDIATAMENTE para UX fluída
    
    // Scroll para baixo imediatamente
    setTimeout(() => scrollToBottom(), 50);
    
    try {
      console.log('📤 Enviando mensagem INSTANTANEAMENTE:', messageText);
      
      const { error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: project.id,
          user_id: currentUserId,
          message: messageText,
        });

      if (error) throw error;

      console.log('✅ Mensagem enviada com sucesso!');
      
      // Focus no input para continuar digitando
      inputRef.current?.focus();
      
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error);
      
      // Restaurar mensagem em caso de erro
      setNewMessage(messageText);
      
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    return format(new Date(timestamp), 'HH:mm', { locale: ptBR });
  };

  const getInitials = (email: string) => {
    if (email === 'Você') return 'EU';
    if (email.startsWith('Usuário')) return email.slice(-4);
    return email.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Inicializando chat em tempo real...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col shadow-lg border-2 border-primary/10">
      {/* Header com indicador de conexão */}
      <CardHeader className="pb-3 flex-shrink-0 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Chat WhatsApp Style</h3>
              <p className="text-sm text-muted-foreground font-normal flex items-center gap-2">
                {connected ? (
                  <>
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Mensagens em tempo real ativas
                  </>
                ) : (
                  <>
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Reconectando...
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={connected ? "default" : "destructive"} className="gap-1 animate-pulse">
              {connected ? (
                <>
                  <CheckCheck className="h-3 w-3" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3" />
                  Offline
                </>
              )}
            </Badge>
            
            <Badge variant="outline" className="text-xs">
              {messages.length} mensagens
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>

      {/* Área de mensagens com scroll automático */}
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Chat em tempo real ativo!</p>
                  <p className="text-sm">As mensagens aparecerão instantaneamente</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.user_id === currentUserId;
                  const showTime = index === 0 || 
                    (new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000);
                  
                  return (
                    <div key={message.id} className="space-y-2 animate-fade-in">
                      {showTime && (
                        <div className="text-center">
                          <Badge variant="outline" className="text-xs px-2 py-1">
                            {formatTime(message.created_at)}
                          </Badge>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                        <Avatar className="h-10 w-10 flex-shrink-0 ring-2 ring-background shadow-sm">
                          <AvatarFallback className={`text-sm font-bold ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                          }`}>
                            {getInitials(message.user_email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className={`flex-1 max-w-[75%] ${isOwn ? 'text-right' : ''}`}>
                          <div className={`inline-block rounded-2xl px-4 py-3 shadow-sm transition-all ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground rounded-br-sm' 
                              : 'bg-muted border rounded-bl-sm'
                          }`}>
                            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                              {message.message}
                            </p>
                          </div>
                          
                          <div className={`mt-1 text-xs text-muted-foreground/70 ${
                            isOwn ? 'text-right' : 'text-left'
                          } flex items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                            <span className="font-medium">{message.user_email}</span>
                            <span>•</span>
                            <span>{formatTime(message.created_at)}</span>
                            {isOwn && connected && (
                              <CheckCheck className="h-3 w-3 text-primary ml-1" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Área de input otimizada */}
        <div className="border-t bg-background p-4 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={connected ? "Digite sua mensagem (Enter para enviar)..." : "Aguardando conexão..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!connected || sending}
                className="border-2 border-primary/20 focus:border-primary/50 rounded-xl min-h-[48px] text-sm transition-all"
                maxLength={1000}
                autoFocus
              />
              
              {newMessage.length > 800 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {1000 - newMessage.length} caracteres restantes
                </p>
              )}
            </div>
            
            <Button 
              onClick={sendMessage}
              disabled={!newMessage.trim() || !connected || sending}
              size="lg"
              className="h-[48px] w-[48px] p-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          {!connected && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1 animate-pulse">
              <WifiOff className="h-3 w-3" />
              Reconectando ao chat em tempo real...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectChat;