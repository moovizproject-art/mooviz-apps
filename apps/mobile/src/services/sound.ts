/**
 * SoundService — manages app sound effects
 * Uses react-native-sound to play audio from Android res/raw (and iOS bundle).
 * The native module must be compiled into the APK — use `nativeAvailable` guard.
 */
import { NativeModules } from 'react-native';

export type SoundName =
  | 'success'          // success alert, "let's start" button
  | 'question'         // question/confirmation alert
  | 'error'            // error alert
  | 'payment'          // driver gets paid / approve payment
  | 'driver_interested' // sender notified someone will take delivery
  | 'new_delivery';    // new delivery notification

// Check if the native module is actually compiled into the binary
const nativeAvailable = !!NativeModules.RNSound;

let SoundClass: any = null;
if (nativeAvailable) {
  try {
    const mod = require('react-native-sound');
    SoundClass = mod.default || mod;
    if (SoundClass && typeof SoundClass.setCategory === 'function') {
      SoundClass.setCategory('Playback');
    }
  } catch {
    SoundClass = null;
  }
}

const soundCache = new Map<SoundName, any>();

function getSound(name: SoundName): Promise<any> {
  if (!SoundClass) return Promise.reject(new Error('Sound not available'));
  const cached = soundCache.get(name);
  if (cached) return Promise.resolve(cached);

  return new Promise((resolve, reject) => {
    const sound = new SoundClass(`${name}.mp3`, SoundClass.MAIN_BUNDLE, (error: any) => {
      if (error) {
        reject(error);
        return;
      }
      soundCache.set(name, sound);
      resolve(sound);
    });
  });
}

/**
 * Play a named sound effect.
 * Silently fails if native module isn't available — never crashes the app.
 */
export async function playSound(name: SoundName): Promise<void> {
  if (!SoundClass) return;
  try {
    const sound = await getSound(name);
    sound.stop(() => {
      sound.play();
    });
  } catch {
    // Silently fail
  }
}

export function releaseAllSounds(): void {
  soundCache.forEach((s) => s.release());
  soundCache.clear();
}
