import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DocumentSnapshot } from 'firebase/firestore';
import { useState, useCallback } from 'react';
import { getUsers, getUserById, type UsersQueryParams, type AppUser } from '../services/users';
import {
  getDeliveries,
  getDeliveryById,
  type DeliveriesQueryParams,
  type Delivery,
} from '../services/deliveries';
import { getReports, type ReportsQueryParams, type Report } from '../services/reports';

// ─── Users ──────────────────────────────────────────────

export function useUsers(params: UsersQueryParams = {}) {
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);

  const queryResult = useQuery({
    queryKey: ['users', params],
    queryFn: async () => {
      const result = await getUsers({ ...params, lastDoc: lastDoc ?? undefined });
      setLastDoc(result.lastDoc);
      return result.users;
    },
  });

  const loadMore = useCallback(() => {
    if (lastDoc) {
      queryResult.refetch();
    }
  }, [lastDoc, queryResult]);

  return { ...queryResult, loadMore, hasMore: lastDoc !== null };
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
