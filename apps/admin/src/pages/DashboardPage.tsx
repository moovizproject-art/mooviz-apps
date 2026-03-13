import { useState } from 'react';
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
import PeriodFilter, { type Period, periodToDays } from '../components/PeriodFilter';
import CsvExport from '../components/CsvExport';
import {
  useStats,
  useDeliveryChart,
  useStatusDistribution,
  useRecentActivity,
  useMigrationStats,
} from '../hooks/useStats';
import {
  useUserBreakdown,
  useRegionalDistribution,
  useDeliveryTimings,
  useMonthlyDeliveries,
  useMonthlyCashflow,
} from '../hooks/useAnalytics';
import { LineChart, Line, Area, AreaChart } from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  pending: '#6366F1',
  waiting: '#8B5CF6',
  picked_up: '#F59E0B',
  delivered: '#22C55E',
  completed_paid: '#10B981',
  cancelled: '#9CA3AF',
};

const REGION_COLORS = ['#3B82F6', '#6366F1', '#8B5CF6', '#F59E0B', '#22C55E', '#EF4444', '#EC4899'];

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} דק'`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} שע' ${mins} דק'` : `${hours} שע'`;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [period, setPeriod] = useState<Period>('30d');

  const { data: stats } = useStats(period);
  const days = periodToDays(period) ?? 14;
  const { data: chartData, isLoading: chartLoading } = useDeliveryChart(days);
  const { data: statusData, isLoading: statusLoading } = useStatusDistribution(period);
  const { data: recentActivity } = useRecentActivity();
  const { data: migrationStats } = useMigrationStats();

  // New analytics hooks
  const { data: userBreakdown } = useUserBreakdown(period);
  const { data: regionalData, isLoading: regionalLoading } = useRegionalDistribution(period);
  const { data: timingsData, isLoading: timingsLoading } = useDeliveryTimings(period);
  const { data: monthlyDeliveries, isLoading: monthlyLoading } = useMonthlyDeliveries();
  const { data: monthlyCashflow, isLoading: cashflowLoading } = useMonthlyCashflow();

  return (
    <div className="space-y-6">
      {/* Header with Period Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('dashboard.subtitle')}</p>
        </div>
        <PeriodFilter value={period} onChange={setPeriod} />
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

      {/* User Breakdown — Senders vs Drivers, Registered vs Active */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.userBreakdown')}</h3>
            <p className="text-xs text-gray-400 mt-0.5">{t('dashboard.activeNote')}</p>
          </div>
          {userBreakdown && (
            <CsvExport
              data={[userBreakdown]}
              columns={[
                { key: 'totalSenders', label: t('dashboard.totalSenders') },
                { key: 'activeSenders', label: t('dashboard.activeSenders') },
                { key: 'totalDrivers', label: t('dashboard.totalDriversCount') },
                { key: 'activeDrivers', label: t('dashboard.activeDriversCount') },
              ]}
              filename="mooviz-user-breakdown"
            />
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div onClick={() => navigate('/users?role=sender')} className="cursor-pointer rounded-lg bg-blue-50 p-4 transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-blue-700">{t('dashboard.totalSenders')}</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{userBreakdown?.totalSenders ?? 0}</p>
          </div>
          <div onClick={() => navigate('/users?role=sender&active=1')} className="cursor-pointer rounded-lg bg-blue-50 p-4 transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-blue-700">{t('dashboard.activeSenders')}</p>
            <p className="mt-1 text-2xl font-bold text-blue-900">{userBreakdown?.activeSenders ?? 0}</p>
          </div>
          <div onClick={() => navigate('/users?role=driver')} className="cursor-pointer rounded-lg bg-green-50 p-4 transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-green-700">{t('dashboard.totalDriversCount')}</p>
            <p className="mt-1 text-2xl font-bold text-green-900">{userBreakdown?.totalDrivers ?? 0}</p>
          </div>
          <div onClick={() => navigate('/users?role=driver&active=1')} className="cursor-pointer rounded-lg bg-green-50 p-4 transition-shadow hover:shadow-md">
            <p className="text-sm font-medium text-green-700">{t('dashboard.activeDriversCount')}</p>
            <p className="mt-1 text-2xl font-bold text-green-900">{userBreakdown?.activeDrivers ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Charts — Deliveries Over Time + Status Distribution */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.deliveriesChart')}</h3>
            {chartData && (
              <CsvExport
                data={chartData}
                columns={[
                  { key: 'date', label: t('dashboard.date') ?? 'Date' },
                  { key: 'count', label: t('dashboard.totalDeliveries') },
                ]}
                filename="mooviz-deliveries-chart"
              />
            )}
          </div>
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

        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.statusDistribution')}</h3>
            {statusData && (
              <CsvExport
                data={statusData}
                columns={[
                  { key: 'status', label: 'Status' },
                  { key: 'count', label: t('dashboard.totalDeliveries') },
                ]}
                filename="mooviz-status-distribution"
              />
            )}
          </div>
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
                        className="cursor-pointer"
                        onClick={() => navigate(`/deliveries?status=${entry.status}`)}
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

      {/* Monthly Charts — Deliveries + Cashflow (12 months) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Monthly Deliveries */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.monthlyDeliveries')}</h3>
            {monthlyDeliveries && (
              <CsvExport
                data={monthlyDeliveries}
                columns={[
                  { key: 'month', label: t('dashboard.month') },
                  { key: 'count', label: t('dashboard.totalDeliveries') },
                ]}
                filename="mooviz-monthly-deliveries"
              />
            )}
          </div>
          <div className="mt-4 h-72">
            {monthlyLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                {t('dashboard.loadingChart')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyDeliveries} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value: number) => [`${value}`, t('dashboard.totalDeliveries')]}
                  />
                  <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(data: any) => {
                    if (data?.monthKey) navigate(`/deliveries?month=${data.monthKey}`);
                  }} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Monthly Cashflow */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t('dashboard.monthlyCashflow')}</h3>
            {monthlyCashflow && (
              <CsvExport
                data={monthlyCashflow}
                columns={[
                  { key: 'month', label: t('dashboard.month') },
                  { key: 'revenue', label: t('dashboard.revenue') },
                  { key: 'count', label: t('dashboard.completedCount') },
                ]}
                filename="mooviz-monthly-cashflow"
              />
            )}
          </div>
          <div className="mt-4 h-72">
            {cashflowLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                {t('dashboard.loadingChart')}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyCashflow} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="cashflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22C55E" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
                  <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" tickFormatter={(v) => `${v} ₪`} />
                  <Tooltip
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [
                      name === 'revenue' ? `${value.toLocaleString()} ₪` : value,
                      name === 'revenue' ? t('dashboard.revenue') : t('dashboard.completedCount'),
                    ]}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#22C55E" strokeWidth={2} fill="url(#cashflowGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Regional Distribution */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{t('dashboard.regionalDistribution')}</h3>
          {regionalData && (
            <CsvExport
              data={regionalData}
              columns={[
                { key: 'region', label: t('dashboard.region') },
                { key: 'count', label: t('dashboard.totalDeliveries') },
              ]}
              filename="mooviz-regional-distribution"
            />
          )}
        </div>
        <div className="mt-4 h-72">
          {regionalLoading ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              {t('dashboard.loadingChart')}
            </div>
          ) : !regionalData?.length ? (
            <div className="flex h-full items-center justify-center text-gray-400">
              {t('dashboard.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalData} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} stroke="#9ca3af" />
                <YAxis type="category" dataKey="region" tick={{ fontSize: 12 }} stroke="#9ca3af" width={80} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                  }}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} className="cursor-pointer"
                  onClick={(_: unknown, index: number) => {
                    const region = regionalData[index]?.region;
                    if (region) navigate(`/deliveries?region=${encodeURIComponent(region)}`);
                  }}
                >
                  {regionalData.map((_, index) => (
                    <Cell key={index} fill={REGION_COLORS[index % REGION_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Delivery Timings Table */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">{t('dashboard.deliveryTimings')}</h3>
          {timingsData && (
            <CsvExport
              data={timingsData.map((d) => ({
                ...d,
                avgPostToApproval: formatMinutes(d.avgPostToApproval),
                avgApprovalToPickup: formatMinutes(d.avgApprovalToPickup),
                avgPickupToDelivery: formatMinutes(d.avgPickupToDelivery),
                avgTotal: formatMinutes(d.avgTotal),
              }))}
              columns={[
                { key: 'region', label: t('dashboard.region') },
                { key: 'avgPostToApproval', label: t('dashboard.postToApproval') },
                { key: 'avgApprovalToPickup', label: t('dashboard.approvalToPickup') },
                { key: 'avgPickupToDelivery', label: t('dashboard.pickupToDelivery') },
                { key: 'avgTotal', label: t('dashboard.totalTime') },
                { key: 'sampleSize', label: t('dashboard.sampleSize') },
              ]}
              filename="mooviz-delivery-timings"
            />
          )}
        </div>
        <div className="mt-4 overflow-x-auto">
          {timingsLoading ? (
            <div className="flex h-32 items-center justify-center text-gray-400">
              {t('dashboard.loadingChart')}
            </div>
          ) : !timingsData?.length ? (
            <div className="flex h-32 items-center justify-center text-gray-400">
              {t('dashboard.noData')}
            </div>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.region')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.postToApproval')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.approvalToPickup')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.pickupToDelivery')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.totalTime')}</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">{t('dashboard.sampleSize')}</th>
                </tr>
              </thead>
              <tbody>
                {timingsData.map((row) => (
                  <tr key={row.region} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/deliveries?region=${encodeURIComponent(row.region)}`)}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.region}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(row.avgPostToApproval)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(row.avgApprovalToPickup)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatMinutes(row.avgPickupToDelivery)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatMinutes(row.avgTotal)}</td>
                    <td className="px-4 py-3 text-gray-500">{row.sampleSize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
