import { useState, useEffect, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';

interface EarningsPeriod {
  total: number;
  count: number;
  avgPerDelivery: number;
}

interface DriverEarnings {
  thisWeek: EarningsPeriod;
  lastWeek: EarningsPeriod;
  thisMonth: EarningsPeriod;
  lastMonth: EarningsPeriod;
  thisYear: EarningsPeriod;
}

const EMPTY_PERIOD: EarningsPeriod = { total: 0, count: 0, avgPerDelivery: 0 };

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sunday
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getStartOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getStartOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function computePeriod(deliveries: Array<{ price: number }>): EarningsPeriod {
  if (deliveries.length === 0) return { ...EMPTY_PERIOD };
  const total = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  return {
    total,
    count: deliveries.length,
    avgPerDelivery: Math.round(total / deliveries.length),
  };
}

export function useDriverEarnings(userId?: string) {
  const [completedDeliveries, setCompletedDeliveries] = useState<Array<{ price: number; completedAt: Date }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('deliveries')
      .where('driverId', '==', userId)
      .where('status', '==', 'completed_paid')
      .onSnapshot(
        (snapshot) => {
          const items = snapshot.docs.map((doc) => {
            const data = doc.data();
            const completedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(0);
            return {
              price: data.price || data.suggestedPrice || 0,
              completedAt,
            };
          });
          setCompletedDeliveries(items);
          setIsLoading(false);
        },
        (error) => {
          console.warn('[useDriverEarnings] Error:', error);
          setIsLoading(false);
        },
      );

    return () => unsubscribe();
  }, [userId]);

  const earnings: DriverEarnings = useMemo(() => {
    const now = new Date();
    const thisWeekStart = getStartOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const thisMonthStart = getStartOfMonth(now);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisYearStart = getStartOfYear(now);

    const inRange = (d: Date, start: Date, end: Date) => d >= start && d < end;

    const thisWeek = completedDeliveries.filter((d) => d.completedAt >= thisWeekStart);
    const lastWeek = completedDeliveries.filter((d) => inRange(d.completedAt, lastWeekStart, thisWeekStart));
    const thisMonth = completedDeliveries.filter((d) => d.completedAt >= thisMonthStart);
    const lastMonth = completedDeliveries.filter((d) => inRange(d.completedAt, lastMonthStart, thisMonthStart));
    const thisYear = completedDeliveries.filter((d) => d.completedAt >= thisYearStart);

    return {
      thisWeek: computePeriod(thisWeek),
      lastWeek: computePeriod(lastWeek),
      thisMonth: computePeriod(thisMonth),
      lastMonth: computePeriod(lastMonth),
      thisYear: computePeriod(thisYear),
    };
  }, [completedDeliveries]);

  return { earnings, isLoading };
}
