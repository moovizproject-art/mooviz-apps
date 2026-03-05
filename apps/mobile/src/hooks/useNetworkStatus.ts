import { useState, useEffect, useCallback, useRef } from 'react';

interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

const DEBOUNCE_MS = 300;

// Lazy-load NetInfo to gracefully handle missing native module
let NetInfoModule: typeof import('@react-native-community/netinfo').default | null = null;
try {
  NetInfoModule = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo native module not linked — default to connected
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleNetworkChange = useCallback((state: any) => {
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
    if (!NetInfoModule) {
      return;
    }

    const unsubscribe = NetInfoModule.addEventListener(handleNetworkChange);
    NetInfoModule.fetch().then(handleNetworkChange);

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [handleNetworkChange]);

  return status;
}
