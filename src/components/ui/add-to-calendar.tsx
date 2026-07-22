import { Button } from "./button";
import { CalendarDays, Download } from "lucide-react";

interface AddToCalendarProps {
  event: {
    title: string;
    description: string;
    startTime: Date;
    endTime: Date;
  };
}

export function AddToCalendar({ event }: AddToCalendarProps) {
  const gcalFormat = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
  
  const googleUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${gcalFormat(event.startTime)}/${gcalFormat(event.endTime)}&details=${encodeURIComponent(event.description)}`;

  const downloadIcs = () => {
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
DTSTART:${gcalFormat(event.startTime)}
DTEND:${gcalFormat(event.endTime)}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
END:VEVENT
END:VCALENDAR`;

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'meeting.ics');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <Button variant="outline" size="sm" onClick={() => window.open(googleUrl, '_blank')} className="flex-1">
        <CalendarDays className="w-4 h-4 mr-2 text-primary" />
        Google Calendar
      </Button>
      <Button variant="outline" size="sm" onClick={downloadIcs} className="flex-1">
        <Download className="w-4 h-4 mr-2 text-primary" />
        Apple / Outlook (.ics)
      </Button>
    </div>
  );
}
