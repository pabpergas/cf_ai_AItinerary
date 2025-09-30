import { 
  MapPin, 
  Calendar, 
  Users, 
  CurrencyDollar, 
  Clock,
  Star,
  Info,
  FloppyDisk,
  ShareNetwork
} from "@phosphor-icons/react";
import { ItineraryMap } from "./ItineraryMap";
import { memo } from "react";

interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  startTime: string;
  endTime: string;
  category: string;
  estimatedCost: number;
  priority: string;
  tips: string[];
}

interface Day {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

interface ItineraryData {
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

interface ItineraryDisplayProps {
  data: string; // JSON string that needs to be parsed
  onActivityClick?: (activity: Activity, itinerary: ItineraryData) => void;
  onSave?: (itinerary: ItineraryData) => void;
  onShare?: (itinerary: ItineraryData) => void;
  onExportCalendar?: () => void;
}

const ItineraryDisplayComponent = ({ data, onActivityClick, onSave, onShare, onExportCalendar }: ItineraryDisplayProps) => {
  let itinerary: ItineraryData;
  
  try {
    itinerary = JSON.parse(data);
  } catch (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-800 dark:text-red-200">Error parsing itinerary data</p>
      </div>
    );
  }

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-4 h-4";
    switch (category) {
      case "FOOD": return "🍽️";
      case "SIGHTSEEING": return "🏛️";
      case "ACCOMMODATION": return "🏨";
      case "TRANSPORTATION": return "🚗";
      case "CULTURE": return "🎭";
      case "ENTERTAINMENT": return "🎪";
      case "OUTDOOR": return "🌿";
      default: return "📍";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH": return "text-red-600 dark:text-red-400";
      case "MEDIUM": return "text-yellow-600 dark:text-yellow-400";
      case "LOW": return "text-green-600 dark:text-green-400";
      case "MUST_DO": return "text-purple-600 dark:text-purple-400";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {itinerary.title}
            </h2>
            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <MapPin size={16} />
                <span>{itinerary.destination}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={16} />
                <span>{itinerary.duration}</span>
              </div>
              <div className="flex items-center gap-1">
                <Users size={16} />
                <span>{itinerary.travelers} travelers</span>
              </div>
              <div className="flex items-center gap-1">
                <CurrencyDollar size={16} />
                <span>${itinerary.totalEstimatedCost} estimated</span>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          {(onSave || onShare || onExportCalendar) && (
            <div className="flex gap-2 ml-4">
              {onExportCalendar && (
                <button
                  onClick={onExportCalendar}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  title="Export to Calendar"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 256 256">
                    <path d="M208,32H184V24a8,8,0,0,0-16,0v8H88V24a8,8,0,0,0-16,0v8H48A16,16,0,0,0,32,48V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V48A16,16,0,0,0,208,32ZM72,48v8a8,8,0,0,0,16,0V48h80v8a8,8,0,0,0,16,0V48h24V80H48V48ZM208,208H48V96H208V208Zm-96-88v64a8,8,0,0,1-16,0V132.94l-4.42,2.22a8,8,0,0,1-7.16-14.32l16-8A8,8,0,0,1,112,120Zm59.16,30.45L152,176h16a8,8,0,0,1,0,16H136a8,8,0,0,1-6.4-12.8l28.78-38.37A8,8,0,1,0,145.07,132a8,8,0,1,1-13.85-8A24,24,0,0,1,176,136,23.76,23.76,0,0,1,171.16,150.45Z"></path>
                  </svg>
                  <span>Export</span>
                </button>
              )}
              {onSave && (
                <button
                  onClick={() => onSave(itinerary)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <FloppyDisk size={16} />
                  <span>Save</span>
                </button>
              )}
              {onShare && (
                <button
                  onClick={() => onShare(itinerary)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <ShareNetwork size={16} />
                  <span>Share</span>
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {itinerary.summary.totalActivities}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Activities</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              ${itinerary.summary.averageCostPerDay}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Avg. Cost/Day</div>
          </div>
          <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg">
            <div className="text-lg font-semibold text-gray-900 dark:text-white">
              {itinerary.interests.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Interests</div>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Activity Locations
        </h3>
        <ItineraryMap days={itinerary.days} destination={itinerary.destination} />
      </div>

      {/* Days */}
      <div className="p-6">
        <div className="space-y-8">
          {itinerary.days.map((day, dayIndex) => (
            <div key={day.date} className="space-y-4">
              {/* Day Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Day {day.dayNumber}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(day.date)}
                  </p>
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {day.activities.length} activities
                </div>
              </div>

              {/* Activities */}
              <div className="space-y-3">
                {day.activities.map((activity, activityIndex) => (
                  <div 
                    key={activity.id}
                    className={`flex gap-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg transition-colors ${
                      onActivityClick 
                        ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-700 border border-transparent' 
                        : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                    }`}
                    onClick={() => onActivityClick?.(activity, itinerary)}
                  >
                    {/* Time */}
                    <div className="flex-shrink-0 w-20 text-center">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.startTime}
                      </div>
                      {activity.endTime && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {activity.endTime}
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-lg">{getCategoryIcon(activity.category)}</span>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {activity.title}
                            </h4>
                            <span className={`text-xs px-2 py-1 rounded-full bg-white dark:bg-gray-800 ${getPriorityColor(activity.priority)}`}>
                              {activity.priority}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
                            {activity.description}
                          </p>
                          
                          <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                            <div className="flex items-center gap-1">
                              <MapPin size={12} />
                              <span>{activity.location}</span>
                            </div>
                            {activity.estimatedCost > 0 && (
                              <div className="flex items-center gap-1">
                                <CurrencyDollar size={12} />
                                <span>${activity.estimatedCost}</span>
                              </div>
                            )}
                          </div>

                          {/* Tips */}
                          {activity.tips && activity.tips.length > 0 && (
                            <div className="mt-3">
                              <div className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 mb-1">
                                <Info size={12} />
                                <span>Tips</span>
                              </div>
                              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                                {activity.tips.map((tip, tipIndex) => (
                                  <li key={tipIndex} className="flex items-start gap-1">
                                    <span className="text-blue-400 mt-0.5">•</span>
                                    <span>{tip}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Day separator */}
              {dayIndex < itinerary.days.length - 1 && (
                <div className="border-t border-gray-200 dark:border-gray-600 my-6"></div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="bg-gray-50 dark:bg-gray-700 p-6 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Created on {new Date(itinerary.createdAt).toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            {itinerary.interests.map((interest, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full"
              >
                {interest}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ItineraryDisplay = memo(ItineraryDisplayComponent, (prevProps, nextProps) => {
  // Only re-render if data actually changed
  return prevProps.data === nextProps.data;
});