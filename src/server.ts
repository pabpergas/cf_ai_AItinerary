import { routeAgentRequest } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  type StreamTextOnFinishCallback,
  stepCountIs,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse,
  type ToolSet
} from "ai";
import { openai } from "@ai-sdk/openai";
import { processToolCalls, cleanupMessages } from "./utils";
import { tools } from "./tools";
// import { env } from "cloudflare:workers";

const model = openai("gpt-4o-2024-11-20");
// Cloudflare AI Gateway
// const openai = createOpenAI({
//   apiKey: env.OPENAI_API_KEY,
//   baseURL: env.GATEWAY_BASE_URL,
// });

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  /**
   * Handles incoming chat messages and manages the response stream
   */
  async onChatMessage(
    onFinish: StreamTextOnFinishCallback<ToolSet>,
    _options?: { abortSignal?: AbortSignal }
  ) {
    // const mcpConnection = await this.mcp.connect(
    //   "https://path-to-mcp-server/sse"
    // );

    // Collect all tools, including MCP tools
    const allTools = {
      ...tools,
      ...this.mcp.getAITools()
    };

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        // Clean up incomplete tool calls to prevent API errors
        const cleanedMessages = cleanupMessages(this.messages);

        // Process any pending tool calls from previous messages
        // This handles human-in-the-loop confirmations for tools
        const processedMessages = await processToolCalls({
          messages: cleanedMessages,
          dataStream: writer,
          tools: allTools,
          executions: {}
        });

        const result = streamText({
          system: `You are AItinerary Assistant, a specialized AI travel planner that helps users create personalized itineraries.

CRITICAL: When a user asks for a travel itinerary, you MUST use the generateCompleteItinerary tool. You must provide ALL the required data including:

1. SPECIFIC REAL LOCATIONS: Use ACTUAL places that exist in the destination city. For example, if the destination is Sevilla, use real places like "Catedral de Sevilla", "Real Alcázar", "Plaza de España", "Barrio Santa Cruz", "Mercado de Triana", etc.

2. ACCURATE COORDINATES: You MUST provide the REAL latitude and longitude coordinates for each specific location. DO NOT use random or approximate coordinates. Use your knowledge of the actual city geography.

3. DETAILED ACTIVITIES: Create 3-5 activities per day with:
   - REAL place names that actually exist in the destination
   - ACCURATE coordinates for those exact places
   - Realistic time schedules
   - Appropriate cost estimates
   - Helpful, practical tips

COORDINATE EXAMPLES FOR MAJOR CITIES:
- Sevilla: Catedral (37.3857, -5.9936), Real Alcázar (37.3829, -5.9913), Plaza de España (37.3768, -5.9874)
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
`,

          messages: convertToModelMessages(processedMessages),
          model,
          tools: allTools,
          // Type boundary: streamText expects specific tool types, but base class uses ToolSet
          // This is safe because our tools satisfy ToolSet interface (verified by 'satisfies' in tools.ts)
          onFinish: onFinish as unknown as StreamTextOnFinishCallback<
            typeof allTools
          >,
          stopWhen: stepCountIs(10)
        });

        writer.merge(result.toUIMessageStream());
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
      const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
      return Response.json({
        success: hasOpenAIKey
      });
    }
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        "OPENAI_API_KEY is not set, don't forget to set it locally in .dev.vars, and use `wrangler secret bulk .dev.vars` to upload it to production"
      );
    }
    return (
      // Route the request to our agent or return 404 if not found
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
