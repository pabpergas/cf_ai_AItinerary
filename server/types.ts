// Types for AItinerary environment

export interface Env {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  Chat: DurableObjectNamespace;
  CollaborativeItinerary: DurableObjectNamespace;
  BROWSER?: Fetcher; // Cloudflare Browser binding
}

// Cloudflare Workers types
declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
  }

  interface D1PreparedStatement {
    bind(...values: any[]): D1PreparedStatement;
    first(): Promise<any>;
    all(): Promise<{ results: any[] }>;
    run(): Promise<{ success: boolean }>;
  }

  interface DurableObjectNamespace {
    get(id: DurableObjectId): DurableObjectStub;
  }

  interface DurableObjectId {
    toString(): string;
  }

  interface DurableObjectStub {
    fetch(request: Request): Promise<Response>;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }

  interface ExportedHandler<Env = unknown> {
    fetch(request: Request, env: Env, ctx: ExecutionContext): Response | Promise<Response>;
  }
}

export interface User {
  userId: string;
  email: string;
  name: string;
  token: string;
}

export interface ItineraryData {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  duration: string;
  travelers: number;
  budget?: number;
  totalEstimatedCost: number;
  currency: string;
  accommodationType: string;
  interests: string[];
  days: Day[];
  summary: {
    totalActivities: number;
    averageCostPerDay: number;
    topCategories: string[];
  };
  createdAt: string;
}

export interface Day {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  startTime: string;
  endTime?: string;
  category: string;
  estimatedCost: number;
  priority: string;
  tips: string[];
}
