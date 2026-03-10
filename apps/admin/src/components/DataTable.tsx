import { useState, useMemo, useCallback } from 'react';

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField: string;
  onRowClick?: (item: T) => void;
  searchable?: boolean;
  searchFields?: string[];
  emptyMessage?: string;
  loading?: boolean;
}

type SortDirection = 'asc' | 'desc';

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((acc, part) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj as unknown);
}

export default function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  onRowClick,
  searchable = false,
  searchFields = [],
  emptyMessage = 'No data found',
  loading = false,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');

  const handleSort = useCallback(
    (key: string) => {
      if (sortKey === key) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortKey(key);
        setSortDir('asc');
      }
    },
    [sortKey],
  );

  const filteredData = useMemo(() => {
    let items = [...data];

    if (search && searchFields.length > 0) {
      const lower = search.toLowerCase();
      items = items.filter((item) =>
        searchFields.some((field) => {
          const val = getNestedValue(item, field);
          return typeof val === 'string' && val.toLowerCase().includes(lower);
        }),
      );
    }

    if (sortKey) {
      items.sort((a, b) => {
        const aVal = getNestedValue(a, sortKey);
        const bVal = getNestedValue(b, sortKey);
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return items;
  }, [data, search, searchFields, sortKey, sortDir]);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {searchable && (
        <div className="border-b border-gray-200 p-4">
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full max-w-sm rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-6 py-3 font-medium ${col.sortable ? 'cursor-pointer select-none hover:text-gray-700' : ''} ${col.className ?? ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <span className="flex items-center gap-1">
                    {col.label}
                    {col.sortable && sortKey === col.key && (
                      <span>{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                  <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                </td>
              </tr>
            ) : filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-400">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr
                  key={String(item[keyField])}
                  onClick={onRowClick ? () => onRowClick(item) : undefined}
                  className={`transition-colors ${
                    onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
                  }`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-6 py-4 ${col.className ?? ''}`}>
                      {col.render ? col.render(item) : String(getNestedValue(item, col.key) ?? '')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
