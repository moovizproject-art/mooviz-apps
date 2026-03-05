import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import { useDeliveries } from '../hooks/useFirestore';
import type { Delivery, DeliveryStatus } from '../services/deliveries';

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>('');
  const [cityFilter, setCityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: deliveries, isLoading } = useDeliveries({
    status: statusFilter || undefined,
    city: cityFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  const columns: Column<Delivery>[] = [
    {
      key: 'id',
      label: 'ID',
      render: (d) => (
        <span className="font-mono text-xs text-gray-500">{d.id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'senderName',
      label: 'Sender',
      sortable: true,
      render: (d) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${d.senderId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {d.senderName || 'Unknown'}
        </button>
      ),
    },
    {
      key: 'driverName',
      label: 'Driver',
      render: (d) => d.driverId ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${d.driverId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {d.driverName || 'Unknown'}
        </button>
      ) : (
        <span className="text-gray-400">Unassigned</span>
      ),
    },
    {
      key: 'pickup.city',
      label: 'Route',
      render: (d) => (
        <span className="text-sm">
          {d.pickup.city || '-'} &rarr; {d.destination.city || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'price',
      label: 'Price',
      sortable: true,
      render: (d) => (
        <span className="font-medium">
          {d.price.toFixed(0)} {d.currency}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (d) => (
        <span className="text-sm text-gray-500">
          {d.createdAt ? format(d.createdAt.toDate(), 'MMM d, yyyy') : '-'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Deliveries</h2>
        <p className="mt-1 text-sm text-gray-500">View and manage all platform deliveries</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | '')}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All</option>
            <option value="new">New</option>
            <option value="pending">Pending</option>
            <option value="waiting">Waiting</option>
            <option value="picked_up">Picked Up</option>
            <option value="delivered">Delivered</option>
            <option value="completed_paid">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">City</label>
          <input
            type="text"
            placeholder="Filter by city"
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {(statusFilter || cityFilter || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setCityFilter('');
              setDateFrom('');
              setDateTo('');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            Clear filters
          </button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={deliveries ?? []}
        keyField="id"
        onRowClick={(delivery) => navigate(`/deliveries/${delivery.id}`)}
        searchable
        searchFields={['title', 'senderName', 'driverName']}
        loading={isLoading}
        emptyMessage="No deliveries found"
      />
    </div>
  );
}
