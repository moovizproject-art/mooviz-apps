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
import { useStats, useDeliveryChart, useStatusDistribution } from '../hooks/useStats';

const STATUS_COLORS: Record<string, string> = {
  new: '#3B82F6',
  accepted: '#6366F1',
  picked_up: '#8B5CF6',
  in_transit: '#F59E0B',
  delivered: '#22C55E',
  confirmed: '#10B981',
  cancelled: '#9CA3AF',
  disputed: '#EF4444',
};

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useStats();
  const { data: chartData, isLoading: chartLoading } = useDeliveryChart(14);
  const { data: statusData, isLoading: statusLoading } = useStatusDistribution();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="mt-1 text-sm text-gray-500">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Deliveries"
          value={stats?.totalDeliveries ?? 0}
          color="blue"
        />
        <StatsCard
          title="Active Deliveries"
          value={stats?.activeDeliveries ?? 0}
          color="yellow"
        />
        <StatsCard
          title="Total Users"
          value={stats?.totalUsers ?? 0}
          color="purple"
        />
        <StatsCard
          title="Active Drivers"
          value={stats?.activeDrivers ?? 0}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="Revenue"
          value={stats ? `$${stats.totalRevenue.toLocaleString()}` : '$0'}
          color="green"
        />
        <StatsCard
          title="Pending KYC"
          value={stats?.pendingKyc ?? 0}
          color="yellow"
        />
        <StatsCard
          title="Open Reports"
          value={stats?.openReports ?? 0}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Deliveries Over Time */}
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900">Deliveries (Last 14 Days)</h3>
          <div className="mt-4 h-72">
            {chartLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                Loading chart...
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
          <h3 className="text-base font-semibold text-gray-900">Status Distribution</h3>
          <div className="mt-4 h-72">
            {statusLoading ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                Loading chart...
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
    </div>
  );
}
