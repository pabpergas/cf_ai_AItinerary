import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { isToolUIPart } from "ai";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
import type { tools } from "./tools";

// Component imports
import { Button } from "@/components/button/Button";
import { Textarea } from "@/components/textarea/Textarea";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import { ItineraryDisplay } from "@/components/itinerary/ItineraryDisplay";
import { AuthModal } from "@/components/auth/AuthModal";

// Icon imports
import {
  PaperPlaneTilt,
  Stop,
  Plus,
  Sidebar,
  User,
  SignOut,
  MagnifyingGlass,
  Books,
  Folder,
  ChatCircle,
  PencilSimple,
  ArrowUp,
  Microphone,
  Paperclip
} from "@phosphor-icons/react";

// List of tools that require human confirmation - now empty since all tools execute automatically
const toolsRequiringConfirmation: (keyof typeof tools)[] = [];

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export default function AItinerary() {
  const [agentInput, setAgentInput] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<{
    activity: any;
    itinerary: any;
  } | null>(null);
  const [recentChats, setRecentChats] = useState<Array<{
    id: string;
    title: string;
    lastMessage: string;
    timestamp: string;
  }>>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userId] = useState(() => {
    // Generate or retrieve user ID from localStorage
    const stored = localStorage.getItem('aitinerary-user-id');
    if (stored) return stored;
    
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('aitinerary-user-id', newId);
    return newId;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleActivityClick = useCallback((activity: any, itinerary: any) => {
    setSelectedActivity({ activity, itinerary });
    
    // Populate input with context about the selected activity
    const contextMessage = `I want to discuss this activity from the itinerary:

**${activity.title}**
- Location: ${activity.location}
- Time: ${activity.startTime}${activity.endTime ? ` - ${activity.endTime}` : ''}
- Category: ${activity.category}
- Cost: $${activity.estimatedCost}
- Priority: ${activity.priority}
- Description: ${activity.description}

Activity ID: ${activity.id}
Itinerary ID: ${itinerary.id}

What would you like to know or change about this activity?`;

    setAgentInput(contextMessage);
    
    // Auto-resize textarea
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, 0);
  }, []);

  const handleSaveItinerary = useCallback(async (itinerary: any) => {
    const saveMessage = `Please save this itinerary for me:

Itinerary: ${JSON.stringify(itinerary)}
User ID: ${userId}
Make it public: false

Please save this itinerary so I can access it later.`;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: saveMessage }]
    });
  }, [sendMessage, userId]);

  const handleShareItinerary = useCallback(async (itinerary: any) => {
    const shareMessage = `Please share this itinerary publicly:

Itinerary: ${JSON.stringify(itinerary)}
User ID: ${user?.userId || userId}
Make it public: true

Please make this itinerary public and give me a shareable link.`;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: shareMessage }]
    });
  }, [sendMessage, user?.userId, userId]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    const loginMessage = `Please log me in with the following credentials:

Email: ${email}
Password: ${password}

Please authenticate this user and return their profile information.`;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: loginMessage }]
    });
  }, [sendMessage]);

  const handleRegister = useCallback(async (email: string, password: string, name: string) => {
    const registerMessage = `Please register a new user with the following information:

Name: ${name}
Email: ${email}
Password: ${password}

Please create this user account and log them in.`;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: registerMessage }]
    });
  }, [sendMessage]);

  const handleLogout = useCallback(() => {
    setUser(null);
    localStorage.removeItem('aitinerary-user');
    localStorage.removeItem('aitinerary-recent-chats');
    clearHistory();
    setRecentChats([]);
  }, [clearHistory]);

  const agent = useAgent({
    agent: "chat",
    agentOptions: {
      durableObjectId: userId
    }
  });

  const handleAgentInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAgentInput(e.target.value);
    // Auto-resize textarea
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleAgentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;

    const message = agentInput;
    setAgentInput("");
    
    // Reset textarea height
    const textarea = document.querySelector('textarea');
    if (textarea) {
      textarea.style.height = "auto";
    }

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: message }]
    });
  };

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  useEffect(() => {
    // Load user from localStorage
    const loadUser = () => {
      const stored = localStorage.getItem('aitinerary-user');
      if (stored) {
        try {
          const userData = JSON.parse(stored);
          setUser(userData);
        } catch (e) {
          console.error('Failed to parse user data:', e);
        }
      }
    };

    // Load recent chats from localStorage
    const loadRecentChats = () => {
      const stored = localStorage.getItem('aitinerary-recent-chats');
      if (stored) {
        try {
          const chats = JSON.parse(stored);
          setRecentChats(chats.slice(0, 5)); // Show only last 5 chats
        } catch (e) {
          console.error('Failed to parse recent chats:', e);
        }
      }
    };

    loadUser();
    loadRecentChats();
  }, []);

  useEffect(() => {
    // Listen for auth responses from tools
    const lastMessage = agentMessages[agentMessages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      lastMessage.parts?.forEach(part => {
        if (isToolUIPart(part) && 
            (part.type === 'tool-registerUser' || part.type === 'tool-loginUser') && 
            part.state === 'output-available' && 
            part.output) {
          try {
            const authResult = JSON.parse(part.output as string);
            if (authResult.success && authResult.userId && authResult.token) {
              const userData: User = {
                userId: authResult.userId,
                email: authResult.email,
                name: authResult.name,
                token: authResult.token
              };
              setUser(userData);
              localStorage.setItem('aitinerary-user', JSON.stringify(userData));
              setShowAuthModal(false);
            }
          } catch (e) {
            console.error('Failed to parse auth response:', e);
          }
        }
      });
    }
  }, [agentMessages]);

  useEffect(() => {
    // Save current chat to recent chats when it has content
    if (agentMessages.length > 0) {
      const lastMessage = agentMessages[agentMessages.length - 1];
      const firstUserMessage = agentMessages.find(m => m.role === 'user');
      
      if (firstUserMessage && lastMessage) {
        const chatData = {
          id: userId,
          title: 'Travel Chat',
          lastMessage: lastMessage.parts?.[0]?.type === 'text' ? lastMessage.parts[0].text.slice(0, 100) + '...' : 'Chat started',
          timestamp: new Date().toISOString()
        };

        setRecentChats(prev => {
          const filtered = prev.filter(chat => chat.id !== userId);
          const updated = [chatData, ...filtered].slice(0, 5);
          
          // Save to localStorage
          localStorage.setItem('aitinerary-recent-chats', JSON.stringify(updated));
          
          return updated;
        });
      }
    }
  }, [agentMessages, userId]);

  const pendingToolCallConfirmation = agentMessages.some((m: UIMessage) =>
    m.parts?.some(
      (part) =>
        isToolUIPart(part) &&
        part.state === "input-available" &&
        toolsRequiringConfirmation.includes(
          part.type.replace("tool-", "") as keyof typeof tools
        )
    )
  );

  return (
    <div className="flex h-screen bg-white">
      <HasOpenAIKey />
      
      {/* Sidebar */}
      <div className="w-64 bg-[#171717] flex flex-col h-full">
        {/* Top Section */}
        <div className="p-3">
          {/* New Chat Button */}
          <button
            onClick={() => {
              clearHistory();
              setSelectedActivity(null);
              setAgentInput("");
              
              const textarea = document.querySelector('textarea');
              if (textarea) {
                textarea.style.height = "auto";
              }
            }}
            className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-600 hover:bg-gray-700 text-white transition-colors"
          >
            <PencilSimple size={16} />
            <span className="text-sm">Nuevo chat</span>
          </button>
        </div>


        {/* Chats Section */}
        <div className="flex-1 overflow-y-auto px-3">
          <div className="pb-3">
            <div className="text-xs text-gray-500 mb-2 px-3">AItinerary</div>
            <div className="space-y-1">
              {recentChats.length === 0 ? (
                <div className="text-xs text-gray-500 text-center py-8 px-3">
                  Tus viajes recientes aparecerán aquí
                </div>
              ) : (
                recentChats.map((chat) => (
                  <button
                    key={chat.id}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors text-left"
                    onClick={() => {
                      alert('Cargar viajes guardados próximamente!');
                    }}
                  >
                    <ChatCircle size={16} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{chat.title}</div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Section - User */}
        <div className="p-3 border-t border-gray-600">
          {user ? (
            <div className="relative group">
              <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-medium">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <div className="text-sm text-white">{user.name}</div>
                  <div className="text-xs text-gray-400">Gratis</div>
                </div>
              </button>
              
              {/* Dropdown Menu */}
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 rounded-lg shadow-lg border border-gray-600 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-3 border-b border-gray-600">
                  <p className="text-sm font-medium text-white">{user.name}</p>
                  <p className="text-xs text-gray-400">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  <SignOut size={16} />
                  Cerrar sesión
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            >
              <User size={16} />
              <span className="text-sm">Iniciar sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto">
          {agentMessages.length === 0 ? (
            // Welcome Screen
            <div className="h-full flex items-center justify-center">
              <div className="max-w-2xl mx-auto text-center px-4">
                <h1 className="text-3xl font-semibold text-gray-900 mb-8">
                  ¿Cómo puedo ayudarte hoy?
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Planifica un viaje de 3 días a Tokio")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Fin de semana en Tokio
                    </div>
                    <div className="text-xs text-gray-600">
                      3 días explorando cultura, comida y sitios de interés
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Planifica una semana en Europa visitando 3 ciudades")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Aventura europea
                    </div>
                    <div className="text-xs text-gray-600">
                      Viaje multi-ciudad con transporte y horarios
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Planifica un viaje mochilero con presupuesto bajo al Sudeste Asiático")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Mochilero con presupuesto
                    </div>
                    <div className="text-xs text-gray-600">
                      Viaje económico de aventura
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Planifica una luna de miel de lujo en Maldivas")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Escapada de lujo
                    </div>
                    <div className="text-xs text-gray-600">
                      Experiencias premium y alojamientos
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Chat Messages
            <div className="max-w-3xl mx-auto w-full">
              {agentMessages.map((m, index) => {
                const isUser = m.role === "user";
                
                return (
                  <div key={m.id} className="group">
                    <div className={`py-6 px-4 ${!isUser ? 'bg-gray-50' : ''}`}>
                      <div className="flex gap-4">
                        {/* Avatar */}
                        <div className="flex-shrink-0">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                            isUser 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-green-600 text-white'
                          }`}>
                            {isUser ? 'Tú' : 'AI'}
                          </div>
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          {m.parts?.map((part, i) => {
                            if (part.type === "text") {
                              // Check if this is an itinerary JSON
                              const isItineraryJson = !isUser && part.text.trim().startsWith('{') && 
                                part.text.includes('"id"') && part.text.includes('"destination"') && 
                                part.text.includes('"days"');

                              if (isItineraryJson) {
                                return (
                                  <div key={i} className="space-y-4">
                                    <ItineraryDisplay 
                                      data={part.text} 
                                      onActivityClick={handleActivityClick}
                                      onSave={handleSaveItinerary}
                                      onShare={handleShareItinerary}
                                    />
                                  </div>
                                );
                              }

                              return (
                                <div key={i} className="prose prose-gray max-w-none text-gray-900">
                                  <MemoizedMarkdown
                                    id={`${m.id}-${i}`}
                                    content={part.text}
                                  />
                                </div>
                              );
                            }

                            if (isToolUIPart(part) && part.type === "tool-generateCompleteItinerary" && part.state === "output-available" && part.output) {
                              // Display itinerary tool result
                              return (
                                <div key={i} className="space-y-4">
                                  <ItineraryDisplay 
                                    data={part.output as string} 
                                    onActivityClick={handleActivityClick}
                                    onSave={handleSaveItinerary}
                                    onShare={handleShareItinerary}
                                  />
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white">
          <div className="max-w-3xl mx-auto">
            {selectedActivity && (
              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-blue-800">
                      Actividad seleccionada: {selectedActivity.activity.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedActivity(null);
                      setAgentInput("");
                    }}
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}
            
            <div className="relative">
              <form onSubmit={handleAgentSubmit} className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <Textarea
                    disabled={pendingToolCallConfirmation}
                    placeholder={
                      pendingToolCallConfirmation
                        ? "Por favor responde a la confirmación anterior..."
                        : "Pregunta lo que quieras"
                    }
                    className="w-full p-3 pr-12 resize-none border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-200 focus:border-gray-400 text-gray-900 bg-white"
                    value={agentInput}
                    onChange={handleAgentInputChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAgentSubmit(e as unknown as React.FormEvent);
                      }
                    }}
                    rows={1}
                    style={{ minHeight: '44px', maxHeight: '200px' }}
                  />
                  
                  {/* Attachment Button */}
                  <button
                    type="button"
                    className="absolute left-3 bottom-3 text-gray-400 hover:text-gray-600"
                  >
                    <Paperclip size={16} />
                  </button>
                  
                  {/* Voice Button */}
                  <button
                    type="button"
                    className="absolute right-12 bottom-3 text-gray-400 hover:text-gray-600"
                  >
                    <Microphone size={16} />
                  </button>
                </div>
                
                {/* Send Button */}
                {status === "submitted" || status === "streaming" ? (
                  <button
                    type="button"
                    onClick={stop}
                    className="p-2 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors"
                  >
                    <Stop size={16} />
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!agentInput.trim()}
                    className={`p-2 rounded-lg transition-colors ${
                      agentInput.trim() 
                        ? 'bg-black hover:bg-gray-800 text-white' 
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <ArrowUp size={16} />
                  </button>
                )}
              </form>
            </div>
            
            <div className="text-xs text-gray-500 text-center mt-3">
              AItinerary puede cometer errores. Considera verificar la información importante.{" "}
              <button className="underline hover:text-gray-700">
                preferencias de cookies
              </button>
              .
            </div>
          </div>
        </div>
      </div>
      
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />
    </div>
  );
}

const hasOpenAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean }>()
);

function HasOpenAIKey() {
  const hasOpenAiKey = use(hasOpenAiKeyPromise);

  if (!hasOpenAiKey.success) {
    return (
      <div className="absolute top-0 left-0 right-0 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800 z-50">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
              <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="text-sm">
              <span className="font-medium text-red-800 dark:text-red-200">OpenAI API Key Required</span>
              <span className="text-red-600 dark:text-red-300 ml-2">Configure your API key to use AItinerary</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}