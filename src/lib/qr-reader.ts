export type BarcodeReader = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> };

export async function decodeQrPixels(pixels: Uint8ClampedArray, width: number, height: number) {
  const { default: jsQR } = await import("jsqr");
  return jsQR(pixels, width, height, { inversionAttempts: "attemptBoth" })?.data || null;
}

export async function createBarcodeReader(): Promise<BarcodeReader> {
  const Detector = (window as unknown as { BarcodeDetector?: {
    new (options: { formats: string[] }): BarcodeReader;
    getSupportedFormats?: () => Promise<string[]>;
  } }).BarcodeDetector;
  if (Detector) {
    try {
      if (!Detector.getSupportedFormats || (await Detector.getSupportedFormats()).includes("qr_code")) {
        return new Detector({ formats: ["qr_code"] });
      }
    } catch { /* Use the local decoder if the native implementation is unavailable. */ }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not initialize QR scanning.");
  return { async detect(video) {
    if (!video.videoWidth || !video.videoHeight) return [];
    const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale); canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = context.getImageData(0, 0, canvas.width, canvas.height);
    const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "attemptBoth" });
    return result ? [{ rawValue: result.data }] : [];
  } };
}
