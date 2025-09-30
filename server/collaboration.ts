/**
 * Collaborative Itinerary Editing with Durable Objects
 * Multiple users can edit the same itinerary in real-time
 */

import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";

interface User {
  id: string;
  name: string;
  email: string;
  color: string; // User color for cursors/highlights
}

interface EditAction {
  type: 'activity-add' | 'activity-update' | 'activity-delete' | 'itinerary-update';
  userId: string;
  timestamp: number;
  data: any;
}

interface CollaboratorPresence {
  userId: string;
  userName: string;
  color: string;
  lastSeen: number;
  cursor?: { activityId: string; dayNumber: number };
}

export class CollaborativeItinerary extends DurableObject<Env> {
  private sessions: Map<WebSocket, User> = new Map();
  private itineraryData: any = null;
  private collaborators: Map<string, CollaboratorPresence> = new Map();
  private editHistory: EditAction[] = [];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    
    // Load persisted state
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<any>("itineraryData");
      if (stored) {
        this.itineraryData = stored;
      }
    });
  }

  // Called when a WebSocket message is received (Cloudflare Durable Objects lifecycle)
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    try {
      const msg = typeof message === 'string' ? message : new TextDecoder().decode(message);
      const data = JSON.parse(msg);
      await this.handleMessage(ws, data);
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  // Called when a WebSocket is closed (Cloudflare Durable Objects lifecycle)
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.handleDisconnect(ws);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade for real-time collaboration
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      await this.handleSession(server, request);

      return new Response(null, {
        status: 101,
        webSocket: client,
      });
    }

    // HTTP API for non-realtime operations
    if (request.method === "GET" && url.pathname.endsWith("/state")) {
      return Response.json({
        itinerary: this.itineraryData,
        collaborators: Array.from(this.collaborators.values()),
        activeUsers: this.sessions.size
      });
    }

    if (request.method === "POST" && url.pathname.endsWith("/create")) {
      const { itinerary, creatorId } = await request.json();
      this.itineraryData = itinerary;
      await this.ctx.storage.put("itineraryData", itinerary);
      
      return Response.json({ success: true, itineraryId: itinerary.id });
    }

    return new Response("Not found", { status: 404 });
  }

  async handleSession(webSocket: WebSocket, request: Request): Promise<void> {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const userName = url.searchParams.get("userName") || "Anonymous";
    const userEmail = url.searchParams.get("userEmail") || "";

    // Generate a random color for this user
    const color = this.generateUserColor();
    
    const user: User = {
      id: userId,
      name: userName,
      email: userEmail,
      color
    };

    // Use ctx.acceptWebSocket instead of webSocket.accept()
    this.ctx.acceptWebSocket(webSocket, [userId]);
    
    // Add to sessions
    this.sessions.set(webSocket, user);
    
    // Add to collaborators presence
    this.collaborators.set(userId, {
      userId,
      userName,
      color,
      lastSeen: Date.now()
    });

    // Send initial state immediately - this should work with ctx.acceptWebSocket
    webSocket.send(JSON.stringify({
      type: 'init',
      itinerary: this.itineraryData,
      user,
      collaborators: Array.from(this.collaborators.values())
    }));

    // Notify other users about new collaborator
    this.broadcast({
      type: 'user-joined',
      user: { userId, userName, color }
    }, webSocket);
  }

  handleDisconnect(webSocket: WebSocket): void {
    const user = this.sessions.get(webSocket);
    if (user) {
      this.sessions.delete(webSocket);
      this.collaborators.delete(user.id);
      
      this.broadcast({
        type: 'user-left',
        userId: user.id
      });
    }
  }

  async handleMessage(webSocket: WebSocket, message: any): Promise<void> {
    const user = this.sessions.get(webSocket);
    if (!user) return;
    switch (message.type) {
      case 'edit':
        await this.handleEdit(user, message.action);
        break;
      
      case 'cursor':
        this.handleCursorUpdate(user, message.cursor);
        break;
      
      case 'typing':
        this.handleTypingIndicator(user, message.activityId);
        break;
      
      case 'vote':
        this.handleVote(user, message.activityId, message.vote);
        break;

      case 'chat':
        this.handleChat(user, message.text);
        break;
    }
  }

  async handleEdit(user: User, action: EditAction): Promise<void> {
    // Apply edit to itinerary data
    action.userId = user.id;
    action.timestamp = Date.now();
    
    switch (action.type) {
      case 'activity-add':
        this.addActivity(action.data);
        break;
      
      case 'activity-update':
        this.updateActivity(action.data);
        break;
      
      case 'activity-delete':
        this.deleteActivity(action.data.activityId);
        break;
      
      case 'itinerary-update':
        this.updateItinerary(action.data);
        break;
    }

    // Save to storage
    await this.ctx.storage.put("itineraryData", this.itineraryData);
    
    // Add to history
    this.editHistory.push(action);
    if (this.editHistory.length > 100) {
      this.editHistory = this.editHistory.slice(-100); // Keep last 100 edits
    }

    // Broadcast to all other users
    this.broadcast({
      type: 'edit',
      action,
      user: { id: user.id, name: user.name, color: user.color }
    });
  }

  addActivity(data: any): void {
    if (!this.itineraryData || !this.itineraryData.days) return;
    
    const day = this.itineraryData.days.find((d: any) => d.dayNumber === data.dayNumber);
    if (day) {
      day.activities.push(data.activity);
    }
  }

  updateActivity(data: any): void {
    if (!this.itineraryData || !this.itineraryData.days) return;
    
    for (const day of this.itineraryData.days) {
      const activityIndex = day.activities.findIndex((a: any) => a.id === data.activityId);
      if (activityIndex !== -1) {
        day.activities[activityIndex] = { ...day.activities[activityIndex], ...data.updates };
        break;
      }
    }
  }

  deleteActivity(activityId: string): void {
    if (!this.itineraryData || !this.itineraryData.days) return;
    
    for (const day of this.itineraryData.days) {
      const activityIndex = day.activities.findIndex((a: any) => a.id === activityId);
      if (activityIndex !== -1) {
        day.activities.splice(activityIndex, 1);
        break;
      }
    }
  }

  updateItinerary(data: any): void {
    if (!this.itineraryData) return;
    
    this.itineraryData = { ...this.itineraryData, ...data };
  }

  handleCursorUpdate(user: User, cursor: any): void {
    const presence = this.collaborators.get(user.id);
    if (presence) {
      presence.cursor = cursor;
      presence.lastSeen = Date.now();
    }

    this.broadcast({
      type: 'cursor-update',
      userId: user.id,
      cursor
    });
  }

  handleTypingIndicator(user: User, activityId: string): void {
    this.broadcast({
      type: 'typing',
      userId: user.id,
      userName: user.name,
      activityId
    });
  }

  handleVote(user: User, activityId: string, vote: 'up' | 'down' | 'neutral'): void {
    // Store votes in activity metadata
    if (!this.itineraryData || !this.itineraryData.days) return;
    
    for (const day of this.itineraryData.days) {
      const activity = day.activities.find((a: any) => a.id === activityId);
      if (activity) {
        if (!activity.votes) activity.votes = {};
        activity.votes[user.id] = vote;
        
        this.broadcast({
          type: 'vote-update',
          activityId,
          userId: user.id,
          vote,
          totalVotes: this.calculateVotes(activity.votes)
        });
        
        break;
      }
    }
  }

  handleChat(user: User, text: string): void {
    this.broadcast({
      type: 'chat-message',
      user: { id: user.id, name: user.name, color: user.color },
      text,
      timestamp: Date.now()
    });
  }

  calculateVotes(votes: Record<string, 'up' | 'down' | 'neutral'>): { up: number; down: number; neutral: number } {
    return Object.values(votes).reduce(
      (acc, vote) => {
        acc[vote]++;
        return acc;
      },
      { up: 0, down: 0, neutral: 0 }
    );
  }

  broadcast(message: any, exclude?: WebSocket): void {
    const data = JSON.stringify(message);
    
    for (const [ws, user] of this.sessions) {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(data);
        } catch (error) {
          console.error('Error broadcasting message:', error);
          // Remove broken WebSocket
          this.sessions.delete(ws);
        }
      }
    }
  }

  generateUserColor(): string {
    const colors = [
      '#3B82F6', // blue
      '#10B981', // green
      '#F59E0B', // amber
      '#EF4444', // red
      '#8B5CF6', // purple
      '#EC4899', // pink
      '#14B8A6', // teal
      '#F97316'  // orange
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
