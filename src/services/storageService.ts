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
