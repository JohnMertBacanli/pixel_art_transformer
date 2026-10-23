// Interface matching Emscripten module exports
import { Injectable } from '@angular/core';


@Injectable({
  providedIn: 'root' // <-- This tells Angular how to inject it everywhere!
})
export class DownscalerService {
  // your WASM / C++ processing code here...

  processImage(file: File, subdivisionLevel: number): void {
    // Call your WASM module methods here (e.g., using Module._process_image, malloc, free, etc.)
    console.log('Processing file with subdivision level:', subdivisionLevel);
  }
}
interface WasmModule {
  _get_gcd(a: number, b: number): number;
  _process_image(
    srcPtr: number, srcW: number, srcH: number, 
    blockSize: number, 
    dstPtr: number, dstW: number, dstH: number
  ): void;
  _malloc(size: number): number;
  _free(ptr: number): void;
  HEAPU8: Uint8Array;
}

export class PixelArtDownscaler {
  private wasm: WasmModule;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(wasmModule: WasmModule, canvasElement: HTMLCanvasElement) {
    this.wasm = wasmModule;
    this.canvas = canvasElement;
    this.ctx = canvasElement.getContext('2d')!;
  }

  public process(sourceImage: HTMLImageElement, subdivisionLevel: number): void {
    const W = sourceImage.width;
    const H = sourceImage.height;

    // 1. Calculate GCD to get maximum square macro-block size
    const gcdBase = this.wasm._get_gcd(W, H);

    // 2. Compute Target Block Size (allows fractional / sub-pixel downscaling)
    const targetBlockSize = gcdBase / Math.max(1, subdivisionLevel);

    // 3. Grid target dimensions
    const dstW = Math.max(1, Math.floor(W / targetBlockSize));
    const dstH = Math.max(1, Math.floor(H / targetBlockSize));

    // 4. Extract raw image bytes from temporary offscreen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = W;
    offCanvas.height = H;
    const offCtx = offCanvas.getContext('2d')!;
    offCtx.drawImage(sourceImage, 0, 0);
    const srcImageData = offCtx.getImageData(0, 0, W, H);

    // 5. Allocate memory buffers in WebAssembly HEAP
    const srcByteCount = W * H * 4;
    const dstByteCount = dstW * dstH * 4;

    const srcPtr = this.wasm._malloc(srcByteCount);
    const dstPtr = this.wasm._malloc(dstByteCount);

    try {
      // Copy JS Uint8ClampedArray into WASM Memory Space
      this.wasm.HEAPU8.set(srcImageData.data, srcPtr);

      // Execute C++ core dominant-color downscaling algorithm
      this.wasm._process_image(srcPtr, W, H, targetBlockSize, dstPtr, dstW, dstH);

      // Read back processed pixel array
      const outputPixels = new Uint8ClampedArray(
        this.wasm.HEAPU8.buffer, 
        dstPtr, 
        dstByteCount
      );

      // Render crisp pixel art output back to the canvas
      this.renderToCanvas(outputPixels, dstW, dstH);
    } finally {
      // Always free allocated heap pointers
      this.wasm._free(srcPtr);
      this.wasm._free(dstPtr);
    }
  }

private renderToCanvas(pixels: Uint8ClampedArray, width: number, height: number): void {
  this.canvas.width = width;
  this.canvas.height = height;

  // Disable smoothing to maintain retro pixel-art aesthetic when stretched in UI
  this.ctx.imageSmoothingEnabled = false;

  // Create a clean copy to satisfy strict TypeScript ImageData types
  const clampedPixels = new Uint8ClampedArray(pixels);
  const outputImageData = new ImageData(clampedPixels, width, height);
  this.ctx.putImageData(outputImageData, 0, 0);
}
}