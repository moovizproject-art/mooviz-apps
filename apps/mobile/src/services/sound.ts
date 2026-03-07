/**
 * SoundService — manages app sound effects
 * Uses react-native-sound to play audio from Android res/raw (and iOS bundle).
 * Completely crash-proof: disables itself on first native error so the app
 * never crashes due to sound playback.
 */
import { NativeModules, Platform } from 'react-native';

export type SoundName =
  | 'success'          // success alert, "let's start" button
  | 'question'         // question/confirmation alert
  | 'error'            // error alert
  | 'payment'          // driver gets paid / approve payment
  | 'driver_interested' // sender notified someone will take delivery
  | 'new_delivery';    // new delivery notification

// Global kill switch — once a native crash is detected, disable all sounds
let disabled = false;

// Check if the native module is actually compiled into the binary
const nativeAvailable = !!NativeModules.RNSound;

let SoundClass: any = null;
if (nativeAvailable) {
  try {
    const mod = require('react-native-sound');
    SoundClass = mod.default || mod;
    // setCategory is iOS-only; skip on Android to avoid potential crash
    if (SoundClass && Platform.OS === 'ios' && typeof SoundClass.setCategory === 'function') {
      SoundClass.setCategory('Playback');
    }
  } catch {
    SoundClass = null;
  }
}

const soundCache = new Map<SoundName, any>();

function getSound(name: SoundName): Promise<any> {
  if (!SoundClass || disabled) return Promise.reject(new Error('Sound not available'));
  const cached = soundCache.get(name);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    try {
      const basePath = Platform.OS === 'ios' ? SoundClass.MAIN_BUNDLE : undefined;
      const sound = new SoundClass(`${name}.mp3`, basePath, (error: any) => {
        if (error) {
          console.warn(`[Sound] Failed to load ${name}:`, error);
          reject(error);
          return;
        }
        soundCache.set(name, sound);
        resolve(sound);
      });
    } catch (e) {
      console.warn('[Sound] Native crash during load, disabling sound:', e);
      disabled = true;
      reject(e);
    }
  });
}

/**
 * Play a named sound effect.
 * Silently fails if native module isn't available — never crashes the app.
 * On first native error, permanently disables all future sound calls.
 */
export async function playSound(name: SoundName): Promise<void> {
  if (!SoundClass || disabled) return;
  try {
    const sound = await getSound(name);
    try {
      sound.stop(() => {
        try {
          sound.play((ok: boolean) => {
            if (!ok) console.warn(`[Sound] Playback failed for ${name}`);
          });
        } catch (e) {
          console.warn('[Sound] Native crash during play, disabling sound:', e);
          disabled = true;
        }
      });
    } catch (e) {
      console.warn('[Sound] Native crash during stop, disabling sound:', e);
      disabled = true;
    }
  } catch {
    // Silently fail — already logged in getSound
  }
}

export function releaseAllSounds(): void {
  try {
    soundCache.forEach((s) => { try { s.release(); } catch { /* ignore */ } });
  } catch { /* ignore */ }
  soundCache.clear();
}
