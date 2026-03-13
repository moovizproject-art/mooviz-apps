import { useQuery } from '@tanstack/react-query';
import {
  collection, getDocs, query, where, Timestamp, getCountFromServer,
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { subDays, subMonths, format, startOfMonth } from 'date-fns';
import { he } from 'date-fns/locale';
import { cityToRegion } from '../constants/regions';
import type { Period } from '../components/PeriodFilter';
import { periodToDays } from '../components/PeriodFilter';

export interface UserBreakdown {
  totalSenders: number;
  totalDrivers: number;
  activeSenders: number;
  activeDrivers: number;
}

export interface RegionalDistribution {
  region: string;
  count: number;
}

export interface DeliveryTiming {
  region: string;
  avgPostToApproval: number;
  avgApprovalToPickup: number;
  avgPickupToDelivery: number;
  avgTotal: number;
  sampleSize: number;
}

export function useUserBreakdown(period: Period) {
  return useQuery<UserBreakdown>({
    queryKey: ['user-breakdown', period],
    queryFn: async () => {
      const usersRef = collection(db, 'users');
      const thirtyDaysAgo = Timestamp.fromDate(subDays(new Date(), 30));
      const days = periodToDays(period);
      const periodStart = days ? Timestamp.fromDate(subDays(new Date(), days)) : null;

      const baseConstraints = periodStart
        ? [where('createdAt', '>=', periodStart)]
        : [];

      const [senderSnap, driverSnap] = await Promise.all([
        getCountFromServer(query(usersRef, where('role', '==', 'sender'), ...baseConstraints)),
        getCountFromServer(query(usersRef, where('role', 'in', ['driver', 'both']), ...baseConstraints)),
      ]);

      const [activeSenderSnap, activeDriverSnap] = await Promise.all([
        getCountFromServer(query(usersRef, where('role', '==', 'sender'), where('lastActiveAt', '>=', thirtyDaysAgo))),
        getCountFromServer(query(usersRef, where('role', 'in', ['driver', 'both']), where('lastActiveAt', '>=', thirtyDaysAgo))),
      ]);

      return {
        totalSenders: senderSnap.data().count,
        totalDrivers: driverSnap.data().count,
        activeSenders: activeSenderSnap.data().count,
        activeDrivers: activeDriverSnap.data().count,
      };
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useRegionalDistribution(period: Period) {
  return useQuery<RegionalDistribution[]>({
    queryKey: ['regional-distribution', period],
    queryFn: async () => {
      const deliveriesRef = collection(db, 'deliveries');
      const days = periodToDays(period);
      const constraints = days
        ? [where('createdAt', '>=', Timestamp.fromDate(subDays(new Date(), days)))]
        : [];

      const snapshot = await getDocs(query(deliveriesRef, ...constraints));
      const regionCounts = new Map<string, number>();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const city = data.pickup?.city ?? '';
        const region = cityToRegion(city);
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      });

      return Array.from(regionCounts.entries())
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeliveryTimings(period: Period) {
  return useQuery<DeliveryTiming[]>({
    queryKey: ['delivery-timings', period],
    queryFn: async () => {
      const deliveriesRef = collection(db, 'deliveries');
      const days = periodToDays(period);
      const constraints = [
        where('status', 'in', ['delivered', 'completed_paid']),
        ...(days ? [where('createdAt', '>=', Timestamp.fromDate(subDays(new Date(), days)))] : []),
      ];

      const snapshot = await getDocs(query(deliveriesRef, ...constraints));

      const regionData = new Map<string, {
        postToApproval: number[];
        approvalToPickup: number[];
        pickupToDelivery: number[];
        total: number[];
      }>();

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const city = data.pickup?.city ?? '';
        const region = cityToRegion(city);
        const history: Array<{ status: string; timestamp: Timestamp }> = data.statusHistory ?? [];

        if (history.length < 2) return;

        const times: Record<string, number> = {};
        history.forEach((entry) => {
          if (entry.timestamp?.toMillis) {
            times[entry.status] = entry.timestamp.toMillis();
          }
        });

        const created = data.createdAt?.toMillis?.() ?? times['new'];
        const pending = times['pending'];
        const waiting = times['waiting'];
        const pickedUp = times['picked_up'];
        const delivered = times['delivered'];

        if (!created || !delivered) return;

        if (!regionData.has(region)) {
          regionData.set(region, {
            postToApproval: [], approvalToPickup: [],
            pickupToDelivery: [], total: [],
          });
        }
        const rd = regionData.get(region)!;

        const approvalTime = pending || waiting;
        if (approvalTime) rd.postToApproval.push((approvalTime - created) / 60000);
        if (approvalTime && pickedUp) rd.approvalToPickup.push((pickedUp - approvalTime) / 60000);
        if (pickedUp && delivered) rd.pickupToDelivery.push((delivered - pickedUp) / 60000);
        rd.total.push((delivered - created) / 60000);
      });

      const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;

      return Array.from(regionData.entries()).map(([region, data]) => ({
        region,
        avgPostToApproval: Math.round(avg(data.postToApproval)),
        avgApprovalToPickup: Math.round(avg(data.approvalToPickup)),
        avgPickupToDelivery: Math.round(avg(data.pickupToDelivery)),
        avgTotal: Math.round(avg(data.total)),
        sampleSize: data.total.length,
      })).sort((a, b) => b.sampleSize - a.sampleSize);
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Monthly Deliveries (last 12 months) ─────────────────────────

export interface MonthlyCount {
  month: string;
  monthKey: string;
  count: number;
}

export function useMonthlyDeliveries() {
  return useQuery<MonthlyCount[]>({
    queryKey: ['monthly-deliveries'],
    queryFn: async () => {
      const twelveMonthsAgo = Timestamp.fromDate(startOfMonth(subMonths(new Date(), 11)));
      const snapshot = await getDocs(
        query(collection(db, 'deliveries'), where('createdAt', '>=', twelveMonthsAgo)),
      );

      // Initialize all 12 months
      const months = new Map<string, number>();
      for (let i = 11; i >= 0; i--) {
        const key = format(subMonths(new Date(), i), 'yyyy-MM');
        months.set(key, 0);
      }

      snapshot.docs.forEach((docSnap) => {
        const ts = docSnap.data().createdAt as Timestamp | undefined;
        if (!ts?.toDate) return;
        const key = format(ts.toDate(), 'yyyy-MM');
        if (months.has(key)) months.set(key, months.get(key)! + 1);
      });

      return Array.from(months.entries()).map(([key, count]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: he }),
        monthKey: key,
        count,
      }));
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Monthly Cashflow (last 12 months) ───────────────────────────

export interface MonthlyCashflow {
  month: string;
  revenue: number;
  count: number;
}

export function useMonthlyCashflow() {
  return useQuery<MonthlyCashflow[]>({
    queryKey: ['monthly-cashflow'],
    queryFn: async () => {
      const twelveMonthsAgo = Timestamp.fromDate(startOfMonth(subMonths(new Date(), 11)));
      const snapshot = await getDocs(
        query(
          collection(db, 'deliveries'),
          where('status', 'in', ['delivered', 'completed_paid']),
          where('createdAt', '>=', twelveMonthsAgo),
        ),
      );

      // Initialize all 12 months
      const months = new Map<string, { revenue: number; count: number }>();
      for (let i = 11; i >= 0; i--) {
        const key = format(subMonths(new Date(), i), 'yyyy-MM');
        months.set(key, { revenue: 0, count: 0 });
      }

      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const ts = data.createdAt as Timestamp | undefined;
        if (!ts?.toDate) return;
        const key = format(ts.toDate(), 'yyyy-MM');
        const entry = months.get(key);
        if (entry) {
          entry.revenue += data.price ?? data.suggestedPrice ?? 0;
          entry.count += 1;
        }
      });

      return Array.from(months.entries()).map(([key, data]) => ({
        month: format(new Date(key + '-01'), 'MMM yy', { locale: he }),
        revenue: Math.round(data.revenue),
        count: data.count,
      }));
    },
    staleTime: 10 * 60 * 1000,
  });
}
