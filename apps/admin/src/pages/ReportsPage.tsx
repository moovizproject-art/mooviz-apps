import { useState } from 'react';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import DataTable, { type Column } from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { useReports, useInvalidate } from '../hooks/useFirestore';
import {
  resolveReport,
  dismissReport,
  setReportInvestigating,
  type Report,
  type ReportStatus,
  type ReportCategory,
  type ModerationAction,
} from '../services/reports';
import { suspendUser, blockUser } from '../services/users';
import { useAuth } from '../hooks/useAuth';

const statusClasses: Record<ReportStatus, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-yellow-100 text-yellow-800',
  resolved: 'bg-green-100 text-green-800',
  dismissed: 'bg-gray-100 text-gray-800',
};

const categoryLabels: Record<ReportCategory, string> = {
  harassment: 'Harassment',
  fraud: 'Fraud',
  damage: 'Damage',
  no_show: 'No Show',
  other: 'Other',
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const { user: admin } = useAuth();
  const invalidate = useInvalidate();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('');
  const [categoryFilter, setCategoryFilter] = useState<ReportCategory | ''>('');
  const { data: reports, isLoading } = useReports({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
  });

  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [actionType, setActionType] = useState<'resolve' | 'dismiss' | null>(null);
  const [moderationAction, setModerationAction] = useState<ModerationAction>('warning');
  const [note, setNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  async function handleAction() {
    if (!selectedReport || !admin) return;
    setActionLoading(true);
    try {
      if (actionType === 'resolve') {
        await resolveReport(selectedReport.id, moderationAction, note, admin.uid);

        // Apply moderation action to reported user
        if (moderationAction === 'suspend') {
          await suspendUser(selectedReport.reportedUserId, note);
        } else if (moderationAction === 'block') {
          await blockUser(selectedReport.reportedUserId, note);
        }
      } else {
        await dismissReport(selectedReport.id, note, admin.uid);
      }
      invalidate('reports');
      setSelectedReport(null);
      setActionType(null);
      setNote('');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleInvestigate(report: Report) {
    await setReportInvestigating(report.id);
    invalidate('reports');
  }

  const columns: Column<Report>[] = [
    {
      key: 'createdAt',
      label: 'Date',
      sortable: true,
      render: (r) => (
        <span className="text-sm text-gray-500">
          {format(r.createdAt.toDate(), 'MMM d, yyyy')}
        </span>
      ),
    },
    {
      key: 'category',
      label: 'Category',
      render: (r) => (
        <span className="text-sm font-medium">{categoryLabels[r.category]}</span>
      ),
    },
    {
      key: 'reporterName',
      label: 'Reporter',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${r.reporterId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {r.reporterName}
        </button>
      ),
    },
    {
      key: 'reportedUserName',
      label: 'Reported User',
      render: (r) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/users/${r.reportedUserId}`);
          }}
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          {r.reportedUserName}
        </button>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (r) => (
        <p className="max-w-xs truncate text-sm text-gray-600">{r.description}</p>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (r) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClasses[r.status]}`}
        >
          {r.status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (r) => (
        <div className="flex gap-2">
          {r.status === 'open' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleInvestigate(r);
              }}
              className="rounded px-2 py-1 text-xs font-medium text-yellow-700 hover:bg-yellow-50"
            >
              Investigate
            </button>
          )}
          {(r.status === 'open' || r.status === 'investigating') && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport(r);
                  setActionType('resolve');
                }}
                className="rounded px-2 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
              >
                Resolve
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedReport(r);
                  setActionType('dismiss');
                }}
                className="rounded px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Reports</h2>
        <p className="mt-1 text-sm text-gray-500">User reports and moderation queue</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="investigating">Investigating</option>
          <option value="resolved">Resolved</option>
          <option value="dismissed">Dismissed</option>
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as ReportCategory | '')}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Categories</option>
          <option value="harassment">Harassment</option>
          <option value="fraud">Fraud</option>
          <option value="damage">Damage</option>
          <option value="no_show">No Show</option>
          <option value="other">Other</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={reports ?? []}
        keyField="id"
        loading={isLoading}
        emptyMessage="No reports found"
      />

      {/* Resolve/Dismiss Dialog */}
      {selectedReport && actionType && (
        <ConfirmDialog
          open={true}
          onClose={() => {
            setSelectedReport(null);
            setActionType(null);
            setNote('');
          }}
          onConfirm={handleAction}
          title={actionType === 'resolve' ? 'Resolve Report' : 'Dismiss Report'}
          message={
            actionType === 'resolve'
              ? `Take action on the report against ${selectedReport.reportedUserName}.`
              : `Dismiss the report against ${selectedReport.reportedUserName}. No action will be taken.`
          }
          confirmLabel={actionType === 'resolve' ? 'Resolve' : 'Dismiss'}
          variant={actionType === 'resolve' ? 'warning' : 'info'}
          loading={actionLoading}
        />
      )}
    </div>
  );
}
