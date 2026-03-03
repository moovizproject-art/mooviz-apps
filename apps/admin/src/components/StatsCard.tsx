interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    label: string;
  };
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-700',
  green: 'bg-green-50 text-green-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  red: 'bg-red-50 text-red-700',
  purple: 'bg-purple-50 text-purple-700',
};

export default function StatsCard({
  title,
  value,
  subtitle,
  trend,
  color = 'blue',
}: StatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        {trend && (
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
              trend.value >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}
          >
            {trend.value >= 0 ? '+' : ''}
            {trend.value}% {trend.label}
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className={`text-3xl font-bold ${colorClasses[color].split(' ')[1]}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <span className="text-sm text-gray-500">{subtitle}</span>}
      </div>
    </div>
  );
}
