import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DataTable, { type Column } from '../components/DataTable';
import UserAvatar from '../components/UserAvatar';
import { useUsers } from '../hooks/useFirestore';
import type { AppUser, UserRole, UserStatus, KycStatus } from '../services/users';

const kycBadgeClass: Record<KycStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const statusBadgeClass: Record<UserStatus, string> = {
  active: 'bg-green-100 text-green-800',
  suspended: 'bg-yellow-100 text-yellow-800',
  blocked: 'bg-red-100 text-red-800',
  pending_kyc: 'bg-blue-100 text-blue-800',
};

export default function UsersPage() {
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [kycFilter, setKycFilter] = useState<KycStatus | ''>('');

  const { data: users, isLoading } = useUsers({
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    kycStatus: kycFilter || undefined,
  });

  const columns: Column<AppUser>[] = [
    {
      key: 'displayName',
      label: 'User',
      render: (user) => (
        <UserAvatar name={user.displayName} photoURL={user.photoURL} role={user.role} />
      ),
    },
    {
      key: 'email',
      label: 'Email',
      sortable: true,
    },
    {
      key: 'phone',
      label: 'Phone',
    },
    {
      key: 'status',
      label: 'Status',
      render: (user) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[user.status]}`}
        >
          {user.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'kycStatus',
      label: 'KYC',
      render: (user) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${kycBadgeClass[user.kycStatus]}`}
        >
          {user.kycStatus}
        </span>
      ),
    },
    {
      key: 'deliveryCount',
      label: 'Deliveries',
      sortable: true,
      className: 'text-right',
    },
    {
      key: 'rating',
      label: 'Rating',
      sortable: true,
      render: (user) => (
        <span className="text-sm text-gray-700">
          {user.rating > 0 ? user.rating.toFixed(1) : '-'}
        </span>
      ),
      className: 'text-right',
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <p className="mt-1 text-sm text-gray-500">Manage platform users, KYC, and access</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Roles</option>
          <option value="sender">Sender</option>
          <option value="driver">Driver</option>
          <option value="both">Both</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="blocked">Blocked</option>
          <option value="pending_kyc">Pending KYC</option>
        </select>

        <select
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value as KycStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All KYC</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={users ?? []}
        keyField="id"
        onRowClick={(user) => navigate(`/users/${user.id}`)}
        searchable
        searchFields={['displayName', 'email', 'phone']}
        loading={isLoading}
        emptyMessage="No users found"
      />
    </div>
  );
}
