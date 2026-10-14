import { Platform } from 'react-native';

type LocalAuthenticationModule = typeof import('expo-local-authentication');

export type BiometricSupport = {
  /** A screen lock or biometric exists that can protect the app. */
  available: boolean;
  /** Plain name for what the phone will ask for, used in labels. */
  method: string;
  /** Why the lock cannot be used, when it cannot. */
  reason?: string;
};

export type UnlockResult =
  | { ok: true }
  | { ok: false; message: string; disableLock?: boolean; cancelled?: boolean };

let modulePromise: Promise<LocalAuthenticationModule> | undefined;

/** Biometric unlock exists only on Android and iOS; the web build has no lock. */
export function isAppLockSupportedPlatform() {
  return Platform.OS === 'android' || Platform.OS === 'ios';
}

async function getLocalAuthentication() {
  if (!isAppLockSupportedPlatform()) return undefined;
  modulePromise ??= import('expo-local-authentication');
  return modulePromise;
}

export async function getBiometricSupport(): Promise<BiometricSupport> {
  const auth = await getLocalAuthentication();
  if (!auth) return { available: false, method: 'Screen lock', reason: 'App lock is available in the phone app.' };
  const [hardware, enrolled, level, types] = await Promise.all([
    auth.hasHardwareAsync(),
    auth.isEnrolledAsync(),
    auth.getEnrolledLevelAsync(),
    auth.supportedAuthenticationTypesAsync(),
  ]);
  const method = types.includes(auth.AuthenticationType.FACIAL_RECOGNITION)
    ? (Platform.OS === 'ios' ? 'Face ID' : 'Face unlock')
    : types.includes(auth.AuthenticationType.FINGERPRINT) ? 'Fingerprint' : 'Screen lock';
  // A PIN, pattern, or password alone still protects the app through the device fallback.
  if (level === auth.SecurityLevel.NONE) return { available: false, method, reason: 'Set up a screen lock (PIN, pattern, fingerprint, or face) in your phone settings first.' };
  return { available: true, method: hardware && enrolled ? method : 'Screen lock' };
}

export async function unlockWithDevice(promptMessage = 'Unlock LifeDesk'): Promise<UnlockResult> {
  const auth = await getLocalAuthentication();
  if (!auth) return { ok: true };
  // Keeping the device PIN fallback means a failed fingerprint can never lock you out of your own data.
  const result = await auth.authenticateAsync({ promptMessage, cancelLabel: 'Cancel', disableDeviceFallback: false, requireConfirmation: false });
  if (result.success) return { ok: true };
  switch (result.error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
      return { ok: false, cancelled: true, message: 'Unlock was cancelled.' };
    case 'lockout':
      return { ok: false, message: 'Too many attempts. Wait a moment, or unlock with your phone PIN.' };
    case 'not_enrolled':
    case 'passcode_not_set':
    case 'not_available':
      // The phone itself is no longer locked, so the app lock protects nothing.
      return { ok: false, disableLock: true, message: 'This phone no longer has a screen lock, so app lock was turned off.' };
    default:
      return { ok: false, message: 'That did not work. Try again.' };
  }
}
