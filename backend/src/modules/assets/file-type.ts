// Identifies uploaded media from its leading bytes. The browser-declared MIME type
// and file extension are not trusted: a mislabeled HTML/SVG file served back with
// an image type could otherwise be used for stored XSS.

export type AssetKind = 'IMAGE' | 'AUDIO';

export interface DetectedType {
  kind: AssetKind;
  mimeType: string;
}

function ascii(buf: Buffer, start: number, end: number): string {
  return buf.subarray(start, end).toString('latin1');
}

export function detectMediaType(buf: Buffer): DetectedType | null {
  if (buf.length < 12) return null;

  // Images
  if (buf[0] === 0x89 && ascii(buf, 1, 4) === 'PNG') return { kind: 'IMAGE', mimeType: 'image/png' };
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { kind: 'IMAGE', mimeType: 'image/jpeg' };
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return { kind: 'IMAGE', mimeType: 'image/gif' };
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return { kind: 'IMAGE', mimeType: 'image/webp' };

  // Audio
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WAVE') return { kind: 'AUDIO', mimeType: 'audio/wav' };
  if (ascii(buf, 0, 4) === 'OggS') return { kind: 'AUDIO', mimeType: 'audio/ogg' };
  if (ascii(buf, 0, 4) === 'fLaC') return { kind: 'AUDIO', mimeType: 'audio/flac' };
  if (ascii(buf, 0, 3) === 'ID3') return { kind: 'AUDIO', mimeType: 'audio/mpeg' };
  // MPEG audio frame sync (11 set bits) with layer bits != 00.
  if (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0 && (buf[1] & 0x06) !== 0) return { kind: 'AUDIO', mimeType: 'audio/mpeg' };
  // ADTS AAC
  if (buf[0] === 0xff && (buf[1] & 0xf6) === 0xf0) return { kind: 'AUDIO', mimeType: 'audio/aac' };
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12);
    if (['M4A ', 'M4B ', 'mp42', 'isom', 'dash'].includes(brand)) return { kind: 'AUDIO', mimeType: 'audio/mp4' };
  }
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { kind: 'AUDIO', mimeType: 'audio/webm' };

  return null;
}
