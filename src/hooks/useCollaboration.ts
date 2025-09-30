import { useState, useEffect, useCallback, useRef } from 'react';

interface Collaborator {
  id: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: { start: number; end: number };
  lastSeen: number;
}

interface CollaborationState {
  isConnected: boolean;
  collaborators: Collaborator[];
  currentUser: Collaborator | null;
  isEditing: boolean;
}

interface UseCollaborationProps {
  itineraryId: string;
  userToken?: string;
  onItineraryUpdate?: (itinerary: any) => void;
}

export function useCollaboration({ 
  itineraryId, 
  userToken, 
  onItineraryUpdate 
}: UseCollaborationProps) {
  const [state, setState] = useState<CollaborationState>({
    isConnected: false,
    collaborators: [],
    currentUser: null,
    isEditing: false
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate user color
  const generateUserColor = useCallback(() => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }, []);

  // Connect to collaboration WebSocket
  const connect = useCallback(() => {
    // Get the correct ID to use for WebSocket connection
    const urlParams = new URLSearchParams(window.location.search);
    const collaborationParam = urlParams.get('collaborate');
    const wsId = collaborationParam || itineraryId;
    
    if (!wsId || !userToken || wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('Skipping WebSocket connection:', { wsId, userToken, readyState: wsRef.current?.readyState });
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/collab/${wsId}/websocket`;
      
      console.log('Attempting to connect to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Collaboration WebSocket connected');
        setState(prev => ({ ...prev, isConnected: true }));
        
        // Send initial ping to trigger server to send initial state
        ws.send(JSON.stringify({
          type: 'ping'
        }));

        // Start heartbeat
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.log('Collaboration WebSocket error:', error);
        console.log('WebSocket readyState:', ws.readyState);
        console.log('WebSocket URL:', ws.url);
        setState(prev => ({ ...prev, isConnected: false }));
      };

      ws.onclose = (event) => {
        console.log('Collaboration WebSocket disconnected');
        console.log('Close event code:', event.code);
        console.log('Close event reason:', event.reason);
        setState(prev => ({ ...prev, isConnected: false }));
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
          heartbeatIntervalRef.current = null;
        }

        // Attempt reconnection after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (!state.isConnected) {
            console.log('Attempting to reconnect...');
            connect();
          }
        }, 3000);
      };


    } catch (error) {
      console.error('Error connecting to collaboration WebSocket:', error);
    }
  }, [itineraryId, userToken, state.isConnected]);

  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'init':
        setState(prev => ({
          ...prev,
          currentUser: {
            id: message.userId,
            name: message.userName,
            color: generateUserColor(),
            lastSeen: Date.now()
          }
        }));
        if (message.itinerary && onItineraryUpdate) {
          onItineraryUpdate(message.itinerary);
        }
        break;

      case 'user_joined':
        setState(prev => ({
          ...prev,
          collaborators: [...prev.collaborators, {
            id: message.userId,
            name: message.userName,
            color: message.color,
            lastSeen: Date.now()
          }]
        }));
        break;

      case 'user_left':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.filter(c => c.id !== message.userId)
        }));
        break;

      case 'cursor_update':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.map(c => 
            c.id === message.userId 
              ? { ...c, cursor: message.cursor, lastSeen: Date.now() }
              : c
          )
        }));
        break;

      case 'selection_update':
        setState(prev => ({
          ...prev,
          collaborators: prev.collaborators.map(c => 
            c.id === message.userId 
              ? { ...c, selection: message.selection, lastSeen: Date.now() }
              : c
          )
        }));
        break;

      case 'itinerary_updated':
        if (onItineraryUpdate) {
          onItineraryUpdate(message.itinerary);
        }
        break;

      case 'pong':
        // Heartbeat response
        break;

      default:
        console.log('Unknown collaboration message:', message);
    }
  }, [generateUserColor, onItineraryUpdate]);

  // Send cursor update
  const updateCursor = useCallback((cursor: { x: number; y: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'cursor_update',
        cursor
      }));
    }
  }, []);

  // Send selection update
  const updateSelection = useCallback((selection: { start: number; end: number }) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'selection_update',
        selection
      }));
    }
  }, []);

  // Send itinerary update
  const updateItinerary = useCallback(async (itinerary: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'update_itinerary',
        itinerary
      }));
    }

    // Also save to database
    try {
      await fetch(`/api/collab/itinerary/${itineraryId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(userToken && { Authorization: `Bearer ${userToken}` }),
        },
        body: JSON.stringify({ itinerary })
      });
    } catch (error) {
      console.error('Failed to save itinerary update:', error);
    }
  }, [itineraryId, userToken]);

  // Send chat message
  const sendChatMessage = useCallback((message: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'chat_message',
        message
      }));
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    setState({
      isConnected: false,
      collaborators: [],
      currentUser: null,
      isEditing: false
    });
  }, []);

  // Auto-connect when props change - only if we have both itineraryId and userToken
  // Also check if we're in collaboration mode via query parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const collaborationParam = urlParams.get('collaborate');
    
    // If we're in collaboration mode, use the collaboration parameter as the WebSocket ID
    // Otherwise use the itineraryId prop
    const wsId = collaborationParam || itineraryId;
    
    if (wsId && userToken && wsId.length > 0) {
      console.log('Connecting to collaboration with ID:', wsId);
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [itineraryId, userToken, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    ...state,
    updateCursor,
    updateSelection,
    updateItinerary,
    sendChatMessage,
    connect,
    disconnect
  };
}
