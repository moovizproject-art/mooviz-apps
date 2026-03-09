import { useState, useEffect, useMemo } from 'react';
import firestore from '@react-native-firebase/firestore';
import { getDistanceKm } from '../utils/mapHelpers';

interface ExpensesPeriod {
  total: number;
  count: number;
  avgPerDelivery: number;
  totalDistanceKm: number;
}

interface SenderExpenses {
  thisWeek: ExpensesPeriod;
  lastWeek: ExpensesPeriod;
  thisMonth: ExpensesPeriod;
  lastMonth: ExpensesPeriod;
  thisYear: ExpensesPeriod;
}

const EMPTY_PERIOD: ExpensesPeriod = { total: 0, count: 0, avgPerDelivery: 0, totalDistanceKm: 0 };

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
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

interface DeliveryRecord {
  price: number;
  completedAt: Date;
  distanceKm: number;
}

function computePeriod(deliveries: DeliveryRecord[]): ExpensesPeriod {
  if (deliveries.length === 0) return { ...EMPTY_PERIOD };
  const total = deliveries.reduce((sum, d) => sum + (d.price || 0), 0);
  const totalDistanceKm = deliveries.reduce((sum, d) => sum + (d.distanceKm || 0), 0);
  return {
    total,
    count: deliveries.length,
    avgPerDelivery: Math.round(total / deliveries.length),
    totalDistanceKm: Math.round(totalDistanceKm * 10) / 10,
  };
}

export function useSenderExpenses(userId?: string) {
  const [completedDeliveries, setCompletedDeliveries] = useState<DeliveryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection('deliveries')
      .where('senderId', '==', userId)
      .where('status', '==', 'completed_paid')
      .onSnapshot(
        (snapshot) => {
          const items = snapshot.docs.map((doc) => {
            const data = doc.data();
            const completedAt = data.updatedAt?.toDate?.() || data.createdAt?.toDate?.() || new Date(0);
            let distanceKm = 0;
            if (data.pickup?.lat && data.destination?.lat) {
              distanceKm = getDistanceKm(
                { latitude: data.pickup.lat, longitude: data.pickup.lng },
                { latitude: data.destination.lat, longitude: data.destination.lng },
              );
            }
            return {
              price: data.suggestedPrice || data.price || 0,
              completedAt,
              distanceKm,
            };
          });
          setCompletedDeliveries(items);
          setIsLoading(false);
        },
        (error) => {
          console.warn('[useSenderExpenses] Error:', error);
          setIsLoading(false);
        },
      );

    return () => unsubscribe();
  }, [userId]);

  const expenses: SenderExpenses = useMemo(() => {
    const now = new Date();
    const thisWeekStart = getStartOfWeek(now);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const thisMonthStart = getStartOfMonth(now);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thisYearStart = getStartOfYear(now);

    const inRange = (d: Date, start: Date, end: Date) => d >= start && d < end;

    return {
      thisWeek: computePeriod(completedDeliveries.filter((d) => d.completedAt >= thisWeekStart)),
      lastWeek: computePeriod(completedDeliveries.filter((d) => inRange(d.completedAt, lastWeekStart, thisWeekStart))),
      thisMonth: computePeriod(completedDeliveries.filter((d) => d.completedAt >= thisMonthStart)),
      lastMonth: computePeriod(completedDeliveries.filter((d) => inRange(d.completedAt, lastMonthStart, thisMonthStart))),
      thisYear: computePeriod(completedDeliveries.filter((d) => d.completedAt >= thisYearStart)),
    };
  }, [completedDeliveries]);

  return { expenses, isLoading };
}
