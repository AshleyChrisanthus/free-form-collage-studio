export interface BackgroundRemoverOptions {
  threshold?: number; // 5 to 150, default 40
  feather?: boolean; // edge feathering band
  floodFill?: boolean; // only remove background connected to borders
  onProgress?: (progress: number, stage: string) => void;
  signal?: AbortSignal;
}

export interface BackgroundRemover {
  id: 'heuristic' | 'neural';
  isAvailable(): Promise<{ ok: boolean; reason?: string }>;
  remove(
    imageData: ImageData,
    opts?: BackgroundRemoverOptions
  ): Promise<ImageData>;
}
