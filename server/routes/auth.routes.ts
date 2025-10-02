import { auth } from "../auth";
import type { Env } from "../types";

export async function handleAuthRoutes(
  request: Request,
  env: Env
): Promise<Response | null> {
  const url = new URL(request.url);

  // Better Auth endpoints - handle all /api/auth/** routes
  if (url.pathname.startsWith("/api/auth/")) {
    return auth(env).handler(request);
  }

  return null;
}
