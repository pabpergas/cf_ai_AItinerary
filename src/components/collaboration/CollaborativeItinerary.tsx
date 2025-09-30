import React, { useState, useRef, useEffect } from 'react';
import { Users, MessageSquare, X } from 'lucide-react';
import { useCollaboration } from '@/hooks/useCollaboration';
import { UserPresence } from './UserPresence';
import { CollaborativeChat } from './CollaborativeChat';
import { CursorIndicators } from './CursorIndicators';

interface CollaborativeItineraryProps {
  itineraryId: string;
  userToken?: string;
  currentItinerary: any;
  onItineraryUpdate: (itinerary: any) => void;
  children: React.ReactNode;
}

export function CollaborativeItinerary({
  itineraryId,
  userToken,
  currentItinerary,
  onItineraryUpdate,
  children
}: CollaborativeItineraryProps) {
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  const {
    isConnected,
    collaborators,
    currentUser,
    updateCursor,
    updateSelection,
    updateItinerary,
    sendChatMessage
  } = useCollaboration({
    itineraryId,
    userToken,
    onItineraryUpdate: (itinerary) => {
      onItineraryUpdate(itinerary);
    }
  });

  // Handle mouse movement for cursor tracking
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isConnected) {
      updateCursor({
        x: e.clientX,
        y: e.clientY
      });
    }
  };

  // Handle selection changes
  const handleSelectionChange = () => {
    if (isConnected) {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        updateSelection({
          start: range.startOffset,
          end: range.endOffset
        });
      }
    }
  };

  // Send chat message
  const handleSendChatMessage = (message: string) => {
    sendChatMessage(message);
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      userId: currentUser?.id || 'unknown',
      userName: currentUser?.name || 'You',
      userColor: currentUser?.color || '#000000',
      message,
      timestamp: Date.now()
    }]);
  };

  // Handle itinerary changes
  useEffect(() => {
    if (currentItinerary && isConnected) {
      updateItinerary(currentItinerary);
    }
  }, [currentItinerary, isConnected, updateItinerary]);

  return (
    <div className="relative">
      {/* User Presence Bar */}
      <UserPresence
        collaborators={collaborators}
        currentUser={currentUser}
        isConnected={isConnected}
      />

      {/* Main Content with Cursor Tracking */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        className="relative"
      >
        {children}
        
        {/* Cursor Indicators */}
        <CursorIndicators
          collaborators={collaborators}
          containerRef={containerRef as React.RefObject<HTMLElement>}
        />
      </div>

      {/* Collaboration Controls */}
      <div className="fixed bottom-4 right-4 flex gap-2 z-50">
        {/* Chat Toggle */}
        <button
          onClick={() => setShowChat(!showChat)}
          className={`p-3 rounded-full shadow-lg transition-all ${
            showChat 
              ? 'bg-blue-600 text-white' 
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
          title="Collaboration Chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>

        {/* Collaborators Count */}
        {collaborators.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 bg-white rounded-full shadow-lg">
            <Users className="w-4 h-4 text-gray-600" />
            <span className="text-sm font-medium text-gray-700">
              {collaborators.length + (currentUser ? 1 : 0)}
            </span>
          </div>
        )}
      </div>

      {/* Collaborative Chat Sidebar */}
      {showChat && (
        <div className="fixed top-0 right-0 h-full w-80 bg-white shadow-xl z-50 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-medium text-gray-900">Collaboration</h3>
            <button
              onClick={() => setShowChat(false)}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Component */}
          <CollaborativeChat
            messages={chatMessages}
            onSendMessage={handleSendChatMessage}
            collaborators={collaborators}
            isConnected={isConnected}
          />
        </div>
      )}

      {/* Connection Status Indicator */}
      {!isConnected && (
        <div className="fixed top-4 left-4 bg-yellow-100 border border-yellow-300 text-yellow-800 px-3 py-2 rounded-lg text-sm">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
            Reconnecting to collaboration...
          </div>
        </div>
      )}
    </div>
  );
}
