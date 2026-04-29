import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useCallback, useState } from 'react';
import { getUsers, getUserById, type UsersQueryParams, type AppUser } from '../services/users';
import {
  getDeliveries,
  getDeliveryById,
  type DeliveriesQueryParams,
  type Delivery,
} from '../services/deliveries';
import { getReports, type ReportsQueryParams } from '../services/reports';

// ─── Users ──────────────────────────────────────────────

export function useUsers(params: UsersQueryParams = {}) {
  // No cursor/pagination: pageSize=200 covers all users.
  // Cursor-based pagination caused empty results on filter change because
  // React Query's refetchOnWindowFocus would re-run with a stale startAfter cursor.
  const queryResult = useQuery({
    queryKey: ['users', params],
    queryFn: () => getUsers(params).then((r) => r.users),
    refetchOnWindowFocus: false,
    refetchInterval: 30_000,
  });

  return { ...queryResult, loadMore: () => {}, hasMore: false };
}

export function useUser(userId: string) {
  return useQuery<AppUser | null>({
    queryKey: ['users', userId],
    queryFn: () => getUserById(userId),
    enabled: !!userId,
  });
}

// ─── Deliveries ─────────────────────────────────────────

export function useDeliveries(params: DeliveriesQueryParams = {}) {
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const queryResult = useQuery({
    queryKey: ['deliveries', params],
    queryFn: async () => {
      const result = await getDeliveries({ ...params, lastDoc: lastDoc ?? undefined });
      setLastDoc(result.lastDoc);
      return result.deliveries;
    },
  });

  const loadMore = useCallback(() => {
    if (lastDoc) {
      queryResult.refetch();
    }
  }, [lastDoc, queryResult]);

  return { ...queryResult, loadMore, hasMore: lastDoc !== null };
}

export function useDelivery(deliveryId: string) {
  return useQuery<Delivery | null>({
    queryKey: ['deliveries', deliveryId],
    queryFn: () => getDeliveryById(deliveryId),
    enabled: !!deliveryId,
  });
}

// ─── Reports ────────────────────────────────────────────

export function useReports(params: ReportsQueryParams = {}) {
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const queryResult = useQuery({
    queryKey: ['reports', params],
    queryFn: async () => {
      const result = await getReports({ ...params, lastDoc: lastDoc ?? undefined });
      setLastDoc(result.lastDoc);
      return result.reports;
    },
  });

  const loadMore = useCallback(() => {
    if (lastDoc) {
      queryResult.refetch();
    }
  }, [lastDoc, queryResult]);

  return { ...queryResult, loadMore, hasMore: lastDoc !== null };
}

// ─── Mutations ──────────────────────────────────────────

export function useInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(
    (key: string) => {
      queryClient.invalidateQueries({ queryKey: [key] });
    },
    [queryClient],
  );
}
