/// <reference types="node" />

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

function readRootFile(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Firebase rules', () => {
  it('keeps Firestore user subcollections schema-aware and owner-scoped', () => {
    const rules = readRootFile('firestore.rules');

    expect(rules).toContain('function isOwner(userId)');
    expect(rules).toContain('function validCategory(data, docId)');
    expect(rules).toContain('function validItem(data, docId)');
    expect(rules).toContain('function validWishlist(data, docId)');
    expect(rules).toContain('match /items/{docId}');
    expect(rules).toContain('allow create, update: if isOwner(userId) && validItem(request.resource.data, docId);');
    expect(rules).toContain('match /{document=**}');
    expect(rules).toContain('allow read, write: if false;');
  });

  it('limits Storage writes to owned images and documents with size checks', () => {
    const rules = readRootFile('storage.rules');

    expect(rules).toContain('function isOwner(userId)');
    expect(rules).toContain('function isSafeImage()');
    expect(rules).toContain('request.resource.size < 10 * 1024 * 1024');
    expect(rules).toContain('request.resource.size < 20 * 1024 * 1024');
    expect(rules).toContain('match /users/{userId}/items/{fileName}');
    expect(rules).toContain('match /users/{userId}/documents/{fileName}');
  });
});
