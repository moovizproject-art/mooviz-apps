import { format } from 'date-fns';
import type { StatusEvent } from '../services/deliveries';
import StatusBadge from './StatusBadge';

interface StatusTimelineProps {
  events: StatusEvent[];
}

/** Safely convert any timestamp format to a Date */
function toDate(ts: unknown): Date {
  if (!ts) return new Date(0);
  if (typeof (ts as { toDate?: unknown }).toDate === 'function') return (ts as { toDate: () => Date }).toDate();
  if (typeof (ts as { seconds?: number }).seconds === 'number') return new Date((ts as { seconds: number }).seconds * 1000);
  if (ts instanceof Date) return ts;
  return new Date(0);
}

export default function StatusTimeline({ events }: StatusTimelineProps) {
  const sortedEvents = [...events].sort(
    (a, b) => toDate(b.timestamp).getTime() - toDate(a.timestamp).getTime(),
  );

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {sortedEvents.map((event, idx) => (
          <li key={`${event.status}-${toDate(event.timestamp).getTime()}`}>
            <div className="relative pb-8">
              {idx !== sortedEvents.length - 1 && (
                <span
                  className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200"
                  aria-hidden="true"
                />
              )}
              <div className="relative flex items-start space-x-3">
                <div className="relative">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-4 ring-white">
                    <div className="h-2 w-2 rounded-full bg-brand-600" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-gray-500">
                      {format(toDate(event.timestamp), 'MMM d, yyyy HH:mm')}
                    </span>
                  </div>
                  {event.note && (
                    <p className="mt-1 text-sm text-gray-600">{event.note}</p>
                  )}
                  <p className="mt-0.5 text-xs text-gray-400">by {event.updatedBy}</p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
