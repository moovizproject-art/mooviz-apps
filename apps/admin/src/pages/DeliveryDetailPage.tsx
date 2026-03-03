import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useDelivery, useInvalidate } from '../hooks/useFirestore';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import DeliveryMap from '../components/DeliveryMap';
import ConfirmDialog from '../components/ConfirmDialog';
import { cancelDelivery, resolveDispute } from '../services/deliveries';

export default function DeliveryDetailPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { data: delivery, isLoading } = useDelivery(deliveryId!);
  const [showCancel, setShowCancel] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function handleCancel() {
    if (!deliveryId) return;
    setActionLoading(true);
    try {
      await cancelDelivery(deliveryId, reason);
      invalidate('deliveries');
      setShowCancel(false);
      setReason('');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleResolve() {
    if (!deliveryId) return;
    setActionLoading(true);
    try {
      await resolveDispute(deliveryId, reason, 'confirmed');
      invalidate('deliveries');
      setShowResolve(false);
      setReason('');
    } finally {
      setActionLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="text-center">
        <p className="text-gray-500">Delivery not found</p>
        <button
          onClick={() => navigate('/deliveries')}
          className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to deliveries
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => navigate('/deliveries')}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            &larr; Back to Deliveries
          </button>
          <h2 className="mt-2 text-2xl font-bold text-gray-900">{delivery.title}</h2>
          <p className="mt-1 text-sm text-gray-500">ID: {delivery.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={delivery.status} size="md" />
          {delivery.status !== 'cancelled' && delivery.status !== 'confirmed' && (
            <button
              onClick={() => setShowCancel(true)}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Cancel Delivery
            </button>
          )}
          {delivery.status === 'disputed' && (
            <button
              onClick={() => setShowResolve(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Resolve Dispute
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Map */}
          <DeliveryMap pickup={delivery.pickup} destination={delivery.destination} />

          {/* Details */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-semibold text-gray-900">Details</h3>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Description</p>
                <p className="mt-1 text-sm text-gray-900">{delivery.description}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Price</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {delivery.currency} {delivery.price.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Sender</p>
                <button
                  onClick={() => navigate(`/users/${delivery.senderId}`)}
                  className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {delivery.senderName}
                </button>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Driver</p>
                {delivery.driverId ? (
                  <button
                    onClick={() => navigate(`/users/${delivery.driverId}`)}
                    className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {delivery.driverName}
                  </button>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">Unassigned</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Created</p>
                <p className="mt-1 text-sm text-gray-900">
                  {format(delivery.createdAt.toDate(), 'MMM d, yyyy HH:mm')}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Delivered</p>
                <p className="mt-1 text-sm text-gray-900">
                  {delivery.deliveredAt
                    ? format(delivery.deliveredAt.toDate(), 'MMM d, yyyy HH:mm')
                    : '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Proof Photo */}
          {delivery.proofPhotoURL && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Proof of Delivery</h3>
              <img
                src={delivery.proofPhotoURL}
                alt="Delivery proof"
                className="mt-4 max-h-80 rounded-lg object-contain"
              />
            </div>
          )}
        </div>

        {/* Right Column - Timeline */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Status Timeline</h3>
          <div className="mt-4">
            {delivery.statusHistory && delivery.statusHistory.length > 0 ? (
              <StatusTimeline events={delivery.statusHistory} />
            ) : (
              <p className="text-sm text-gray-500">No status history available</p>
            )}
          </div>
        </div>
      </div>

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={showCancel}
        onClose={() => setShowCancel(false)}
        onConfirm={handleCancel}
        title="Cancel Delivery"
        message="Are you sure you want to cancel this delivery? This action cannot be undone."
        confirmLabel="Cancel Delivery"
        variant="danger"
        loading={actionLoading}
      />

      {/* Resolve Dialog */}
      <ConfirmDialog
        open={showResolve}
        onClose={() => setShowResolve(false)}
        onConfirm={handleResolve}
        title="Resolve Dispute"
        message="Resolve this dispute and mark the delivery as confirmed?"
        confirmLabel="Resolve"
        variant="info"
        loading={actionLoading}
      />
    </div>
  );
}
