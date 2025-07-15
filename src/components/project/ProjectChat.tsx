import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Users, User, Clock, Wifi, WifiOff } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';
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
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const realtimeChannelRef = useRef<any>(null);
  const { toast } = useToast();

  // Inicializar tudo quando o componente montar
  useEffect(() => {
    console.log('🚀 ProjectChat mounted for project:', project.id);
    initializeChat();
    
    return () => {
      console.log('🔥 ProjectChat unmounting, cleaning up...');
      cleanupRealtime();
    };
  }, [project.id]);

  // Auto-scroll quando mensagens mudarem
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Configurar realtime após obter o usuário
  useEffect(() => {
    if (currentUserId && !loading) {
      console.log('🔌 User loaded, setting up realtime...');
      setupRealtime();
    }
  }, [currentUserId, loading]);

  const initializeChat = async () => {
    try {
      console.log('🔑 Getting current user...');
      await getCurrentUser();
      console.log('📥 Loading initial messages...');
      await loadMessages();
    } catch (error) {
      console.error('❌ Error initializing chat:', error);
      toast({
        title: "Erro ao inicializar chat",
        description: "Tente recarregar a página",
        variant: "destructive",
      });
    }
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      console.error('❌ Error getting user:', error);
      return;
    }
    
    if (user) {
      console.log('✅ Current user:', user.id, user.email);
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || '');
    }
  };

  const loadMessages = async () => {
    try {
      setLoading(true);
      console.log('📥 Loading messages for project:', project.id);
      
      const { data, error } = await supabase
        .from('project_chat_messages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('❌ Error loading messages:', error);
        throw error;
      }

      console.log('✅ Loaded', data?.length || 0, 'messages');

      // Buscar informações dos usuários
      const userIds = [...new Set((data || []).map(msg => msg.user_id))];
      const { data: users } = await supabase
        .from('user_emails')
        .select('id, email')
        .in('id', userIds);

      const userMap = new Map(users?.map(user => [user.id, user.email]) || []);

      // Mapear mensagens com informações dos usuários
      const messagesWithUsers = (data || []).map((msg) => ({
        ...msg,
        user_email: msg.user_id === currentUserId ? 'Você' : userMap.get(msg.user_id) || `Usuário ${msg.user_id.slice(-4)}`
      }));

      setMessages(messagesWithUsers);
      console.log('✅ Messages state updated');
    } catch (error) {
      console.error('❌ Error loading messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens do chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtime = () => {
    // Limpar canal anterior se existir
    cleanupRealtime();

    if (!currentUserId) {
      console.log('⏳ No user ID available for realtime setup');
      setIsConnected(false);
      return;
    }

    console.log('⚡ Setting up realtime subscription for user:', currentUserId);
    
    const channel = supabase
      .channel(`chat_project_${project.id}_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        async (payload) => {
          console.log('📨 NEW MESSAGE RECEIVED:', payload);
          const newMsg = payload.new as ChatMessage;
          
          // Buscar informação do usuário para a nova mensagem
          let userDisplay = `Usuário ${newMsg.user_id.slice(-4)}`;
          
          if (newMsg.user_id === currentUserId) {
            userDisplay = 'Você';
          } else {
            try {
              const { data: userInfo } = await supabase
                .from('user_emails')
                .select('email')
                .eq('id', newMsg.user_id)
                .maybeSingle();
              
              if (userInfo?.email) {
                userDisplay = userInfo.email;
              }
            } catch (err) {
              console.log('⚠️ Could not fetch user email:', err);
            }
          }
          
          const messageWithUser = {
            ...newMsg,
            user_email: userDisplay
          };

          console.log('📝 Adding message to state:', messageWithUser);
          
          // Adicionar mensagem ao estado de forma segura
          setMessages(prevMessages => {
            // Verificar se já existe para evitar duplicatas
            const exists = prevMessages.some(msg => msg.id === newMsg.id);
            if (exists) {
              console.log('🔄 Message already exists, skipping...');
              return prevMessages;
            }
            
            const newMessages = [...prevMessages, messageWithUser];
            console.log('✅ Messages updated. Total:', newMessages.length);
            return newMessages;
          });
        }
      )
      .subscribe((status) => {
        console.log('🔌 Subscription status changed to:', status);
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ Successfully subscribed to realtime!');
          setIsConnected(true);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ Channel error or timeout, connection failed');
          setIsConnected(false);
          
          // Tentar reconectar após 3 segundos
          setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            setupRealtime();
          }, 3000);
        } else if (status === 'CLOSED') {
          console.log('🔌 Channel closed');
          setIsConnected(false);
        } else {
          console.log('🔌 Connection status:', status);
          setIsConnected(false);
        }
      });

    realtimeChannelRef.current = channel;
  };

  const cleanupRealtime = () => {
    if (realtimeChannelRef.current) {
      console.log('🧹 Cleaning up realtime channel...');
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending || !currentUserId || !isConnected) {
      console.log('❌ Cannot send message:', { 
        hasMessage: !!newMessage.trim(), 
        sending, 
        hasUserId: !!currentUserId, 
        isConnected 
      });
      return;
    }

    const messageText = newMessage.trim();
    setSending(true);
    setNewMessage(''); // Limpar imediatamente para UX rápida
    
    try {
      console.log('📤 Sending message:', messageText);
      
      const { data, error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: project.id,
          user_id: currentUserId,
          message: messageText,
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error sending message:', error);
        throw error;
      }

      console.log('✅ Message sent successfully:', data);
      
      // Focus no input para continuar digitando
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
    } catch (error) {
      console.error('❌ Error sending message:', error);
      // Restaurar mensagem em caso de erro
      setNewMessage(messageText);
      toast({
        title: "Erro ao enviar mensagem",
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

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'end' 
      });
    }, 100);
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    
    if (isToday(date)) {
      return format(date, 'HH:mm', { locale: ptBR });
    } else if (isYesterday(date)) {
      return `Ontem às ${format(date, 'HH:mm', { locale: ptBR })}`;
    } else {
      return format(date, 'dd/MM/yyyy HH:mm', { locale: ptBR });
    }
  };

  const getInitials = (userEmail: string) => {
    if (userEmail === 'Você') return 'EU';
    if (userEmail.startsWith('Usuário')) return userEmail.slice(-4);
    return userEmail.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <Card className="h-[600px] flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <MessageCircle className="h-8 w-8 mx-auto mb-2 animate-pulse" />
          <p>Carregando chat...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="h-[600px] flex flex-col overflow-hidden shadow-lg border-2 border-primary/20">
      <CardHeader className="pb-3 flex-shrink-0 bg-gradient-to-r from-primary/5 to-primary/10">
        <CardTitle className="flex items-center justify-between text-lg">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6 text-primary" />
            <span>Chat em Tempo Real</span>
            <Badge variant={isConnected ? "default" : "secondary"} className="ml-2">
              {isConnected ? (
                <>
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </>
              ) : (
                <>
                  <WifiOff className="h-3 w-3 mr-1" />
                  Conectando...
                </>
              )}
            </Badge>
          </div>
          <Badge variant="outline" className="text-xs">
            {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
          </Badge>
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Mensagens instantâneas • Como WhatsApp
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/20">
          <ScrollArea className="h-full px-4">
            <div className="space-y-4 pb-4 pt-4">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="relative">
                    <MessageCircle className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <div className="absolute -top-1 -right-1 h-4 w-4 bg-primary rounded-full animate-pulse" />
                  </div>
                  <p className="text-xl font-semibold mb-2">Chat vazio</p>
                  <p className="text-sm">Inicie a conversa enviando a primeira mensagem!</p>
                </div>
              ) : (
                messages.map((message, index) => {
                  const isOwn = message.user_id === currentUserId;
                  const showTimestamp = index === 0 || 
                    (new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000);
                  
                  return (
                    <div key={message.id} className="space-y-2">
                      {showTimestamp && (
                        <div className="text-center text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {formatMessageTime(message.created_at)}
                          </Badge>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} group animate-fade-in`}>
                        <Avatar className="h-10 w-10 mt-1 flex-shrink-0 ring-2 ring-background">
                          <AvatarFallback className={`text-sm font-semibold ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
                          }`}>
                            {getInitials(message.user_email || 'U')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className={`flex-1 max-w-[calc(100%-4rem)] ${isOwn ? 'text-right' : ''}`}>
                          <div className={`inline-block rounded-2xl px-4 py-3 max-w-full shadow-sm transition-all duration-200 group-hover:shadow-md ${
                            isOwn 
                              ? 'bg-primary text-primary-foreground rounded-br-md' 
                              : 'bg-card border border-border rounded-bl-md'
                          }`}>
                            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                              {message.message}
                            </p>
                          </div>
                          
                          <div className={`flex items-center gap-1 mt-2 text-xs text-muted-foreground/70 ${
                            isOwn ? 'justify-end' : 'justify-start'
                          }`}>
                            <User className="h-3 w-3" />
                            <span className="truncate max-w-32 font-medium">{message.user_email}</span>
                            <Clock className="h-3 w-3 ml-1" />
                            <span>{format(new Date(message.created_at), 'HH:mm', { locale: ptBR })}</span>
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

        {/* Message Input */}
        <div className="border-t bg-card/50 backdrop-blur-sm p-4 flex-shrink-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                ref={inputRef}
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                disabled={sending || !isConnected}
                className="min-h-[44px] resize-none border-2 border-primary/20 focus:border-primary/50 rounded-xl"
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
              disabled={!newMessage.trim() || sending || !isConnected}
              size="lg"
              className="h-[44px] w-[44px] p-0 rounded-xl shadow-md hover:shadow-lg transition-all duration-200"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
          
          {!isConnected && (
            <div className="mt-2 text-xs text-destructive flex items-center gap-1">
              <WifiOff className="h-3 w-3" />
              Reconectando...
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectChat;