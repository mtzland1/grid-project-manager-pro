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
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
    loadMessages();
    
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [project.id]);

  useEffect(() => {
    if (currentUserId) {
      setupRealtimeSubscription();
    }
  }, [currentUserId, project.id]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      setCurrentUserEmail(user.email || '');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('project_chat_messages')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Buscar emails dos usuários separadamente
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
    } catch (error) {
      console.error('Error loading messages:', error);
      toast({
        title: "Erro ao carregar mensagens",
        description: "Não foi possível carregar as mensagens do chat",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    console.log('Setting up realtime subscription for project:', project.id);
    
    const channel = supabase
      .channel(`project-chat-${project.id}`, {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        async (payload) => {
          console.log('Received new message:', payload);
          const newMsg = payload.new as ChatMessage;
          
          // Buscar informações do usuário para mensagem em tempo real
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
              console.log('Could not fetch user email for real-time message:', err);
            }
          }
          
          setMessages(prev => {
            // Verificar se a mensagem já existe para evitar duplicatas
            const exists = prev.some(msg => msg.id === newMsg.id);
            if (exists) {
              console.log('Message already exists, skipping duplicate');
              return prev;
            }
            
            const newMessages = [...prev, {
              ...newMsg,
              user_email: userDisplay
            }];
            
            console.log('Adding new message to state, total messages:', newMessages.length);
            return newMessages;
          });

          // Auto-scroll para nova mensagem
          setTimeout(() => scrollToBottom(), 100);

          // Mostrar notificação para mensagens de outros usuários
          if (newMsg.user_id !== currentUserId) {
            toast({
              title: "Nova mensagem",
              description: `${userDisplay}: ${newMsg.message.substring(0, 50)}${newMsg.message.length > 50 ? '...' : ''}`,
            });
          }
        }
      )
      .on('presence', { event: 'sync' }, () => {
        console.log('Presence sync');
        setIsConnected(true);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined:', key);
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        console.log('User left:', key);
      })
      .subscribe((status) => {
        console.log('Subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
        
        if (status === 'SUBSCRIBED') {
          // Enviar presença para indicar que estamos online
          channel.track({
            user_id: currentUserId,
            user_email: currentUserEmail,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    const messageToSend = newMessage.trim();
    
    try {
      console.log('Sending message:', messageToSend);
      
      const { data, error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: project.id,
          user_id: currentUserId,
          message: messageToSend,
        })
        .select()
        .single();

      if (error) {
        console.error('Error sending message:', error);
        throw error;
      }

      console.log('Message sent successfully:', data);

      // Adicionar mensagem imediatamente ao estado local para resposta rápida
      if (data) {
        setMessages(prev => {
          const exists = prev.some(msg => msg.id === data.id);
          if (exists) return prev;
          
          return [...prev, {
            ...data,
            user_email: 'Você'
          }];
        });
      }

      setNewMessage('');
      
      // Focus no input para facilitar digitação contínua
      setTimeout(() => {
        inputRef.current?.focus();
        scrollToBottom();
      }, 50);
      
    } catch (error) {
      console.error('Error sending message:', error);
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

  // Format message time with better date handling
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

  // Get initials for avatar
  const getInitials = (userEmail: string) => {
    if (userEmail === 'Você') return 'EU';
    if (userEmail.startsWith('Usuário')) return userEmail.slice(-4);
    return userEmail.substring(0, 2).toUpperCase();
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Hoje';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Ontem';
    } else {
      return date.toLocaleDateString('pt-BR');
    }
  };

  const groupMessagesByDate = (messages: ChatMessage[]) => {
    const groups: { [key: string]: ChatMessage[] } = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });

    return Object.entries(groups).map(([date, msgs]) => ({
      date,
      messages: msgs
    }));
  };

  if (loading) {
    return (
      <Card className="h-[500px] flex items-center justify-center">
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
            <span>Chat do Projeto</span>
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
          Converse em tempo real com sua equipe
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
                    (new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() > 300000); // 5 minutes
                  
                  return (
                    <div key={message.id} className="space-y-2">
                      {showTimestamp && (
                        <div className="text-center text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">
                            {formatMessageTime(message.created_at)}
                          </Badge>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''} group`}>
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
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectChat;