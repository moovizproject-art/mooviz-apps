import { useState, useEffect, useCallback, useRef } from 'react';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

interface UseFirestoreOptions<T> {
  /** Firestore collection path */
  collection: string;
  /** Where clauses: [field, operator, value] */
  where?: [string, FirebaseFirestoreTypes.WhereFilterOp, unknown][];
  /** Order by: [field, direction] */
  orderBy?: [string, 'asc' | 'desc'];
  /** Max documents to fetch */
  limit?: number;
  /** Transform raw Firestore doc data into typed object */
  transform?: (doc: FirebaseFirestoreTypes.DocumentSnapshot) => T;
  /** Whether to subscribe in real-time (default: true) */
  realtime?: boolean;
  /** Disable the query */
  enabled?: boolean;
}

interface UseFirestoreResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * useFirestore — הוק Firestore גנרי
 * Generic Firestore listener hook with real-time updates.
 * הוק גנרי להאזנה ל-Firestore עם עדכונים בזמן אמת
 */
export function useFirestore<T extends { id: string }>({
  collection,
  where: whereClauses,
  orderBy,
  limit,
  transform,
  realtime = true,
  enabled = true,
}: UseFirestoreOptions<T>): UseFirestoreResult<T> {
  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const refreshCounter = useRef<number>(0);

  const defaultTransform = useCallback(
    (doc: FirebaseFirestoreTypes.DocumentSnapshot): T => {
      return { id: doc.id, ...doc.data() } as T;
    },
    [],
  );

  const transformFn = transform || defaultTransform;

  useEffect(() => {
    if (!enabled) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    // Build query
    let query: FirebaseFirestoreTypes.Query = firestore().collection(collection);

    if (whereClauses) {
      for (const [field, op, value] of whereClauses) {
        query = query.where(field, op, value);
      }
    }

    if (orderBy) {
      query = query.orderBy(orderBy[0], orderBy[1]);
    }

    if (limit) {
      query = query.limit(limit);
    }

    if (realtime) {
      // Real-time listener
      // מאזין בזמן אמת
      const unsubscribe = query.onSnapshot(
        (snapshot) => {
          const docs = snapshot.docs.map(transformFn);
          setData(docs);
          setIsLoading(false);
        },
        (err) => {
          const code = (err as { code?: string }).code;
          const message = String(err);
          const isRecoverable =
            code === 'firestore/failed-precondition' ||
            code === 'firestore/permission-denied' ||
            message.includes('failed-precondition') ||
            message.includes('permission-denied') ||
            message.includes('requires an index');
          if (isRecoverable) {
            console.warn(`[useFirestore] ${collection}: ${code || 'unknown'} — showing empty state`);
            setData([]);
          } else {
            console.error(`[useFirestore] Error on ${collection}:`, err);
            setError(err as Error);
          }
          setIsLoading(false);
        },
      );

      return unsubscribe;
    } else {
      // One-time fetch
      query
        .get()
        .then((snapshot) => {
          const docs = snapshot.docs.map(transformFn);
          setData(docs);
          setIsLoading(false);
        })
        .catch((err) => {
          const code = (err as { code?: string }).code;
          const message = String(err);
          const isRecoverable =
            code === 'firestore/failed-precondition' ||
            code === 'firestore/permission-denied' ||
            message.includes('failed-precondition') ||
            message.includes('permission-denied') ||
            message.includes('requires an index');
          if (isRecoverable) {
            console.warn(`[useFirestore] ${collection}: ${code || 'unknown'} — showing empty state`);
            setData([]);
          } else {
            console.error(`[useFirestore] Error fetching ${collection}:`, err);
            setError(err as Error);
          }
          setIsLoading(false);
        });
      return undefined;
    }
  }, [collection, enabled, realtime, refreshCounter.current]);

  const refresh = useCallback(() => {
    refreshCounter.current += 1;
  }, []);

  return { data, isLoading, error, refresh };
}
