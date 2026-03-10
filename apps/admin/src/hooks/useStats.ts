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

export function useStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const deliveriesRef = collection(db, 'deliveries');
      const usersRef = collection(db, 'users');
      const reportsRef = collection(db, 'reports');

      const [
        totalDeliveriesSnap,
        activeDeliveriesSnap,
        totalUsersSnap,
        activeDriversSnap,
        pendingKycSnap,
        openReportsSnap,
      ] = await Promise.all([
        getCountFromServer(query(deliveriesRef)),
        getCountFromServer(
          query(deliveriesRef, where('status', 'in', ['new', 'pending', 'waiting', 'picked_up'])),
        ),
        getCountFromServer(query(usersRef)),
        getCountFromServer(
          query(usersRef, where('role', 'in', ['driver', 'both']), where('status', '==', 'active')),
        ),
        getCountFromServer(query(usersRef, where('kycStatus', '==', 'pending'))),
        getCountFromServer(query(reportsRef, where('status', '==', 'open'))),
      ]);

      // Estimate revenue from completed deliveries
      const completedQuery = query(
        deliveriesRef,
        where('status', 'in', ['delivered', 'completed_paid']),
      );
      const completedSnap = await getDocs(completedQuery);
      const totalRevenue = completedSnap.docs.reduce(
        (sum, docSnap) => sum + (docSnap.data().price ?? 0),
        0,
      );

      return {
        totalDeliveries: totalDeliveriesSnap.data().count,
        activeDeliveries: activeDeliveriesSnap.data().count,
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

export function useStatusDistribution() {
  return useQuery<StatusDistribution[]>({
    queryKey: ['status-distribution'],
    queryFn: async () => {
      const statuses = ['new', 'pending', 'waiting', 'picked_up', 'delivered', 'completed_paid', 'cancelled'];
      const deliveriesRef = collection(db, 'deliveries');

      const counts = await Promise.all(
        statuses.map(async (status) => {
          const snap = await getCountFromServer(
            query(deliveriesRef, where('status', '==', status)),
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
