/**
 * Local document storage.
 *
 * Files live under `data/uploads/<userId>/` and the database only ever holds a
 * path *relative* to that root. Two consequences, both deliberate:
 *   · a member cannot point a record at an arbitrary file (the row is the only
 *     source of the path, and it is resolved under the root before reading);
 *   · moving storage to S3 or a private bucket later is one function, not a
 *     schema change.
 *
 * Files are stored with a sanitised name, an allow-listed extension, and are
 * always served back with `Content-Disposition: attachment` so a browser never
 * renders an uploaded document inline. There is no virus scanning in this
 * build — say so plainly rather than implying a control that is absent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { newId } from '@/lib/db';

const ROOT_RELATIVE = path.join('data', 'uploads');

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** Extension → the `file_type` recorded on the document row. */
const ALLOWED: Record<string, string> = {
  '.pdf': 'pdf',
  '.png': 'png',
  '.jpg': 'jpg',
  '.jpeg': 'jpg',
  '.webp': 'webp',
  '.heic': 'heic',
  '.txt': 'txt',
  '.md': 'md',
  '.csv': 'csv',
  '.docx': 'docx',
  '.xlsx': 'xlsx',
  '.pptx': 'pptx',
};

export type StoredFile = { storedPath: string; fileType: string; sizeKb: number; safeName: string };

export function uploadsRoot(): string {
  return path.join(process.cwd(), ROOT_RELATIVE);
}

export function sanitiseName(name: string): { safeName: string; extension: string | null; fileType: string } {
  const base = path.basename(name).replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim();
  const extension = path.extname(base).toLowerCase();
  const fileType = ALLOWED[extension];
  return {
    safeName: (base.slice(0, 120) || 'document'),
    extension: fileType ? extension : null,
    fileType: fileType ?? 'pdf',
  };
}

export function isAllowedExtension(name: string): boolean {
  return sanitiseName(name).extension !== null;
}

/** Write bytes for a member; returns the relative path to store. */
export function storeUpload(userId: string, originalName: string, bytes: Buffer): StoredFile {
  const { safeName, extension, fileType } = sanitiseName(originalName);
  if (!extension) throw new Error('That file type is not accepted.');
  if (bytes.byteLength === 0) throw new Error('That file is empty.');
  if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new Error('That file is larger than 15 MB.');

  const directory = path.join(uploadsRoot(), safeSegment(userId));
  fs.mkdirSync(directory, { recursive: true });
  const fileName = `${newId('file')}${extension}`;
  fs.writeFileSync(path.join(directory, fileName), bytes, { mode: 0o600 });

  return {
    storedPath: path.posix.join(safeSegment(userId), fileName),
    fileType,
    sizeKb: Math.max(1, Math.round(bytes.byteLength / 1024)),
    safeName,
  };
}

/** Absolute path for a stored relative path, refusing anything outside the root. */
export function resolveStored(storedPath: string): string | null {
  const root = uploadsRoot();
  const absolute = path.resolve(root, storedPath);
  if (absolute !== root && !absolute.startsWith(root + path.sep)) return null;
  return fs.existsSync(absolute) ? absolute : null;
}

export function removeStoredFile(storedPath: string): void {
  const absolute = resolveStored(storedPath);
  if (!absolute) return;
  try {
    fs.unlinkSync(absolute);
  } catch {
    /* a missing file is not a failure worth surfacing to a member */
  }
}

function safeSegment(value: string): string {
  return value.replace(/[^\w-]/g, '').slice(0, 60) || 'misc';
}
