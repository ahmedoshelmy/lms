import {
  DOCUMENT,
  Injectable,
  InjectionToken,
  PLATFORM_ID,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Whether to register the service worker: production builds only. */
export const SERVICE_WORKER_ENABLED = new InjectionToken<boolean>('SERVICE_WORKER_ENABLED', {
  providedIn: 'root',
  factory: () => !isDevMode(),
});

/** How often a tab left open asks whether a new version is out. */
export const UPDATE_CHECK_MS = 6 * 60 * 60 * 1000;

/** Chrome's install offer; not in the DOM typings. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
}

/**
 * The app as an installed app: whether it is online, whether a new version is
 * waiting, and whether the browser offers to install it.
 *
 * The service worker (Angular's, configured in ngsw-config.json) keeps the
 * app's own files only -- never an API response, as the data is about children
 * and devices are shared. It is driven here with the browser's own APIs rather
 * than @angular/service-worker's client, which would add its weight to the
 * first download for what is a message listener and an interval.
 */
@Injectable({ providedIn: 'root' })
export class PwaService {
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly workerEnabled = inject(SERVICE_WORKER_ENABLED);

  readonly online = signal(true);
  /** A new version has been downloaded; a reload starts it. */
  readonly updateReady = signal(false);
  /**
   * The worker found this version's files no longer match the server's
   * (UNRECOVERABLE_STATE): a reload is the way back to a working app.
   */
  readonly needsReload = signal(false);
  /** The browser has offered to install the app, and it has not been taken up yet. */
  readonly canInstall = signal(false);

  private installOffer: InstallPromptEvent | null = null;
  private started = false;

  /** Puts the update bar away until the next new version. */
  later(): void {
    this.updateReady.set(false);
  }

  /** Called once, by the root component. */
  start(): void {
    const win = this.document.defaultView;
    if (!this.isBrowser || !win || this.started) return;
    this.started = true;

    this.online.set(win.navigator.onLine);
    win.addEventListener('online', () => this.online.set(true));
    win.addEventListener('offline', () => this.online.set(false));

    win.addEventListener('beforeinstallprompt', (event) => {
      // Kept for the "Install app" button rather than shown at once.
      event.preventDefault();
      this.installOffer = event as InstallPromptEvent;
      this.canInstall.set(true);
    });
    win.addEventListener('appinstalled', () => {
      this.installOffer = null;
      this.canInstall.set(false);
    });

    if (this.workerEnabled && 'serviceWorker' in win.navigator) this.registerWorker(win);
  }

  /**
   * Starts the new version. The pages that hold typed work (the register, the
   * monthly report) ask before it is lost, through beforeunload; the bar sits
   * beneath dialogs, so Reload cannot be pressed while one is open.
   */
  reload(): void {
    this.document.defaultView?.location.reload();
  }

  async install(): Promise<void> {
    const offer = this.installOffer;
    if (!offer) return;
    // An offer can be used once.
    this.installOffer = null;
    this.canInstall.set(false);
    await offer.prompt();
  }

  private registerWorker(win: Window): void {
    const workers = win.navigator.serviceWorker;
    workers.addEventListener('message', (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === 'VERSION_READY') this.updateReady.set(true);
      if (type === 'UNRECOVERABLE_STATE') this.needsReload.set(true);
    });

    // After the page has loaded: the worker fetches the whole app, and that
    // should not compete with the first screen.
    const register = () =>
      workers
        .register('ngsw-worker.js')
        .then((registration) => {
          // To the registered worker, not navigator.serviceWorker.controller:
          // a page opened with a hard reload has no controller, and its check
          // would go nowhere for as long as the tab stayed open.
          win.setInterval(
            () =>
              (registration.active ?? workers.controller)?.postMessage({
                action: 'CHECK_FOR_UPDATES',
                nonce: Math.floor(Math.random() * 1e9),
              }),
            UPDATE_CHECK_MS
          );
        })
        // Without the worker the app still works, only not offline.
        .catch(() => undefined);

    if (this.document.readyState === 'complete') register();
    else win.addEventListener('load', register, { once: true });
  }
}
