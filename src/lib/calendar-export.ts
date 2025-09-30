/**
 * Calendar export utilities for generating iCal files
 * Compatible with Google Calendar, Apple Calendar, Outlook, etc.
 */

interface Activity {
  id: string;
  title: string;
  description: string;
  location: string;
  startTime: string;
  endTime?: string;
  category: string;
  tips?: string[];
}

interface Day {
  date: string;
  dayNumber: number;
  activities: Activity[];
}

interface Itinerary {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Day[];
}

/**
 * Format date for iCal format (YYYYMMDDTHHMMSSZ)
 */
function formatICalDate(date: string, time?: string): string {
  const dateObj = new Date(date);
  
  if (time) {
    const [hours, minutes] = time.split(':');
    dateObj.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  }
  
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  const hours = String(dateObj.getHours()).padStart(2, '0');
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  const secs = String(dateObj.getSeconds()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${mins}${secs}Z`;
}

/**
 * Escape special characters for iCal format
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Generate a unique identifier for calendar events
 */
function generateUID(activityId: string): string {
  return `${activityId}@aitinerary.app`;
}

/**
 * Export itinerary to iCal format
 */
export function exportToICalendar(itinerary: Itinerary): string {
  const now = new Date();
  const timestamp = formatICalDate(now.toISOString());
  
  let icalContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//AItinerary//Travel Planner//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeICalText(itinerary.title)}`,
    'X-WR-TIMEZONE:UTC',
    `X-WR-CALDESC:${escapeICalText(`Travel itinerary for ${itinerary.destination}`)}`
  ];

  // Add each activity as an event
  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      const startDateTime = formatICalDate(day.date, activity.startTime);
      
      // If no end time, assume 1 hour duration
      let endDateTime: string;
      if (activity.endTime) {
        endDateTime = formatICalDate(day.date, activity.endTime);
      } else {
        const startDate = new Date(day.date);
        const [hours, minutes] = activity.startTime.split(':');
        startDate.setHours(parseInt(hours, 10) + 1, parseInt(minutes, 10), 0, 0);
        endDateTime = formatICalDate(startDate.toISOString());
      }

      // Build description with tips
      let description = escapeICalText(activity.description);
      if (activity.tips && activity.tips.length > 0) {
        description += '\\n\\nTips:\\n' + activity.tips.map(tip => `- ${escapeICalText(tip)}`).join('\\n');
      }

      icalContent.push(
        'BEGIN:VEVENT',
        `UID:${generateUID(activity.id)}`,
        `DTSTAMP:${timestamp}`,
        `DTSTART:${startDateTime}`,
        `DTEND:${endDateTime}`,
        `SUMMARY:${escapeICalText(activity.title)}`,
        `DESCRIPTION:${description}`,
        `LOCATION:${escapeICalText(activity.location)}`,
        `CATEGORIES:${activity.category}`,
        'STATUS:CONFIRMED',
        'TRANSP:OPAQUE',
        'END:VEVENT'
      );
    }
  }

  icalContent.push('END:VCALENDAR');
  
  return icalContent.join('\r\n');
}

/**
 * Download iCal file
 */
export function downloadICalFile(itinerary: Itinerary): void {
  const icalContent = exportToICalendar(itinerary);
  const blob = new Blob([icalContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${itinerary.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate Google Calendar URL
 */
export function getGoogleCalendarUrl(activity: Activity, date: string): string {
  const startDate = new Date(date);
  const [hours, minutes] = activity.startTime.split(':');
  startDate.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
  
  let endDate: Date;
  if (activity.endTime) {
    endDate = new Date(date);
    const [endHours, endMinutes] = activity.endTime.split(':');
    endDate.setHours(parseInt(endHours, 10), parseInt(endMinutes, 10), 0, 0);
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // +1 hour
  }

  const formatGoogleDate = (d: Date) => {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: activity.title,
    dates: `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`,
    details: activity.description + (activity.tips ? '\n\nTips:\n' + activity.tips.join('\n') : ''),
    location: activity.location,
    trp: 'false'
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Add all activities to Google Calendar (opens multiple tabs)
 */
export function addAllToGoogleCalendar(itinerary: Itinerary): void {
  const confirm = window.confirm(
    `This will open ${itinerary.days.reduce((total, day) => total + day.activities.length, 0)} tabs in your browser. Continue?`
  );
  
  if (!confirm) return;

  for (const day of itinerary.days) {
    for (const activity of day.activities) {
      const url = getGoogleCalendarUrl(activity, day.date);
      window.open(url, '_blank');
    }
  }
}
