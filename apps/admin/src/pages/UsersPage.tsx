import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import CsvExport from '../components/CsvExport';
import DataTable, { type Column } from '../components/DataTable';
import UserAvatar from '../components/UserAvatar';
import { useUsers } from '../hooks/useFirestore';
import { useI18n } from '../i18n/I18nContext';
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
  const { t } = useI18n();
  const navigate = useNavigate();
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [kycFilter, setKycFilter] = useState<KycStatus | ''>('');

  const { data: users, isLoading } = useUsers({
    role: roleFilter || undefined,
    status: statusFilter || undefined,
    kycStatus: kycFilter || undefined,
    pageSize: 200,
  });

  const columns: Column<AppUser>[] = [
    {
      key: 'fullName',
      label: t('users.user'),
      render: (user) => (
        <UserAvatar name={user.fullName || user.displayName} photoURL={user.photoURL} role={user.role} />
      ),
    },
    {
      key: 'email',
      label: t('users.email'),
      sortable: true,
    },
    {
      key: 'phone',
      label: t('users.phone'),
    },
    {
      key: 'kycStatus',
      label: t('users.kyc'),
      render: (user) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${kycBadgeClass[user.kycStatus]}`}
        >
          {user.kycStatus}
        </span>
      ),
    },
    {
      key: 'activeMode',
      label: t('users.activeMode'),
      render: (user) => (
        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
          user.activeMode === 'driver'
            ? 'bg-green-100 text-green-700'
            : user.activeMode === 'sender'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
        }`}>
          {user.activeMode ?? 'N/A'}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('users.status'),
      render: (user) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClass[user.status]}`}
        >
          {user.status.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: t('users.joined'),
      sortable: true,
      render: (user) => (
        <span className="text-sm text-gray-500">
          {user.createdAt ? format(user.createdAt.toDate(), 'MMM d, yyyy') : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('users.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('users.subtitle')}</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">{t('users.allRoles')}</option>
          <option value="sender">{t('users.sender')}</option>
          <option value="driver">{t('users.driver')}</option>
          <option value="both">{t('users.both')}</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">{t('users.allStatuses')}</option>
          <option value="active">{t('users.active')}</option>
          <option value="suspended">{t('users.suspended')}</option>
          <option value="blocked">{t('users.blocked')}</option>
        </select>

        <select
          value={kycFilter}
          onChange={(e) => setKycFilter(e.target.value as KycStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">{t('users.allKyc')}</option>
          <option value="pending">{t('users.pending')}</option>
          <option value="approved">{t('users.approved')}</option>
          <option value="rejected">{t('users.rejected')}</option>
        </select>

        {(roleFilter || statusFilter || kycFilter) && (
          <button
            onClick={() => {
              setRoleFilter('');
              setStatusFilter('');
              setKycFilter('');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            {t('users.clearFilters')}
          </button>
        )}
      </div>

      <CsvExport
        data={users ?? []}
        columns={[
          { key: 'fullName', label: 'שם' },
          { key: 'email', label: 'אימייל' },
          { key: 'phone', label: 'טלפון' },
          { key: 'role', label: 'תפקיד' },
          { key: 'completedDeliveries', label: 'משלוחים' },
        ]}
        filename="mooviz-users"
      />

      <DataTable
        columns={columns}
        data={users ?? []}
        keyField="id"
        onRowClick={(user) => navigate(`/users/${user.id}`)}
        searchable
        searchFields={['fullName', 'displayName', 'email', 'phone']}
        loading={isLoading}
        emptyMessage={t('users.noUsers')}
      />
    </div>
  );
}
