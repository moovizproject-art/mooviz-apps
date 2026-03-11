import { saveAs } from 'file-saver';

interface CsvExportProps<T> {
  data: T[];
  columns: { key: string; label: string }[];
  filename: string;
  className?: string;
}

function toCsv<T extends Record<string, any>>(
  data: T[],
  columns: { key: string; label: string }[],
): string {
  const BOM = '\uFEFF';
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const rows = data.map((item) =>
    columns
      .map((col) => {
        const val = col.key.split('.').reduce((acc: any, k) => acc?.[k], item);
        const str = val == null ? '' : String(val);
        return `"${str.replace(/"/g, '""')}"`;
      })
      .join(','),
  );
  return BOM + [header, ...rows].join('\n');
}

export { toCsv };

export default function CsvExport<T extends Record<string, any>>({
  data,
  columns,
  filename,
  className = '',
}: CsvExportProps<T>) {
  const handleExport = () => {
    const csv = toCsv(data, columns);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, `${filename}-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <button
      onClick={handleExport}
      disabled={data.length === 0}
      className={`inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 ${className}`}
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      ייצוא CSV
    </button>
  );
}
