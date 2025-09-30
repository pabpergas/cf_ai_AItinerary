/**
 * Tool definitions for the AItinerary AI chat agent
 * Tools execute automatically and return structured data for the frontend
 */
import { tool, type ToolSet, type ToolExecution } from "ai";
import { z } from "zod/v3";
import puppeteer from "@cloudflare/puppeteer";
import type { Env } from "./types";

/**
 * Generate a complete travel itinerary - executes automatically
 */
const generateCompleteItinerary = tool({
  description: "Generate a complete travel itinerary with all activities for each day. You must create realistic activity names and locations, then provide accurate lat/lng coordinates for each location based on the destination city.",
  inputSchema: z.object({
    destination: z.string().describe("Main destination or city"),
    startDate: z.string().describe("Start date in YYYY-MM-DD format"),
    endDate: z.string().describe("End date in YYYY-MM-DD format"),
    travelers: z.number().optional().default(2).describe("Number of travelers"),
    budget: z.number().optional().describe("Total budget in USD"),
    interests: z.array(z.string()).optional().default([]).describe("Travel interests like culture, food, adventure, etc."),
    accommodationType: z.enum(["hotel", "hostel", "apartment", "luxury", "budget"]).optional().default("hotel").describe("Type of accommodation preference"),
    activities: z.array(z.object({
      title: z.string().describe("Specific name of the activity or place"),
      description: z.string().describe("Detailed description of what to do"),
      location: z.string().describe("Specific address or landmark name"),
      coordinates: z.object({
        lat: z.number().describe("Latitude coordinate"),
        lng: z.number().describe("Longitude coordinate")
      }).describe("Exact coordinates for the location"),
      startTime: z.string().describe("Start time in HH:MM format"),
      endTime: z.string().optional().describe("End time in HH:MM format"),
      category: z.enum(["ACCOMMODATION", "TRANSPORTATION", "FOOD", "SIGHTSEEING", "ENTERTAINMENT", "SHOPPING", "OUTDOOR", "CULTURE", "WELLNESS", "BUSINESS", "OTHER"]).describe("Activity category"),
      estimatedCost: z.number().describe("Estimated cost in USD"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "MUST_DO"]).describe("Priority level"),
      tips: z.array(z.string()).describe("Helpful tips for this activity"),
      dayNumber: z.number().describe("Which day this activity belongs to (1, 2, 3, etc.)")
    })).describe("Complete list of all activities for all days with specific locations and coordinates")
  }),
  execute: async ({ destination, startDate, endDate, travelers, budget, interests, accommodationType, activities }) => {
    console.log(`Organizing complete itinerary for ${destination} from ${startDate} to ${endDate}`);
    
    // Calculate number of days
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    // Group activities by day
    const days = [];
    for (let i = 1; i <= daysDiff; i++) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + (i - 1));
      const dateStr = currentDate.toISOString().split('T')[0];
      
      const dayActivities = activities.filter(activity => activity.dayNumber === i);
      
      days.push({
        date: dateStr,
        dayNumber: i,
        activities: dayActivities.map(activity => ({
          id: `act_${Date.now()}_${Math.random()}`,
          title: activity.title,
          description: activity.description,
          location: activity.location,
          coordinates: activity.coordinates,
          startTime: activity.startTime,
          endTime: activity.endTime,
          category: activity.category,
          estimatedCost: activity.estimatedCost,
          priority: activity.priority,
          tips: activity.tips
        }))
      });
    }
    
    // Calculate total estimated cost
    const totalEstimatedCost = activities.reduce((total, activity) => total + activity.estimatedCost, 0);
    
    // Get top categories
    const categoryCount: { [key: string]: number } = {};
    activities.forEach(activity => {
      categoryCount[activity.category] = (categoryCount[activity.category] || 0) + 1;
    });
    const topCategories = Object.entries(categoryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([category]) => category);
    
    const itinerary = {
      id: `itin_${Date.now()}`,
      title: `${destination} ${daysDiff}-Day Adventure`,
      destination,
      startDate,
      endDate,
      duration: `${daysDiff} days`,
      travelers,
      budget,
      totalEstimatedCost,
      currency: "USD",
      accommodationType,
      interests,
      days,
      summary: {
        totalActivities: activities.length,
        averageCostPerDay: Math.round(totalEstimatedCost / daysDiff),
        topCategories
      },
      createdAt: new Date().toISOString()
    };
    
    return JSON.stringify(itinerary, null, 2);
  }
});

