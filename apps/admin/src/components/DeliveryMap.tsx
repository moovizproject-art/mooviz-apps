import type { GeoPoint } from '../services/deliveries';

interface DeliveryMapProps {
  pickup: GeoPoint;
  destination: GeoPoint;
  className?: string;
}

export default function DeliveryMap({ pickup, destination, className = '' }: DeliveryMapProps) {
  // Build a static map URL showing pickup and destination markers
  // In production, replace with an interactive map (Mapbox GL, Google Maps, etc.)
  const mapUrl = `https://maps.googleapis.com/maps/api/staticmap?size=600x300&maptype=roadmap&markers=color:green%7Clabel:P%7C${pickup.latitude},${pickup.longitude}&markers=color:red%7Clabel:D%7C${destination.latitude},${destination.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY ?? ''}`;

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-200 ${className}`}>
      <div className="bg-gray-100">
        {import.meta.env.VITE_GOOGLE_MAPS_KEY ? (
          <img src={mapUrl} alt="Delivery route" className="h-64 w-full object-cover" />
        ) : (
          <div className="flex h-64 items-center justify-center bg-gray-100 text-gray-400">
            <div className="text-center">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <p className="mt-2 text-sm">Map preview</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 divide-x divide-gray-200 bg-white">
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-700">
              P
            </span>
            <span className="text-xs font-medium uppercase text-gray-500">Pickup</span>
          </div>
          <p className="mt-1 text-sm text-gray-900">{pickup.address}</p>
          <p className="text-xs text-gray-500">{pickup.city}</p>
        </div>
        <div className="p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-700">
              D
            </span>
            <span className="text-xs font-medium uppercase text-gray-500">Destination</span>
          </div>
          <p className="mt-1 text-sm text-gray-900">{destination.address}</p>
          <p className="text-xs text-gray-500">{destination.city}</p>
        </div>
      </div>
    </div>
  );
}
