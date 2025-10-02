import type { Env } from "../types";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
}

export async function validateToken(
  db: D1Database,
  token: string
): Promise<AuthUser | null> {
  const session = await db
    .prepare(
      "SELECT u.id, u.email, u.name FROM session s JOIN user u ON s.user_id = u.id WHERE s.token = ? AND s.expires_at > ?"
    )
    .bind(token, Date.now())
    .first<{ id: string; email: string; name: string }>();

  return session
    ? { userId: session.id, email: session.email, name: session.name }
    : null;
}

export async function requireAuth(
  request: Request,
  env: Env
): Promise<{ user: AuthUser; token: string } | Response> {
  // Try to get token from Authorization header first, then from query params (for SSE)
  let token = request.headers.get("Authorization")?.replace("Bearer ", "");

  if (!token) {
    const url = new URL(request.url);
    token = url.searchParams.get("token") || undefined;
  }

  if (!token) {
    return Response.json(
      { success: false, error: "No token provided" },
      { status: 401 }
    );
  }

  const user = await validateToken(env.DB, token);

  if (!user) {
    return Response.json(
      { success: false, error: "Invalid token" },
      { status: 401 }
    );
  }

  return { user, token };
}
