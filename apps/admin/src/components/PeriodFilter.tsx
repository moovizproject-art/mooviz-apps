export type Period = '7d' | '30d' | '90d' | 'quarter' | 'year' | 'all';

interface PeriodFilterProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

const PERIOD_OPTIONS: { value: Period; label: string; labelHe: string }[] = [
  { value: '7d', label: '7 Days', labelHe: '7 ימים' },
  { value: '30d', label: '30 Days', labelHe: '30 ימים' },
  { value: '90d', label: '90 Days', labelHe: '90 ימים' },
  { value: 'quarter', label: 'Quarter', labelHe: 'רבעון' },
  { value: 'year', label: 'Year', labelHe: 'שנה' },
  { value: 'all', label: 'All Time', labelHe: 'הכל' },
];

export function periodToDays(period: Period): number | null {
  switch (period) {
    case '7d': return 7;
    case '30d': return 30;
    case '90d': return 90;
    case 'quarter': return 90;
    case 'year': return 365;
    case 'all': return null;
  }
}

export default function PeriodFilter({ value, onChange, className = '' }: PeriodFilterProps) {
  return (
    <div className={`inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 ${className}`}>
      {PERIOD_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-white text-brand-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.labelHe}
        </button>
      ))}
    </div>
  );
}
