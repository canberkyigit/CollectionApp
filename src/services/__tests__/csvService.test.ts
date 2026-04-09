import { describe, expect, it } from 'vitest';

import { parseCSV } from '../csvService';

describe('csvService', () => {
  it('parses quoted commas and escaped quotes', () => {
    const csv = 'title,description\n"Book, One","He said ""hello"""';
    const parsed = parseCSV(csv);

    expect(parsed.headers).toEqual(['title', 'description']);
    expect(parsed.rows).toEqual([['Book, One', 'He said "hello"']]);
  });

  it('parses multiline quoted cells', () => {
    const csv = 'title,notes\n"Example","Line 1\nLine 2"';
    const parsed = parseCSV(csv);

    expect(parsed.rows).toEqual([['Example', 'Line 1\nLine 2']]);
  });
});
