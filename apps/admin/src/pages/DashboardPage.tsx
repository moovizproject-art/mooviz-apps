import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/I18nContext';
import { format } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import StatsCard from '../components/StatsCard';
import StatusBadge from '../components/StatusBadge';
import {
  useStats,
  useDeliveryChart,
  useStatusDistribution,
  useRecentActivity,
  useMigrationStats,
} from '../hooks/useStats';

const STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  pending: '#6366F1',
  waiting: '#8B5CF6',
  picked_up: '#F59E0B',
  delivered: '#22C55E',
  completed_paid: '#10B981',
  cancelled: '#9CA3AF',
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { data: stats } = useStats();
  const { data: chartData, isLoading: chartLoading } = useDeliveryChart(14);
  const { data: statusData, isLoading: statusLoading } = useStatusDistribution();
  const { data: recentActivity } = useRecentActivity();
  const { data: migrationStats } = useMigrationStats();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('dashboard.subtitle')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title={t('dashboard.totalDeliveries')}
          value={stats?.totalDeliveries ?? 0}
          color="blue"
        />
        <StatsCard
          title={t('dashboard.activeDeliveries')}
          value={stats?.activeDeliveries ?? 0}
          color="yellow"
        />
        <StatsCard
          title={t('dashboard.totalUsers')}
          value={stats?.totalUsers ?? 0}
          color="purple"
        />
        <StatsCard
          title={t('dashboard.activeDrivers')}
          value={stats?.activeDrivers ?? 0}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title={t('dashboard.revenue')}
          value={stats ? `${stats.totalRevenue.toLocaleString()} ILS` : '0 ILS'}
          color="green"
        />
        <StatsCard
          title={t('dashboard.pendingKyc')}
          value={stats?.pendingKyc ?? 0}
          color="yellow"
        />
        <StatsCard
          title={t('dashboard.openReports')}
          value={stats?.openReports ?? 0}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Deliveries Over Time */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">{t('dashboard.deliveriesChart')}</h3>
          <div className="mt-4 h-72">
            {chartLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                {t('dashboard.loadingChart')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '8px',
                      border: '1px solid #e5e7eb',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Status Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">{t('dashboard.statusDistribution')}</h3>
          <div className="mt-4 h-72">
            {statusLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                {t('dashboard.loadingChart')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    strokeWidth={2}
                  >
                    {statusData?.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_COLORS[entry.status] ?? '#9CA3AF'}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    formatter={(value: string) =>
                      value.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                    }
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Deliveries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.recentDeliveries')}</h3>
            <button
              onClick={() => navigate('/deliveries')}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {recentActivity?.recentDeliveries.length === 0 && (
              <p className="py-4 text-sm text-gray-400">{t('dashboard.noDeliveries')}</p>
            )}
            {recentActivity?.recentDeliveries.map((delivery) => (
              <div
                key={delivery.id}
                onClick={() => navigate(`/deliveries/${delivery.id}`)}
                className="flex cursor-pointer items-center justify-between py-3 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {delivery.title}
                  </p>
                  <p className="text-xs text-gray-500">
                    {delivery.pickup.city} &rarr; {delivery.destination.city}
                  </p>
                </div>
                <div className="ml-4 flex items-center gap-3">
                  <StatusBadge status={delivery.status} />
                  <span className="whitespace-nowrap text-xs text-gray-400">
                    {format(delivery.createdAt.toDate(), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Registrations */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.recentRegistrations')}</h3>
            <button
              onClick={() => navigate('/users')}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {t('dashboard.viewAll')}
            </button>
          </div>
          <div className="mt-4 divide-y divide-gray-100">
            {recentActivity?.recentUsers.length === 0 && (
              <p className="py-4 text-sm text-gray-400">{t('dashboard.noUsers')}</p>
            )}
            {recentActivity?.recentUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => navigate(`/users/${user.id}`)}
                className="flex cursor-pointer items-center justify-between py-3 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-600">
                    {user.fullName
                      .split(' ')
                      .map((p) => p.charAt(0))
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.fullName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    user.role === 'driver' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {user.role}
                  </span>
                  <span className="text-xs text-gray-400">
                    {format(user.createdAt.toDate(), 'MMM d')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Migration Stats */}
      {migrationStats && migrationStats.totalMigrated > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">{t('dashboard.migration')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('dashboard.migrationSubtitle')}</p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-700">{t('dashboard.totalMigrated')}</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {migrationStats.totalMigrated}
              </p>
            </div>
            <div className="rounded-lg bg-yellow-50 p-4">
              <p className="text-sm font-medium text-yellow-700">{t('dashboard.pendingPassword')}</p>
              <p className="mt-1 text-2xl font-bold text-yellow-900">
                {migrationStats.pendingPassword}
              </p>
            </div>
            <div className="rounded-lg bg-red-50 p-4">
              <p className="text-sm font-medium text-red-700">{t('dashboard.missingPhone')}</p>
              <p className="mt-1 text-2xl font-bold text-red-900">
                {migrationStats.missingPhone}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