/**
 * Get destination information - executes automatically
 */
const getDestinationInfo = tool({
  description: "Get detailed information about a travel destination including attractions, restaurants, and local tips",
  inputSchema: z.object({ 
    destination: z.string().describe("City or destination name"),
    interests: z.array(z.string()).optional().describe("User interests like food, culture, outdoor activities")
  }),
  execute: async ({ destination, interests = [] }) => {
    console.log(`Getting destination info for ${destination}, interests: ${interests.join(", ")}`);
    
    const destinationData = {
      destination,
      topAttractions: [
        `${destination} Historic Center`,
        `${destination} Art Museum`,
        `${destination} Central Park`,
        `${destination} Cathedral`,
        `${destination} Market Square`
      ],
      restaurants: [
        `Local Bistro in ${destination}`,
        `Traditional Cuisine House`,
        `Fine Dining Experience`,
        `Street Food Markets`,
        `Rooftop Restaurant with Views`
      ],
      localTips: [
        `Best time to visit ${destination} is during spring/fall`,
        "Use local public transportation for cost savings",
        "Try the local specialty dishes",
        "Learn basic local phrases",
        "Respect local customs and dress codes"
      ],
      averageCosts: {
        accommodation: "80-150 USD/night",
        meals: "25-50 USD/day",
        activities: "10-30 USD/attraction",
        transportation: "5-15 USD/day"
      },
      weather: {
        current: "Pleasant with mild temperatures",
        recommendation: "Pack layers and comfortable walking shoes"
      }
    };

    return JSON.stringify(destinationData, null, 2);
  }
});

/**
 * Get weather information for travel planning
 */
const getWeatherInfo = tool({
  description: "Get weather information for a destination to help with travel planning",
  inputSchema: z.object({ 
    destination: z.string().describe("City or destination name"),
    date: z.string().optional().describe("Date in YYYY-MM-DD format")
  }),
  execute: async ({ destination, date }) => {
    console.log(`Getting weather for ${destination} on ${date || 'current'}`);
    
    const weatherData = {
      location: destination,
      date: date || new Date().toISOString().split('T')[0],
      temperature: "22°C (72°F)",
      condition: "Partly cloudy",
      humidity: "65%",
      precipitation: "10%",
      windSpeed: "15 km/h",
      uvIndex: "Moderate",
      recommendations: [
        "Light jacket recommended for evenings",
        "Perfect weather for outdoor activities",
        "Bring sunscreen and sunglasses",
        "Comfortable walking weather"
      ]
    };

    return JSON.stringify(weatherData, null, 2);
  }
});

/**
 * Calculate travel times between locations
 */
const calculateTravelTime = tool({
  description: "Calculate travel time and transportation options between two locations",
  inputSchema: z.object({
    origin: z.string().describe("Starting location"),
    destination: z.string().describe("Destination location"),
    transportMode: z.enum(["walking", "driving", "public_transport", "taxi"]).optional().default("driving")
  }),
  execute: async ({ origin, destination, transportMode }) => {
    console.log(`Calculating travel time from ${origin} to ${destination} by ${transportMode}`);
    
    const travelData = {
      origin,
      destination,
      mode: transportMode,
      estimatedTime: "25 minutes",
      distance: "12 km",
      cost: transportMode === "taxi" ? "15-20 USD" : transportMode === "public_transport" ? "2-5 USD" : "Free",
      alternatives: [
        { mode: "walking", time: "45 minutes", cost: "Free" },
        { mode: "public_transport", time: "20 minutes", cost: "2-5 USD" },
        { mode: "taxi", time: "15 minutes", cost: "15-20 USD" }
      ],
      recommendations: [
        transportMode === "walking" ? "Scenic route available" : "Fastest route recommended",
        "Traffic can be heavy during rush hours",
        "Book transportation in advance if needed"
      ]
    };

    return JSON.stringify(travelData, null, 2);
  }
});

/**
 * Modify a specific activity in an itinerary
 */
