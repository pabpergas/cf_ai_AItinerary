import { routeAgentRequest } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet,
  type UIMessage
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools, executions } from "./tools";
import type { Env } from "./types";
import { hashPassword, generateToken, generateRandomId, generateUserId, generateMessageId } from "./server-crypto";

async function validateToken(db: D1Database, token: string): Promise<{ userId: string; email: string; name: string } | null> {
  const session = await db.prepare(
    'SELECT u.id, u.email, u.name FROM user_sessions s JOIN users u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > datetime("now")'
  ).bind(token).first();
  
  return session ? { userId: session.id, email: session.email, name: session.name } : null;
}

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  // We DON'T override onMessage here - we implement onChatMessage instead
  // The agents system will handle message storage automatically

  async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (token) {
      await this.ctx.storage.put("userToken", token);
      const user = await validateToken(this.env.DB, token);
      if (user) {
        await this.ctx.storage.put("userId", user.userId);
      }
    }

    return super.onRequest(request);
  }

  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ): Promise<Response> {
    console.log("[onChatMessage] START - Method called");
    
    // El token viene del estado del DO, guardado durante la conexión WebSocket inicial
    const token = await this.ctx.storage.get<string>("userToken");
    const userId = await this.ctx.storage.get<string>("userId");

    console.log("[onChatMessage] Token and userId retrieved:", { hasToken: !!token, userId });

    if (!token || !userId) {
      console.error("[onChatMessage] No token/userId in storage, unauthorized");
      throw new Error("Unauthorized: No token or userId");
    }

    const user = await validateToken(this.env.DB, token);
    console.log("[onChatMessage] User validated:", { userId: user?.userId });
    
    if (!user) {
      console.error("[onChatMessage] Invalid token, unauthorized");
      throw new Error("Unauthorized: Invalid token");
    }

    // The conversation ID is the DO name - no need to manage it separately
    const conversationId = this.ctx.id.toString();
    console.log("[onChatMessage] ConversationId (DO ID):", conversationId);

    // Create conversation record in D1 if it doesn't exist (for listing purposes)
    const existingConv = await this.env.DB.prepare(
      "SELECT id FROM chat_conversations WHERE id = ?"
    ).bind(conversationId).first();
    
    if (!existingConv) {
      await this.env.DB.prepare(
        "INSERT INTO chat_conversations (id, user_id, title) VALUES (?, ?, ?)"
      ).bind(conversationId, user.userId, "New conversation").run();
    }

    // Collect all tools, including MCP tools
    // Inject env into tools that need it
    const toolsWithEnv = Object.fromEntries(
      Object.entries(tools).map(([name, toolDef]) => {
        if (name === 'searchWeb' || name === 'searchBooking') {
          return [name, {
            ...toolDef,
            execute: async (args: any) => {
              return toolDef.execute({ ...args, env: this.env });
            }
          }];
        }
        return [name, toolDef];
      })
    );

    const allTools = {
      ...toolsWithEnv,
      ...this.mcp.getAITools()
    };

    console.log("[onChatMessage] Creating UI message stream");
    
    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        try {
          console.log("[onChatMessage] Stream execute started, messages count:", this.messages.length);
          
          // Clean up incomplete tool calls to prevent API errors
          const cleanedMessages = cleanupMessages(this.messages);
          console.log("[onChatMessage] Messages cleaned, count:", cleanedMessages.length);

          const processedMessages = await processToolCalls({
            messages: cleanedMessages,
            dataStream: writer,
            tools: allTools,
            executions
          });
          
          console.log("[onChatMessage] Messages processed, count:", processedMessages.length);

          if (!this.env.OPENAI_API_KEY) {
            writer.writeText("OpenAI API key is not configured.");
            return;
          }

          const openai = createOpenAI({
            apiKey: this.env.OPENAI_API_KEY,
            fetch
          });

          const model = openai("gpt-4o-mini-2024-07-18");
          console.log("[onChatMessage] OpenAI model created, starting streamText");

          const result = streamText({
            system: `You are AItinerary Assistant, a specialized AI travel planner that helps users create personalized itineraries.

CRITICAL WORKFLOW:
1. When a user asks for travel planning, FIRST check if web search is enabled in their message
2. If [WEB_SEARCH_ENABLED] is present, FIRST use searchBooking to find real hotels, then present options to user
3. If user selects a specific hotel, THEN use generateCompleteItinerary with that hotel included
4. If no web search, use generateCompleteItinerary directly

When using generateCompleteItinerary, you MUST provide ALL the required data including:

1. SPECIFIC REAL LOCATIONS: Use ACTUAL places that exist in the destination city. For example, if the destination is Seville, use real places like "Seville Cathedral", "Real Alcázar", "Plaza de España", "Santa Cruz Quarter", "Triana Market", etc.

2. ACCURATE COORDINATES: You MUST provide the REAL latitude and longitude coordinates for each specific location. DO NOT use random or approximate coordinates. Use your knowledge of the actual city geography.

3. DETAILED ACTIVITIES: Create 3-5 activities per day with:
   - REAL place names that actually exist in the destination
   - ACCURATE coordinates for those exact places
   - Realistic time schedules
   - Appropriate cost estimates
   - Helpful, practical tips

COORDINATE EXAMPLES FOR MAJOR CITIES:
- Seville: Cathedral (37.3857, -5.9936), Real Alcázar (37.3829, -5.9913), Plaza de España (37.3768, -5.9874)
- Madrid: Prado Museum (40.4138, -3.6921), Retiro Park (40.4153, -3.6844), Puerta del Sol (40.4168, -3.7038)
- Barcelona: Sagrada Familia (41.4036, 2.1744), Park Güell (41.4145, 2.1527), Las Ramblas (41.3811, 2.1724)

When calling generateCompleteItinerary:
- Research the destination and use REAL attraction names, restaurants, and landmarks
- Provide ACCURATE lat/lng coordinates for each real location
- Create realistic daily schedules with proper timing
- Include mix of sightseeing, dining, culture, and entertainment
- Add practical tips for each activity

NEVER use generic names like "Historic District" or "Art Museum" - use the actual names of places in the destination city.
NEVER use coordinates from other cities - each coordinate must match the real location you're naming.

Never provide text descriptions - always use the tool with complete, accurate data.

SEARCH TOOLS WORKFLOW:
- When [WEB_SEARCH_ENABLED] is in the message, follow this sequence:
  1. FIRST: Use searchBooking to find real hotels with prices
  2. SECOND: Present hotel options to user (do NOT generate itinerary yet)
  3. WAIT: Let user select a hotel before proceeding
  4. THIRD: Only after hotel selection, use generateCompleteItinerary

SEARCH TOOLS USAGE:
- searchWeb: For restaurants, attractions, reviews, current information (ONLY when user explicitly asks for current info)
- searchBooking: For hotels, prices, availability on Booking.com (ONLY when [WEB_SEARCH_ENABLED] is present)
- CRITICAL: DO NOT use search tools when user has already selected a hotel or is confirming a selection
- CRITICAL: When user says "I have selected [hotel name]", immediately proceed to generateCompleteItinerary WITHOUT searching
- Always show search results to user BEFORE generating final itinerary
- Never auto-generate itinerary when web search is enabled - wait for user selection

ACTIVITY MODIFICATION HANDLING:
- When users discuss changes to activities in the chat (add, modify, remove), detect which specific activity they want to modify
- For ADDING or MODIFYING activities:
  * Single activity: Return ONLY the JSON object of the modified/new activity. DO NOT include explanatory text before or after the JSON.
  * Multiple activities: Use addMultipleActivities tool with itineraryId and array of activities with their dayNumbers
  * Format: Return the complete updated activity JSON with all fields (id, title, description, location, coordinates, startTime, endTime, category, estimatedCost, priority, tips, dayNumber)
  * The frontend will automatically replace/add the activity in the itinerary
  * After the JSON, you MAY add a brief note about conflicts or suggestions
- For REMOVING activities:
  * Single activity: Use removeActivity tool with the itineraryId and activityId
  * Multiple activities: Use removeMultipleActivities tool with itineraryId and array of activityIds
  * The tool will automatically remove the activity/activities from the itinerary
  * Confirm to the user which activities were removed
- Examples of modification triggers:
  * "Add activity X to day 3" → Return ONLY the JSON of the new activity
  * "Add 3 restaurants to the itinerary" → Use addMultipleActivities tool
  * "Change the time of the museum visit to 2pm" → Return ONLY the updated museum activity JSON
  * "Make the restaurant dinner more expensive" → Return ONLY the updated restaurant activity JSON
  * "Remove the shopping activity" → Use removeActivity tool
  * "Delete all food activities from day 2" → Use removeMultipleActivities tool
  * "Remove the first 3 activities from day 1" → Use removeMultipleActivities tool
  * "Cancel the museum visit" → Use removeActivity tool
  
CRITICAL FORMAT FOR ACTIVITY MODIFICATIONS:
\`\`\`json
{
  "id": "act_...",
  "title": "...",
  ...
}
\`\`\`

Then optionally add a brief note about the change.`,

            messages: convertToModelMessages(processedMessages),
            model,
            tools: allTools,
            providerOptions: {
              openai: {
                reasoning_effort: "low"
              }
            },
            onFinish: onFinish as StreamTextOnFinishCallback<typeof allTools>,
            stopWhen: stepCountIs(10)
          });

          writer.merge(result.toUIMessageStream());

          // Update conversation timestamp
          await this.env.DB.prepare(
            "UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"
          ).bind(conversationId).run();
        } catch (error) {
          console.error("Chat stream execution error", error);
          try {
            writer.writeText("Sorry, an unexpected error occurred.");
          } catch {
            // ignore secondary errors writing to stream
          }
          if (typeof (writer as unknown as { close?: () => void }).close === "function") {
            (writer as unknown as { close?: () => void }).close?.();
          } else {
            writer.writeText('');
          }
        }
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/check-open-ai-key") {
      try {
        const hasKey = Boolean(env.OPENAI_API_KEY);
        return Response.json({
          success: hasKey
        });
      } catch (error) {
        return Response.json({
          success: false,
          message: "OpenAI key is not available",
          error: (error as Error).message
        });
      }
    }

    // Auth endpoints
    if (url.pathname === "/api/auth/register" && request.method === "POST") {
      try {
        const { email, password, name } = await request.json();
        
        if (!email || !password || !name) {
          return Response.json({ success: false, error: "Missing required fields" }, { status: 400 });
        }

        if (password.length < 8) {
          return Response.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 });
        }

        // Check if user already exists
        const existingUser = await env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
        if (existingUser) {
          return Response.json({ success: false, error: "User already exists" }, { status: 409 });
        }

        const userId = generateUserId();
        const passwordHash = await hashPassword(password);
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        // Create user
        await env.DB.prepare(
          "INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)"
        ).bind(userId, email, name, passwordHash).run();

        // Create session
        await env.DB.prepare(
          "INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
        ).bind(generateUserId(), userId, token, expiresAt).run();

        return Response.json({
          success: true,
          userId,
          email,
          name,
          token,
          message: "Account created successfully!"
        });
      } catch (error) {
        console.error("Registration error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      try {
        const { email, password } = await request.json();
        
        if (!email || !password) {
          return Response.json({ success: false, error: "Missing email or password" }, { status: 400 });
        }

        const user = await env.DB.prepare(
          "SELECT id, email, name, password_hash FROM users WHERE email = ?"
        ).bind(email).first();

        const passwordHash = await hashPassword(password);
        if (!user || user.password_hash !== passwordHash) {
          return Response.json({ success: false, error: "Invalid credentials" }, { status: 401 });
        }

        const token = generateToken();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

        // Create session
        await env.DB.prepare(
          "INSERT INTO user_sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)"
        ).bind(generateUserId(), user.id, token, expiresAt).run();

        return Response.json({
          success: true,
          userId: user.id,
          email: user.email,
          name: user.name,
          token,
          message: "Login successful!"
        });
      } catch (error) {
        console.error("Login error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/auth/profile" && request.method === "GET") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        const user = await validateToken(env.DB, token);
        if (!user) {
          return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        return Response.json({
          success: true,
          userId: user.userId,
          email: user.email,
          name: user.name
        });
      } catch (error) {
        console.error("Profile error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        await env.DB.prepare("DELETE FROM user_sessions WHERE token = ?").bind(token).run();

        return Response.json({
          success: true,
          message: "Logged out successfully"
        });
      } catch (error) {
        console.error("Logout error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    // Itinerary endpoints
    if (url.pathname === "/api/itineraries" && request.method === "POST") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        const user = await validateToken(env.DB, token);
        if (!user) {
          return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        const { itinerary, isPublic } = await request.json();
        const itineraryData = JSON.parse(itinerary);
        const shareId = isPublic ? `share_${Date.now()}_${generateRandomId()}` : null;

        // Save itinerary (update if exists)
        await env.DB.prepare(`
          INSERT OR REPLACE INTO itineraries (
            id, user_id, title, destination, start_date, end_date, duration, 
            travelers, budget, total_estimated_cost, currency, accommodation_type, 
            interests, data, is_public, share_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          itineraryData.id,
          user.userId,
          itineraryData.title,
          itineraryData.destination,
          itineraryData.startDate,
          itineraryData.endDate,
          itineraryData.duration,
          itineraryData.travelers,
          itineraryData.budget || null,
          itineraryData.totalEstimatedCost,
          itineraryData.currency || 'USD',
          itineraryData.accommodationType || null,
          JSON.stringify(itineraryData.interests || []),
          JSON.stringify(itineraryData),
          isPublic || false,
          shareId
        ).run();

        // Save activities (skip if they already exist)
        for (const day of itineraryData.days) {
          for (const activity of day.activities) {
            try {
              await env.DB.prepare(`
                INSERT OR REPLACE INTO activities (
                  id, itinerary_id, day_number, title, description, location,
                  latitude, longitude, start_time, end_time, category,
                  estimated_cost, priority, tips
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).bind(
                activity.id,
                itineraryData.id,
                day.dayNumber,
                activity.title,
                activity.description,
                activity.location,
                activity.coordinates?.lat || null,
                activity.coordinates?.lng || null,
                activity.startTime,
                activity.endTime || null,
                activity.category,
                activity.estimatedCost,
                activity.priority,
                JSON.stringify(activity.tips || [])
              ).run();
            } catch (activityError) {
              console.error(`Error saving activity ${activity.id}:`, activityError);
              // Continue with other activities
            }
          }
        }

      return Response.json({
          success: true,
          itineraryId: itineraryData.id,
          shareId,
          shareUrl: isPublic ? `https://aitinerary.app/share/${shareId}` : null,
          message: "Itinerary saved successfully"
        });
      } catch (error) {
        console.error("Save itinerary error:", error);
        const errorMessage = error instanceof Error ? error.message : "Internal server error";
        console.error("Detailed error:", errorMessage);
        return Response.json({ success: false, error: errorMessage }, { status: 500 });
      }
    }

    if (url.pathname === "/api/itineraries" && request.method === "GET") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        const user = await validateToken(env.DB, token);
        if (!user) {
          return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "10");
        const offset = parseInt(searchParams.get("offset") || "0");

        const itineraries = await env.DB.prepare(`
          SELECT id, title, destination, duration, is_public, share_id, created_at
          FROM itineraries 
          WHERE user_id = ? 
          ORDER BY created_at DESC 
          LIMIT ? OFFSET ?
        `).bind(user.userId, limit, offset).all();

        return Response.json({
          success: true,
          itineraries: itineraries.results,
          total: itineraries.results.length
        });
      } catch (error) {
        console.error("Get itineraries error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }


    // Conversations endpoint
    if (url.pathname === "/api/conversations" && request.method === "GET") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        const user = await validateToken(env.DB, token);
        if (!user) {
          return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        const conversations = await env.DB.prepare(`
          SELECT id, title, created_at, updated_at
          FROM chat_conversations 
          WHERE user_id = ? 
          ORDER BY updated_at DESC 
          LIMIT 10
        `).bind(user.userId).all();

        return Response.json({
          success: true,
          conversations: conversations.results.map(conv => ({
            id: conv.id,
            title: conv.title || "Untitled chat",
            lastMessage: "",
            timestamp: conv.updated_at
          }))
        });
      } catch (error) {
        console.error("Get conversations error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    // Update conversation title
    if (url.pathname === "/api/conversations/update-title" && request.method === "POST") {
      try {
        const token = request.headers.get("Authorization")?.replace("Bearer ", "");
        if (!token) {
          return Response.json({ success: false, error: "No token provided" }, { status: 401 });
        }

        const user = await validateToken(env.DB, token);
        if (!user) {
          return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
        }

        const { conversationId, title } = await request.json();
        
        await env.DB.prepare(`
          UPDATE chat_conversations 
          SET title = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND user_id = ?
        `).bind(title, conversationId, user.userId).run();

        return Response.json({
          success: true,
          message: "Title updated successfully"
        });
      } catch (error) {
        console.error("Update title error:", error);
        return Response.json({ success: false, error: "Internal server error" }, { status: 500 });
      }
    }

    // Collaboration endpoints
    if (url.pathname.startsWith("/api/collab/")) {
      const itineraryId = url.pathname.split("/")[3];
      
      if (!itineraryId) {
        return Response.json({ error: "Missing itinerary ID" }, { status: 400 });
      }

      // Get or create collaborative session
      const doId = env.CollaborativeItinerary.idFromName(itineraryId);
      const doStub = env.CollaborativeItinerary.get(doId);
      
      return doStub.fetch(request);
    }

      // Voice transcript save endpoint
      if (url.pathname === "/api/voice/transcript" && request.method === "POST") {
        try {
          const token = request.headers.get("Authorization")?.replace("Bearer ", "");
          if (!token) {
            return Response.json({ success: false, error: "No token provided" }, { status: 401 });
          }

          const user = await validateToken(env.DB, token);
          if (!user) {
            return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
          }

          const body = await request.json() as { 
            conversationId: string;
            role: 'user' | 'assistant';
            content: string;
          };

          console.log(`Saving voice transcript for user ${user.email}:`, body);

          // Save to chat_messages table
          await env.DB.prepare(`
            INSERT INTO chat_messages (conversation_id, role, content, created_at)
            VALUES (?, ?, ?, datetime('now'))
          `).bind(body.conversationId, body.role, body.content).run();

          // Update conversation timestamp
          await env.DB.prepare(`
            UPDATE chat_conversations 
            SET updated_at = datetime('now')
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

      // Voice tool execution endpoint
      if (url.pathname === "/api/voice/execute-tool" && request.method === "POST") {
        try {
          const body = await request.json() as { toolName: string; args: any };
          const { toolName, args } = body;

          console.log(`Executing voice tool: ${toolName}`, args);

          // Get the tool from our tools object
          const tool = tools[toolName as keyof typeof tools];
          if (!tool || !tool.execute) {
            return Response.json({ error: `Tool ${toolName} not found` }, { status: 404 });
          }

          // Execute the tool with the provided arguments
          // Inject env for tools that need it
          const toolArgs = (toolName === 'searchWeb' || toolName === 'searchBooking') 
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

      // OpenAI Realtime ephemeral token endpoint - generates token for WebRTC
      if (url.pathname === "/api/realtime/token" && request.method === "GET") {
        try {
          // Validate JWT token
          const token = request.headers.get("Authorization")?.replace("Bearer ", "");
          if (!token) {
            return Response.json({ success: false, error: "No token provided" }, { status: 401 });
          }

          const user = await validateToken(env.DB, token);
          if (!user) {
            return Response.json({ success: false, error: "Invalid token" }, { status: 401 });
          }

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

    // Cloudflare AI is automatically available in the environment
    // Handle collaboration query parameters - serve main app for all requests
    // The collaboration detection is handled client-side via query parameters

    // Debug endpoint to list all itineraries (temporary)
    if (url.pathname === '/api/collab/itineraries/list' && request.method === 'GET') {
      try {
        const itineraries = await env.DB.prepare(`
          SELECT id, title, created_at, updated_at 
          FROM itineraries 
          ORDER BY created_at DESC
          LIMIT 20
        `).all();

        return Response.json({
          itineraries: itineraries.results
        });
      } catch (error) {
        console.error('Error listing itineraries:', error);
        return Response.json({ error: 'Failed to list itineraries' }, { status: 500 });
      }
    }

    // Get shared itinerary endpoint
    if (url.pathname.startsWith('/api/collab/itinerary/') && request.method === 'GET') {
      try {
        const itineraryId = url.pathname.split('/api/collab/itinerary/')[1];
        
        if (!itineraryId) {
          return Response.json({ error: 'Itinerary ID required' }, { status: 400 });
        }

        console.log('Looking for itinerary with ID:', itineraryId);

        // Get itinerary from database by ID
        const itinerary = await env.DB.prepare(`
          SELECT id, title, data, created_at, updated_at 
          FROM itineraries 
          WHERE id = ?
        `).bind(itineraryId).first();

        if (!itinerary) {
          console.log('Itinerary not found for ID:', itineraryId);
          return Response.json({ error: 'Itinerary not found' }, { status: 404 });
        }

        console.log('Found itinerary:', itinerary.id);

        // Parse the JSON data
        const itineraryData = typeof itinerary.data === 'string' 
          ? JSON.parse(itinerary.data) 
          : itinerary.data;

        return Response.json({
          id: itinerary.id,
          title: itinerary.title,
          data: itineraryData,
          createdAt: itinerary.created_at,
          updatedAt: itinerary.updated_at
        });

      } catch (error) {
        console.error('Error fetching collaborative itinerary:', error);
        return Response.json(
          { error: 'Failed to fetch itinerary' },
          { status: 500 }
        );
      }
    }

    // Update shared itinerary endpoint  
    if (url.pathname.startsWith('/api/collab/itinerary/') && request.method === 'PUT') {
      try {
        const itineraryId = url.pathname.split('/api/collab/itinerary/')[1];
        
        if (!itineraryId) {
          return Response.json({ error: 'Itinerary ID required' }, { status: 400 });
        }

        const body = await request.json() as { itinerary: any };
        const { itinerary } = body;

        if (!itinerary) {
          return Response.json({ error: 'Itinerary data required' }, { status: 400 });
        }

        // Update itinerary in database
        await env.DB.prepare(`
          UPDATE itineraries 
          SET data = ?, updated_at = datetime('now')
          WHERE id = ?
        `).bind(JSON.stringify(itinerary), itineraryId).run();

        return Response.json({ success: true });

      } catch (error) {
        console.error('Error updating collaborative itinerary:', error);
        return Response.json(
          { error: 'Failed to update itinerary' },
          { status: 500 }
        );
      }
    }

    // WebSocket endpoint removed - using simple share instead

    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;

// Export Durable Objects
export { CollaborativeItinerary } from "./collaboration";

// Export Realtime Voice Agent factory
export { createVoiceTravelAgent } from "./voice-agent";
