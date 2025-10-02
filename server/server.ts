import { routeAgentRequest } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  generateText,
  type StreamTextOnFinishCallback,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  type ToolSet,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import type { Env } from "./types";
import { generateRandomId, generateUserId, generateMessageId } from "./server-crypto";

// Middleware
import { validateToken } from "./middleware/auth.middleware";

// Routes
import { handleAuthRoutes } from "./routes/auth.routes";
import { handleItineraryRoutes } from "./routes/itinerary.routes";
import { handleConversationRoutes } from "./routes/conversation.routes";
import { handleVoiceRoutes } from "./routes/voice.routes";
import { handleCollabRoutes } from "./routes/collab.routes";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // IMPORTANT: Clear messages loaded by parent constructor from SQL
    // Each conversation ID should have its own DO instance, so we don't want
    // the parent class loading messages based on some default query
    this.messages = [];

    console.log("[Chat DO] Constructor called");
    console.log("[Chat DO] ID:", this.ctx.id.toString());
    console.log("[Chat DO] Name:", this.ctx.id.name);
    console.log("[Chat DO] Messages cleared, will be loaded in onRequest based on conversationId");
  }

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    let token = url.searchParams.get("token");
    const conversationId = url.searchParams.get("conversationId");
    const pathname = url.pathname;

    // If no token in query params, try to get it from Authorization header or _pk query param
    if (!token) {
      const authHeader = request.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        token = authHeader.substring(7);
      } else {
        // Check _pk query param (Cloudflare Agents SDK uses this)
        token = url.searchParams.get("_pk") || null;
      }
    }

    console.log("[Chat DO] onRequest called");
    console.log("[Chat DO] Pathname:", pathname);
    console.log("[Chat DO] Token from query 'token':", url.searchParams.get("token") ? "present" : "missing");
    console.log("[Chat DO] Token from query '_pk':", url.searchParams.get("_pk") ? "present" : "missing");
    console.log("[Chat DO] Token from header:", request.headers.get("Authorization") ? "present" : "missing");
    console.log("[Chat DO] Final token:", token ? "present" : "missing");
    console.log("[Chat DO] ConversationId from query:", conversationId);
    console.log("[Chat DO] Current messages count:", this.messages.length);

    // Get stored conversationId
    const storedConversationId = await this.ctx.storage.get<string>("conversationId");

    // ALWAYS reload messages from DB based on conversationId to ensure we have the correct conversation
    if (conversationId) {
      // Check if we need to reload messages
      // Reload if: conversation changed OR messages are empty (DO restarted)
      const needsReload = !storedConversationId || conversationId !== storedConversationId || this.messages.length === 0;

      if (needsReload) {
        console.log("[Chat DO] Loading/switching conversation:", conversationId);
        if (storedConversationId && conversationId === storedConversationId && this.messages.length === 0) {
          console.log("[Chat DO] Same conversation but 0 messages in memory - reloading from DB");
        }
        if (storedConversationId && conversationId !== storedConversationId) {
          console.log("[Chat DO] Previous conversationId:", storedConversationId);
        }

        // Clear existing messages (they might be from constructor or previous conversation)
        this.messages = [];

        try {
          const dbMessages = await this.env.DB.prepare(
            "SELECT content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC"
          ).bind(conversationId).all();

          if (dbMessages.results && dbMessages.results.length > 0) {
            console.log("[Chat DO] Loaded", dbMessages.results.length, "messages from DB");
            this.messages = dbMessages.results.map((row: any) => JSON.parse(row.content));
          } else {
            console.log("[Chat DO] No messages in DB for this conversation (new conversation)");
          }
        } catch (error) {
          console.error("[Chat DO] Error loading messages from DB:", error);
        }
      } else {
        console.log("[Chat DO] Same conversation, keeping", this.messages.length, "messages in memory");
      }
    }

    // Save conversationId if provided
    if (conversationId) {
      await this.ctx.storage.put("conversationId", conversationId);
      console.log("[Chat DO] Saved conversationId to storage:", conversationId);
    }

    // Save token and userId to storage whenever available
    if (token) {
      console.log("[Chat DO] Saving token to storage");
      // Always update token to ensure we have the latest one
      await this.ctx.storage.put("userToken", token);
      const user = await validateToken(this.env.DB, token);
      if (user) {
        console.log("[Chat DO] Saving userId to storage:", user.userId);
        await this.ctx.storage.put("userId", user.userId);
      } else {
        console.error("[Chat DO] Token validation failed in onRequest");
        console.error("[Chat DO] Token preview:", token.substring(0, 10));
      }
    } else {
      console.log("[Chat DO] No token in query params");
    }

    // Check if this is a get-messages request
    if (pathname.includes('/get-messages')) {
      // Only return empty array if there are no messages (new conversation)
      if (this.messages.length === 0) {
        console.log("[Chat DO] No messages yet, returning empty array");
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    return super.onRequest(request);
  }

  private async notifyConversationUpdate(userId: string): Promise<void> {
    try {
      // Get conversations data
      const conversations = await this.env.DB.prepare(`
        SELECT id, title, created_at, updated_at
        FROM chat_conversations
        WHERE user_id = ?
        ORDER BY updated_at DESC
        LIMIT 10
      `).bind(userId).all();

      const data = conversations.results.map((conv: any) => ({
        id: conv.id,
        title: conv.title || "Untitled chat",
        lastMessage: "",
        timestamp: conv.updated_at,
      }));

      // Get NotificationManager DO for this user
      const id = this.env.NotificationManager.idFromName(userId);
      const stub = this.env.NotificationManager.get(id);

      console.log("[notifyConversationUpdate] Sending data:", JSON.stringify(data));

      // Notify all connections for this user
      const response = await stub.fetch(new Request(`https://internal/notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, data })
      }));

      const result = await response.json();
      console.log("[notifyConversationUpdate] Notified user:", userId, "Response:", result);
    } catch (error) {
      console.error("[notifyConversationUpdate] Error:", error);
    }
  }

  private async generateConversationTitle(conversationId: string, userId: string): Promise<void> {
    try {
      // Get first few messages to generate a title
      const userMessages = this.messages
        .filter(m => m.role === 'user')
        .slice(0, 3)
        .map(m => {
          const textPart = m.parts?.find((p: any) => p.type === 'text');
          return textPart ? (textPart as any).text : '';
        })
        .filter(text => text.length > 0)
        .join(' ');

      if (!userMessages) return;

      const openai = createOpenAI({
        apiKey: this.env.OPENAI_API_KEY,
        fetch,
      });

      const model = openai("gpt-4o-mini");

      const { text } = await generateText({
        model,
        prompt: `Based on this conversation, generate a short, descriptive title (max 6 words) that summarizes the trip or topic:\n\n${userMessages}\n\nTitle:`,
      });

      const title = text.trim().replace(/^["']|["']$/g, '');

      // Update conversation title in D1
      await this.env.DB.prepare(
        "UPDATE chat_conversations SET title = ? WHERE id = ?"
      ).bind(title, conversationId).run();

      console.log("[generateConversationTitle] Title generated:", title);

      // Notify SSE connections about title update
      await this.notifyConversationUpdate(userId);
    } catch (error) {
      console.error("[generateConversationTitle] Error:", error);
    }
  }

  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ): Promise<Response> {
    console.log("[onChatMessage] START - Method called");
    console.log("[onChatMessage] DO ID:", this.ctx.id.toString());
    console.log("[onChatMessage] DO Name:", this.ctx.id.name);

    let storedToken = await this.ctx.storage.get<string>("userToken");
    let userId = await this.ctx.storage.get<string>("userId");
    const conversationId = await this.ctx.storage.get<string>("conversationId");

    console.log("[onChatMessage] Stored data retrieved:", {
      hasToken: !!storedToken,
      userId,
      conversationId,
    });

    // If no conversationId, we can't proceed
    if (!conversationId) {
      console.error("[onChatMessage] No conversationId in storage");
      throw new Error("No conversationId available");
    }

    // If we don't have userId, we need to validate with the stored token first
    if (!userId && storedToken) {
      console.log("[onChatMessage] No userId in storage, validating with stored token");
      const user = await validateToken(this.env.DB, storedToken);
      if (user) {
        userId = user.userId;
        await this.ctx.storage.put("userId", userId);
        console.log("[onChatMessage] userId retrieved from token validation:", userId);
      }
    }

    // If we still don't have userId, check if conversation exists and get userId from it
    if (!userId) {
      console.log("[onChatMessage] Still no userId, trying to get from existing conversation in DB");
      const conversation = await this.env.DB.prepare(
        "SELECT user_id FROM chat_conversations WHERE id = ?"
      ).bind(conversationId).first<{ user_id: string }>();

      if (conversation?.user_id) {
        userId = conversation.user_id;
        await this.ctx.storage.put("userId", userId);
        console.log("[onChatMessage] userId retrieved from existing conversation:", userId);
      } else {
        console.error("[onChatMessage] No userId available and conversation doesn't exist - unauthorized");
        throw new Error("Unauthorized: No valid session found");
      }
    }

    // Validate token directly from DB using userId to ensure we have the latest valid session
    const validSession = await this.env.DB.prepare(
      "SELECT s.token, s.expires_at, u.id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.user_id = ? AND s.expires_at > ? ORDER BY s.created_at DESC LIMIT 1"
    ).bind(userId, Date.now()).first<{ token: string; expires_at: number; id: string; email: string; name: string }>();

    if (!validSession) {
      console.error("[onChatMessage] No valid session found for userId:", userId);
      throw new Error("Unauthorized: Session expired or not found");
    }

    const user = {
      userId: validSession.id,
      email: validSession.email,
      name: validSession.name
    };

    // Update stored token if it's different
    if (storedToken !== validSession.token) {
      console.log("[onChatMessage] Updating stored token with latest session token");
      await this.ctx.storage.put("userToken", validSession.token);
    }

    console.log("[onChatMessage] User validated:", { userId: user.userId });
    console.log("[onChatMessage] ConversationId from storage:", conversationId);

    // Create conversation record in D1 if it doesn't exist
    const existingConv = await this.env.DB.prepare(
      "SELECT id FROM chat_conversations WHERE id = ?"
    ).bind(conversationId).first();

    if (!existingConv) {
      console.log("[onChatMessage] Creating new conversation in DB");
      await this.env.DB.prepare(
        "INSERT INTO chat_conversations (id, user_id, title) VALUES (?, ?, ?)"
      ).bind(conversationId, user.userId, "New conversation").run();

      // Notify SSE connections immediately about new conversation
      console.log("[onChatMessage] Notifying new conversation creation");
      await this.notifyConversationUpdate(userId);
    }

    // Collect all tools with special handling for certain tools
    const toolsWithEnv = Object.fromEntries(
      Object.entries(tools).map(([name, toolDef]) => {
        // Tools that need env
        if (name === "searchWeb" || name === "searchBooking") {
          return [
            name,
            {
              ...toolDef,
              execute: async (args: any) => {
                return toolDef.execute({ ...args, env: this.env });
              },
            },
          ];
        }

        // updateConversationTitle needs conversationId and DB access
        if (name === "updateConversationTitle") {
          return [
            name,
            {
              ...toolDef,
              execute: async (args: any) => {
                const { title } = args;
                console.log("[updateConversationTitle] Updating title to:", title);

                // Update in database
                await this.env.DB.prepare(
                  "UPDATE chat_conversations SET title = ? WHERE id = ?"
                ).bind(title, conversationId).run();

                console.log("[updateConversationTitle] Title updated in DB");

                return { success: true, title };
              },
            },
          ];
        }

        return [name, toolDef];
      })
    );

    const allTools = {
      ...toolsWithEnv,
      ...this.mcp.getAITools(),
    };

    console.log("[onChatMessage] Creating UI message stream");

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          console.log(
            "[onChatMessage] Stream execute started, messages count:",
            this.messages.length
          );

          const cleanedMessages = cleanupMessages(this.messages);
          console.log(
            "[onChatMessage] Messages cleaned, count:",
            cleanedMessages.length
          );

          const processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions,
          });

          console.log(
            "[onChatMessage] Messages processed, count:",
            processedMessages.length
          );

          if (!this.env.OPENAI_API_KEY) {
            writer.writeText("OpenAI API key is not configured.");
            return;
          }

          const openai = createOpenAI({
            apiKey: this.env.OPENAI_API_KEY,
            fetch,
          });

          const model = openai("gpt-4o-mini-2024-07-18");
          console.log("[onChatMessage] OpenAI model created, starting streamText");

          const wrappedOnFinish: StreamTextOnFinishCallback<ToolSet> = async (event) => {
            console.log("[wrappedOnFinish] Called!");
            console.log("[wrappedOnFinish] conversationId:", conversationId);
            console.log("[wrappedOnFinish] messages count:", this.messages.length);

            // Call original onFinish
            await onFinish(event);
            console.log("[wrappedOnFinish] Original onFinish completed");

            // Save all messages to DB with correct conversationId
            try {
              console.log("[onFinish] Saving messages to DB, conversationId:", conversationId);
              console.log("[onFinish] Total messages to save:", this.messages.length);

              // Delete old messages for this conversation
              await this.env.DB.prepare(
                "DELETE FROM chat_messages WHERE conversation_id = ?"
              ).bind(conversationId).run();

              // Save all current messages
              for (const message of this.messages) {
                await this.env.DB.prepare(
                  "INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, datetime('now'))"
                ).bind(
                  conversationId,
                  message.role,
                  JSON.stringify(message)
                ).run();
              }

              console.log("[onFinish] Messages saved successfully");
            } catch (error) {
              console.error("[onFinish] Error saving messages:", error);
            }

            // Check if we should generate a title (after 3-4 user messages)
            const userMessageCount = this.messages.filter(m => m.role === 'user').length;
            console.log("[wrappedOnFinish] User message count:", userMessageCount);

            if (userMessageCount >= 3 && userMessageCount <= 4) {
              console.log("[wrappedOnFinish] User count is 3-4, checking title...");

              // Check if title is still "New conversation"
              const conv = await this.env.DB.prepare(
                "SELECT title FROM chat_conversations WHERE id = ?"
              ).bind(conversationId).first<{ title: string }>();

              console.log("[wrappedOnFinish] Current title:", conv?.title);

              if (conv && conv.title === "New conversation") {
                console.log("[wrappedOnFinish] Calling generateConversationTitle");
                // Generate title in background
                if (userId) {
                  this.generateConversationTitle(conversationId, userId);
                } else {
                  console.log("[wrappedOnFinish] No userId, skipping title generation");
                }
              } else {
                console.log("[wrappedOnFinish] Title already set or conversation not found");
              }
            }
          };

          const result = streamText({
            system: `You are AItinerary Assistant, a specialized AI travel planner that helps users create personalized itineraries.

CONVERSATION TITLE:
- After responding to the user's THIRD message, call updateConversationTitle with a short descriptive title (max 6 words) based on their travel request
- Example: If user asks "I want to visit Paris for 3 days", respond to them first, THEN call updateConversationTitle with title "3-Day Paris Trip"
- IMPORTANT: Always provide your response to the user FIRST, then call the tool
- Only call this tool ONCE per conversation

CRITICAL WORKFLOW:
1. When a user asks for travel planning, FIRST check if web search is enabled in their message
2. If [WEB_SEARCH_ENABLED] is present, FIRST use searchBooking to find real hotels with the EXACT dates from user's request
   - IMPORTANT: Always pass checkIn and checkOut dates in YYYY-MM-DD format
   - Example: If user wants "3 days in Paris from March 15", use checkIn: "2025-03-15", checkOut: "2025-03-18"
3. If user selects a specific hotel, THEN use generateCompleteItinerary with that hotel included
4. If no web search, use generateCompleteItinerary directly

When using generateCompleteItinerary, you MUST provide ALL the required data including:

1. SPECIFIC REAL LOCATIONS: Use ACTUAL places that exist in the destination city.
2. ACCURATE COORDINATES: You MUST provide the REAL latitude and longitude coordinates for each specific location.
3. DETAILED ACTIVITIES: Create 3-5 activities per day with real place names, accurate coordinates, realistic time schedules, appropriate cost estimates, and helpful tips.

Never provide text descriptions - always use the tool with complete, accurate data.

ACTIVITY MODIFICATION HANDLING:
- When modifying an itinerary, use the appropriate tools (modifyActivity, replaceActivity, addActivity, removeActivity)
- IMPORTANT: After calling any modification tool, ALWAYS send a confirmation message to the user
- Example: "✓ I've added 'Visit Long Island' to day 3 of your itinerary."
- Example: "✓ I've removed the Brooklyn Bridge activity from your itinerary."
- Example: "✓ I've updated the Statue of Liberty visit with your requested changes."
`,
            messages: convertToModelMessages(processedMessages),
            tools: allTools,
            model,
            maxSteps: 10,
            onFinish: wrappedOnFinish,
            onChunk: (chunk) => {
              console.log("[Streaming] Chunk received:", chunk.type);
            },
          });

          writer.merge(result.toUIMessageStream());
        } catch (error) {
          console.error("[onChatMessage] Error in stream execute:", error);
          writer.writeText(
            `Error: ${error instanceof Error ? error.message : "Unknown error"}`
          );
        }
      },
    });

    return createUIMessageStreamResponse({ stream });
  }
}

/**
 * Main Worker Handler
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Check OpenAI key
    if (url.pathname === "/check-open-ai-key") {
      try {
        const hasKey = !!env.OPENAI_API_KEY && env.OPENAI_API_KEY.length > 0;
        return Response.json({
          success: hasKey,
          message: hasKey ? "OpenAI key is configured" : "OpenAI key is not configured",
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: "OpenAI key is not available",
          error: (error as Error).message,
        });
      }
    }

    // Route handlers
    const authResponse = await handleAuthRoutes(request, env);
    if (authResponse) return authResponse;

    const itineraryResponse = await handleItineraryRoutes(request, env);
    if (itineraryResponse) return itineraryResponse;

    const conversationResponse = await handleConversationRoutes(request, env);
    if (conversationResponse) return conversationResponse;

    const voiceResponse = await handleVoiceRoutes(request, env);
    if (voiceResponse) return voiceResponse;

    const collabResponse = await handleCollabRoutes(request, env);
    if (collabResponse) return collabResponse;

    // Route to agent or let assets handle it (including SPA routing)
    return (
      (await routeAgentRequest(request, env)) ||
      env.ASSETS.fetch(request)
    );
  },
} satisfies ExportedHandler<Env>;

// Export Durable Objects
export { CollaborativeItinerary } from "./collaboration";
export { NotificationManager } from "./notification-manager";

// Export Realtime Voice Agent factory
export { createVoiceTravelAgent } from "./voice-agent";