const modifyActivity = tool({
  description: "Modify a specific activity in an existing itinerary. Can change time, location, description, cost, etc.",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary containing the activity"),
    activityId: z.string().describe("ID of the activity to modify"),
    changes: z.object({
      title: z.string().optional().describe("New title for the activity"),
      description: z.string().optional().describe("New description for the activity"),
      location: z.string().optional().describe("New location for the activity"),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number()
      }).optional().describe("New coordinates for the activity"),
      startTime: z.string().optional().describe("New start time in HH:MM format"),
      endTime: z.string().optional().describe("New end time in HH:MM format"),
      category: z.enum(["ACCOMMODATION", "TRANSPORTATION", "FOOD", "SIGHTSEEING", "ENTERTAINMENT", "SHOPPING", "OUTDOOR", "CULTURE", "WELLNESS", "BUSINESS", "OTHER"]).optional().describe("New category"),
      estimatedCost: z.number().optional().describe("New estimated cost in USD"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "MUST_DO"]).optional().describe("New priority level"),
      tips: z.array(z.string()).optional().describe("New tips for this activity")
    }).describe("Changes to apply to the activity")
  }),
  execute: async ({ itineraryId, activityId, changes }) => {
    console.log(`Modifying activity ${activityId} in itinerary ${itineraryId}`);
    
    const result = {
      success: true,
      itineraryId,
      activityId,
      changes,
      message: `Activity "${changes.title || 'activity'}" has been successfully updated with the requested changes.`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Replace an activity with a completely new one
 */
const replaceActivity = tool({
  description: "Replace an existing activity with a completely new activity in the itinerary",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary containing the activity"),
    activityId: z.string().describe("ID of the activity to replace"),
    newActivity: z.object({
      title: z.string().describe("Title of the new activity"),
      description: z.string().describe("Description of the new activity"),
      location: z.string().describe("Location of the new activity"),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number()
      }).describe("Coordinates for the new activity"),
      startTime: z.string().describe("Start time in HH:MM format"),
      endTime: z.string().optional().describe("End time in HH:MM format"),
      category: z.enum(["ACCOMMODATION", "TRANSPORTATION", "FOOD", "SIGHTSEEING", "ENTERTAINMENT", "SHOPPING", "OUTDOOR", "CULTURE", "WELLNESS", "BUSINESS", "OTHER"]).describe("Activity category"),
      estimatedCost: z.number().describe("Estimated cost in USD"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "MUST_DO"]).describe("Priority level"),
      tips: z.array(z.string()).describe("Tips for the new activity")
    }).describe("Complete new activity data")
  }),
  execute: async ({ itineraryId, activityId, newActivity }) => {
    console.log(`Replacing activity ${activityId} in itinerary ${itineraryId}`);
    
    const result = {
      success: true,
      itineraryId,
      replacedActivityId: activityId,
      newActivity: {
        ...newActivity,
        id: `act_${Date.now()}_${Math.random()}`
      },
      message: `Activity has been successfully replaced with "${newActivity.title}".`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Add a new activity to a specific day in the itinerary
 */
const addActivity = tool({
  description: "Add a new activity to a specific day in the itinerary",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary"),
    dayNumber: z.number().describe("Day number to add the activity to (1, 2, 3, etc.)"),
    activity: z.object({
      title: z.string().describe("Title of the new activity"),
      description: z.string().describe("Description of the new activity"),
      location: z.string().describe("Location of the new activity"),
      coordinates: z.object({
        lat: z.number(),
        lng: z.number()
      }).describe("Coordinates for the new activity"),
      startTime: z.string().describe("Start time in HH:MM format"),
      endTime: z.string().optional().describe("End time in HH:MM format"),
      category: z.enum(["ACCOMMODATION", "TRANSPORTATION", "FOOD", "SIGHTSEEING", "ENTERTAINMENT", "SHOPPING", "OUTDOOR", "CULTURE", "WELLNESS", "BUSINESS", "OTHER"]).describe("Activity category"),
      estimatedCost: z.number().describe("Estimated cost in USD"),
      priority: z.enum(["LOW", "MEDIUM", "HIGH", "MUST_DO"]).describe("Priority level"),
      tips: z.array(z.string()).describe("Tips for the new activity")
    }).describe("New activity data"),
    position: z.enum(["start", "end", "before", "after"]).optional().default("end").describe("Where to insert the activity"),
    referenceActivityId: z.string().optional().describe("Reference activity ID when using 'before' or 'after' position")
  }),
  execute: async ({ itineraryId, dayNumber, activity, position, referenceActivityId }) => {
    console.log(`Adding new activity to day ${dayNumber} in itinerary ${itineraryId}`);
    
    const newActivity = {
      ...activity,
      id: `act_${Date.now()}_${Math.random()}`
    };

    const result = {
      success: true,
      itineraryId,
      dayNumber,
      newActivity,
      position,
      referenceActivityId,
      message: `New activity "${activity.title}" has been successfully added to day ${dayNumber}.`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Remove an activity from the itinerary
 */
const removeActivity = tool({
  description: "Remove an activity from the itinerary",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary"),
    activityId: z.string().describe("ID of the activity to remove")
  }),
  execute: async ({ itineraryId, activityId }) => {
    console.log(`Removing activity ${activityId} from itinerary ${itineraryId}`);
    
    const result = {
      success: true,
      itineraryId,
      removedActivityId: activityId,
      message: "Activity has been successfully removed from the itinerary.",
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Remove multiple activities from the itinerary at once
 */
const removeMultipleActivities = tool({
  description: "Remove multiple activities from the itinerary at once",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary"),
    activityIds: z.array(z.string()).describe("Array of activity IDs to remove")
  }),
  execute: async ({ itineraryId, activityIds }) => {
    console.log(`Removing ${activityIds.length} activities from itinerary ${itineraryId}`);
    
    const result = {
      success: true,
      itineraryId,
      removedActivityIds: activityIds,
      count: activityIds.length,
      message: `${activityIds.length} activities have been successfully removed from the itinerary.`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Add multiple activities to the itinerary at once
 */
const addMultipleActivities = tool({
  description: "Add multiple new activities to the itinerary at once",
  inputSchema: z.object({
    itineraryId: z.string().describe("ID of the itinerary"),
    activities: z.array(z.object({
      dayNumber: z.number().describe("Day number to add the activity to (1, 2, 3, etc.)"),
      activity: z.object({
        title: z.string().describe("Title of the new activity"),
        description: z.string().describe("Description of the new activity"),
        location: z.string().describe("Location of the new activity"),
        coordinates: z.object({
          lat: z.number(),
          lng: z.number()
        }).describe("Coordinates for the new activity"),
        startTime: z.string().describe("Start time in HH:MM format"),
        endTime: z.string().optional().describe("End time in HH:MM format"),
        category: z.enum(["ACCOMMODATION", "TRANSPORTATION", "FOOD", "SIGHTSEEING", "ENTERTAINMENT", "SHOPPING", "OUTDOOR", "CULTURE", "WELLNESS", "BUSINESS", "OTHER"]).describe("Activity category"),
        estimatedCost: z.number().describe("Estimated cost in USD"),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "MUST_DO"]).describe("Priority level"),
        tips: z.array(z.string()).describe("Tips for the new activity")
      }).describe("Activity data")
    })).describe("Array of activities to add with their day numbers")
  }),
  execute: async ({ itineraryId, activities }) => {
    console.log(`Adding ${activities.length} activities to itinerary ${itineraryId}`);
    
    const newActivities = activities.map(({ dayNumber, activity }) => ({
      dayNumber,
      activity: {
        ...activity,
        id: `act_${Date.now()}_${Math.random()}`
      }
    }));

    const result = {
      success: true,
      itineraryId,
      addedActivities: newActivities,
      count: newActivities.length,
      message: `${newActivities.length} activities have been successfully added to the itinerary.`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Save an itinerary to the database
 */
const saveItinerary = tool({
  description: "Save an itinerary to the database for persistence and sharing",
  inputSchema: z.object({
    itinerary: z.string().describe("Complete itinerary JSON data to save"),
    userId: z.string().describe("User ID who created the itinerary"),
    isPublic: z.boolean().optional().default(false).describe("Whether the itinerary should be publicly shareable")
  }),
  execute: async ({ itinerary, userId, isPublic }) => {
    console.log(`Saving itinerary for user ${userId}, public: ${isPublic}`);
    
    const itineraryData = JSON.parse(itinerary);
    const saveId = `saved_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Note: This tool now returns a message that the frontend should handle
    // The actual database saving should be done via API endpoints
    const result = {
      success: true,
      saveId,
      itineraryId: itineraryData.id,
      userId,
      isPublic,
      shareUrl: isPublic ? `https://aitinerary.app/share/${saveId}` : null,
      message: `Itinerary "${itineraryData.title}" has been saved successfully. Please use the Save button to persist this itinerary.`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Load a saved itinerary from the database
 */
const loadItinerary = tool({
  description: "Load a previously saved itinerary from the database",
  inputSchema: z.object({
    saveId: z.string().describe("Save ID of the itinerary to load"),
    userId: z.string().optional().describe("User ID (required for private itineraries)")
  }),
  execute: async ({ saveId, userId }) => {
    console.log(`Loading itinerary ${saveId} for user ${userId || 'anonymous'}`);
    
    // Simulate loading from database
    const result = {
      success: true,
      saveId,
      userId,
      message: "Itinerary loaded successfully. You can now view and modify it.",
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Get list of saved itineraries for a user
 */
const getUserItineraries = tool({
  description: "Get a list of all saved itineraries for a specific user",
  inputSchema: z.object({
    userId: z.string().describe("User ID to get itineraries for"),
    limit: z.number().optional().default(10).describe("Maximum number of itineraries to return"),
    offset: z.number().optional().default(0).describe("Number of itineraries to skip (for pagination)")
  }),
  execute: async ({ userId, limit, offset }) => {
    console.log(`Getting itineraries for user ${userId}, limit: ${limit}, offset: ${offset}`);
    
    // Simulate getting user itineraries
    const mockItineraries = [
      {
        saveId: "saved_123_abc",
        title: "Tokyo 3-Day Adventure",
        destination: "Tokyo, Japan",
        duration: "3 days",
        isPublic: false,
        createdAt: "2024-01-15T10:30:00Z",
        shareUrl: null
      },
      {
        saveId: "saved_456_def", 
        title: "Paris Weekend Getaway",
        destination: "Paris, France",
        duration: "2 days",
        isPublic: true,
        createdAt: "2024-01-20T14:15:00Z",
        shareUrl: "https://aitinerary.app/share/saved_456_def"
      }
    ];

    const result = {
      success: true,
      userId,
      itineraries: mockItineraries.slice(offset, offset + limit),
      total: mockItineraries.length,
      limit,
      offset,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Share an itinerary by making it public
 */
const shareItinerary = tool({
  description: "Make an itinerary public and get a shareable URL",
  inputSchema: z.object({
    saveId: z.string().describe("Save ID of the itinerary to share"),
    userId: z.string().describe("User ID who owns the itinerary"),
    title: z.string().optional().describe("Optional custom title for sharing")
  }),
  execute: async ({ saveId, userId, title }) => {
    console.log(`Sharing itinerary ${saveId} by user ${userId}`);
    
    const shareUrl = `https://aitinerary.app/share/${saveId}`;
    
    const result = {
      success: true,
      saveId,
      userId,
      shareUrl,
      customTitle: title,
      message: `Itinerary is now public and can be shared using the URL: ${shareUrl}`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});


/**
 * Search the web for travel information
 */
const searchWeb = tool({
  description: "Search the web for current travel information, prices, reviews, or booking options. Use this when you need real-time data about hotels, flights, restaurants, or attractions.",
  inputSchema: z.object({
    query: z.string().describe("Search query for travel information"),
    targetSite: z.enum(["general", "booking.com", "tripadvisor", "google"]).optional().default("general").describe("Specific site to search"),
    env: z.any().optional().describe("Environment bindings")
  }),
  execute: async ({ query, targetSite, env }) => {
    console.log(`Searching web: ${query} on ${targetSite}`);
    
    if (!env?.BROWSER) {
      return JSON.stringify({
        query,
        targetSite,
        error: "Browser binding not configured. Enable Cloudflare Browser Rendering in your dashboard.",
        results: []
      }, null, 2);
    }

    try {
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      
      let searchUrl = "";
      switch (targetSite) {
        case "booking.com":
          searchUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`;
          break;
        case "tripadvisor":
          searchUrl = `https://www.tripadvisor.com/Search?q=${encodeURIComponent(query)}`;
          break;
        case "google":
        case "general":
        default:
          searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + " travel")}`;
          break;
      }

      await page.goto(searchUrl, { waitUntil: "networkidle0", timeout: 10000 });
      
      // Extract search results
      const results = await page.evaluate(() => {
        const items: Array<{ title: string; snippet: string; url: string }> = [];
        
        // Google results
        document.querySelectorAll('div.g').forEach((el, idx) => {
          if (idx >= 5) return; // Limit to 5 results
          const titleEl = el.querySelector('h3');
          const snippetEl = el.querySelector('.VwiC3b');
          const linkEl = el.querySelector('a');
          
          if (titleEl && linkEl) {
            items.push({
              title: titleEl.textContent || '',
              snippet: snippetEl?.textContent || '',
              url: linkEl.getAttribute('href') || ''
            });
          }
        });
        
        return items;
      });

      await browser.close();

      return JSON.stringify({
        query,
        targetSite,
        results: results.length > 0 ? results : [{
          title: "No results found",
          snippet: "Try a different search query",
          url: "#"
        }],
        timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      console.error('Browser search error:', error);
      return JSON.stringify({
        query,
        targetSite,
        error: `Search failed: ${(error as Error).message}`,
        results: []
      }, null, 2);
    }
  }
});

/**
 * Search booking.com for accommodation options
 */
const searchBooking = tool({
  description: "Search booking.com for hotels, apartments, or accommodation in a specific destination with dates and preferences.",
  inputSchema: z.object({
    destination: z.string().describe("City or destination to search accommodation"),
    checkIn: z.string().optional().describe("Check-in date in YYYY-MM-DD format"),
    checkOut: z.string().optional().describe("Check-out date in YYYY-MM-DD format"),
    guests: z.number().optional().default(2).describe("Number of guests"),
    priceRange: z.enum(["budget", "mid-range", "luxury"]).optional().default("mid-range"),
    env: z.any().optional().describe("Environment bindings")
  }),
  execute: async ({ destination, checkIn, checkOut, guests, priceRange, env }) => {
    console.log(`Searching Booking.com: ${destination}, guests: ${guests}, range: ${priceRange}`);
    
    if (!env?.BROWSER) {
      return JSON.stringify({
        destination,
        checkIn,
        checkOut,
        guests,
        priceRange,
        error: "Browser binding not configured",
        hotels: []
      }, null, 2);
    }

    try {
      const browser = await puppeteer.launch(env.BROWSER);
      const page = await browser.newPage();
      
      let bookingUrl = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(destination)}`;
      if (checkIn) bookingUrl += `&checkin=${checkIn}`;
      if (checkOut) bookingUrl += `&checkout=${checkOut}`;
      bookingUrl += `&group_adults=${guests}`;

      await page.goto(bookingUrl, { waitUntil: "networkidle0", timeout: 15000 });
      
      // Extract hotel results
      const hotels = await page.evaluate(() => {
        const items: Array<{ name: string; price: string; rating: string; url: string }> = [];
        
        document.querySelectorAll('[data-testid="property-card"]').forEach((el, idx) => {
          if (idx >= 5) return;
          
          const nameEl = el.querySelector('[data-testid="title"]');
          const priceEl = el.querySelector('[data-testid="price-and-discounted-price"]');
          const ratingEl = el.querySelector('[data-testid="review-score"]');
          const linkEl = el.querySelector('a');
          
          items.push({
            name: nameEl?.textContent?.trim() || 'Hotel',
            price: priceEl?.textContent?.trim() || 'Price not available',
            rating: ratingEl?.textContent?.trim() || 'No rating',
            url: linkEl?.getAttribute('href') || '#'
          });
        });
        
        return items;
      });

      await browser.close();

      return JSON.stringify({
        destination,
        checkIn,
        checkOut,
        guests,
        priceRange,
        hotels: hotels.length > 0 ? hotels : [],
        message: hotels.length > 0 ? `Found ${hotels.length} accommodation options` : "No hotels found for these criteria",
        timestamp: new Date().toISOString()
      }, null, 2);
    } catch (error) {
      console.error('Booking search error:', error);
      return JSON.stringify({
        destination,
        error: `Search failed: ${(error as Error).message}`,
        hotels: []
      }, null, 2);
    }
  }
});

/**
 * Export all available tools
 */
export const tools = {
  generateCompleteItinerary,
  getDestinationInfo,
  getWeatherInfo,
  calculateTravelTime,
  modifyActivity,
  replaceActivity,
  addActivity,
  removeActivity,
  removeMultipleActivities,
  addMultipleActivities,
  saveItinerary,
  loadItinerary,
  getUserItineraries,
  shareItinerary,
  searchWeb,
  searchBooking
} satisfies ToolSet;

export const executions: Record<string, ToolExecution> = {};