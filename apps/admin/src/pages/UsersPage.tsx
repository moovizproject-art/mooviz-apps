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

// "userType" combines role + driverUnlocked into a meaningful admin filter:
// 'sender'         = role === 'sender' (server-side)
// 'driver'         = driverUnlocked === true (client-side: KYC-approved drivers)
// 'pending_review' = kycStatus === 'pending' + has docs (client-side)
type UserTypeFilter = '' | 'sender' | 'driver' | 'pending_review';

export default function UsersPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [userTypeFilter, setUserTypeFilter] = useState<UserTypeFilter>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [kycFilter, setKycFilter] = useState<KycStatus | ''>('');

  // Map the userType selection to actual query params
  const roleParam: UserRole | undefined =
    userTypeFilter === 'sender' ? 'sender' : undefined;
  const driverUnlockedParam = userTypeFilter === 'driver' ? true : undefined;
  const kycStatusParam: KycStatus | undefined =
    userTypeFilter === 'pending_review' ? 'pending' : (kycFilter || undefined);

  const { data: users, isLoading } = useUsers({
    role: roleParam,
    status: statusFilter || undefined,
    kycStatus: kycStatusParam,
    driverUnlocked: driverUnlockedParam,
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
      render: (user) => {
        const hasDocs = !!(user.kycDocumentURL || user.kycIdURL);
        return (
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${kycBadgeClass[user.kycStatus]}`}>
              {user.kycStatus === 'pending' && hasDocs ? '⏳ ממתין לאישור' : user.kycStatus}
            </span>
            {user.kycStatus === 'pending' && !hasDocs && (
              <span className="text-xs text-gray-400">לא הגיש מסמכים</span>
            )}
          </div>
        );
      },
    },
    {
      key: 'activeMode',
      label: 'תפקיד',
      render: (user) => (
        <div className="flex flex-wrap gap-1">
          {user.driverUnlocked && (
            <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
              נהג ✓
            </span>
          )}
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
            user.activeMode === 'driver'
              ? 'bg-green-50 text-green-600'
              : user.activeMode === 'sender'
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500'
          }`}>
            {user.activeMode === 'driver' ? 'נהג (פעיל)' : user.activeMode === 'sender' ? 'שולח' : user.role}
          </span>
        </div>
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
      <div className="flex flex-wrap gap-3 items-center">
        {/* User-type quick filter — replaces the broken role dropdown */}
        <select
          value={userTypeFilter}
          onChange={(e) => {
            setUserTypeFilter(e.target.value as UserTypeFilter);
            // Clear KYC dropdown when switching to pending_review (it's built-in)
            if (e.target.value === 'pending_review') setKycFilter('');
          }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">כל המשתמשים</option>
          <option value="sender">שולחים בלבד</option>
          <option value="driver">נהגים מאושרים (KYC ✓)</option>
          <option value="pending_review">⏳ ממתינים לאישור KYC</option>
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

        {/* KYC filter — hidden when userType=pending_review (already implied) */}
        {userTypeFilter !== 'pending_review' && (
          <select
            value={kycFilter}
            onChange={(e) => setKycFilter(e.target.value as KycStatus | '')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">{t('users.allKyc')}</option>
            <option value="pending">ממתין (הגיש מסמכים)</option>
            <option value="approved">{t('users.approved')}</option>
            <option value="rejected">{t('users.rejected')}</option>
          </select>
        )}

        {(userTypeFilter || statusFilter || kycFilter) && (
          <button
            onClick={() => {
              setUserTypeFilter('');
              setStatusFilter('');
              setKycFilter('');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            {t('users.clearFilters')}
          </button>
        )}

        {/* Live count */}
        {!isLoading && users && (
          <span className="text-sm text-gray-400">{users.length} משתמשים</span>
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
