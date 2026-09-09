import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Page } from 'playwright';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';

const BLANK_STANDARD_DEVIATION = 3.0;

/** PNG を保存し、実画素から一様な画面を判定する。 */
export class PageCapturer {
  /** 保存先の規則を受け取る。 */
  constructor(private readonly layout: DebugOutputLayout) {}

  /** PNG の画素寸法と輝度判定を返す。 */
  async capture(page: Page, options: { name: string; directory?: string; fullPage?: boolean }): Promise<{ path: string; width: number; height: number; blank: boolean }> {
    const path = this.layout.capture(options.name, options.directory);
    await mkdir(dirname(path), { recursive: true });
    const buffer = await page.screenshot({ path, type: 'png', fullPage: options.fullPage ?? false });
    // DOM へ追加しない canvas なので観測履歴とレイアウトに影響しない。
    const dimensions = await page.evaluate(async ({ source, threshold }) => {
      const bytes = Uint8Array.from(atob(source), character => character.charCodeAt(0));
      // URL を読み込まないため、アプリの img-src CSP に撮影判定を依存させない。
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      if (!context) { image.close(); throw new Error('画素読み取り用 canvas を作成できません'); }
      try { context.drawImage(image, 0, 0); }
      finally { image.close(); }
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const channelsPerPixel = 4;
      const greenOffset = 1;
      const blueOffset = 2;
      const redWeight = 0.2126;
      const greenWeight = 0.7152;
      const blueWeight = 0.0722;
      let mean = 0;
      let squaredDeviation = 0;
      let count = 0;
      for (let offset = 0; offset < pixels.length; offset += channelsPerPixel) {
        const luminance = pixels[offset]! * redWeight + pixels[offset + greenOffset]! * greenWeight + pixels[offset + blueOffset]! * blueWeight;
        count += 1;
        const difference = luminance - mean;
        mean += difference / count;
        squaredDeviation += difference * (luminance - mean);
      }
      return { width: canvas.width, height: canvas.height, blank: Math.sqrt(squaredDeviation / count) < threshold };
    }, { source: buffer.toString('base64'), threshold: BLANK_STANDARD_DEVIATION });
    return { path, ...dimensions };
  }
}
