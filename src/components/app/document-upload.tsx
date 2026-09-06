'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Paperclip, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { SelectField, TextArea, TextField } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { ApiClientError, apiRequest } from '@/lib/http/client';
import { DOCUMENT_CATEGORIES, STATUS_LABEL, label as humanise } from '@/lib/utils/format';

const MAX_MB = 15;
const ACCEPT = '.pdf,.docx,.xlsx,.pptx,.csv,.txt,.md,.png,.jpg,.jpeg,.webp,.heic';

export function DocumentUpload({
  properties,
  defaultPropertyId,
}: {
  properties: { id: string; name: string }[];
  defaultPropertyId?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [values, setValues] = useState({ name: '', category: 'contracts', propertyId: defaultPropertyId ?? '', owner: '', visibility: 'private', expiresAt: '', tags: '', notes: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  function pick(next: File | null) {
    setFile(next);
    if (next && !values.name) setValues((current) => ({ ...current, name: next.name.replace(/\.[^.]+$/, '').slice(0, 120) }));
  }

  async function submit() {
    if (!file) {
      setErrors({ file: 'Choose a file first.' });
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErrors({ file: `That file is larger than ${MAX_MB} MB.` });
      return;
    }
    setPending(true);
    setErrors({});
    const form = new FormData();
    form.append('file', file);
    form.append('name', values.name || file.name.replace(/\.[^.]+$/, ''));
    form.append('category', values.category);
    if (values.propertyId) form.append('propertyId', values.propertyId);
    if (values.owner) form.append('owner', values.owner);
    form.append('visibility', values.visibility);
    if (values.expiresAt) form.append('expiresAt', values.expiresAt);
    if (values.tags) form.append('tags', values.tags);
    if (values.notes) form.append('notes', values.notes);

    try {
      await apiRequest('/api/documents/upload', { method: 'POST', body: form });
      toast.success('Filed', `${file.name} is stored against this record.`);
      setOpen(false);
      setFile(null);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) setErrors(caught.fields);
      toast.error('Not uploaded', caught instanceof Error ? caught.message : 'Try again in a moment.');
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <Button type="button" variant="gold-outline" size="md" icon={<Upload size={13} strokeWidth={1.4} />} onClick={() => setOpen(true)}>
        Upload a file
      </Button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Attach a document"
        eyebrow="Records"
        description="The file is written to this machine under your own member folder. Nothing is sent to a third-party store."
        size="md"
        loading={pending}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit} loading={pending} icon={<Paperclip size={13} strokeWidth={1.4} />}>
              Store it
            </Button>
          </>
        }
      >
        <div className="space-y-5">
          <label
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              pick(event.dataTransfer.files?.[0] ?? null);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[5px] border border-dashed border-ivory-200/15 bg-ink-950/50 px-6 py-9 text-center transition-colors duration-300 hover:border-gold-400/45"
          >
            <input ref={inputRef} type="file" accept={ACCEPT} className="sr-only" onChange={(event) => pick(event.target.files?.[0] ?? null)} />
            {file ? (
              <>
                <p className="text-[13px] text-ivory-50">{file.name}</p>
                <p className="text-[11.5px] text-graphite-500">{(file.size / 1024).toFixed(0)} KB · click to choose another</p>
              </>
            ) : (
              <>
                <p className="text-[13px] text-graphite-200">Drop a file, or choose one</p>
                <p className="text-[11.5px] text-graphite-500">pdf · docx · xlsx · pptx · csv · txt · md · png · jpg · webp · heic — up to {MAX_MB} MB</p>
              </>
            )}
          </label>
          {errors.file ? <p className="text-[12px] text-state-risk">{errors.file}</p> : null}

          <TextField label="Record it as" value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} error={errors.name} placeholder={file ? file.name.replace(/\.[^.]+$/, '') : 'Building insurance 2026'} />

          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField
              label="Category"
              value={values.category}
              onChange={(e) => setValues({ ...values, category: e.target.value })}
              options={DOCUMENT_CATEGORIES.map((value) => ({ value, label: humanise(value, STATUS_LABEL) }))}
            />
            <SelectField
              label="Residence"
              value={values.propertyId}
              onChange={(e) => setValues({ ...values, propertyId: e.target.value })}
              placeholder="Not specific to one"
              options={properties.map((property) => ({ value: property.id, label: property.name }))}
            />
            <TextField label="Held by" value={values.owner} onChange={(e) => setValues({ ...values, owner: e.target.value })} error={errors.owner} placeholder="Family office, Lausanne" hint="Who physically keeps the original." />
            <TextField label="Expires" type="date" value={values.expiresAt} onChange={(e) => setValues({ ...values, expiresAt: e.target.value })} error={errors.expiresAt} />
            <SelectField
              label="Visibility"
              value={values.visibility}
              onChange={(e) => setValues({ ...values, visibility: e.target.value })}
              options={[
                { value: 'private', label: 'Private to you' },
                { value: 'household', label: 'Household staff' },
                { value: 'advisers', label: 'Advisers' },
              ]}
            />
            <TextField label="Tags" value={values.tags} onChange={(e) => setValues({ ...values, tags: e.target.value })} error={errors.tags} placeholder="insurance, renewal" hint="Comma separated." />
          </div>

          <TextArea label="Notes" value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} rows={3} max={600} error={errors.notes} />

          <AnimatePresence>
            {errors.form ? (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="alert" className="text-[12.5px] text-state-risk">
                {errors.form}
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </Modal>
    </>
  );
}
