import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PwaStatusComponent } from '../../shared/components/pwa-status/pwa-status.component';
import { PwaService, SERVICE_WORKER_ENABLED, UPDATE_CHECK_MS } from './pwa.service';

/** A stand-in for navigator.serviceWorker, which jsdom does not have. */
function fakeWorkers() {
  const listeners: ((event: MessageEvent) => void)[] = [];
  const workers = {
    register: vi.fn(() => Promise.resolve({})),
    controller: { postMessage: vi.fn() },
    addEventListener: (_type: string, listener: (event: MessageEvent) => void) =>
      listeners.push(listener),
    send: (data: unknown) => listeners.forEach((l) => l(new MessageEvent('message', { data }))),
  };
  Object.defineProperty(window.navigator, 'serviceWorker', { value: workers, configurable: true });
  return workers;
}

function start(workerEnabled = false) {
  TestBed.configureTestingModule({
    providers: [{ provide: SERVICE_WORKER_ENABLED, useValue: workerEnabled }],
  });
  const pwa = TestBed.inject(PwaService);
  pwa.start();
  return pwa;
}

describe('PwaService', () => {
  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window.navigator, 'serviceWorker');
  });

  it('follows the connection going and coming back', () => {
    const pwa = start();

    window.dispatchEvent(new Event('offline'));
    expect(pwa.online()).toBe(false);
    window.dispatchEvent(new Event('online'));
    expect(pwa.online()).toBe(true);
  });

  it("keeps the browser's install offer for the button, and uses it once", async () => {
    const pwa = start();
    const offer = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
      prompt: vi.fn(() => Promise.resolve()),
    });

    window.dispatchEvent(offer);
    // Not shown by the browser on its own.
    expect(offer.defaultPrevented).toBe(true);
    expect(pwa.canInstall()).toBe(true);

    await pwa.install();
    await pwa.install();
    expect(offer.prompt).toHaveBeenCalledTimes(1);
    expect(pwa.canInstall()).toBe(false);
  });

  it('registers no worker in a development build', () => {
    const workers = fakeWorkers();
    start(false);
    expect(workers.register).not.toHaveBeenCalled();
  });

  it('registers the worker, says when a new version is ready, and checks for one', async () => {
    vi.useFakeTimers();
    const workers = fakeWorkers();
    const pwa = start(true);
    await vi.waitFor(() => expect(workers.register).toHaveBeenCalledWith('ngsw-worker.js'));
    await Promise.resolve();

    workers.send({ type: 'VERSION_DETECTED' });
    expect(pwa.updateReady()).toBe(false);
    workers.send({ type: 'VERSION_READY' });
    expect(pwa.updateReady()).toBe(true);

    vi.advanceTimersByTime(UPDATE_CHECK_MS);
    expect(workers.controller.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CHECK_FOR_UPDATES' })
    );
  });
});

describe('PwaStatusComponent', () => {
  it('says when the app is offline, and offers the new version', () => {
    const fixture = TestBed.createComponent(PwaStatusComponent);
    const pwa = TestBed.inject(PwaService);
    const reload = vi.spyOn(pwa, 'reload').mockImplementation(() => undefined);
    const el = fixture.nativeElement as HTMLElement;

    pwa.online.set(false);
    pwa.updateReady.set(true);
    fixture.detectChanges();

    expect(el.querySelector('[role="status"]')?.textContent).toContain("You're offline");
    el.querySelector<HTMLButtonElement>('button')!.click();
    expect(reload).toHaveBeenCalled();
  });
});
