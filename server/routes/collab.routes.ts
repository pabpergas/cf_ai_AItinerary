import type { Env } from "../types";

export async function handleCollabRoutes(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);

  // Collaboration endpoints with Durable Objects
  if (url.pathname.startsWith("/api/collab/")) {
    const pathParts = url.pathname.split("/");
    const itineraryId = pathParts[3];

    if (!itineraryId) {
      return Response.json({ error: "Missing itinerary ID" }, { status: 400 });
    }

    // Get or create collaborative session
    const doId = env.CollaborativeItinerary.idFromName(itineraryId);
    const doStub = env.CollaborativeItinerary.get(doId);

    return doStub.fetch(request);
  }

  // Debug endpoint to list all itineraries
  if (
    url.pathname === "/api/collab/itineraries/list" &&
    request.method === "GET"
  ) {
    try {
      const itineraries = await env.DB.prepare(`
          SELECT id, title, created_at, updated_at
          FROM itineraries
          ORDER BY created_at DESC
          LIMIT 20
        `).all();

      return Response.json({
        itineraries: itineraries.results,
      });
    } catch (error) {
      console.error("Error listing itineraries:", error);
      return Response.json(
        { error: "Failed to list itineraries" },
        { status: 500 }
      );
    }
  }

  // Get shared itinerary
  if (
    url.pathname.startsWith("/api/collab/itinerary/") &&
    request.method === "GET"
  ) {
    try {
      const itineraryId = url.pathname.split("/api/collab/itinerary/")[1];

      if (!itineraryId) {
        return Response.json(
          { error: "Itinerary ID required" },
          { status: 400 }
        );
      }

      console.log("Looking for itinerary with ID:", itineraryId);

      const itinerary = await env.DB.prepare(`
          SELECT id, title, data, created_at, updated_at
          FROM itineraries
          WHERE id = ?
        `).bind(itineraryId).first<{
        id: string;
        title: string;
        data: string;
        created_at: number;
        updated_at: number;
      }>();

      if (!itinerary) {
        console.log("Itinerary not found for ID:", itineraryId);
        return Response.json(
          { error: "Itinerary not found" },
          { status: 404 }
        );
      }

      console.log("Found itinerary:", itinerary.id);

      const itineraryData =
        typeof itinerary.data === "string"
          ? JSON.parse(itinerary.data)
          : itinerary.data;

      return Response.json({
        id: itinerary.id,
        title: itinerary.title,
        data: itineraryData,
        createdAt: itinerary.created_at,
        updatedAt: itinerary.updated_at,
      });
    } catch (error) {
      console.error("Error fetching collaborative itinerary:", error);
      return Response.json(
        { error: "Failed to fetch itinerary" },
        { status: 500 }
      );
    }
  }

  // Update shared itinerary
  if (
    url.pathname.startsWith("/api/collab/itinerary/") &&
    request.method === "PUT"
  ) {
    try {
      const itineraryId = url.pathname.split("/api/collab/itinerary/")[1];

      if (!itineraryId) {
        return Response.json(
          { error: "Itinerary ID required" },
          { status: 400 }
        );
      }

      const body = (await request.json()) as { itinerary: any };
      const { itinerary } = body;

      if (!itinerary) {
        return Response.json(
          { error: "Itinerary data required" },
          { status: 400 }
        );
      }

      await env.DB.prepare(`
          UPDATE itineraries
          SET data = ?, updated_at = unixepoch()
          WHERE id = ?
        `).bind(JSON.stringify(itinerary), itineraryId).run();

      return Response.json({ success: true });
    } catch (error) {
      console.error("Error updating collaborative itinerary:", error);
      return Response.json(
        { error: "Failed to update itinerary" },
        { status: 500 }
      );
    }
  }

  return null;
}
