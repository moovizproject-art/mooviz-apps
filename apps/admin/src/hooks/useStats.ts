import { useQuery } from '@tanstack/react-query';
import {
  collection,
  getCountFromServer,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { subDays, startOfDay, format } from 'date-fns';
import { getRecentDeliveries, type Delivery } from '../services/deliveries';
import { getRecentUsers, getMigratedUsersCount, type AppUser } from '../services/users';
import type { Period } from '../components/PeriodFilter';
import { periodToDays } from '../components/PeriodFilter';

export interface DashboardStats {
  totalDeliveries: number;
  activeDeliveries: number;
  totalUsers: number;
  activeDrivers: number;
  totalRevenue: number;
  pendingKyc: number;
  openReports: number;
}

export interface DailyDeliveryCount {
  date: string;
  count: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
}

export interface MigrationStats {
  totalMigrated: number;
  pendingPassword: number;
  missingPhone: number;
}

export interface RecentActivity {
  recentDeliveries: Delivery[];
  recentUsers: AppUser[];
}

export function useStats(period?: Period) {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats', period ?? 'all'],
    queryFn: async () => {
      const deliveriesRef = collection(db, 'deliveries');
      const usersRef = collection(db, 'users');
      const reportsRef = collection(db, 'reports');

      const days = period ? periodToDays(period) : null;
      const cutoff = days ? Timestamp.fromDate(subDays(new Date(), days)) : null;

      // Queries that DON'T use period filter (global counts)
      const [
        totalUsersSnap,
        activeDriversSnap,
        pendingKycSnap,
        openReportsSnap,
      ] = await Promise.all([
        getCountFromServer(query(usersRef)),
        getCountFromServer(query(usersRef, where('driverUnlocked', '==', true))),
        getCountFromServer(query(usersRef, where('kycStatus', '==', 'pending'))),
        getCountFromServer(query(reportsRef, where('status', '==', 'open'))),
      ]);

      // Delivery counts — avoid IN + inequality (needs composite index per status).
      // Instead, fetch all deliveries in period and count client-side.
      const ACTIVE_STATUSES = ['new', 'pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'awaiting_payment'];
      const COMPLETED_STATUSES = ['delivered', 'completed_paid'];

      let totalDeliveries = 0;
      let activeDeliveries = 0;
      let totalRevenue = 0;

      if (cutoff) {
        // Period-filtered: fetch deliveries created in range and count client-side
        const periodDeliveries = await getDocs(
          query(deliveriesRef, where('createdAt', '>=', cutoff)),
        );
        totalDeliveries = periodDeliveries.size;
        for (const docSnap of periodDeliveries.docs) {
          const d = docSnap.data();
          if (ACTIVE_STATUSES.includes(d.status)) activeDeliveries++;
          if (COMPLETED_STATUSES.includes(d.status)) {
            totalRevenue += d.price ?? d.suggestedPrice ?? 0;
          }
        }
      } else {
        // No period: use server counts (more efficient)
        const [totalSnap, activeSnap] = await Promise.all([
          getCountFromServer(query(deliveriesRef)),
          getCountFromServer(
            query(deliveriesRef, where('status', 'in', ACTIVE_STATUSES)),
          ),
        ]);
        totalDeliveries = totalSnap.data().count;
        activeDeliveries = activeSnap.data().count;

        const completedSnap = await getDocs(
          query(deliveriesRef, where('status', 'in', COMPLETED_STATUSES)),
        );
        totalRevenue = completedSnap.docs.reduce(
          (sum, docSnap) => sum + (docSnap.data().price ?? docSnap.data().suggestedPrice ?? 0),
          0,
        );
      }

      return {
        totalDeliveries,
        activeDeliveries,
        totalUsers: totalUsersSnap.data().count,
        activeDrivers: activeDriversSnap.data().count,
        totalRevenue,
        pendingKyc: pendingKycSnap.data().count,
        openReports: openReportsSnap.data().count,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useDeliveryChart(days: number = 14) {
  return useQuery<DailyDeliveryCount[]>({
    queryKey: ['delivery-chart', days],
    queryFn: async () => {
      const startDate = startOfDay(subDays(new Date(), days));
      const q = query(
        collection(db, 'deliveries'),
        where('createdAt', '>=', Timestamp.fromDate(startDate)),
        orderBy('createdAt', 'asc'),
      );
      const snapshot = await getDocs(q);

      const countsByDate = new Map<string, number>();
      for (let i = 0; i <= days; i++) {
        const date = format(subDays(new Date(), days - i), 'MMM dd');
        countsByDate.set(date, 0);
      }

      snapshot.docs.forEach((docSnap) => {
        const createdAt = docSnap.data().createdAt as Timestamp;
        const dateKey = format(createdAt.toDate(), 'MMM dd');
        countsByDate.set(dateKey, (countsByDate.get(dateKey) ?? 0) + 1);
      });

      return Array.from(countsByDate.entries()).map(([date, count]) => ({ date, count }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useStatusDistribution(period?: Period) {
  return useQuery<StatusDistribution[]>({
    queryKey: ['status-distribution', period ?? 'all'],
    queryFn: async () => {
      const statuses = ['new', 'pending', 'awaiting_confirm', 'waiting_for_pickup', 'picked_up', 'delivered', 'awaiting_payment', 'completed_paid', 'cancelled'];
      const deliveriesRef = collection(db, 'deliveries');

      // If period is provided and not 'all', filter by createdAt
      const days = period ? periodToDays(period) : null;
      const periodConstraints = days
        ? [where('createdAt', '>=', Timestamp.fromDate(subDays(new Date(), days)))]
        : [];

      const counts = await Promise.all(
        statuses.map(async (status) => {
          const snap = await getCountFromServer(
            query(deliveriesRef, where('status', '==', status), ...periodConstraints),
          );
          return { status, count: snap.data().count };
        }),
      );

      return counts.filter((c) => c.count > 0);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useRecentActivity() {
  return useQuery<RecentActivity>({
    queryKey: ['recent-activity'],
    queryFn: async () => {
      const [recentDeliveries, recentUsers] = await Promise.all([
        getRecentDeliveries(10),
        getRecentUsers(10),
      ]);
      return { recentDeliveries, recentUsers };
    },
    staleTime: 60 * 1000,
  });
}

export function useMigrationStats() {
  return useQuery<MigrationStats>({
    queryKey: ['migration-stats'],
    queryFn: getMigratedUsersCount,
    staleTime: 5 * 60 * 1000,
  });
}
