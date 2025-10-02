import { requireAuth } from "../middleware/auth.middleware";
import { generateRandomId } from "../server-crypto";
import type { Env } from "../types";

export async function handleItineraryRoutes(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);

  // Save itinerary
  if (url.pathname === "/api/itineraries" && request.method === "POST") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
      const { itinerary, isPublic } = await request.json();
      const itineraryData = JSON.parse(itinerary);
      const shareId = isPublic
        ? `share_${Date.now()}_${generateRandomId()}`
        : null;

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
        itineraryData.currency || "USD",
        itineraryData.accommodationType || null,
        JSON.stringify(itineraryData.interests || []),
        JSON.stringify(itineraryData),
        isPublic || false,
        shareId
      ).run();

      // Save activities
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
            console.error(
              `Error saving activity ${activity.id}:`,
              activityError
            );
          }
        }
      }

      return Response.json({
        success: true,
        itineraryId: itineraryData.id,
        shareId,
        shareUrl: isPublic
          ? `https://aitinerary.app/share/${shareId}`
          : null,
        message: "Itinerary saved successfully",
      });
    } catch (error) {
      console.error("Save itinerary error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Internal server error";
      return Response.json({ success: false, error: errorMessage }, { status: 500 });
    }
  }

  // Get itineraries
  if (url.pathname === "/api/itineraries" && request.method === "GET") {
    const authResult = await requireAuth(request, env);
    if (authResult instanceof Response) return authResult;
    const { user } = authResult;

    try {
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
        total: itineraries.results.length,
      });
    } catch (error) {
      console.error("Get itineraries error:", error);
      return Response.json(
        { success: false, error: "Internal server error" },
        { status: 500 }
      );
    }
  }

  return null;
}
