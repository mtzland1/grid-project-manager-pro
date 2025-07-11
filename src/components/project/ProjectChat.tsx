import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { MessageCircle, Send, Users, User, Clock } from 'lucide-react';
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    getCurrentUser();
    loadMessages();
    setupRealtimeSubscription();
  }, [project.id]);

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
    const channel = supabase
      .channel(`project-chat-${project.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_chat_messages',
          filter: `project_id=eq.${project.id}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          
          // Buscar email do usuário para mensagens em tempo real
          let userDisplay = newMsg.user_id === currentUserId ? 'Você' : `Usuário ${newMsg.user_id.slice(-4)}`;
          
          try {
            const { data: userInfo } = await supabase
              .from('user_emails')
              .select('email')
              .eq('id', newMsg.user_id)
              .single();
            
            if (userInfo && newMsg.user_id !== currentUserId) {
              userDisplay = userInfo.email;
            }
          } catch (err) {
            console.log('Could not fetch user email for real-time message');
          }
          
          setMessages(prev => {
            const newMessages = [...prev, {
              ...newMsg,
              user_email: userDisplay
            }];
            // Force scroll após adicionar nova mensagem
            setTimeout(() => scrollToBottom(), 100);
            return newMessages;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const { error } = await supabase
        .from('project_chat_messages')
        .insert({
          project_id: project.id,
          user_id: currentUserId,
          message: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage('');
      // Force scroll após enviar mensagem
      setTimeout(() => scrollToBottom(), 100);
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: "Não foi possível enviar a mensagem",
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
    <Card className="h-[500px] flex flex-col overflow-hidden">
      <CardHeader className="pb-3 flex-shrink-0">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MessageCircle className="h-5 w-5" />
          Chat do Projeto
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {messages.length} {messages.length === 1 ? 'mensagem' : 'mensagens'}
        </p>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full px-4">
            <div className="space-y-4 pb-4">
              {messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p className="text-lg font-medium">Nenhuma mensagem ainda</p>
                  <p className="text-sm">Seja o primeiro a enviar uma mensagem!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwn = message.user_id === currentUserId;
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}
                    >
                      <Avatar className="h-8 w-8 mt-1 flex-shrink-0">
                        <AvatarFallback className={`text-xs ${isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {getInitials(message.user_email || 'U')}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex-1 max-w-[calc(100%-3rem)] ${isOwn ? 'text-right' : ''}`}>
                        <div className={`inline-block rounded-lg px-3 py-2 max-w-full ${
                          isOwn 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-muted'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {message.message}
                          </p>
                        </div>
                        
                        <div className={`flex items-center gap-1 mt-1 text-xs text-muted-foreground ${
                          isOwn ? 'justify-end' : 'justify-start'
                        }`}>
                          <User className="h-3 w-3" />
                          <span className="truncate max-w-24">{message.user_email}</span>
                          <Clock className="h-3 w-3 ml-2" />
                          <span>{formatMessageTime(message.created_at)}</span>
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
        <div className="border-t bg-background p-4 flex-shrink-0">
          <div className="flex gap-2">
            <Input
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={sending}
              className="flex-1"
            />
            <Button 
              onClick={sendMessage} 
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="flex-shrink-0"
            >
              {sending ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectChat;