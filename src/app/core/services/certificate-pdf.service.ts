import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Certificate } from '../interfaces/Certificate';
import {
  CERT_PAGE_HEIGHT,
  CERT_PAGE_WIDTH,
  CertificatePdfAssets,
  certificateFileName,
  drawCertificateDocument,
} from '../utils/certificate-pdf';

/** Spacing between downloads; back-to-back saves get dropped by some browsers. */
const DOWNLOAD_GAP_MS = 400;

const BACKGROUND_URL = '/certificate/certificate-background.png';
const SIGNATURE_FONT_URL = '/certificate/pacifico-regular.ttf';

/**
 * Builds the certificate PDFs in the browser, one file per certificate.
 *
 * jsPDF and the two assets are all loaded on demand — jsPDF is a large library
 * and the artwork is a third of a megabyte, so neither belongs in the bundle a
 * user downloads just to open a page. Assets are cached after the first save.
 */
@Injectable({
  providedIn: 'root',
})
export class CertificatePdfService {
  private readonly platformId = inject(PLATFORM_ID);
  private assets: CertificatePdfAssets | null = null;

  /**
   * Generates one PDF per certificate and downloads each in turn.
   *
   * Separate files rather than one multi-page document, so each certificate can
   * be filed and sent on its own. Browsers rate-limit programmatic downloads,
   * so the saves are spaced out; Chrome additionally asks once per site before
   * allowing more than one.
   */
  async save(
    certificates: Certificate[],
    onProgress?: (done: number, total: number) => void
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId) || certificates.length === 0) return;

    const [{ jsPDF }, assets] = await Promise.all([import('jspdf'), this.loadAssets()]);

    for (let index = 0; index < certificates.length; index++) {
      onProgress?.(index + 1, certificates.length);

      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'pt',
        format: [CERT_PAGE_WIDTH, CERT_PAGE_HEIGHT],
        compress: true,
      });

      drawCertificateDocument(doc, [certificates[index]], assets);
      doc.save(certificateFileName(certificates[index]));

      if (index < certificates.length - 1) {
        await delay(DOWNLOAD_GAP_MS);
      }
    }
  }

  private async loadAssets(): Promise<CertificatePdfAssets> {
    if (this.assets) return this.assets;

    const [background, signatureFontBase64] = await Promise.all([
      fetchAsDataUrl(BACKGROUND_URL),
      // A missing font is survivable: the drawing falls back to Helvetica for
      // the signature lines rather than failing the whole export.
      fetchAsBase64(SIGNATURE_FONT_URL).catch(() => undefined),
    ]);

    this.assets = { background, signatureFontBase64 };
    return this.assets;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${url}: ${response.status}`);
  }
  return response.arrayBuffer();
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // Chunked to keep the argument list well inside the call-stack limit for
  // assets of a few hundred kilobytes.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchAsBase64(url: string): Promise<string> {
  return toBase64(await fetchBuffer(url));
}

async function fetchAsDataUrl(url: string): Promise<string> {
  return `data:image/png;base64,${toBase64(await fetchBuffer(url))}`;
}
