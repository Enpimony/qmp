/// <reference lib="webworker" />

console.log('Worker script starting...');

let removeBackground: any = null;
let preload: any = null;

// Try to import the background removal library
(async () => {
  try {
    const module = await import('@imgly/background-removal');
    removeBackground = module.removeBackground;
    preload = module.preload;
    console.log('Background removal library loaded successfully');
  } catch (error) {
    console.error('Failed to load background removal library:', error);
    postMessage({ type: 'error', error: 'Failed to load background removal library' });
  }
})();

addEventListener('error', (error) => {
  console.error('Worker unhandled error:', error);
  postMessage({ type: 'error', error: `Worker error: ${error.message}` });
});

addEventListener('message', async (ev) => {
  console.log('Worker received message:', ev.data);

  // Check if library is loaded
  if (!removeBackground || !preload) {
    console.error('Background removal library not loaded yet');
    postMessage({ type: 'error', error: 'Background removal library not loaded' });
    return;
  }
  // support either transferred buffer or full file
  const { buffer, file, type, maxWidthFinal = 512 } = ev.data;
  console.log('Processing data:', { buffer: !!buffer, file: !!file, type, maxWidthFinal });
  let inputSource: Blob | File;
  try {
    console.log('Posting started message');
    postMessage({ type: 'started' });

    // Warm up model in worker if available
    try {
      // preload may be a no-op if already loaded; helps reduce first-run time
      console.log('Starting preload');
      await (preload as any)();
      console.log('Preload completed');
    } catch (preloadError) {
      // ignore preload errors
      console.log('preload error:', preloadError);
    }

    if (buffer) {
      inputSource = new Blob([buffer], { type: type || 'image/png' });
    } else if (file) {
      inputSource = file;
    } else {
      throw new Error('No image provided');
    }
    console.log('proce1');
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
      console.log('run detection');
      const finalBlob = await runDetection(inputSource, maxWidthFinal);
      postMessage({ type: 'result', blob: finalBlob });
    } catch (finalErr: any) {
      postMessage({ type: 'error', error: finalErr?.message ?? String(finalErr) });
    }
  } catch (err: any) {
    postMessage({ type: 'error', error: err?.message ?? String(err) });
  }
});
