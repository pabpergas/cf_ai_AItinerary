/**
 * Tool definitions for the AItinerary AI chat agent
 * Tools execute automatically and return structured data for the frontend
 */
import { tool, type ToolSet } from "ai";
import { z } from "zod/v3";

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
    
    const result = {
      success: true,
      saveId,
      itineraryId: itineraryData.id,
      userId,
      isPublic,
      shareUrl: isPublic ? `https://aitinerary.app/share/${saveId}` : null,
      message: `Itinerary "${itineraryData.title}" has been saved successfully.`,
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
 * User registration
 */
const registerUser = tool({
  description: "Register a new user account",
  inputSchema: z.object({
    email: z.string().email().describe("User email address"),
    password: z.string().min(8).describe("User password (minimum 8 characters)"),
    name: z.string().describe("User full name")
  }),
  execute: async ({ email, password, name }) => {
    console.log(`Registering user: ${email}`);
    
    // Simulate user registration
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      success: true,
      userId,
      email,
      name,
      message: "Account created successfully! You are now logged in.",
      token: `token_${userId}`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * User login
 */
const loginUser = tool({
  description: "Login an existing user",
  inputSchema: z.object({
    email: z.string().email().describe("User email address"),
    password: z.string().describe("User password")
  }),
  execute: async ({ email, password }) => {
    console.log(`Login attempt for: ${email}`);
    
    // Simulate login validation
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = {
      success: true,
      userId,
      email,
      name: "User Name", // Would come from database
      message: "Login successful!",
      token: `token_${userId}`,
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Get user profile
 */
const getUserProfile = tool({
  description: "Get user profile information",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    token: z.string().describe("Authentication token")
  }),
  execute: async ({ userId, token }) => {
    console.log(`Getting profile for user: ${userId}`);
    
    const result = {
      success: true,
      userId,
      email: "user@example.com",
      name: "User Name",
      createdAt: "2024-01-01T00:00:00Z",
      totalItineraries: 5,
      message: "Profile retrieved successfully",
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
  }
});

/**
 * Update user profile
 */
const updateUserProfile = tool({
  description: "Update user profile information",
  inputSchema: z.object({
    userId: z.string().describe("User ID"),
    token: z.string().describe("Authentication token"),
    updates: z.object({
      name: z.string().optional().describe("New name"),
      email: z.string().email().optional().describe("New email"),
      password: z.string().min(8).optional().describe("New password")
    }).describe("Profile updates")
  }),
  execute: async ({ userId, token, updates }) => {
    console.log(`Updating profile for user: ${userId}`);
    
    const result = {
      success: true,
      userId,
      updates,
      message: "Profile updated successfully",
      timestamp: new Date().toISOString()
    };

    return JSON.stringify(result, null, 2);
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
  saveItinerary,
  loadItinerary,
  getUserItineraries,
  shareItinerary,
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile
} satisfies ToolSet;