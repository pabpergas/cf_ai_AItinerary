import { useEffect, useRef, useMemo, memo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in Leaflet with Webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Activity {
  id: string;
  title: string;
  location: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  category: string;
  startTime: string;
}

interface Day {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

interface ItineraryMapProps {
  days: Day[];
  destination: string;
}

const ItineraryMapComponent = ({ days, destination }: ItineraryMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const getCategoryColor = (category: string): string => {
    const colors: { [key: string]: string } = {
      'FOOD': '#ef4444',      // red
      'SIGHTSEEING': '#3b82f6', // blue
      'ACCOMMODATION': '#8b5cf6', // purple
      'TRANSPORTATION': '#6b7280', // gray
      'CULTURE': '#f59e0b',    // amber
      'ENTERTAINMENT': '#ec4899', // pink
      'OUTDOOR': '#10b981',    // emerald
      'WELLNESS': '#06b6d4',   // cyan
      'BUSINESS': '#64748b',   // slate
      'OTHER': '#9ca3af'       // gray
    };
    return colors[category] || '#6b7280';
  };

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      'FOOD': '🍽️',
      'SIGHTSEEING': '🏛️',
      'ACCOMMODATION': '🏨',
      'TRANSPORTATION': '🚗',
      'CULTURE': '🎭',
      'ENTERTAINMENT': '🎪',
      'OUTDOOR': '🌿',
      'WELLNESS': '💆',
      'BUSINESS': '💼',
      'OTHER': '📍'
    };
    return icons[category] || '📍';
  };

  // Memoize activities collection
  const allActivities = useMemo(() => {
    const activities: Activity[] = [];
    days.forEach(day => {
      day.activities.forEach(activity => {
        if (activity.coordinates) {
          activities.push(activity);
        }
      });
    });
    return activities;
  }, [days]);

  useEffect(() => {
    if (!mapRef.current || allActivities.length === 0) return;

    // Initialize map
    const map = L.map(mapRef.current).setView(
      [allActivities[0].coordinates.lat, allActivities[0].coordinates.lng],
      13
    );

    mapInstanceRef.current = map;

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Add markers for each activity
    const markers: L.Marker[] = [];
    
    allActivities.forEach((activity, index) => {
      // Create custom icon
      const iconHtml = `
        <div style="
          background-color: ${getCategoryColor(activity.category)};
          width: 30px;
          height: 30px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">
          ${index + 1}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([activity.coordinates.lat, activity.coordinates.lng], {
        icon: customIcon
      }).addTo(map);

      // Add popup
      const popupContent = `
        <div style="min-width: 200px;">
          <div style="font-weight: bold; margin-bottom: 8px; color: ${getCategoryColor(activity.category)};">
            ${getCategoryIcon(activity.category)} ${activity.title}
          </div>
          <div style="color: #666; font-size: 12px; margin-bottom: 4px;">
            📍 ${activity.location}
          </div>
          <div style="color: #666; font-size: 12px;">
            🕐 ${activity.startTime}
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      markers.push(marker);
    });

    // Fit map to show all markers
    if (markers.length > 1) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [allActivities]);

  return (
    <div className="w-full h-80 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      <div ref={mapRef} className="w-full h-full" />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export const ItineraryMap = memo(ItineraryMapComponent, (prevProps, nextProps) => {
  // Only re-render if days or destination actually changed
  if (prevProps.destination !== nextProps.destination) {
    return false; // Re-render needed
  }
  
  if (prevProps.days.length !== nextProps.days.length) {
    return false; // Re-render needed
  }
  
  // Deep comparison of activities
  for (let i = 0; i < prevProps.days.length; i++) {
    const prevDay = prevProps.days[i];
    const nextDay = nextProps.days[i];
    
    if (prevDay.activities.length !== nextDay.activities.length) {
      return false; // Re-render needed
    }
    
    for (let j = 0; j < prevDay.activities.length; j++) {
      const prevActivity = prevDay.activities[j];
      const nextActivity = nextDay.activities[j];
      
      if (prevActivity.id !== nextActivity.id ||
          prevActivity.title !== nextActivity.title ||
          prevActivity.coordinates?.lat !== nextActivity.coordinates?.lat ||
          prevActivity.coordinates?.lng !== nextActivity.coordinates?.lng) {
        return false; // Re-render needed
      }
    }
  }
  
  return true; // No re-render needed
});