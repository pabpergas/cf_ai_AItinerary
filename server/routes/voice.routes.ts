import { requireAuth } from "../middleware/auth.middleware";
import { tools } from "../tools";
import type { Env } from "../types";

export async function handleVoiceRoutes(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);

  // Voice transcript save
  if (url.pathname === "/api/voice/transcript" && request.method === "POST") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
      const body = (await request.json()) as {
        conversationId: string;
        role: "user" | "assistant";
        content: string;
      };

      console.log(`Saving voice transcript for user ${user.email}:`, body);

      await env.DB.prepare(`
          INSERT INTO chat_messages (conversation_id, role, content, created_at)
          VALUES (?, ?, ?, unixepoch())
        `).bind(body.conversationId, body.role, body.content).run();

      await env.DB.prepare(`
          UPDATE chat_conversations
          SET updated_at = unixepoch()
          WHERE id = ? AND user_id = ?
        `).bind(body.conversationId, user.userId).run();

      return Response.json({ success: true });
    } catch (error) {
      console.error("Voice transcript save error:", error);
      return Response.json(
        { error: "Failed to save transcript" },
        { status: 500 }
      );
    }
  }

  // Voice tool execution
  if (
    url.pathname === "/api/voice/execute-tool" &&
    request.method === "POST"
  ) {
    try {
      const body = (await request.json()) as { toolName: string; args: any };
      const { toolName, args } = body;

      console.log(`Executing voice tool: ${toolName}`, args);

      const tool = tools[toolName as keyof typeof tools];
      if (!tool || !tool.execute) {
        return Response.json(
          { error: `Tool ${toolName} not found` },
          { status: 404 }
        );
      }

      const toolArgs =
        toolName === "searchWeb" || toolName === "searchBooking"
          ? { ...args, env }
          : args;

      const result = await (tool.execute as any)(toolArgs);

      console.log(`Voice tool ${toolName} result:`, result);
      return Response.json({ success: true, result });
    } catch (error) {
      console.error("Voice tool execution error:", error);
      return Response.json(
        { error: "Failed to execute tool" },
        { status: 500 }
      );
    }
  }

  // OpenAI Realtime ephemeral token
  if (url.pathname === "/api/realtime/token" && request.method === "GET") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
      console.log(`Generating realtime token for user: ${user.email}`);

      const sessionConfig = JSON.stringify({
        session: {
          type: "realtime",
          model: "gpt-realtime",
          audio: {
            output: {
              voice: "marin",
            },
          },
          instructions: `You are AItinerary Voice Assistant, a friendly AI travel planner.

CRITICAL RULES:
- NEVER say "let me create", "I'll generate", or "I'm going to make" - JUST DO IT
- When you have all needed info, IMMEDIATELY call the tool without announcing it
- While the tool runs, keep talking naturally about what the itinerary will include
- NO confirmations, NO asking permission - be proactive and decisive

Your role:
- Help users plan trips through natural voice conversations
- Ask about: destination, dates, budget, travelers, interests
- As SOON as you have enough info, call generateCompleteItinerary or searchBooking
- While waiting for results, describe what you're planning

Examples:
❌ BAD: "Great! Let me create an itinerary for you..."
✅ GOOD: "Perfect! For your 3 days in Paris, I'm planning visits to the Eiffel Tower, Louvre Museum..." [CALLS TOOL IMMEDIATELY]

❌ BAD: "I'll search for hotels now..."
✅ GOOD: "Looking at hotels in the city center with your budget..." [CALLS TOOL IMMEDIATELY]

Keep responses brief and natural for voice. Be enthusiastic about travel!`,
        },
      });

      const response = await fetch(
        "https://api.openai.com/v1/realtime/client_secrets",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: sessionConfig,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenAI ephemeral token error:", errorText);
        return new Response(errorText, { status: response.status });
      }

      const data = await response.json();
      return Response.json(data);
    } catch (error) {
      console.error("Error creating ephemeral token:", error);
      return Response.json(
        { error: "Failed to generate token" },
        { status: 500 }
      );
    }
  }

  return null;
}
