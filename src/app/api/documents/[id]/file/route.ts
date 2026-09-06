/**
 * GET /api/documents/[id]/file — stream a member's own stored file.
 *
 * The path comes from the row, never from the request, and is resolved under
 * the uploads root before it is opened. The response is always an attachment so
 * an uploaded document cannot execute in the browser.
 */
import fs from 'node:fs';
import path from 'node:path';
import { api } from '@/lib/http/handler';
import { getDb } from '@/lib/db';
import { resolveStored } from '@/lib/files';
import { NotFoundError } from '@/lib/db';
import { fail } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

/**
 * RFC 6266 filename for a download.
 *
 * Header values are byte strings: a document called «Villa Azure — glass
 * insurance» (em dash, U+2014) would otherwise throw and turn the download
 * into a 500. So the ASCII form is sanitised for old clients and the exact
 * name travels percent-encoded in `filename*` for modern ones.
 */
function disposition(name: string, fallback: string): string {
  const ascii = (raw: string) =>
    raw
      // eslint-disable-next-line no-control-regex
      .replace(/[^\x20-\x7e]/g, '_')
      .replace(/["\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80);
  const shown = ascii(name) || ascii(fallback) || 'document';
  const encoded = encodeURIComponent(name.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 120));
  return `attachment; filename="${shown}"; filename*=UTF-8''${encoded}`;
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export const GET = api<{ id: string }>({
  scope: 'documents:file',
  handler: ({ user, params }) => {
    const row = getDb().get<{ name: string; file_type: string; stored_path: string | null }>(
      `SELECT name, file_type, stored_path FROM documents WHERE id = @id AND user_id = @userId`,
      { id: params.id, userId: user.id },
    );
    if (!row) throw new NotFoundError('That document is not in your records.');
    if (!row.stored_path) return fail(409, 'no_file', 'This record has no file attached — it holds the details only.');

    const absolute = resolveStored(row.stored_path);
    if (!absolute) return fail(410, 'file_missing', 'The stored file is no longer on this volume.');

    const bytes = fs.readFileSync(absolute);
    const fallback = path.basename(absolute);
    return new Response(bytes, {
      headers: {
        'content-type': MIME[row.file_type] ?? 'application/octet-stream',
        'content-disposition': disposition(row.name, fallback),
        'content-length': String(bytes.byteLength),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  },
});
