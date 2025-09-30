import { memo } from "react";
import { isToolUIPart } from "ai";
import type { UIMessage } from "@ai-sdk/react";
import { MemoizedMarkdown } from "@/components/memoized-markdown";
import AIOrb from "@/components/ui/AIOrb";

interface ChatMessageProps {
  message: UIMessage;
  isProcessing: boolean;
  isReasoning: boolean;
  isGeneratingItinerary: boolean;
  onHotelSelect: (hotel: any) => void;
}

export const ChatMessage = memo(({ 
  message, 
  isProcessing, 
  isReasoning, 
  isGeneratingItinerary,
  onHotelSelect 
}: ChatMessageProps) => {
  const isUser = message.role === "user";

  return (
    <div className="group">
      <div className={`py-6 px-4 ${!isUser ? 'bg-gray-50' : ''}`}>
        <div className="flex gap-4">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
              isUser 
                ? 'bg-blue-600 text-white' 
                : 'bg-green-600 text-white'
            }`}>
              {isUser ? 'You' : 'AI'}
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Show AIOrb when processing and no text content yet */}
            {!isUser && isProcessing && !message.parts?.some(p => p.type === 'text' && p.text && p.text.trim().length > 0) && (
              <div className="flex items-center gap-3">
                <AIOrb size="24px" animationDuration={8} />
                <span className="text-gray-600 text-sm">
                  {isReasoning ? "Reasoning..." : 
                   isGeneratingItinerary ? "Generating itinerary..." : 
                   "Thinking..."}
                </span>
              </div>
            )}
            
            {message.parts?.map((part, i) => {
              if (part.type === "text") {
                // Skip itinerary JSON - shown in right sidebar
                const isItineraryJson = !isUser && part.text.trim().startsWith('{') && 
                  part.text.includes('"id"') && part.text.includes('"destination"') && 
                  part.text.includes('"days"');

                if (isItineraryJson) {
                  return null;
                }

                // Clean search instructions from user messages
                let cleanText = part.text;
                if (isUser && cleanText.includes('[WEB_SEARCH_ENABLED:')) {
                  cleanText = cleanText.split('[WEB_SEARCH_ENABLED:')[0].trim();
                }

                // Check if this is search results JSON
                const isSearchResults = !isUser && (
                  (cleanText.includes('"query"') && cleanText.includes('"results"')) ||
                  (cleanText.includes('"destination"') && cleanText.includes('"hotels"'))
                );

                if (isSearchResults) {
                  try {
                    const results = JSON.parse(cleanText);
                    
                    if (results.hotels) {
                      // Booking results
                      return (
                        <div key={i} className="space-y-3">
                          <h4 className="font-semibold text-gray-900">🏨 Hotels in {results.destination}</h4>
                          <div className="grid gap-3">
                            {results.hotels.map((hotel: any, idx: number) => (
                              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="flex justify-between items-start mb-2">
                                  <h5 className="font-medium text-gray-900">{hotel.name}</h5>
                                  <span className="text-sm text-green-600 font-semibold">{hotel.price}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                                  <span>⭐ {hotel.rating}</span>
                                </div>
                                <button
                                  onClick={() => onHotelSelect(hotel)}
                                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                                >
                                  Select and generate itinerary
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    } else if (results.results) {
                      // Web search results
                      return (
                        <div key={i} className="space-y-3">
                          <h4 className="font-semibold text-gray-900">🔍 Search results: {results.query}</h4>
                          <div className="space-y-2">
                            {results.results.slice(0, 3).map((result: any, idx: number) => (
                              <div key={idx} className="border-l-4 border-blue-500 pl-4 py-2">
                                <a 
                                  href={result.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-700 font-medium"
                                >
                                  {result.title}
                                </a>
                                <p className="text-sm text-gray-600 mt-1">{result.snippet}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  } catch (e) {
                    // If not valid JSON, fall through to normal text
                  }
                }

                return (
                  <div key={i} className="prose prose-gray max-w-none text-gray-900">
                    <MemoizedMarkdown
                      id={`${message.id}-${i}`}
                      content={cleanText}
                    />
                  </div>
                );
              }

              // Skip tool itinerary results - shown in right sidebar
              if (isToolUIPart(part) && part.type === "tool-generateCompleteItinerary") {
                return null;
              }

              // Display search tool results
              if (isToolUIPart(part) && (part.type === "tool-searchWeb" || part.type === "tool-searchBooking") && part.state === "output-available" && part.output) {
                try {
                  const results = typeof part.output === 'string' ? JSON.parse(part.output) : part.output;
                  
                  if (part.type === "tool-searchBooking" && results.hotels) {
                    return (
                      <div key={i} className="space-y-3 bg-blue-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-blue-900">🏨 Hotels found in {results.destination}</h4>
                        <div className="grid gap-3">
                          {results.hotels.map((hotel: any, idx: number) => (
                            <div key={idx} className="bg-white border border-blue-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                              <div className="flex justify-between items-start mb-2">
                                <h5 className="font-medium text-gray-900">{hotel.name}</h5>
                                <span className="text-sm text-green-600 font-semibold">{hotel.price}</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                                <span>⭐ {hotel.rating}</span>
                                {hotel.url !== '#' && (
                                  <a href={hotel.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    View on Booking.com
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => onHotelSelect(hotel)}
                                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                              >
                                Select and generate itinerary
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  } else if (part.type === "tool-searchWeb" && results.results) {
                    return (
                      <div key={i} className="space-y-3 bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-900">🔍 Web results: {results.query}</h4>
                        <div className="space-y-2">
                          {results.results.slice(0, 3).map((result: any, idx: number) => (
                            <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3">
                              <a 
                                href={result.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-700 font-medium block"
                              >
                                {result.title}
                              </a>
                              <p className="text-sm text-gray-600 mt-1">{result.snippet}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }
                } catch (e) {
                  console.error('Failed to parse tool results:', e);
                }
              }

              return null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
});

ChatMessage.displayName = 'ChatMessage';
