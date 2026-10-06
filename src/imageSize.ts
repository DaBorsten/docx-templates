import { Image } from './types';

type Size = { width: number; height: number };

function toBytes(data: Image['data']): Uint8Array {
  if (typeof data === 'string') return Buffer.from(data, 'base64');
  if (ArrayBuffer.isView(data))
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  return new Uint8Array(data);
}

const uint16 = (b: Uint8Array, i: number) => (b[i] << 8) | b[i + 1];

function pngSize(b: Uint8Array): Size | undefined {
  // Signature (8 bytes), then the IHDR chunk: length, type, width, height
  if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50) return undefined;
  return {
    width: uint16(b, 16) * 65536 + uint16(b, 18),
    height: uint16(b, 20) * 65536 + uint16(b, 22),
  };
}

function gifSize(b: Uint8Array): Size | undefined {
  // 'GIF87a' or 'GIF89a', then little-endian width and height
  if (b.length < 10 || b[0] !== 0x47 || b[1] !== 0x49) return undefined;
  return { width: b[6] | (b[7] << 8), height: b[8] | (b[9] << 8) };
}

function jpegSize(b: Uint8Array): Size | undefined {
  if (b[0] !== 0xff || b[1] !== 0xd8) return undefined;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return undefined;
    const marker = b[i + 1];
    if (marker === 0xff) {
      // Fill byte
      i += 1;
      continue;
    }
    // SOF0..SOF15 hold the frame size, except DHT (C4), JPG (C8) and DAC (CC)
    const isFrame =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc;
    if (isFrame) return { height: uint16(b, i + 5), width: uint16(b, i + 7) };
    i += 2 + uint16(b, i + 2);
  }
  return undefined;
}

function svgSize(b: Uint8Array): Size | undefined {
  let text = '';
  for (let i = 0; i < b.length && i < 8192; i++) {
    text += String.fromCharCode(b[i]);
  }
  const tag = /<svg\b[^>]*>/i.exec(text);
  if (!tag) return undefined;
  const attr = (name: string) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`).exec(tag[0]);
    return m ? m[1].trim() : undefined;
  };
  // Only the ratio matters, so absolute units don't need converting as long as both match.
  const length = /^(\d*\.?\d+)([a-z]*)$/i;
  const w = length.exec(attr('width') ?? '');
  const h = length.exec(attr('height') ?? '');
  if (w && h && w[2] === h[2]) {
    return { width: Number(w[1]), height: Number(h[1]) };
  }
  const viewBox = (attr('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (viewBox.length === 4) return { width: viewBox[2], height: viewBox[3] };
  return undefined;
}

/**
 * Reads the width / height ratio of an image from its header.
 * Returns undefined when it cannot be determined.
 */
export function getImageAspectRatio(image: Image): number | undefined {
  const bytes = toBytes(image.data);
  const size =
    image.extension === '.png'
      ? pngSize(bytes)
      : image.extension === '.gif'
      ? gifSize(bytes)
      : image.extension === '.svg'
      ? svgSize(bytes)
      : jpegSize(bytes);
  if (!size || !(size.width > 0) || !(size.height > 0)) return undefined;
  return size.width / size.height;
}
