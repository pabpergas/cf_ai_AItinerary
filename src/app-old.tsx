import { useEffect, useState, useRef, useCallback, use } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";
// tools import removed - tools are now in server directory

// Component imports
import { ItineraryDisplay } from "@/components/itinerary/ItineraryDisplay";
import { AuthModal } from "@/components/auth/AuthModal";
import { AnimatedShinyText } from "@/components/ui/AnimatedShinyText";
import AIOrb from "@/components/ui/AIOrb";
import { WelcomeScreen } from "@/components/welcome/WelcomeScreen";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { VoiceCall } from "@/components/voice/VoiceCall";
import { downloadICalFile } from "@/lib/calendar-export";
import { ShareButton } from "@/components/collaboration/ShareButton";


// List of tools that require human confirmation - now empty since all tools execute automatically
const toolsRequiringConfirmation: string[] = [];

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export default function AItinerary() {
  const { conversationId: urlConversationId } = useParams<{ conversationId?: string }>();
  const navigate = useNavigate();

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
  const [isReasoning, setIsReasoning] = useState(false);
  const [currentItinerary, setCurrentItinerary] = useState<any>(null);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(480); // Default width in pixels
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<any[]>([]);
  const [userId] = useState(() => {
    // Generate or retrieve user ID from localStorage
    const stored = localStorage.getItem('aitinerary-user-id');
    if (stored) return stored;

    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('aitinerary-user-id', newId);
    return newId;
  });

  // Use URL param if available, otherwise null (new chat)
  const conversationId = urlConversationId || null;

  // Generate new conversation ID when starting a new chat
  const startNewConversation = useCallback(() => {
    const newConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    navigate(`/chat/${newConversationId}`);
    return newConversationId;
  }, [navigate]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = useAgent({
    agent: "chat",
    name: conversationId || userId, // One DO per conversation
    query: { token: user?.token ?? "" }
  }, {
    key: conversationId // Force recreation when conversationId changes
  });

  const {
    messages: agentMessages,
    addToolResult,
    clearHistory: agentClearHistory,
    status,
    sendMessage,
    stop
  } = useAgentChat<unknown, UIMessage<{ createdAt: string }>>({
    agent
  });


  // Detectar reasoning e itinerarios desde los mensajes
  useEffect(() => {
    const lastMessage = agentMessages[agentMessages.length - 1];
    if (!lastMessage) return;

    // Look for reasoning-start in any message, not just the last one
    const hasActiveReasoning = agentMessages.some(m => 
      m.parts?.some((p: any) => p.type === 'reasoning-start')
    );
    const hasReasoningEnd = agentMessages.some(m =>
      m.parts?.some((p: any) => p.type === 'reasoning-end')
    );

    console.log('[Reasoning] Active:', hasActiveReasoning, 'End:', hasReasoningEnd, 'Messages:', agentMessages.length);
    
    if (hasActiveReasoning && !hasReasoningEnd) {
      setIsReasoning(true);
    } else if (hasReasoningEnd) {
      setIsReasoning(false);
    }

    // Update isProcessing based on agent status and message state
    const isAgentBusy = status === "streaming" || status === "submitted";
    const lastAssistantMessage = agentMessages.filter(m => m.role === 'assistant').pop();
    const hasTextContent = lastAssistantMessage?.parts?.some(p => p.type === 'text' && p.text && p.text.trim().length > 0);
    
    // Keep processing true until we have actual text content from the assistant
    setIsProcessing(isAgentBusy && !hasTextContent);

    // Detect itinerary generation
    const hasItineraryToolCall = lastMessage.parts?.some((p: any) => 
      p.type === 'tool-generateCompleteItinerary'
    );
    
    if (hasItineraryToolCall) {
      setIsGeneratingItinerary(true);
    }

    // Extract itinerary when ready
    agentMessages.forEach(message => {
      message.parts?.forEach((part: any) => {
        if (part.type === 'text' && message.role === 'assistant') {
          const text = part.text?.trim() || '';
          
          // Check for full itinerary JSON
          const isItineraryJson = text.startsWith('{') && 
            text.includes('"id"') && 
            text.includes('"destination"') && 
            text.includes('"days"');
          
          if (isItineraryJson) {
            try {
              const itinerary = JSON.parse(text);
              setCurrentItinerary(itinerary);
              setIsGeneratingItinerary(false);
            } catch (e) {
              console.error('Failed to parse itinerary:', e);
            }
          }

          // Check for single activity JSON (activity modification)
          // Try to extract JSON even if there's text before/after
          let activityJson = text;
          const jsonMatch = text.match(/\{[\s\S]*?"id"[\s\S]*?"dayNumber"[\s\S]*?\}/);
          if (jsonMatch) {
            activityJson = jsonMatch[0];
          }
          
          const isActivityJson = activityJson.startsWith('{') && 
            activityJson.includes('"id"') && 
            activityJson.includes('"title"') && 
            activityJson.includes('"dayNumber"') &&
            !activityJson.includes('"destination"') &&
            !activityJson.includes('"days"');
          
          if (isActivityJson && currentItinerary) {
            try {
              const updatedActivity = JSON.parse(activityJson);
              if (updatedActivity.id && updatedActivity.dayNumber) {
                // Update the specific activity in the current itinerary
                const updatedItinerary = { ...currentItinerary };
                const dayIndex = updatedItinerary.days.findIndex((day: any) => day.dayNumber === updatedActivity.dayNumber);
                
                if (dayIndex !== -1) {
                  const activityIndex = updatedItinerary.days[dayIndex].activities.findIndex((act: any) => act.id === updatedActivity.id);
                  
                  if (activityIndex !== -1) {
                    // Replace existing activity
                    updatedItinerary.days[dayIndex].activities[activityIndex] = updatedActivity;
                    setCurrentItinerary(updatedItinerary);
                    console.log('Activity updated:', updatedActivity.title);
                  } else {
                    // Add new activity to the day
                    updatedItinerary.days[dayIndex].activities.push(updatedActivity);
                    setCurrentItinerary(updatedItinerary);
                    console.log('Activity added:', updatedActivity.title);
                  }
                } else {
                  console.warn(`Day ${updatedActivity.dayNumber} not found in itinerary`);
                }
              }
            } catch (e) {
              console.error('Failed to parse activity JSON:', e);
            }
          }
        }

        if (part.type === 'tool-generateCompleteItinerary' && part.state === 'output-available' && part.output) {
          try {
            const itinerary = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            setCurrentItinerary(itinerary);
            setIsGeneratingItinerary(false);
          } catch (e) {
            console.error('Failed to parse itinerary from tool:', e);
          }
        }

        // Handle removeActivity tool
        if (part.type === 'tool-removeActivity' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.removedActivityId && currentItinerary) {
              // Remove the activity from the current itinerary
              const updatedItinerary = { ...currentItinerary };
              let activityRemoved = false;
              
              for (const day of updatedItinerary.days) {
                const activityIndex = day.activities.findIndex((act: any) => act.id === result.removedActivityId);
                if (activityIndex !== -1) {
                  day.activities.splice(activityIndex, 1);
                  activityRemoved = true;
                  console.log('Activity removed:', result.removedActivityId);
                  break;
                }
              }
              
              if (activityRemoved) {
                setCurrentItinerary(updatedItinerary);
              }
            }
          } catch (e) {
            console.error('Failed to process removeActivity:', e);
          }
        }

        // Handle removeMultipleActivities tool
        if (part.type === 'tool-removeMultipleActivities' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.removedActivityIds && currentItinerary) {
              // Remove multiple activities from the current itinerary
              const updatedItinerary = { ...currentItinerary };
              let removedCount = 0;
              
              for (const activityId of result.removedActivityIds) {
                for (const day of updatedItinerary.days) {
                  const activityIndex = day.activities.findIndex((act: any) => act.id === activityId);
                  if (activityIndex !== -1) {
                    day.activities.splice(activityIndex, 1);
                    removedCount++;
                    console.log('Activity removed:', activityId);
                    break;
                  }
                }
              }
              
              if (removedCount > 0) {
                setCurrentItinerary(updatedItinerary);
                console.log(`${removedCount} activities removed from itinerary`);
              }
            }
          } catch (e) {
            console.error('Failed to process removeMultipleActivities:', e);
          }
        }

        // Handle addMultipleActivities tool
        if (part.type === 'tool-addMultipleActivities' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.addedActivities && currentItinerary) {
              // Add multiple activities to the current itinerary
              const updatedItinerary = { ...currentItinerary };
              let addedCount = 0;
              
              for (const { dayNumber, activity } of result.addedActivities) {
                const dayIndex = updatedItinerary.days.findIndex((day: any) => day.dayNumber === dayNumber);
                if (dayIndex !== -1) {
                  updatedItinerary.days[dayIndex].activities.push(activity);
                  addedCount++;
                  console.log('Activity added:', activity.title);
                } else {
                  console.warn(`Day ${dayNumber} not found in itinerary`);
                }
              }
              
              if (addedCount > 0) {
                setCurrentItinerary(updatedItinerary);
                console.log(`${addedCount} activities added to itinerary`);
              }
            }
          } catch (e) {
            console.error('Failed to process addMultipleActivities:', e);
          }
        }

        // Log parts para debug
        console.log('[Message Part]', part.type, message.role);
      });
    });
  }, [agentMessages, status]);

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
      if (!user?.token) {
        alert('You must sign in to save itineraries');
        return;
      }

    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itinerary: JSON.stringify(itinerary), 
          isPublic: false 
        }),
      });

      const data = await response.json();

      if (data.success) {
        alert('Itinerary saved successfully');
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Save itinerary error:', error);
      alert('Error al guardar el itinerario');
    }
  }, [user?.token]);

  const handleShareItinerary = useCallback(async (itinerary: any) => {
    if (!user?.token) {
      alert('You must sign in to share itineraries');
      return;
    }

    try {
      const response = await fetch('/api/itineraries', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          itinerary: JSON.stringify(itinerary), 
          isPublic: true 
        }),
      });

      const data = await response.json();

      if (data.success) {
        if (data.shareUrl) {
          navigator.clipboard.writeText(data.shareUrl);
          alert(`Itinerary shared! URL copied to clipboard: ${data.shareUrl}`);
        } else {
          alert('Itinerary saved but could not generate share link');
        }
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Share itinerary error:', error);
      alert('Error al compartir el itinerario');
    }
  }, [user?.token]);

  const handleExportToCalendar = useCallback(() => {
    if (!currentItinerary) {
      alert('No itinerary to export');
      return;
    }
    
    downloadICalFile(currentItinerary);
  }, [currentItinerary]);

  // Generate share link when itinerary is created
  const generateShareLink = useCallback(() => {
    if (currentItinerary && conversationId) {
      const baseUrl = window.location.origin;
      return `${baseUrl}/share/${conversationId}`;
    }
    return null;
  }, [currentItinerary, conversationId]);

  const handleLogin = useCallback(async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success) {
        const userData: User = {
          userId: data.userId,
          email: data.email,
          name: data.name,
          token: data.token
        };
        setUser(userData);
        localStorage.setItem('aitinerary-user', JSON.stringify(userData));
        setShowAuthModal(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Connection error. Please try again.');
    }
  }, []);

  const handleRegister = useCallback(async (email: string, password: string, name: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, name }),
      });

      const data = await response.json();

      if (data.success) {
        const userData: User = {
          userId: data.userId,
          email: data.email,
          name: data.name,
          token: data.token
        };
        setUser(userData);
        localStorage.setItem('aitinerary-user', JSON.stringify(userData));
        setShowAuthModal(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Connection error. Please try again.');
    }
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      if (user?.token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
    setUser(null);
    localStorage.removeItem('aitinerary-user');
    localStorage.removeItem('aitinerary-recent-chats');
      agentClearHistory();
    setRecentChats([]);
    }
  }, [user?.token, agentClearHistory]);

  const handleAgentInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!user?.token) {
      setShowAuthModal(true);
      return;
    }

    setAgentInput(e.target.value);
    // Auto-resize textarea
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, 0);
  }, [user?.token]);

  const handleAgentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;
    if (!user?.token) {
      setShowAuthModal(true);
      return;
    }

    // Start new conversation only if there's no existing conversationId
    if (!conversationId) {
      startNewConversation();
    }

    const message = agentInput;
    setAgentInput("");
    
    const textarea = document.querySelector('textarea');
    if (textarea) {
      (textarea as HTMLTextAreaElement).style.height = "auto";
    }

    const messageWithContext = searchEnabled 
      ? `${message}\n\n[WEB_SEARCH_ENABLED: The user has enabled web search. You MUST use searchWeb to get updated information about restaurants, attractions, prices and reviews. You MUST use searchBooking to search for real hotels with current prices. Prioritize real data over general knowledge.]`
      : message;

    await sendMessage({
      role: "user",
      parts: [{ type: "text", text: messageWithContext }]
    });
  }, [agentInput, sendMessage, user?.token, conversationId, startNewConversation]);

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

    loadUser();
  }, []);

  useEffect(() => {
    // Load conversations when user is available
    const loadConversations = async () => {
      if (!user?.token) return;
      
      try {
        const response = await fetch('/api/conversations', {
          headers: { Authorization: `Bearer ${user.token}` }
        });
        if (response.ok) {
          const data: any = await response.json();
          setRecentChats(data.conversations || []);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    };

    if (user?.token) {
      loadConversations();
    }
  }, [user?.token]);

  // The agents system automatically handles message loading
  // No need for manual message loading since agents have their own persistence

  // Reload conversations after sending a message
  useEffect(() => {
    if (user?.token && agentMessages.length > 0) {
      const loadConversations = async () => {
        try {
          const response = await fetch('/api/conversations', {
            headers: { Authorization: `Bearer ${user.token}` }
          });
          if (response.ok) {
            const data: any = await response.json();
            setRecentChats(data.conversations || []);
          }
        } catch (error) {
          console.error('Failed to reload conversations:', error);
        }
      };
      
      // Small delay to ensure backend has processed the message
      setTimeout(loadConversations, 1000);
    }
  }, [agentMessages.length, user?.token]);


  const titleUpdatedRef = useRef(false);

  useEffect(() => {
    // Auto-generate conversation title from first user message (only once per conversation)
    if (agentMessages.length === 1 && conversationId && user?.token) {
      const firstUserMessage = agentMessages.find(m => m.role === 'user');
      
      if (firstUserMessage && firstUserMessage.parts?.[0]?.type === 'text') {
        const messageText = firstUserMessage.parts[0].text;
        const title = messageText.length > 50 ? messageText.slice(0, 50) + '...' : messageText;
        
        // Update conversation title in backend
        fetch('/api/conversations/update-title', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${user.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ conversationId, title })
        }).catch(err => console.error('Failed to update title:', err));
      }
    }
  }, [agentMessages.length, conversationId, user?.token]);

  // All tools execute automatically now, no confirmation needed
  const pendingToolCallConfirmation = false;

  // Listen for voice transcripts and add them to chat
  useEffect(() => {
    const handleVoiceTranscript = (event: CustomEvent) => {
      const transcriptMessage = event.detail;
      console.log('Adding voice transcript to chat:', transcriptMessage);
      
      // Add to voice messages state
      setVoiceMessages(prev => [...prev, transcriptMessage]);
    };

    window.addEventListener('voice-transcript', handleVoiceTranscript as EventListener);
    
    return () => {
      window.removeEventListener('voice-transcript', handleVoiceTranscript as EventListener);
    };
  }, [agentMessages]);

  const handleHotelSelect = useCallback((hotel: any) => {
    setAgentInput(`I have selected ${hotel.name} (${hotel.price}) with rating ${hotel.rating}. Now generate the complete itinerary using this hotel.`);
    setTimeout(() => {
      const form = document.querySelector('form');
      if (form) {
        form.requestSubmit();
      }
    }, 100);
  }, []);

  return (
    <div key={conversationId || 'new'} className="flex h-screen bg-white overflow-hidden">
      <HasAIKey />
      
      {/* Left Sidebar */}
      <Sidebar
        user={user}
        recentChats={recentChats}
        onShowAuthModal={() => setShowAuthModal(true)}
        onLogout={handleLogout}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white h-screen">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto max-h-screen">
          {agentMessages.length === 0 ? (
            // Welcome Screen
            <div className="h-full flex items-center justify-center">
              <div className="max-w-2xl mx-auto text-center px-4">
                <h1 className="text-3xl font-semibold text-gray-900 mb-8">
                  How can I help you today?
                </h1>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-3xl mx-auto">
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Plan a 3-day trip to Tokyo")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Weekend in Tokyo
                    </div>
                    <div className="text-xs text-gray-600">
                      3 days exploring culture, food and points of interest
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Plan a week in Europe visiting 3 cities")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      European adventure
                    </div>
                    <div className="text-xs text-gray-600">
                      Multi-city trip with transport and schedules
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Plan a budget backpacking trip to Southeast Asia")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Budget backpacking
                    </div>
                    <div className="text-xs text-gray-600">
                      Budget adventure trip
                    </div>
                  </button>
                  
                  <button 
                    className="p-4 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setAgentInput("Plan a luxury honeymoon in the Maldives")}
                  >
                    <div className="text-sm font-medium text-gray-900 mb-1">
                      Luxury getaway
                    </div>
                    <div className="text-xs text-gray-600">
                      Premium experiences and accommodations
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Chat Messages
            <div className="max-w-3xl mx-auto w-full h-full overflow-y-auto">
              {[...agentMessages, ...voiceMessages].sort((a, b) => 
                new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
              ).map((m) => (
                <ChatMessage
                  key={m.id}
                  message={m}
                  isProcessing={isProcessing}
                  isReasoning={isReasoning}
                  isGeneratingItinerary={isGeneratingItinerary}
                  onHotelSelect={handleHotelSelect}
                />
              ))}
              <div ref={messagesEndRef} />
              
              {/* Reasoning Indicator */}
              {isReasoning && (
                <div className="max-w-3xl mx-auto w-full py-6 px-4">
                      <div className="flex gap-4">
                        <div className="flex-shrink-0">
                      <AIOrb size="32px" animationDuration={8} />
                          </div>
                    <div className="flex-1 min-w-0 flex items-center">
                      <AnimatedShinyText className="text-base">
                        Thinking and analyzing your request...
                      </AnimatedShinyText>
                        </div>
                                  </div>
                                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area */}
        <ChatInput
                    value={agentInput}
                    onChange={handleAgentInputChange}
          onSubmit={handleAgentSubmit}
                    onKeyDown={(e) => {
            if (!user?.token) {
              setShowAuthModal(true);
              return;
            }
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAgentSubmit(e as unknown as React.FormEvent);
                      }
                    }}
          onStop={stop}
          isAuthenticated={!!user?.token}
          isSubmitting={status === "submitted" || status === "streaming"}
          searchEnabled={searchEnabled}
          onToggleSearch={() => setSearchEnabled(!searchEnabled)}
          onToggleVoiceCall={() => setIsVoiceCallOpen(true)}
          onShowAuthModal={() => setShowAuthModal(true)}
          pendingConfirmation={pendingToolCallConfirmation}
          isVoiceCallActive={isVoiceCallOpen}
          selectedActivity={selectedActivity}
          onClearActivity={() => {
            setSelectedActivity(null);
            setAgentInput("");
          }}
        />
                </div>
                
      {/* Right Sidebar - Itinerary Display */}
      {(isGeneratingItinerary || currentItinerary) && (
        <div 
          className="bg-gray-50 border-l border-gray-200 flex flex-col h-full overflow-hidden relative"
          style={{ width: `${rightSidebarWidth}px`, minWidth: '320px', maxWidth: '800px' }}
        >
          {/* Resize Handle */}
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault();
              const startX = e.clientX;
              const startWidth = rightSidebarWidth;

              const handleMouseMove = (moveEvent: MouseEvent) => {
                const delta = startX - moveEvent.clientX;
                const newWidth = Math.min(Math.max(startWidth + delta, 320), 800);
                setRightSidebarWidth(newWidth);
              };

              const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };

              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
          />

            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Itinerary</h2>
              {currentItinerary && (
                <ShareButton 
                  itineraryId={currentItinerary.id || conversationId || ''} 
                  onShare={(link) => {
                    console.log('Share link generated:', link);
                    console.log('Using itinerary ID:', currentItinerary.id || conversationId);
                    // Show success message
                    alert(`🎉 Share link copied to clipboard!\n\nShare this link with others:\n${link}`);
                  }}
                />
              )}
            </div>
            
          <div className="flex-1 overflow-y-auto p-4">
            {isGeneratingItinerary && !currentItinerary ? (
              <div className="flex flex-col items-center justify-center h-full gap-6">
                <AIOrb size="120px" animationDuration={12} />
                <AnimatedShinyText className="text-lg font-medium">
                  Generating your perfect itinerary...
                </AnimatedShinyText>
            </div>
            ) : currentItinerary ? (
              <ItineraryDisplay 
                data={typeof currentItinerary === 'string' ? currentItinerary : JSON.stringify(currentItinerary)} 
                onActivityClick={handleActivityClick}
                onSave={handleSaveItinerary}
                onShare={handleShareItinerary}
                onExportCalendar={handleExportToCalendar}
              />
            ) : null}
          </div>
        </div>
      )}
      
      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLogin={handleLogin}
        onRegister={handleRegister}
      />

      {/* Voice Call Modal */}
      <VoiceCall
        isOpen={isVoiceCallOpen}
        onClose={() => {
          setIsVoiceCallOpen(false);
        }}
        userToken={user?.token}
        conversationId={conversationId || undefined}
        onTranscript={(role, text) => {
          console.log(`${role} transcript:`, text);
          
          // Add transcript directly to chat without triggering agent response
          const transcriptMessage = {
            id: `voice-${role}-${Date.now()}`,
            role: role,
            content: text,
            createdAt: new Date().toISOString(),
            parts: [
              {
                type: 'text',
                text: text,
              }
            ]
          };
          
          // Add to agent messages directly
          // We need to access the agent's internal message system
          // For now, we'll use a custom event to add the message
          window.dispatchEvent(new CustomEvent('voice-transcript', {
            detail: transcriptMessage
          }));
        }}
        onToolCall={(toolName, args, result) => {
          console.log(`Voice tool call: ${toolName}`, { args, result });
          
          // Handle specific tools that affect the UI
          if (toolName === 'generateCompleteItinerary' && result?.result) {
            try {
              const parsed = typeof result.result === 'string' 
                ? JSON.parse(result.result) 
                : result.result;
              setCurrentItinerary(parsed);
            } catch (e) {
              console.error('Error parsing itinerary from voice:', e);
            }
          }
          
          if (toolName === 'searchBooking' && result?.result) {
            console.log('Hotels found via voice:', result.result);
            // Hotels will be displayed via AI response
          }
        }}
      />
    </div>
  );
}

const hasAiKeyPromise = fetch("/check-open-ai-key").then((res) =>
  res.json<{ success: boolean; message: string }>()
);

function HasAIKey() {
  const hasAiKey = use(hasAiKeyPromise);

  if (!hasAiKey.success) {
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
              <span className="font-medium text-red-800 dark:text-red-200">OpenAI key no configurada</span>
              <span className="text-red-600 dark:text-red-300 ml-2">Configura OPENAI_API_KEY para usar la IA</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return null;
}