import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Wifi, WifiOff, Loader2 } from 'lucide-react';
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
  // Estados principais
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  
  // Estados do usuário
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  
  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const userMapRef = useRef<Map<string, string>>(new Map());
  
  const { toast } = useToast();

  // ============= INICIALIZAÇÃO =============
  useEffect(() => {
    console.log('🚀 Inicializando chat para projeto:', project.id);
    initializeChat();
    
    return () => {
      console.log('🧹 Limpando chat...');
      cleanup();
    };
  }, [project.id]);

  // Auto-scroll sempre que mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // ============= FUNÇÕES PRINCIPAIS =============
  
  const initializeChat = async () => {
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
      console.log('📥 Carregando mensagens...');
      await loadMessages(user.id);
      
      // 3. Configurar realtime
      console.log('⚡ Configurando realtime...');
      setupRealtime(user.id);
      
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
  };

  const loadMessages = async (userId: string) => {
    try {
      // Buscar mensagens
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

        // Criar mapa de usuários
        const userMap = new Map();
        usersData?.forEach(user => {
          userMap.set(user.id, user.email);
        });
        userMapRef.current = userMap;
      }

      // Mapear mensagens com informações dos usuários
      const messagesWithUsers = messagesData?.map(msg => ({
        ...msg,
        user_email: getUserDisplayName(msg.user_id, userId)
      })) || [];

      setMessages(messagesWithUsers);
      console.log('✅ Carregadas', messagesWithUsers.length, 'mensagens');
      
    } catch (error) {
      console.error('❌ Erro ao carregar mensagens:', error);
      throw error;
    }
  };

  const setupRealtime = (userId: string) => {
    // Limpar conexão anterior
    cleanup();

    console.log('🔌 Configurando canal realtime...');
    
    const channel = supabase
      .channel(`chat-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        async (payload) => {
          console.log('📨 Nova mensagem recebida:', payload);
          await handleNewMessage(payload.new as ChatMessage, userId);
        }
      )
      .subscribe((status) => {
        console.log('📡 Status da conexão:', status);
        setConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Conectado ao realtime!');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('❌ Erro na conexão, tentando reconectar...');
          setTimeout(() => setupRealtime(userId), 2000);
        }
      });

    channelRef.current = channel;
  };

  const handleNewMessage = async (newMsg: ChatMessage, userId: string) => {
    try {
      // Se não temos informações do usuário, buscar
      if (!userMapRef.current.has(newMsg.user_id) && newMsg.user_id !== userId) {
        const { data: userData } = await supabase
          .from('user_emails')
          .select('email')
          .eq('id', newMsg.user_id)
          .maybeSingle();
        
        if (userData?.email) {
          userMapRef.current.set(newMsg.user_id, userData.email);
        }
      }

      const messageWithUser = {
        ...newMsg,
        user_email: getUserDisplayName(newMsg.user_id, userId)
      };

      // Adicionar à lista de mensagens
      setMessages(prev => {
        // Evitar duplicatas
        if (prev.some(msg => msg.id === newMsg.id)) {
          console.log('📝 Mensagem já existe, ignorando...');
          return prev;
        }
        
        console.log('✅ Adicionando nova mensagem');
        return [...prev, messageWithUser];
      });

    } catch (error) {
      console.error('❌ Erro ao processar nova mensagem:', error);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !connected || !currentUserId) {
      console.log('⚠️ Não é possível enviar mensagem:', {
        hasText: !!newMessage.trim(),
        sending,
        connected,
        hasUser: !!currentUserId
      });
      return;
    }

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage(''); // Limpar imediatamente para UX fluída
    
    try {
      console.log('📤 Enviando mensagem:', messageText);
      
      const { data, error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: project.id,
          user_id: currentUserId,
          message: messageText,
        })
        .select()
        .single();

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

  // ============= FUNÇÕES AUXILIARES =============
  
  const getUserDisplayName = (userId: string, currentUserId: string): string => {
    if (userId === currentUserId) return 'Você';
    
    const email = userMapRef.current.get(userId);
    if (email) return email;
    
    return `Usuário ${userId.slice(-4)}`;
  };

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth',
        block: 'end'
      });
    }, 50);
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const cleanup = () => {
    if (channelRef.current) {
      console.log('🧹 Removendo canal realtime...');
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
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

  // ============= RENDERIZAÇÃO =============
  
  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
          <p className="text-muted-foreground">Carregando chat...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col shadow-lg border-2 border-primary/10">
      {/* Header */}
      <CardHeader className="pb-3 flex-shrink-0 bg-gradient-to-r from-primary/5 to-primary/10 border-b">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageCircle className="h-6 w-6 text-primary" />
            <div>
              <h3 className="text-lg font-semibold">Chat em Tempo Real</h3>
              <p className="text-sm text-muted-foreground font-normal">
                {connected ? 'Conectado e sincronizado' : 'Conectando...'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"} className="gap-1">
              {connected ? (
                <>
                  <Wifi className="h-3 w-3" />
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

      {/* Messages Area */}
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar uma mensagem!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.user_id === currentUserId;
                  const showTime = index === 0 || 
                    (new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000);
                  
                  return (
                    <div key={message.id} className="space-y-2">
                      {showTime && (
                        <div className="text-center">
                          <Badge variant="outline" className="text-xs px-2 py-1">
                            {formatTime(message.created_at)}
                          </Badge>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} animate-fade-in`}>
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
                          }`}>
                            <span className="font-medium">{message.user_email}</span>
                            <span className="ml-2">{formatTime(message.created_at)}</span>
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

        {/* Input Area */}
        <div className="border-t bg-background p-4 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder={connected ? "Digite sua mensagem..." : "Conectando..."}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={!connected || sending}
                className="border-2 border-primary/20 focus:border-primary/50 rounded-xl min-h-[48px] text-sm"
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
              className="h-[48px] w-[48px] p-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            >
              {sending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          {!connected && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Tentando reconectar...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectChat;