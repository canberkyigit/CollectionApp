import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { t } from '@/i18n';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1200;

/** Downscale to ≤1200px and re-encode as JPEG; falls back to the raw file if decoding fails. */
export function compressImage(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    };
    img.src = url;
  });
}

/** Photo list state for the item editor: add (validated + compressed), remove, reorder, cover. */
export function useItemPhotos(initialImages: string[] = []) {
  const [images, setImages] = useState<string[]>(initialImages);
  const [coverIndex, setCoverIndex] = useState(0);

  const addFiles = useCallback((files: FileList | File[] | null, onAdded?: () => void) => {
    if (!files) return;
    Array.from(files).forEach(async (file) => {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        toast.error(t('itemForm.photos.unsupported', { name: file.name }));
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        toast.error(t('itemForm.photos.tooLarge', { name: file.name }));
        return;
      }
      const compressed = await compressImage(file);
      setImages((prev) => [...prev, compressed]);
      onAdded?.();
    });
  }, []);

  /** Add a remote image (lookup cover). `asCover` puts it first. */
  const addImageUrl = useCallback((url: string, asCover = false) => {
    setImages((prev) => {
      if (prev.includes(url)) return prev;
      return asCover ? [url, ...prev] : [...prev, url];
    });
    if (asCover) setCoverIndex(0);
  }, []);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setCoverIndex((prev) => {
      if (index === prev) return 0;
      if (index < prev) return prev - 1;
      return prev;
    });
  }, []);

  const moveImage = useCallback((from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setCoverIndex((prev) => {
      if (prev === from) return to;
      if (from < prev && to >= prev) return prev - 1;
      if (from > prev && to <= prev) return prev + 1;
      return prev;
    });
  }, []);

  const resetImages = useCallback((next: string[]) => {
    setImages(next);
    setCoverIndex(0);
  }, []);

  return { images, coverIndex, setCoverIndex, addFiles, addImageUrl, removeImage, moveImage, resetImages };
}

export type ItemPhotosState = ReturnType<typeof useItemPhotos>;
