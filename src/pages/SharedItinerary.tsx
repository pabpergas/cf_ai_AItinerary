import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ItineraryDisplay } from '@/components/itinerary/ItineraryDisplay';
import { downloadICalFile } from '@/lib/calendar-export';
import AIOrb from '@/components/ui/AIOrb';
import { AnimatedShinyText } from '@/components/ui/AnimatedShinyText';

export default function SharedItinerary() {
  const { itineraryId } = useParams<{ itineraryId: string }>();
  const [itinerary, setItinerary] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!itineraryId) {
      setError('No itinerary ID provided');
      setLoading(false);
      return;
    }

    const loadItinerary = async () => {
      try {
        console.log('Loading shared itinerary:', itineraryId);
        const response = await fetch(`/api/collab/itinerary/${itineraryId}`);

        if (!response.ok) {
          throw new Error(`Failed to load itinerary: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Loaded itinerary:', data);
        setItinerary(data.data);
      } catch (err) {
        console.error('Error loading itinerary:', err);
        setError(err instanceof Error ? err.message : 'Failed to load itinerary');
      } finally {
        setLoading(false);
      }
    };

    loadItinerary();
  }, [itineraryId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AIOrb size="80px" animationDuration={10} />
          <AnimatedShinyText className="text-lg font-medium mt-6">
            Loading shared itinerary...
          </AnimatedShinyText>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Itinerary Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your Own Itinerary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Back to home"
            >
              ←
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Shared Itinerary
              </h1>
              <p className="text-sm text-gray-600">
                View only • {itineraryId}
              </p>
            </div>
          </div>

          <Link
            to="/"
            className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            Create Your Own
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-6">
        {itinerary ? (
          <ItineraryDisplay
            data={typeof itinerary === 'string' ? itinerary : JSON.stringify(itinerary)}
            onActivityClick={() => {}}
            onSave={() => {}}
            onShare={() => {}}
            onExportCalendar={() => {
              if (itinerary) {
                downloadICalFile(itinerary);
              }
            }}
          />
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Itinerary Data
            </h3>
            <p className="text-gray-600">
              This itinerary appears to be empty.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
