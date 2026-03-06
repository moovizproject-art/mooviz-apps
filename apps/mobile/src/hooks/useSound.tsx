/**
 * useSound — hook + context for app sound effects with mute toggle
 * Persists mute preference to AsyncStorage.
 */
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { playSound as playSoundRaw, SoundName } from '../services/sound';

const SOUND_ENABLED_KEY = '@sound_enabled';

interface SoundContextValue {
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  play: (name: SoundName) => void;
}

const SoundContext = createContext<SoundContextValue | undefined>(undefined);

export function SoundProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [soundEnabled, setSoundEnabledState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(SOUND_ENABLED_KEY).then((val) => {
      if (val !== null) {
        setSoundEnabledState(val === 'true');
      }
    });
  }, []);

  const setSoundEnabled = useCallback((enabled: boolean) => {
    setSoundEnabledState(enabled);
    AsyncStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
  }, []);

  const play = useCallback((name: SoundName) => {
    if (soundEnabled) {
      playSoundRaw(name);
    }
  }, [soundEnabled]);

  return (
    <SoundContext.Provider value={{ soundEnabled, setSoundEnabled, play }}>
      {children}
    </SoundContext.Provider>
  );
}

export function useSound(): SoundContextValue {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
}

export type { SoundName };
