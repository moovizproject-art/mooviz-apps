import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUser, useInvalidate } from '../hooks/useFirestore';
import UserAvatar from '../components/UserAvatar';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../hooks/useAuth';
import {
  approveKyc,
  rejectKyc,
  suspendUser,
  blockUser,
  reactivateUser,
  deleteUser,
} from '../services/users';
import { getUserDeliveries, type Delivery } from '../services/deliveries';
import { useQuery } from '@tanstack/react-query';

type AdminAction = 'approve_kyc' | 'reject_kyc' | 'suspend' | 'block' | 'reactivate' | 'delete' | null;

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
  const { user: admin } = useAuth();
  const { data: user, isLoading } = useUser(userId!);
  const [activeAction, setActiveAction] = useState<AdminAction>(null);
  const [actionReason, setActionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const { data: senderDeliveries } = useQuery({
    queryKey: ['user-deliveries', userId, 'sender'],
    queryFn: () => getUserDeliveries(userId!, 'sender'),
    enabled: !!userId,
  });

  const { data: driverDeliveries } = useQuery({
    queryKey: ['user-deliveries', userId, 'driver'],
    queryFn: () => getUserDeliveries(userId!, 'driver'),
    enabled: !!userId,
  });

  const [actionError, setActionError] = useState<string | null>(null);

  async function executeAction() {
    if (!userId || !admin) return;
    setActionLoading(true);
    setActionError(null);
    try {
      switch (activeAction) {
        case 'approve_kyc':
          await approveKyc(userId, admin.uid);
          break;
        case 'reject_kyc':
          await rejectKyc(userId, actionReason, admin.uid);
          break;
        case 'suspend':
          await suspendUser(userId, actionReason, admin.uid);
          break;
        case 'block':
          await blockUser(userId, actionReason, admin.uid);
          break;
        case 'reactivate':
          await reactivateUser(userId, admin.uid);
          break;
        case 'delete':
          await deleteUser(userId, admin.uid);
          invalidate('users');
          setActiveAction(null);
          navigate('/users');
          return;
      }
      invalidate('users');
      setActiveAction(null);
      setActionReason('');
    } catch (err) {
      console.error(`[Admin] Action ${activeAction} failed:`, err);
      const message = err instanceof Error ? err.message : 'Action failed';
      setActionError(message);
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

  if (!user) {
    return (
      <div className="text-center">
        <p className="text-gray-500">User not found</p>
        <button
          onClick={() => navigate('/users')}
          className="mt-4 text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to users
        </button>
      </div>
    );
  }

  const allDeliveries = [...(senderDeliveries ?? []), ...(driverDeliveries ?? [])];
  const kycStatusColor = user.kycStatus === 'approved'
    ? 'bg-green-100 text-green-800'
    : user.kycStatus === 'rejected'
      ? 'bg-red-100 text-red-800'
      : 'bg-yellow-100 text-yellow-800';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/users')}
          className="text-sm font-medium text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Users
        </button>
      </div>

      {/* Error Banner */}
      {actionError && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-red-800">{actionError}</p>
            <button onClick={() => setActionError(null)} className="text-red-400 hover:text-red-600 text-sm">
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Profile Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <UserAvatar
            name={user.fullName || user.displayName}
            photoURL={user.photoURL}
            role={user.role}
            size="lg"
          />
          <div className="flex gap-2">
            {user.kycStatus === 'pending' && (
              <>
                <button
                  onClick={() => setActiveAction('approve_kyc')}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                >
                  Approve KYC
                </button>
                <button
                  onClick={() => setActiveAction('reject_kyc')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  Reject KYC
                </button>
              </>
            )}
            {user.status === 'active' && (
              <>
                <button
                  onClick={() => setActiveAction('suspend')}
                  className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-100"
                >
                  Suspend
                </button>
                <button
                  onClick={() => setActiveAction('block')}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  Block
                </button>
              </>
            )}
            {(user.status === 'suspended' || user.status === 'blocked') && (
              <button
                onClick={() => setActiveAction('reactivate')}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Reactivate
              </button>
            )}
            <button
              onClick={() => setActiveAction('delete')}
              className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Delete
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Email</p>
            <p className="mt-1 text-sm text-gray-900">{user.email || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Phone</p>
            <p className="mt-1 text-sm text-gray-900">{user.phone || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">City</p>
            <p className="mt-1 text-sm text-gray-900">{user.city || '-'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Joined</p>
            <p className="mt-1 text-sm text-gray-900">
              {user.createdAt ? format(user.createdAt.toDate(), 'MMM d, yyyy') : '-'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Active Mode</p>
            <p className="mt-1 text-sm text-gray-900">{user.activeMode ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Driver Unlocked</p>
            <p className="mt-1 text-sm text-gray-900">{user.driverUnlocked ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Rating (Driver)</p>
            <p className="mt-1 text-sm text-gray-900">
              {user.ratingAsDriver
                ? `${user.ratingAsDriver.average.toFixed(1)} / 5.0 (${user.ratingAsDriver.count})`
                : 'No ratings'}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Rating (Sender)</p>
            <p className="mt-1 text-sm text-gray-900">
              {user.ratingAsSender
                ? `${user.ratingAsSender.average.toFixed(1)} / 5.0 (${user.ratingAsSender.count})`
                : 'No ratings'}
            </p>
          </div>
        </div>
      </div>

      {/* KYC Review Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">KYC Verification</h3>
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${kycStatusColor}`}>
            {user.kycStatus.toUpperCase()}
          </span>
        </div>

        {/* KYC Documents */}
        <div className="mt-4">
          {(user.kycDocumentURL || user.kycIdURL) ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">Uploaded Documents</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* License Document */}
                {user.kycDocumentURL && (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="bg-gray-50 px-3 py-2">
                      <p className="text-xs font-medium text-gray-500">Driver License</p>
                    </div>
                    <div className="p-2">
                      <img
                        src={user.kycDocumentURL}
                        alt="Driver License"
                        className="max-h-64 w-full rounded object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'flex h-40 items-center justify-center text-gray-400 text-sm';
                            fallback.textContent = 'Unable to load image';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
                      <a
                        href={user.kycDocumentURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}
                {/* ID Card Document */}
                {user.kycIdURL && (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <div className="bg-gray-50 px-3 py-2">
                      <p className="text-xs font-medium text-gray-500">ID Card</p>
                    </div>
                    <div className="p-2">
                      <img
                        src={user.kycIdURL}
                        alt="ID Card"
                        className="max-h-64 w-full rounded object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            const fallback = document.createElement('div');
                            fallback.className = 'flex h-40 items-center justify-center text-gray-400 text-sm';
                            fallback.textContent = 'Unable to load image';
                            parent.appendChild(fallback);
                          }
                        }}
                      />
                    </div>
                    <div className="border-t border-gray-200 bg-gray-50 px-3 py-2">
                      <a
                        href={user.kycIdURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Open in new tab
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed border-gray-200">
              <p className="text-sm text-gray-400">No KYC documents uploaded</p>
            </div>
          )}
        </div>

        {/* Rejection Reason (if rejected) */}
        {user.kycStatus === 'rejected' && user.kycRejectionReason && (
          <div className="mt-4 rounded-lg bg-red-50 p-4">
            <p className="text-sm font-medium text-red-800">Rejection Reason</p>
            <p className="mt-1 text-sm text-red-700">{user.kycRejectionReason}</p>
          </div>
        )}

        {/* KYC Action Buttons (shown when pending) */}
        {user.kycStatus === 'pending' && (
          <div className="mt-6 flex gap-3 border-t border-gray-200 pt-4">
            <button
              onClick={() => setActiveAction('approve_kyc')}
              className="flex-1 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700"
            >
              Approve KYC
            </button>
            <button
              onClick={() => setActiveAction('reject_kyc')}
              className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Reject KYC
            </button>
          </div>
        )}

        {/* Re-review if previously rejected */}
        {user.kycStatus === 'rejected' && user.kycDocumentURL && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <button
              onClick={() => setActiveAction('approve_kyc')}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Override: Approve KYC
            </button>
          </div>
        )}
      </div>

      {/* Delivery History */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900">
          Delivery History ({allDeliveries.length})
        </h3>
        {allDeliveries.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No deliveries yet</p>
        ) : (
          <div className="mt-4 divide-y divide-gray-100">
            {allDeliveries.slice(0, 10).map((delivery: Delivery) => (
              <div
                key={delivery.id}
                onClick={() => navigate(`/deliveries/${delivery.id}`)}
                className="flex cursor-pointer items-center justify-between py-3 hover:bg-gray-50"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{delivery.title}</p>
                  <p className="text-xs text-gray-500">
                    {delivery.pickup.city} &rarr; {delivery.destination.city}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={delivery.status} />
                  <span className="text-xs text-gray-400">
                    {delivery.createdAt ? format(delivery.createdAt.toDate(), 'MMM d') : '-'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        open={activeAction === 'approve_kyc'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Approve KYC"
        message={`Approve KYC verification for ${user.fullName || user.displayName}? This will set kycStatus to approved and unlock driver mode.`}
        confirmLabel="Approve"
        variant="info"
        loading={actionLoading}
      />

      {/* Reject KYC with reason input */}
      <ConfirmDialog
        open={activeAction === 'reject_kyc'}
        onClose={() => {
          setActiveAction(null);
          setActionReason('');
        }}
        onConfirm={executeAction}
        title="Reject KYC"
        message={`Reject KYC verification for ${user.fullName || user.displayName}?`}
        confirmLabel="Reject"
        variant="danger"
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">
            Rejection Reason <span className="text-red-500">*</span>
          </label>
          <textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            rows={3}
            placeholder="Enter reason for rejection..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </ConfirmDialog>

      {/* Suspend with reason */}
      <ConfirmDialog
        open={activeAction === 'suspend'}
        onClose={() => {
          setActiveAction(null);
          setActionReason('');
        }}
        onConfirm={executeAction}
        title="Suspend User"
        message={`Suspend ${user.fullName || user.displayName}? They will not be able to create or accept deliveries.`}
        confirmLabel="Suspend"
        variant="warning"
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Reason</label>
          <textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            rows={2}
            placeholder="Enter reason for suspension..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </ConfirmDialog>

      {/* Block with reason */}
      <ConfirmDialog
        open={activeAction === 'block'}
        onClose={() => {
          setActiveAction(null);
          setActionReason('');
        }}
        onConfirm={executeAction}
        title="Block User"
        message={`Block ${user.fullName || user.displayName}? This will permanently restrict their access.`}
        confirmLabel="Block"
        variant="danger"
        loading={actionLoading}
      >
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Reason</label>
          <textarea
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            rows={2}
            placeholder="Enter reason for blocking..."
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={activeAction === 'reactivate'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Reactivate User"
        message={`Reactivate ${user.fullName || user.displayName}? Their account will be restored to active status.`}
        confirmLabel="Reactivate"
        variant="info"
        loading={actionLoading}
      />

      {/* Delete User */}
      <ConfirmDialog
        open={activeAction === 'delete'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Delete User"
        message={`Permanently delete ${user.fullName || user.displayName}? This action cannot be undone. All user data will be removed from Firestore.`}
        confirmLabel="Delete Permanently"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
