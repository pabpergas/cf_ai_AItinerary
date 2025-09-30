# AI Prompts Used in AItinerary Development

This document contains the actual AI prompts used during the development of AItinerary. These prompts were used to guide AI assistants in implementing features and solving technical challenges.

## Development Prompts

### Initial Project Setup

```
Create a travel itinerary planning application using:
- Cloudflare Workers for serverless backend
- React 18 with TypeScript for frontend
- Cloudflare D1 for database
- OpenAI GPT-4o-mini for AI generation
- TailwindCSS for styling

The application should:
1. Allow users to create AI-generated travel itineraries
2. Support user authentication with JWT
3. Save itineraries to database
4. Display itineraries with interactive maps using Leaflet
5. Support real-time chat with AI assistant

Set up the basic project structure with Vite for frontend and Wrangler for Workers.
```

### Database Schema Design

```
Design a database schema for a travel planning application with:

Tables:
1. users - Store user accounts with email, password hash, and profile data
2. conversations - Track chat sessions with conversation IDs
3. chat_messages - Store all chat messages with role, content, and timestamps
4. itineraries - Save complete travel plans with JSON data

Requirements:
- Use foreign keys to maintain referential integrity
- Add indexes for frequently queried fields
- Store itinerary data as JSON for flexibility
- Include created_at and updated_at timestamps

Create the SQL schema file for Cloudflare D1.
```

### Authentication System

```
Implement a complete authentication system with:

1. User registration endpoint
   - Validate email format
   - Hash passwords with Web Crypto API
   - Generate JWT tokens
   - Store user in D1 database

2. Login endpoint
   - Verify credentials
   - Generate JWT token
   - Return user profile

3. JWT middleware
   - Extract and verify tokens from Authorization header
   - Decode user information
   - Attach user to request context

Use native Cloudflare Workers APIs only.
```

### AI Tools Implementation

```
Create AI tools for the travel planning agent:

1. generateCompleteItinerary
   - Input: destination, dates, travelers, budget, interests
   - Output: Complete itinerary JSON with days and activities
   - Include: activity details, locations, costs, tips, coordinates

2. searchBooking
   - Input: destination, check-in, check-out, guests
   - Use Cloudflare Browser to scrape Booking.com
   - Return: Array of hotels with name, price, rating, link

3. modifyActivity
   - Input: itineraryId, dayNumber, activityId, modifications
   - Output: Only the modified activity JSON

4. removeMultipleActivities / addMultipleActivities
   - Support bulk operations on activities

Use Zod for schema validation and return structured JSON responses.
```

### Frontend Component Architecture

```
Refactor the monolithic app.tsx into smaller components:

1. WelcomeScreen - Display when no messages exist
2. ChatMessage - Render individual messages with hotel cards
3. ChatInput - Text input with voice and search toggles
4. Sidebar - User profile and conversation list
5. ItineraryDisplay - Parse and display itinerary JSON

Each component should have clear props interfaces and proper TypeScript types.
```

### Map Integration with Leaflet

```
Integrate Leaflet for itinerary visualization:

1. Display map with all activity locations
2. Add numbered markers for each activity
5. Add popup information on marker click
6. Auto-fit bounds to show all markers

Requirements:
- Use Leaflet library
- Handle map initialization and cleanup
- Support dynamic marker updates
- Ensure responsive design
```

### Calendar Export Feature

```
Implement iCalendar export functionality:

1. Parse itinerary data structure
2. Generate .ics file format with:
   - Event for each activity
   - Proper date/time formatting
   - Location information
   - Activity descriptions

3. Create download function
4. Support Google Calendar and Outlook import
```




## Troubleshooting Prompts

### Crypto Error Resolution

```
Fix "crypto.hash is not a function" error:

```

### WebSocket Connection Issues

```
Fix WebSocket connection failures in Durable Objects
```


