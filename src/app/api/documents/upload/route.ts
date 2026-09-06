/**
 * POST /api/documents/upload — multipart upload of a real file.
 *
 * Bytes are written under `data/uploads/<member>/` and the row keeps only the
 * relative path. Size, extension and emptiness are checked before anything is
 * written; nothing is passed to another service.
 */
import { NextResponse } from 'next/server';
import { api } from '@/lib/http/handler';
import { documentUploadSchema } from '@/lib/validation/schemas';
import { createDocument } from '@/lib/data/write';
import { MAX_UPLOAD_BYTES, isAllowedExtension, storeUpload } from '@/lib/files';
import { ConstraintError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

export const POST = api({
  scope: 'documents:upload',
  limit: { max: 20, windowMs: 10 * 60_000 },
  handler: async ({ request, user }) => {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ConstraintError('Send the file as multipart form data.');
    }

    const file = form.get('file');
    if (!(file instanceof File)) throw new ConstraintError('Choose a file to attach.');
    if (file.size > MAX_UPLOAD_BYTES) throw new ConstraintError('That file is larger than 15 MB.');
    if (!isAllowedExtension(file.name)) throw new ConstraintError('Accepted: pdf, docx, xlsx, pptx, csv, txt, md, png, jpg, webp, heic.');

    const parsed = documentUploadSchema.safeParse({
      name: form.get('name') ?? file.name.replace(/\.[^.]+$/, '').slice(0, 160),
      category: form.get('category') ?? 'contracts',
      propertyId: form.get('propertyId') || null,
      owner: form.get('owner') || null,
      visibility: form.get('visibility') ?? 'private',
      expiresAt: form.get('expiresAt') || null,
      notes: form.get('notes') || null,
      tags: String(form.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 8),
    });
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (!fields[issue.path.join('.')]) fields[issue.path.join('.')] = issue.message;
      return NextResponse.json({ ok: false, error: { code: 'validation_failed', message: 'Some fields need your attention.', fields } }, { status: 422 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const stored = storeUpload(user.id, file.name, bytes);
    const document = createDocument(user.id, {
      name: parsed.data.name,
      category: parsed.data.category,
      propertyId: parsed.data.propertyId ?? null,
      owner: parsed.data.owner ?? null,
      visibility: parsed.data.visibility,
      status: 'valid',
      expiresAt: parsed.data.expiresAt ?? null,
      tags: parsed.data.tags ?? [],
      notes: parsed.data.notes ?? null,
      fileType: stored.fileType,
      sizeKb: stored.sizeKb,
      storedPath: stored.storedPath,
    });

    return { document, stored: { name: stored.safeName, sizeKb: stored.sizeKb } };
  },
});

/** Capability probe, so the interface can state the limit instead of guessing. */
export const GET = api({
  scope: 'documents:upload-capability',
  handler: () => ({ storage: 'local', maxBytes: MAX_UPLOAD_BYTES, perMinute: 20 }),
});
