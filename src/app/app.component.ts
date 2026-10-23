import { Component, ElementRef, ViewChild, computed, signal } from '@angular/core';
 
@Component({
  selector: 'app-root',
  standalone: true,
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  @ViewChild('outputCanvas', { static: true })
  outputCanvas!: ElementRef<HTMLCanvasElement>;
 
  // UI state (signals so the view always updates)
  factor = signal(4);          // size of one "pixel" block in source pixels
  smooth = signal(false);      // false = crisp nearest-neighbor, true = blended colors
  fileName = signal('');
  originalUrl = signal('');
  outW = signal(0);
  outH = signal(0);
 
  private image = signal<HTMLImageElement | null>(null);
  hasImage = computed(() => this.image() !== null);
 
  private frame = 0;
 
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
 
    if (this.originalUrl()) URL.revokeObjectURL(this.originalUrl());
    const url = URL.createObjectURL(file);
 
    const img = new Image();
    img.onload = () => {
      this.image.set(img);
      this.scheduleRender();
    };
    img.src = url;
 
    this.fileName.set(file.name);
    this.originalUrl.set(url);
  }
 
  onSubdivisionChange(event: Event): void {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.factor.set(isNaN(value) ? 1 : value);
    this.scheduleRender();
  }
 
  onSmoothChange(event: Event): void {
    this.smooth.set((event.target as HTMLInputElement).checked);
    this.scheduleRender();
  }
 
  download(): void {
    if (!this.hasImage()) return;
    const link = document.createElement('a');
    const base = this.fileName().replace(/\.[^.]+$/, '') || 'image';
    link.download = `${base}_pixel_${this.outW()}x${this.outH()}.png`;
    link.href = this.outputCanvas.nativeElement.toDataURL('image/png');
    link.click();
  }
 
  // Batch rapid slider moves into one redraw per animation frame
  private scheduleRender(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.render());
  }
 
  private render(): void {
    const img = this.image();
    if (!img) return;
 
    const f = Math.max(1, this.factor());
    const w = Math.max(1, Math.round(img.naturalWidth / f));
    const h = Math.max(1, Math.round(img.naturalHeight / f));
 
    const canvas = this.outputCanvas.nativeElement;
    canvas.width = w;
    canvas.height = h;
 
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = this.smooth();
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
 
    this.outW.set(w);
    this.outH.set(h);
  }
}