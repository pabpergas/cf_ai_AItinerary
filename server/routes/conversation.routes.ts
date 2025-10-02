import { requireAuth } from "../middleware/auth.middleware";
import type { Env } from "../types";

export async function handleConversationRoutes(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);

  // SSE endpoint for conversation updates - use NotificationManager DO
  if (url.pathname === "/api/conversations/stream" && request.method === "GET") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    // Get NotificationManager DO for this user (one instance per user)
    const id = env.NotificationManager.idFromName(user.userId);
    const stub = env.NotificationManager.get(id);

    // Forward the request to the DO
    const doRequest = new Request(`https://internal/subscribe?userId=${user.userId}`, {
      method: 'GET',
      signal: request.signal
    });

    const response = await stub.fetch(doRequest);

    // Send initial data before returning SSE stream
    const conversations = await env.DB.prepare(`
      SELECT id, title, created_at, updated_at
      FROM chat_conversations
      WHERE user_id = ?
      ORDER BY updated_at DESC
      LIMIT 10
    `).bind(user.userId).all();

    const data = conversations.results.map((conv: any) => ({
      id: conv.id,
      title: conv.title || "Untitled chat",
      lastMessage: "",
      timestamp: conv.updated_at,
    }));

    // Create a new stream that sends initial data then pipes DO stream
    const { readable, writable } = new TransformStream();
    const encoder = new TextEncoder();

    // Start async task to send initial data then pipe DO stream
    (async () => {
      const writer = writable.getWriter();
      try {
        // Send initial data
        await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        writer.releaseLock();

        // Now pipe the DO response stream
        if (response.body) {
          await response.body.pipeTo(writable);
        } else {
          // If no DO stream, close the writable
          await writable.close();
        }
      } catch (error) {
        console.error('[SSE] Error in stream:', error);
        writer.releaseLock();
        writable.abort();
      }
    })();

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }

  // Get conversations list
  if (url.pathname === "/api/conversations" && request.method === "GET") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
      const conversations = await env.DB.prepare(`
          SELECT id, title, created_at, updated_at
          FROM chat_conversations
          WHERE user_id = ?
          ORDER BY updated_at DESC
          LIMIT 10
        `).bind(user.userId).all();

      return Response.json({
        success: true,
        conversations: conversations.results.map((conv: any) => ({
          id: conv.id,
          title: conv.title || "Untitled chat",
          lastMessage: "",
          timestamp: conv.updated_at,
        })),
      });
    } catch (error) {
      console.error("Get conversations error:", error);
      return Response.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  // Update conversation title
  if (
    url.pathname === "/api/conversations/update-title" &&
    request.method === "POST"
  ) {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
      const { conversationId, title } = await request.json();

      await env.DB.prepare(`
          UPDATE chat_conversations
          SET title = ?, updated_at = unixepoch()
          WHERE id = ? AND user_id = ?
        `).bind(title, conversationId, user.userId).run();

      return Response.json({
        success: true,
        message: "Title updated successfully",
      });
    } catch (error) {
      console.error("Update title error:", error);
      return Response.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return null;
}
