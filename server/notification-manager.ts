import { DurableObject } from "cloudflare:workers";
import type { Env } from "./types";

interface SSEConnection {
  writer: WritableStreamDefaultWriter<Uint8Array>;
  encoder: TextEncoder;
  userId: string;
}

/**
 * Durable Object to manage SSE connections for real-time notifications
 */
export class NotificationManager extends DurableObject<Env> {
  private connections: Map<string, SSEConnection[]>;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.connections = new Map();
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId");

    if (!userId) {
      return new Response("Missing userId", { status: 400 });
    }

    // SSE endpoint - keep connection open
    if (url.pathname === "/subscribe") {
      const { readable, writable } = new TransformStream();
      const writer = writable.getWriter();
      const encoder = new TextEncoder();

      // Add connection to map
      const userConnections = this.connections.get(userId) || [];
      const connection: SSEConnection = { writer, encoder, userId };
      userConnections.push(connection);
      this.connections.set(userId, userConnections);

      console.log(`[NotificationManager] User ${userId} subscribed. Total connections: ${userConnections.length}`);

      // Send keepalive every 30 seconds
      const keepaliveInterval = setInterval(async () => {
        try {
          await writer.write(encoder.encode(`: keepalive\n\n`));
        } catch (error) {
          clearInterval(keepaliveInterval);
        }
      }, 30000);

      // Cleanup on disconnect
      request.signal.addEventListener('abort', () => {
        clearInterval(keepaliveInterval);
        const connections = this.connections.get(userId) || [];
        const index = connections.indexOf(connection);
        if (index > -1) {
          connections.splice(index, 1);
        }
        if (connections.length === 0) {
          this.connections.delete(userId);
        }
        writer.close();
        console.log(`[NotificationManager] User ${userId} disconnected. Remaining connections: ${connections.length}`);
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }

    // Notify endpoint - send update to all connections for a user
    if (url.pathname === "/notify" && request.method === "POST") {
      const { userId: targetUserId, data } = await request.json<{ userId: string; data: any }>();

      const connections = this.connections.get(targetUserId) || [];
      console.log(`[NotificationManager] Notifying ${connections.length} connections for user ${targetUserId}`);
      console.log(`[NotificationManager] Data to send:`, JSON.stringify(data));

      const message = `data: ${JSON.stringify(data)}\n\n`;
      console.log(`[NotificationManager] SSE message:`, message);

      // Send to all connections for this user
      await Promise.all(
        connections.map(async (conn) => {
          try {
            await conn.writer.write(conn.encoder.encode(message));
          } catch (error) {
            console.error(`[NotificationManager] Failed to send to connection:`, error);
            // Remove failed connection
            const userConns = this.connections.get(targetUserId) || [];
            const index = userConns.indexOf(conn);
            if (index > -1) {
              userConns.splice(index, 1);
            }
          }
        })
      );

      return new Response(JSON.stringify({ success: true, sent: connections.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response("Not found", { status: 404 });
  }
}
