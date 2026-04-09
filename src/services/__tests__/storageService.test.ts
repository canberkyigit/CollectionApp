import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  deleteObject: vi.fn(),
  isFirebaseConfigured: vi.fn(() => true),
}));

vi.mock('firebase/storage', () => ({
  ref: mocks.ref,
  uploadBytes: mocks.uploadBytes,
  getDownloadURL: mocks.getDownloadURL,
  deleteObject: mocks.deleteObject,
}));

vi.mock('@/services/firebase', () => ({
  storage: { app: 'storage' },
  isFirebaseConfigured: mocks.isFirebaseConfigured,
}));

import { storageService } from '@/services/storageService';

describe('storageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ref.mockReturnValue({ fullPath: 'users/user-1/items/file.jpg' });
    mocks.getDownloadURL.mockResolvedValue('https://firebasestorage.googleapis.com/file.jpg');
    mocks.uploadBytes.mockResolvedValue(undefined);
    mocks.deleteObject.mockResolvedValue(undefined);
    mocks.isFirebaseConfigured.mockReturnValue(true);
  });

  it('uploads files and base64 blobs to Firebase storage', async () => {
    const file = new File(['image-data'], 'cover.png', { type: 'image/png' });

    const fileUrl = await storageService.uploadImage('user-1', file);
    const base64Url = await storageService.uploadBase64('user-1', 'data:image/jpeg;base64,Zm9v');

    expect(fileUrl).toContain('firebasestorage.googleapis.com');
    expect(base64Url).toContain('firebasestorage.googleapis.com');
    expect(mocks.ref).toHaveBeenCalled();
    expect(mocks.uploadBytes).toHaveBeenCalledTimes(2);
  });

  it('returns local data when Firebase is unavailable and ignores non-storage deletes', async () => {
    mocks.isFirebaseConfigured.mockReturnValue(false);

    const base64 = 'data:image/png;base64,Zm9v';
    await expect(storageService.uploadBase64('user-1', base64)).resolves.toBe(base64);
    await storageService.deleteImage('https://example.com/image.jpg');

    expect(mocks.deleteObject).not.toHaveBeenCalled();
  });

  it('deletes Firebase storage objects and swallows delete failures', async () => {
    await storageService.deleteImage('https://firebasestorage.googleapis.com/v0/b/app/o/file.jpg');
    expect(mocks.deleteObject).toHaveBeenCalledTimes(1);

    mocks.deleteObject.mockRejectedValueOnce(new Error('missing'));
    await expect(
      storageService.deleteImage('https://firebasestorage.googleapis.com/v0/b/app/o/file.jpg'),
    ).resolves.toBeUndefined();
  });
});
