import { useState, useEffect, useCallback, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

const DEBOUNCE_MS = 300;

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNetworkChange = useCallback((state: NetInfoState) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setStatus({
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
      });
    }, DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(handleNetworkChange);

    // Fetch initial state
    NetInfo.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleNetworkChange]);

  return status;
}
