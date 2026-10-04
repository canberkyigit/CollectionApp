import { useRef, useState } from 'react';
import { AlertTriangle, Download, ExternalLink, FileText, ImageIcon, Paperclip, Plus, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useT } from '@/i18n';
import { cn, formatDate, formatNumber, slugify } from '@/lib/utils';
import {
  DOCUMENT_MIME_TYPES,
  DocumentUploadError,
  MAX_DOCUMENT_BYTES,
  MAX_OFFLINE_DOCUMENT_BYTES,
  storageService,
  uploadDocument,
  validateDocumentFile,
} from '@/services/storageService';
import { useAuthStore } from '@/store/useAuthStore';
import { useCollectionStore } from '@/store/useCollectionStore';
import type { CollectionItem, ProvenanceDocument } from '@/types';

const DOCUMENT_TYPES: ProvenanceDocument['type'][] = ['receipt', 'certificate', 'appraisal', 'manual', 'other'];

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${formatNumber(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${formatNumber(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
}

function isImageDocument(document: ProvenanceDocument): boolean {
  if (document.mimeType) return document.mimeType.startsWith('image/');
  return /^data:image\//.test(document.url) || /\.(jpe?g|png|webp)(\?|$)/i.test(document.url);
}

function fileExtension(document: ProvenanceDocument): string {
  if (document.mimeType === 'application/pdf' || document.url.startsWith('data:application/pdf')) return 'pdf';
  if (document.mimeType?.startsWith('image/')) return document.mimeType.slice(6).replace('jpeg', 'jpg');
  return document.url.match(/\.(pdf|jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? 'pdf';
}

/** Data URLs can't be opened as top-level tabs in modern browsers — go through a blob URL. */
async function openDocument(document: ProvenanceDocument): Promise<void> {
  if (!document.url.startsWith('data:')) {
    window.open(document.url, '_blank', 'noopener,noreferrer');
    return;
  }
  const blob = await (await fetch(document.url)).blob();
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function downloadDocument(document: ProvenanceDocument): void {
  const link = window.document.createElement('a');
  link.href = document.url;
  link.download = `${slugify(document.title)}.${fileExtension(document)}`;
  link.rel = 'noopener';
  link.target = '_blank';
  link.click();
}

function useUploadErrorMessage() {
  const t = useT();
  return (error: unknown): string => {
    if (error instanceof DocumentUploadError) {
      switch (error.code) {
        case 'too-large':
          return t('itemDetail.documents.error.tooLarge', { size: formatBytes(MAX_DOCUMENT_BYTES) });
        case 'too-large-offline':
          return t('itemDetail.documents.error.tooLargeOffline', { size: formatBytes(MAX_OFFLINE_DOCUMENT_BYTES) });
        case 'unsupported-type':
          return t('itemDetail.documents.error.type');
        default:
          break;
      }
    }
    return t('itemDetail.documents.error.upload');
  };
}

function DocumentUploadForm({
  item,
  onDone,
  onCancel,
}: {
  item: CollectionItem;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  const getErrorMessage = useUploadErrorMessage();
  const addItemDocument = useCollectionStore((state) => state.addItemDocument);
  const ownerUserId = useCollectionStore((state) => state.ownerUserId);
  const authUserId = useAuthStore((state) => state.user?.uid);
  const [file, setFile] = useState<File | null>(null);
  const [type, setType] = useState<ProvenanceDocument['type']>('receipt');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = (next: File | null) => {
    setError(null);
    setFile(next);
    if (!next) return;
    if (!title.trim()) setTitle(next.name.replace(/\.[^.]+$/, ''));
    try {
      validateDocumentFile(next, !storageService.isAvailable() || !(authUserId ?? ownerUserId));
    } catch (validationError) {
      setError(getErrorMessage(validationError));
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) {
      setError(t('itemDetail.documents.error.noFile'));
      return;
    }
    if (!title.trim()) {
      setError(t('itemDetail.documents.error.title'));
      return;
    }

    setIsUploading(true);
    setError(null);
    try {
      const url = await uploadDocument(authUserId ?? ownerUserId, file);
      const created = addItemDocument(item.id, {
        type,
        title: title.trim(),
        url,
        mimeType: file.type,
        size: file.size,
      });
      if (!created) throw new Error('not-saved');
      toast.success(t('itemDetail.documents.toast.added'));
      onDone();
    } catch (uploadError) {
      const message = getErrorMessage(uploadError);
      setError(message);
      toast.error(message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="document-file">{t('itemDetail.documents.field.file')}</Label>
        <Input
          id="document-file"
          type="file"
          accept={DOCUMENT_MIME_TYPES.join(',')}
          onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
          className="cursor-pointer file:mr-3 file:rounded-lg file:bg-primary/10 file:px-2.5 file:text-xs file:font-semibold file:text-primary"
        />
        <p className="text-xs text-muted-foreground">
          {t('itemDetail.documents.field.fileHint', { size: formatBytes(MAX_DOCUMENT_BYTES) })}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="space-y-2">
          <Label htmlFor="document-type">{t('itemDetail.documents.field.type')}</Label>
          <Select value={type} onValueChange={(value) => setType(value as ProvenanceDocument['type'])}>
            <SelectTrigger id="document-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map((documentType) => (
                <SelectItem key={documentType} value={documentType}>
                  {t(`itemDetail.documents.type.${documentType}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="document-title">{t('itemDetail.documents.field.title')}</Label>
          <Input
            id="document-title"
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            placeholder={t('itemDetail.documents.field.titlePlaceholder')}
          />
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isUploading}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" disabled={isUploading}>
          <Upload className="size-3.5" />
          {isUploading ? t('itemDetail.documents.uploading') : t('itemDetail.documents.upload')}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DocumentIcon({ document, size = 'md' }: { document: ProvenanceDocument; size?: 'sm' | 'md' }) {
  const isImage = isImageDocument(document);
  const Icon = isImage ? ImageIcon : FileText;
  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg',
        size === 'sm' ? 'size-7' : 'size-9',
        isImage ? 'bg-blue-500/10' : 'bg-primary/10',
      )}
      aria-hidden="true"
    >
      <Icon className={cn(size === 'sm' ? 'size-3.5' : 'size-4', isImage ? 'text-blue-500' : 'text-primary')} />
    </div>
  );
}

/**
 * Provenance documents (receipts, certificates, appraisals…).
 * `compact` renders a read-only list for the side panel.
 */
export function DocumentsPanel({ item, compact = false }: { item: CollectionItem; compact?: boolean }) {
  const t = useT();
  const removeItemDocument = useCollectionStore((state) => state.removeItemDocument);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ProvenanceDocument | null>(null);
  const openingRef = useRef(false);

  const documents = [...(item.documents ?? [])].sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));

  const handleOpen = async (document: ProvenanceDocument) => {
    if (openingRef.current) return;
    openingRef.current = true;
    try {
      await openDocument(document);
    } catch {
      toast.error(t('itemDetail.documents.error.open'));
    } finally {
      openingRef.current = false;
    }
  };

  const handleDelete = () => {
    if (!pendingDelete) return;
    removeItemDocument(item.id, pendingDelete.id);
    void storageService.deleteImage(pendingDelete.url);
    toast.success(t('itemDetail.documents.toast.removed'));
    setPendingDelete(null);
  };

  if (compact) {
    if (documents.length === 0) return null;
    return (
      <ul className="space-y-1.5">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <DocumentIcon document={document} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">{document.title}</p>
              <p className="text-[10px] text-muted-foreground">
                {t(`itemDetail.documents.type.${document.type}`)}
                <span aria-hidden="true"> · </span>
                <span className="tabular-nums">{formatDate(document.uploadedAt)}</span>
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0 text-muted-foreground hover:text-primary"
              aria-label={t('itemDetail.documents.openNamed', { title: document.title })}
              onClick={() => void handleOpen(document)}
            >
              <ExternalLink className="size-3.5" />
            </Button>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Paperclip className="size-4" aria-hidden="true" />
            {t('itemDetail.documents.title')}
          </CardTitle>
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="size-3.5" />
            {t('itemDetail.documents.add')}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {documents.length > 0 ? (
          <ul className="space-y-3">
            {documents.map((document) => (
              <li
                key={document.id}
                className="group flex items-center gap-3 rounded-lg border bg-muted/30 p-3 transition-colors hover:border-primary/30"
              >
                <DocumentIcon document={document} />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    className="block max-w-full truncate text-left text-sm font-medium transition-colors hover:text-primary hover:underline"
                    onClick={() => void handleOpen(document)}
                  >
                    {document.title}
                  </button>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {t(`itemDetail.documents.type.${document.type}`)}
                    </Badge>
                    <span className="tabular-nums">{formatDate(document.uploadedAt)}</span>
                    {document.size != null && <span className="tabular-nums">{formatBytes(document.size)}</span>}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-muted-foreground hover:text-foreground"
                    aria-label={t('itemDetail.documents.downloadNamed', { title: document.title })}
                    onClick={() => downloadDocument(document)}
                  >
                    <Download className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-8 p-0 text-muted-foreground hover:text-destructive"
                    aria-label={t('itemDetail.documents.deleteNamed', { title: document.title })}
                    onClick={() => setPendingDelete(document)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="py-8 text-center">
            <FileText className="mx-auto size-10 text-muted-foreground/30" aria-hidden="true" />
            <p className="mt-2 text-sm text-muted-foreground">{t('itemDetail.documents.emptyTitle')}</p>
            <p className="text-xs text-muted-foreground">{t('itemDetail.documents.emptyDescription')}</p>
          </div>
        )}
      </CardContent>

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10" aria-hidden="true">
                <Paperclip className="size-5 text-primary" />
              </div>
              <div className="space-y-1.5 text-left">
                <DialogTitle>{t('itemDetail.documents.addTitle')}</DialogTitle>
                <DialogDescription>{t('itemDetail.documents.addDescription')}</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DocumentUploadForm item={item} onDone={() => setUploadOpen(false)} onCancel={() => setUploadOpen(false)} />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        title={t('itemDetail.documents.deleteTitle')}
        description={t('itemDetail.documents.deleteDescription', { title: pendingDelete?.title ?? '' })}
        confirmLabel={t('common.delete')}
        destructive
      />
    </Card>
  );
}
