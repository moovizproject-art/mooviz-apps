import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import DataTable, { type Column } from '../components/DataTable';
import StatusBadge from '../components/StatusBadge';
import CsvExport from '../components/CsvExport';
import { useDeliveries } from '../hooks/useFirestore';
import { useI18n } from '../i18n/I18nContext';
import type { Delivery, DeliveryStatus } from '../services/deliveries';
import { cityToRegion, REGION_NAMES } from '../constants/regions';

export default function DeliveriesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | ''>(
    (searchParams.get('status') as DeliveryStatus) || '',
  );
  const [regionFilter, setRegionFilter] = useState(searchParams.get('region') || '');
  const [dateFrom, setDateFrom] = useState(() => {
    const month = searchParams.get('month');
    return month ? format(startOfMonth(new Date(month + '-01')), 'yyyy-MM-dd') : '';
  });
  const [dateTo, setDateTo] = useState(() => {
    const month = searchParams.get('month');
    return month ? format(endOfMonth(new Date(month + '-01')), 'yyyy-MM-dd') : '';
  });

  const { data: rawDeliveries, isLoading } = useDeliveries({
    status: statusFilter || undefined,
    dateFrom: dateFrom ? new Date(dateFrom) : undefined,
    dateTo: dateTo ? new Date(dateTo) : undefined,
  });

  // Client-side region filtering (regions map to multiple cities)
  const deliveries = regionFilter
    ? rawDeliveries?.filter((d) => cityToRegion(d.pickup?.city || '') === regionFilter)
    : rawDeliveries;

  const columns: Column<Delivery>[] = [
    {
      key: 'id',
      label: t('deliveries.id'),
      render: (d) => (
        <span className="font-mono text-xs text-gray-500">{d.id.slice(0, 8)}...</span>
      ),
    },
    {
      key: 'senderName',
      label: t('deliveries.senderCol'),
      sortable: true,
      render: (d) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${d.senderId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {d.senderName || t('deliveries.unknown')}
        </button>
      ),
    },
    {
      key: 'driverName',
      label: t('deliveries.driverCol'),
      render: (d) => d.driverId ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${d.driverId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {d.driverName || t('deliveries.unknown')}
        </button>
      ) : (
        <span className="text-gray-400">{t('deliveries.unassigned')}</span>
      ),
    },
    {
      key: 'pickup.city',
      label: t('deliveries.route'),
      render: (d) => (
        <span className="text-sm">
          {d.pickup.city || '-'} &rarr; {d.destination.city || '-'}
        </span>
      ),
    },
    {
      key: 'status',
      label: t('deliveries.status'),
      render: (d) => <StatusBadge status={d.status} />,
    },
    {
      key: 'price',
      label: t('deliveries.price'),
      sortable: true,
      render: (d) => (
        <span className="font-medium">
          ₪{d.price.toLocaleString('he-IL', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'createdAt',
      label: t('deliveries.created'),
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t('deliveries.title')}</h2>
          <p className="mt-1 text-sm text-gray-500">{t('deliveries.subtitle')}</p>
        </div>
        {deliveries && (
          <CsvExport
            data={deliveries.map((d) => ({
              id: d.id,
              senderName: d.senderName || '',
              driverName: d.driverName || '',
              pickupCity: d.pickup?.city || '',
              destinationCity: d.destination?.city || '',
              status: d.status,
              price: d.price,
              currency: d.currency,
              createdAt: d.createdAt ? format(d.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : '',
            }))}
            columns={[
              { key: 'id', label: 'ID' },
              { key: 'senderName', label: 'שולח' },
              { key: 'driverName', label: 'נהג' },
              { key: 'pickupCity', label: 'עיר איסוף' },
              { key: 'destinationCity', label: 'עיר יעד' },
              { key: 'status', label: 'סטטוס' },
              { key: 'price', label: 'מחיר' },
              { key: 'currency', label: 'מטבע' },
              { key: 'createdAt', label: 'תאריך' },
            ]}
            filename="mooviz-deliveries"
          />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-500">{t('deliveries.status')}</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as DeliveryStatus | '')}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">{t('deliveries.all')}</option>
            <option value="new">{t('deliveries.new')}</option>
            <option value="pending">{t('deliveries.pending')}</option>
            <option value="awaiting_confirm">{t('deliveries.awaitingConfirm')}</option>
            <option value="waiting_for_pickup">{t('deliveries.waitingForPickup')}</option>
            <option value="picked_up">{t('deliveries.pickedUp')}</option>
            <option value="delivered">{t('deliveries.delivered')}</option>
            <option value="awaiting_payment">{t('deliveries.awaitingPayment')}</option>
            <option value="completed_paid">{t('deliveries.completed')}</option>
            <option value="cancelled">{t('deliveries.cancelled')}</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">{t('deliveries.region')}</label>
          <select
            value={regionFilter}
            onChange={(e) => setRegionFilter(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">{t('deliveries.allRegions')}</option>
            {REGION_NAMES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">{t('deliveries.from')}</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500">{t('deliveries.to')}</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        {(statusFilter || regionFilter || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setStatusFilter('');
              setRegionFilter('');
              setDateFrom('');
              setDateTo('');
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            {t('deliveries.clearFilters')}
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
        emptyMessage={t('deliveries.noDeliveries')}
      />
    </div>
  );
}
