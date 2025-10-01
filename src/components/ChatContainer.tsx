import { useEffect, useState, useRef, useCallback, use } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "agents/ai-react";
import type { UIMessage } from "@ai-sdk/react";

// Component imports
import { ItineraryDisplay } from "@/components/itinerary/ItineraryDisplay";
import { AnimatedShinyText } from "@/components/ui/AnimatedShinyText";
import AIOrb from "@/components/ui/AIOrb";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { VoiceCall } from "@/components/voice/VoiceCall";
import { downloadICalFile } from "@/lib/calendar-export";
import { ShareButton } from "@/components/collaboration/ShareButton";

interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

interface ChatContainerProps {
  conversationId: string | null;
  user: User | null;
  onShowAuthModal: () => void;
}

export function ChatContainer({ conversationId, user, onShowAuthModal }: ChatContainerProps) {
  const [agentInput, setAgentInput] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<{
    activity: any;
    itinerary: any;
  } | null>(null);
  const [isReasoning, setIsReasoning] = useState(false);
  const [currentItinerary, setCurrentItinerary] = useState<any>(null);
  const [isGeneratingItinerary, setIsGeneratingItinerary] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(480);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<any[]>([]);
  const [userId] = useState(() => {
    const stored = localStorage.getItem('aitinerary-user-id');
    if (stored) return stored;
    const newId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('aitinerary-user-id', newId);
    return newId;
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const agent = useAgent({
    agent: "chat",
    name: conversationId || userId,
    query: { token: user?.token ?? "" }
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

    const hasActiveReasoning = agentMessages.some(m =>
      m.parts?.some((p: any) => p.type === 'reasoning-start')
    );
    const hasReasoningEnd = agentMessages.some(m =>
      m.parts?.some((p: any) => p.type === 'reasoning-end')
    );

    if (hasActiveReasoning && !hasReasoningEnd) {
      setIsReasoning(true);
    } else if (hasReasoningEnd) {
      setIsReasoning(false);
    }

    const isAgentBusy = status === "streaming" || status === "submitted";
    const lastAssistantMessage = agentMessages.filter(m => m.role === 'assistant').pop();
    const hasTextContent = lastAssistantMessage?.parts?.some(p => p.type === 'text' && p.text && p.text.trim().length > 0);

    setIsProcessing(isAgentBusy && !hasTextContent);

    const hasItineraryToolCall = lastMessage.parts?.some((p: any) =>
      p.type === 'tool-generateCompleteItinerary'
    );

    if (hasItineraryToolCall) {
      setIsGeneratingItinerary(true);
    }

    agentMessages.forEach(message => {
      message.parts?.forEach((part: any) => {
        if (part.type === 'text' && message.role === 'assistant') {
          const text = part.text?.trim() || '';

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
                const updatedItinerary = { ...currentItinerary };
                const dayIndex = updatedItinerary.days.findIndex((day: any) => day.dayNumber === updatedActivity.dayNumber);

                if (dayIndex !== -1) {
                  const activityIndex = updatedItinerary.days[dayIndex].activities.findIndex((act: any) => act.id === updatedActivity.id);

                  if (activityIndex !== -1) {
                    updatedItinerary.days[dayIndex].activities[activityIndex] = updatedActivity;
                    setCurrentItinerary(updatedItinerary);
                  } else {
                    updatedItinerary.days[dayIndex].activities.push(updatedActivity);
                    setCurrentItinerary(updatedItinerary);
                  }
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

        if (part.type === 'tool-removeActivity' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.removedActivityId && currentItinerary) {
              const updatedItinerary = { ...currentItinerary };
              let activityRemoved = false;

              for (const day of updatedItinerary.days) {
                const activityIndex = day.activities.findIndex((act: any) => act.id === result.removedActivityId);
                if (activityIndex !== -1) {
                  day.activities.splice(activityIndex, 1);
                  activityRemoved = true;
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

        if (part.type === 'tool-removeMultipleActivities' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.removedActivityIds && currentItinerary) {
              const updatedItinerary = { ...currentItinerary };
              let removedCount = 0;

              for (const activityId of result.removedActivityIds) {
                for (const day of updatedItinerary.days) {
                  const activityIndex = day.activities.findIndex((act: any) => act.id === activityId);
                  if (activityIndex !== -1) {
                    day.activities.splice(activityIndex, 1);
                    removedCount++;
                    break;
                  }
                }
              }

              if (removedCount > 0) {
                setCurrentItinerary(updatedItinerary);
              }
            }
          } catch (e) {
            console.error('Failed to process removeMultipleActivities:', e);
          }
        }

        if (part.type === 'tool-addMultipleActivities' && part.state === 'output-available' && part.output) {
          try {
            const result = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
            if (result.success && result.addedActivities && currentItinerary) {
              const updatedItinerary = { ...currentItinerary };
              let addedCount = 0;

              for (const { dayNumber, activity } of result.addedActivities) {
                const dayIndex = updatedItinerary.days.findIndex((day: any) => day.dayNumber === dayNumber);
                if (dayIndex !== -1) {
                  updatedItinerary.days[dayIndex].activities.push(activity);
                  addedCount++;
                }
              }

              if (addedCount > 0) {
                setCurrentItinerary(updatedItinerary);
              }
            }
          } catch (e) {
            console.error('Failed to process addMultipleActivities:', e);
          }
        }
      });
    });
  }, [agentMessages, status, currentItinerary]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const handleActivityClick = useCallback((activity: any, itinerary: any) => {
    setSelectedActivity({ activity, itinerary });

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

  const handleAgentInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!user?.token) {
      onShowAuthModal();
      return;
    }

    setAgentInput(e.target.value);
    setTimeout(() => {
      const textarea = document.querySelector('textarea');
      if (textarea) {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }
    }, 0);
  }, [user?.token, onShowAuthModal]);

  const handleAgentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentInput.trim()) return;
    if (!user?.token) {
      onShowAuthModal();
      return;
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
  }, [agentInput, sendMessage, user?.token, onShowAuthModal, searchEnabled]);

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages, scrollToBottom]);

  useEffect(() => {
    const handleVoiceTranscript = (event: CustomEvent) => {
      const transcriptMessage = event.detail;
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

  const pendingToolCallConfirmation = false;

  return (
    <>
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white h-screen">
        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto max-h-screen">
          {agentMessages.length === 0 ? (
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
              onShowAuthModal();
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
          onShowAuthModal={onShowAuthModal}
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

      {/* Voice Call Modal */}
      <VoiceCall
        isOpen={isVoiceCallOpen}
        onClose={() => {
          setIsVoiceCallOpen(false);
        }}
        userToken={user?.token}
        conversationId={conversationId || undefined}
        onTranscript={(role, text) => {
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

          window.dispatchEvent(new CustomEvent('voice-transcript', {
            detail: transcriptMessage
          }));
        }}
        onToolCall={(toolName, args, result) => {
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
        }}
      />
    </>
  );
}
