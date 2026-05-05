import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useDelivery, useInvalidate } from '../hooks/useFirestore';
import { useAuth } from '../hooks/useAuth';
import StatusBadge from '../components/StatusBadge';
import StatusTimeline from '../components/StatusTimeline';
import DeliveryMap from '../components/DeliveryMap';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  cancelDelivery,
  resolveDispute,
  updateDeliveryStatus,
  type DeliveryStatus,
  type InterestedDriver,
} from '../services/deliveries';

const ALL_STATUSES: DeliveryStatus[] = [
  'new', 'pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'delivered', 'awaiting_payment', 'completed_paid', 'cancelled',
];

export default function DeliveryDetailPage() {
  const { deliveryId } = useParams<{ deliveryId: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { user: admin } = useAuth();
  const { data: delivery, isLoading } = useDelivery(deliveryId!);
  const [showCancel, setShowCancel] = useState(false);
  const [showResolve, setShowResolve] = useState(false);
  const [showStatusOverride, setShowStatusOverride] = useState(false);
  const [overrideStatus, setOverrideStatus] = useState<DeliveryStatus>('new');
  const [reason, setReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function handleCancel() {
    if (!deliveryId) return;
    setActionLoading(true);
    try {
      await cancelDelivery(deliveryId, reason, admin?.uid);
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
      await resolveDispute(deliveryId, reason, 'completed_paid', admin?.uid);
      invalidate('deliveries');
      setShowResolve(false);
      setReason('');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStatusOverride() {
    if (!deliveryId || !admin) return;
    setActionLoading(true);
    try {
      await updateDeliveryStatus(deliveryId, overrideStatus, admin.uid, reason || undefined);
      invalidate('deliveries');
      setShowStatusOverride(false);
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
          <p className="mt-1 font-mono text-sm text-gray-500">ID: {delivery.id}</p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={delivery.status} size="md" />
          <button
            onClick={() => {
              setOverrideStatus(delivery.status);
              setShowStatusOverride(true);
            }}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Override Status
          </button>
          {delivery.status !== 'cancelled' && delivery.status !== 'completed_paid' && (
            <button
              onClick={() => setShowCancel(true)}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Cancel Delivery
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
                <p className="mt-1 text-sm text-gray-900">{delivery.description || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Price</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  ₪{delivery.price.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Sender</p>
                <button
                  onClick={() => navigate(`/users/${delivery.senderId}`)}
                  className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  {delivery.senderName || delivery.senderId}
                </button>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Driver</p>
                {delivery.driverId ? (
                  <button
                    onClick={() => navigate(`/users/${delivery.driverId}`)}
                    className="mt-1 text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    {delivery.driverName || delivery.driverId}
                  </button>
                ) : (
                  <p className="mt-1 text-sm text-gray-400">Unassigned</p>
                )}
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Created</p>
                <p className="mt-1 text-sm text-gray-900">
                  {delivery.createdAt
                    ? format(delivery.createdAt.toDate(), 'MMM d, yyyy HH:mm')
                    : '-'}
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

            {/* Item Details */}
            {delivery.item && (
              <div className="mt-6 border-t border-gray-200 pt-4">
                <h4 className="text-sm font-semibold text-gray-900">Item</h4>
                <div className="mt-2 grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Type</p>
                    <p className="mt-1 text-sm text-gray-900">{delivery.item.type || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Size</p>
                    <p className="mt-1 text-sm text-gray-900">{delivery.item.size || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase text-gray-500">Description</p>
                    <p className="mt-1 text-sm text-gray-900">{delivery.item.description || '-'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Item Photo */}
          {delivery.item?.photoURL && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Item Photo</h3>
              <img
                src={delivery.item.photoURL}
                alt="Item"
                className="mt-4 max-h-80 rounded-lg object-contain"
              />
            </div>
          )}

          {/* Proof Photos */}
          {(delivery.proof?.pickupURL || delivery.proof?.deliveryURL || delivery.proofPhotoURL) && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Proof Photos</h3>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {delivery.proof?.pickupURL && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-gray-500">Pickup Proof</p>
                    <img
                      src={delivery.proof.pickupURL}
                      alt="Pickup proof"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  </div>
                )}
                {(delivery.proof?.deliveryURL || delivery.proofPhotoURL) && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-gray-500">Delivery Proof</p>
                    <img
                      src={delivery.proof?.deliveryURL || delivery.proofPhotoURL || ''}
                      alt="Delivery proof"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  </div>
                )}
                {delivery.proof?.paymentURL && (
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase text-gray-500">Payment Proof</p>
                    <img
                      src={delivery.proof.paymentURL}
                      alt="Payment proof"
                      className="max-h-64 rounded-lg object-contain"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          {/* Status Timeline */}
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

          {/* Interested Drivers */}
          {delivery.interestedDrivers && delivery.interestedDrivers.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">
                Interested Drivers
                <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                  {delivery.interestedDrivers.length}
                </span>
              </h3>
              <ul className="mt-4 divide-y divide-gray-100">
                {delivery.interestedDrivers.map((d: InterestedDriver) => {
                  const statusColors: Record<string, string> = {
                    interested: 'bg-blue-100 text-blue-700',
                    selected: 'bg-purple-100 text-purple-700',
                    confirmed: 'bg-green-100 text-green-700',
                    declined: 'bg-orange-100 text-orange-700',
                    cancelled: 'bg-gray-100 text-gray-500',
                    withdrawn: 'bg-gray-100 text-gray-500',
                  };
                  return (
                    <li key={d.uid} className="flex items-start gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => navigate(`/users/${d.uid}`)}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          {d.name || d.uid}
                        </button>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                          {d.rating != null && <span>⭐ {d.rating.toFixed(1)}</span>}
                          {d.distanceKm != null && <span>📍 {d.distanceKm.toFixed(1)} km</span>}
                          {d.expressedAt && (
                            <span>
                              {format(
                                d.expressedAt.toDate ? d.expressedAt.toDate() : new Date((d.expressedAt as any).seconds * 1000),
                                'HH:mm'
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[d.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {d.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={showCancel}
        onClose={() => {
          setShowCancel(false);
          setReason('');
        }}
        onConfirm={handleCancel}
        title="Cancel Delivery"
        message="Are you sure you want to cancel this delivery? This action cannot be undone."
        confirmLabel="Cancel Delivery"
        variant="danger"
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Reason</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Enter cancellation reason..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </ConfirmDialog>

      {/* Resolve Dialog */}
      <ConfirmDialog
        open={showResolve}
        onClose={() => {
          setShowResolve(false);
          setReason('');
        }}
        onConfirm={handleResolve}
        title="Resolve Dispute"
        message="Resolve this dispute and mark the delivery as completed?"
        confirmLabel="Resolve"
        variant="info"
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Resolution Note</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Enter resolution details..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </ConfirmDialog>

      {/* Status Override Dialog */}
      <ConfirmDialog
        open={showStatusOverride}
        onClose={() => {
          setShowStatusOverride(false);
          setReason('');
        }}
        onConfirm={handleStatusOverride}
        title="Override Delivery Status"
        message="Manually override the delivery status. This will be logged as an admin action."
        confirmLabel="Apply Override"
        variant="warning"
        loading={actionLoading}
      >
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">New Status</label>
            <select
              value={overrideStatus}
              onChange={(e) => setOverrideStatus(e.target.value as DeliveryStatus)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for status override..."
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}
