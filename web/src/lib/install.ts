let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function listenForInstall(): void {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    listeners.forEach((fn) => fn());
  });
}

export function canInstall(): boolean {
  return deferred != null;
}

export function onInstallAvailable(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const choice = await deferred.userChoice;
  deferred = null;
  return choice.outcome === 'accepted';
}

export function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function isNativeApp(): boolean {
  try {
    const cap = (window as Window & {
      Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string };
    }).Capacitor;
    if (cap?.isNativePlatform?.()) return true;
    const platform = cap?.getPlatform?.();
    if (platform === 'android' || platform === 'ios') return true;
    const { hostname, port, protocol } = window.location;
    const localHost = /^(localhost|127\.0\.0\.1)$/i.test(hostname);
    // Capacitor androidScheme https → https://localhost (no port)
    if (localHost && !port && protocol === 'https:') return true;
    if (cap && localHost) return true;
    return false;
  } catch {
    return false;
  }
}
