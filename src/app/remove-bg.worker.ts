/// <reference lib="webworker" />
import { removeBackground, preload } from '@imgly/background-removal';

addEventListener('message', async (ev) => {
  // support either transferred buffer or full file
  const { buffer, file, type, maxWidthPreview = 256, maxWidthFinal = 512 } = ev.data;
  let inputSource: Blob | File;
  try {
    postMessage({ type: 'started' });

    // Warm up model in worker if available
    try {
      // preload may be a no-op if already loaded; helps reduce first-run time
      await (preload as any)();
    } catch {
      // ignore preload errors
    }

    if (buffer) {
      inputSource = new Blob([buffer], { type: type || 'image/png' });
    } else if (file) {
      inputSource = file;
    } else {
      throw new Error('No image provided');
    }

    // helper to scale and run detection
    const runDetection = async (source: Blob | File, maxWidth: number) => {
      try {
        const imgBitmap = await createImageBitmap(source);
        let scaled: Blob | File = source;
        if (imgBitmap.width > maxWidth) {
          const scale = maxWidth / imgBitmap.width;
          const w = Math.round(imgBitmap.width * scale);
          const h = Math.round(imgBitmap.height * scale);
          const offCanvas = new OffscreenCanvas(w, h);
          const ctx = offCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(imgBitmap, 0, 0, w, h);
            if ((offCanvas as any).convertToBlob) {
              scaled = await (offCanvas as any).convertToBlob({
                type: (source as File).type || 'image/png',
              });
            }
          }
        }
        // run removeBackground and forward progress messages
        const config = {
          progress: (_key: string, current: number, total: number) => {
            postMessage({ type: 'progress', progress: Math.round((current / total) * 100) });
          },
          debug: false,
          execution_providers: ['wasm'], // Prioritza WebGPU sobre WASM
          model: 'small',
        } as any;
        console.log('init detect');
        const resultBlob: Blob = await removeBackground(scaled, config);
        console.log('end detect');
        return resultBlob;
      } catch (err) {
        throw err;
      }
    };

    // 2) final (higher-res) -> replace preview
    try {
      const finalBlob = await runDetection(inputSource, maxWidthFinal);
      postMessage({ type: 'result', blob: finalBlob });
    } catch (finalErr: any) {
      postMessage({ type: 'error', error: finalErr?.message ?? String(finalErr) });
    }
  } catch (err: any) {
    postMessage({ type: 'error', error: err?.message ?? String(err) });
  }
});
