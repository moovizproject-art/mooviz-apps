import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { useUser, useInvalidate } from '../hooks/useFirestore';
import UserAvatar from '../components/UserAvatar';
import StatusBadge from '../components/StatusBadge';
import ConfirmDialog from '../components/ConfirmDialog';
import {
  approveKyc,
  rejectKyc,
  suspendUser,
  blockUser,
  reactivateUser,
} from '../services/users';
import { getUserDeliveries, type Delivery } from '../services/deliveries';
import { useQuery } from '@tanstack/react-query';

type AdminAction = 'approve_kyc' | 'reject_kyc' | 'suspend' | 'block' | 'reactivate' | null;

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const invalidate = useInvalidate();
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

  async function executeAction() {
    if (!userId) return;
    setActionLoading(true);
    try {
      switch (activeAction) {
        case 'approve_kyc':
          await approveKyc(userId);
          break;
        case 'reject_kyc':
          await rejectKyc(userId, actionReason);
          break;
        case 'suspend':
          await suspendUser(userId, actionReason);
          break;
        case 'block':
          await blockUser(userId, actionReason);
          break;
        case 'reactivate':
          await reactivateUser(userId);
          break;
      }
      invalidate('users');
      setActiveAction(null);
      setActionReason('');
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

      {/* Profile Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <UserAvatar
            name={user.displayName}
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
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Email</p>
            <p className="mt-1 text-sm text-gray-900">{user.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Phone</p>
            <p className="mt-1 text-sm text-gray-900">{user.phone}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Joined</p>
            <p className="mt-1 text-sm text-gray-900">
              {format(user.createdAt.toDate(), 'MMM d, yyyy')}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Rating</p>
            <p className="mt-1 text-sm text-gray-900">
              {user.rating > 0 ? `${user.rating.toFixed(1)} / 5.0` : 'No ratings'}
            </p>
          </div>
        </div>
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
                    {format(delivery.createdAt.toDate(), 'MMM d')}
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
        message={`Approve KYC verification for ${user.displayName}? This will activate their account.`}
        confirmLabel="Approve"
        variant="info"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={activeAction === 'reject_kyc'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Reject KYC"
        message={`Reject KYC verification for ${user.displayName}?`}
        confirmLabel="Reject"
        variant="danger"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={activeAction === 'suspend'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Suspend User"
        message={`Suspend ${user.displayName}? They will not be able to create or accept deliveries.`}
        confirmLabel="Suspend"
        variant="warning"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={activeAction === 'block'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Block User"
        message={`Block ${user.displayName}? This will permanently restrict their access.`}
        confirmLabel="Block"
        variant="danger"
        loading={actionLoading}
      />
      <ConfirmDialog
        open={activeAction === 'reactivate'}
        onClose={() => setActiveAction(null)}
        onConfirm={executeAction}
        title="Reactivate User"
        message={`Reactivate ${user.displayName}? Their account will be restored to active status.`}
        confirmLabel="Reactivate"
        variant="info"
        loading={actionLoading}
      />
    </div>
  );
}
