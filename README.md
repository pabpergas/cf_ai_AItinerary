# ✈️ AItinerary - AI Travel Planning Assistant

A specialized AI-powered travel planning assistant built on Cloudflare's Agent platform. AItinerary helps users create personalized travel itineraries through natural conversation, providing destination recommendations, weather information, and detailed trip planning.

## Features

- 🗺️ **Intelligent Itinerary Creation** - Generate complete travel plans with AI assistance
- 🌍 **Destination Information** - Get detailed info about attractions, restaurants, and local tips
- 🌤️ **Weather Integration** - Check weather conditions for your travel dates
- 🚗 **Travel Time Calculation** - Calculate times and costs between locations
- ✅ **Human-in-the-Loop Confirmation** - Review and approve itinerary changes before they're saved
- 🎨 **Modern Travel-Focused UI** - Beautiful, responsive interface designed for trip planning
- 🌓 **Dark/Light Theme Support** - Choose your preferred viewing experience

## Prerequisites

- Cloudflare account
- OpenAI API key

## Quick Start

1. Clone this repository:

```bash
git clone <repository-url>
cd aitinerary
```

2. Install dependencies:

```bash
npm install
```

3. Set up your environment:

Create a `.dev.vars` file:

```env
OPENAI_API_KEY=your_openai_api_key
```

4. Run locally:

```bash
npm start
```

5. Deploy to Cloudflare:

```bash
npm run deploy
```

## Project Structure

```
├── src/
│   ├── app.tsx           # Travel planning UI
│   ├── server.ts         # AItinerary agent logic
│   ├── tools.ts          # Travel-specific tools
│   ├── utils.ts          # Helper functions
│   └── styles.css        # Travel-themed styling
├── src/components/       # Minimal UI components
│   ├── button/
│   ├── card/
│   ├── textarea/
│   └── tool-invocation-card/
```

## Available Tools

### Human Confirmation Required
- **createItinerary** - Create a new travel itinerary with basic information
- **addActivity** - Add activities to existing itineraries

### Automatic Execution
- **getDestinationInfo** - Get detailed destination information and recommendations
- **getWeatherInfo** - Retrieve weather information for travel planning
- **calculateTravelTime** - Calculate travel times and transportation options

## Example Conversations

**Plan a Weekend Trip:**
```
"I want to plan a 3-day trip to Paris for 2 people with a $1000 budget"
```

**Get Destination Info:**
```
"Tell me about the best restaurants and attractions in Tokyo"
```

**Check Weather:**
```
"What's the weather like in Barcelona in March?"
```

**Calculate Travel Times:**
```
"How long does it take to get from the Eiffel Tower to the Louvre by metro?"
```

## Customization

### Adding New Travel Tools

Extend the travel planning capabilities by adding new tools in `tools.ts`:

```typescript
const findFlights = tool({
  description: "Search for flight options between cities",
  inputSchema: z.object({
    origin: z.string(),
    destination: z.string(),
    departDate: z.string(),
    returnDate: z.string().optional()
  }),
  execute: async ({ origin, destination, departDate, returnDate }) => {
    // Implementation for flight search
  }
});
```

### Modifying the Travel UI

The interface is specifically designed for travel planning and can be customized in `app.tsx`:

- Update travel-themed colors and gradients
- Add new travel-specific UI components
- Customize itinerary display and confirmation dialogs
- Add quick-start travel templates

## Travel Use Cases

1. **City Break Planning**
   - 2-3 day city itineraries
   - Restaurant and attraction recommendations
   - Local transportation options

2. **Multi-City Tours**
   - Travel time calculations between cities
   - Budget planning across multiple destinations
   - Weather considerations for timing

3. **Activity-Based Travel**
   - Outdoor adventure planning
   - Cultural tour itineraries
   - Food and wine experiences

4. **Business Travel**
   - Efficient scheduling around meetings
   - Local dining and networking venues
   - Quick city overviews

## Learn More

- [Cloudflare Agents Documentation](https://developers.cloudflare.com/agents/)
- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)

## License

MIT