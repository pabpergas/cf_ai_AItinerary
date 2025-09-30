# AItinerary

AI-powered travel itinerary planner built with Cloudflare Workers, Durable Objects, and OpenAI. The system generates personalized travel plans with intelligent recommendations, hotel searches via Booking.com, and real-time voice interaction.

## Testing URL
```
https://
```

## System Overview

AItinerary is a serverless application that combines:
- **Frontend**: React 18 + TypeScript + TailwindCSS
- **Backend**: Cloudflare Workers (Edge Runtime)
- **Database**: Cloudflare D1 (SQLite)
- **AI**: OpenAI GPT-4o-mini & Realtime API
- **Browser Automation**: Cloudflare Browser Rendering for web scraping

### Key Features
- AI-powered itinerary generation
- Smart hotel search integration with Booking.com
- Voice interaction using OpenAI Realtime API
- Calendar export (iCal/Google Calendar)
- Shareable itineraries
- Interactive maps with Mapbox
- JWT-based authentication

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Cloudflare account
- OpenAI API key

## Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd cf_ai_AItinerary
npm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file in the root directory:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Configure Cloudflare

Update `wrangler.jsonc`:
- Set your `account_id`
- Configure D1 database binding

### 4. Create and Setup Database

Create the D1 database:

```bash
npx wrangler d1 create aitinerary-db
```

Copy the generated `database_id` to `wrangler.jsonc` under the `d1_databases` binding.

Run migrations locally:

```bash
npx wrangler d1 execute aitinerary-db --local --file=./migrations/schema.sql
```

Run migrations in production (after first deploy):

```bash
npx wrangler d1 execute aitinerary-db --remote --file=./migrations/schema.sql
```

### 5. Add Secrets

Set your OpenAI API key as a secret:

```bash
npx wrangler secret put OPENAI_API_KEY
```

When prompted, paste your OpenAI API key.

## Development

Start the development server:

```bash
npm run dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Cloudflare Workers local development server

## Build

Build the project for production:

```bash
npm run build
```

This compiles:
- Frontend assets to `dist/`
- Server code with TypeScript

## Deploy

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

Or using Wrangler directly:

```bash
npx wrangler deploy
```

### First Deployment Checklist

1. Database created and configured in `wrangler.jsonc`
2. Migrations run on remote database
3. OpenAI API key added as secret
4. Account ID set in `wrangler.jsonc`
5. Build successful (`npm run build`)
6. Deploy executed (`npm run deploy`)

## Project Structure

```
cf_ai_AItinerary/
├── src/                    # Frontend React application
│   ├── app.tsx            # Main app component
│   ├── components/        # React components
│   └── hooks/             # Custom hooks
├── server/                # Backend Worker code
│   ├── server.ts         # Main server and routing
│   ├── tools.ts          # AI tools/functions
│   └── types.ts          # TypeScript definitions
├── public/               # Static assets
├── migrations/           # Database schema
├── wrangler.jsonc       # Cloudflare configuration
└── package.json         # Dependencies
```

## Configuration Files

### wrangler.jsonc
Main Cloudflare Workers configuration. Key sections:
- `account_id`: Your Cloudflare account ID
- `d1_databases`: D1 database binding
- `durable_objects`: Durable Objects bindings
- `browser`: Browser Rendering binding

### .dev.vars
Local development environment variables (not committed to git):
- `OPENAI_API_KEY`: OpenAI API key

## Troubleshooting

**Build errors:**
- Ensure Node.js version is 18 or higher
- Clear `node_modules` and reinstall: `rm -rf node_modules && npm install`

**Database errors:**
- Verify database_id in `wrangler.jsonc` matches your D1 database
- Run migrations: `npx wrangler d1 execute aitinerary-db --remote --file=./migrations/schema.sql`

**Deployment fails:**
- Check that `account_id` is set correctly in `wrangler.jsonc`
- Ensure you're logged in: `npx wrangler login`
- Verify all secrets are set: `npx wrangler secret list`

**AI not responding:**
- Verify OpenAI API key is set as secret
- Check Worker logs: `npx wrangler tail`

## Documentation

- `PROMPTS.md`: AI prompts and system instructions
- Cloudflare Workers: https://developers.cloudflare.com/workers/
- Cloudflare D1: https://developers.cloudflare.com/d1/
- OpenAI API: https://platform.openai.com/docs/

