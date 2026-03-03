import type { DeliveryStatus } from '../services/deliveries';

const statusConfig: Record<DeliveryStatus, { label: string; className: string }> = {
  new: { label: 'New', className: 'bg-blue-100 text-blue-800' },
  accepted: { label: 'Accepted', className: 'bg-indigo-100 text-indigo-800' },
  picked_up: { label: 'Picked Up', className: 'bg-purple-100 text-purple-800' },
  in_transit: { label: 'In Transit', className: 'bg-yellow-100 text-yellow-800' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  confirmed: { label: 'Confirmed', className: 'bg-emerald-100 text-emerald-800' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-800' },
  disputed: { label: 'Disputed', className: 'bg-red-100 text-red-800' },
};

interface StatusBadgeProps {
  status: DeliveryStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: 'bg-gray-100 text-gray-800' };

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.className} ${
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'
      }`}
    >
      {config.label}
    </span>
  );
}
