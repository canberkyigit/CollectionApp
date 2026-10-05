import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage, isFirebaseConfigured } from './firebase';

function generateFileName(originalName: string): string {
  const ext = originalName.split('.').pop() ?? 'jpg';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `${timestamp}-${rand}.${ext}`;
}

export const storageService = {
  isAvailable(): boolean {
    return isFirebaseConfigured();
  },

  async uploadImage(
    userId: string,
    file: File,
    folder = 'items',
  ): Promise<string> {
    if (!isFirebaseConfigured()) {
      return await fileToBase64(file);
    }

    const fileName = generateFileName(file.name);
    const path = `users/${userId}/${folder}/${fileName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  },

  async uploadBase64(
    userId: string,
    base64: string,
    folder = 'items',
  ): Promise<string> {
    if (!isFirebaseConfigured()) return base64;

    const blob = base64ToBlob(base64);
    const fileName = generateFileName('image.jpg');
    const path = `users/${userId}/${folder}/${fileName}`;
    const storageRef = ref(storage, path);

    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  },

  async deleteImage(url: string): Promise<void> {
    if (!isFirebaseConfigured()) return;
    if (!url.includes('firebasestorage.googleapis.com')) return;

    try {
      const storageRef = ref(storage, url);
      await deleteObject(storageRef);
    } catch {
      // Ignore -- file may already be deleted
    }
  },
};

/** Max size of a provenance document (receipt, certificate…) — matches storage.rules headroom. */
export const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;
/** Offline documents are kept inline as data URLs in local storage, so keep them small. */
export const MAX_OFFLINE_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const DOCUMENT_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;

export type DocumentUploadErrorCode = 'too-large' | 'too-large-offline' | 'unsupported-type' | 'upload-failed';

export class DocumentUploadError extends Error {
  readonly code: DocumentUploadErrorCode;

  constructor(code: DocumentUploadErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'DocumentUploadError';
    this.code = code;
  }
}

/** Throws DocumentUploadError when the file can't be stored as a document. */
export function validateDocumentFile(file: File, offline = !isFirebaseConfigured()): void {
  if (!(DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type)) {
    throw new DocumentUploadError('unsupported-type');
  }
  if (file.size > MAX_DOCUMENT_BYTES) throw new DocumentUploadError('too-large');
  if (offline && file.size > MAX_OFFLINE_DOCUMENT_BYTES) throw new DocumentUploadError('too-large-offline');
}

/**
 * Uploads a provenance document (PDF or image) to `users/{uid}/documents/`.
 * Without Firebase it falls back to an inline data URL, like item images.
 */
export async function uploadDocument(userId: string | null | undefined, file: File): Promise<string> {
  const offline = !isFirebaseConfigured() || !userId;
  validateDocumentFile(file, offline);

  if (offline) return await fileToBase64(file);

  try {
    const storageRef = ref(storage, `users/${userId}/documents/${generateFileName(file.name)}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (error) {
    throw new DocumentUploadError('upload-failed', error instanceof Error ? error.message : undefined);
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function base64ToBlob(base64: string): Blob {
  const parts = base64.split(',');
  const mime = parts[0]?.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const raw = atob(parts[1]);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}
