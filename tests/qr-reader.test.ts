import assert from "node:assert/strict";
import { test } from "node:test";
import QRCode from "qrcode";
import { decodeQrPixels } from "../src/lib/qr-reader";

test("fallback decodes a teacher QR with the actual board colours and room URL", async () => {
  const url = "https://school-hub-ten-beryl.vercel.app/debate/join/ABC123";
  const matrix = QRCode.create(url).modules;
  const margin = 2, scale = 8, width = (matrix.size + margin * 2) * scale;
  const pixels = new Uint8ClampedArray(width * width * 4);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y / scale) - margin, column = Math.floor(x / scale) - margin;
    const dark = row >= 0 && column >= 0 && row < matrix.size && column < matrix.size && matrix.data[row * matrix.size + column];
    pixels.set(dark ? [37, 79, 64, 255] : [255, 254, 250, 255], (y * width + x) * 4);
  }
  assert.equal(await decodeQrPixels(pixels, width, width), url);
});

test("fallback does not report a QR in an empty video frame", async () => {
  assert.equal(await decodeQrPixels(new Uint8ClampedArray(64 * 64 * 4).fill(255), 64, 64), null);
});
