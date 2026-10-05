import { describe, expect, it } from 'vitest';

import { detectCsvDelimiter, parseCSV, stripBom } from '../csvService';

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

describe('csvService delimiter detection', () => {
  it('detects semicolon files written by Turkish/European Excel', () => {
    const csv = 'Başlık;Açıklama;Fiyat\r\n"Kitap; Bir";Güzel;12,50\r\n';
    expect(detectCsvDelimiter(csv)).toBe(';');
    const parsed = parseCSV(csv);
    expect(parsed.delimiter).toBe(';');
    expect(parsed.headers).toEqual(['Başlık', 'Açıklama', 'Fiyat']);
    expect(parsed.rows).toEqual([['Kitap; Bir', 'Güzel', '12,50']]);
  });

  it('ignores delimiters inside quoted header cells', () => {
    expect(detectCsvDelimiter('"a;b;c",d,e\n1,2,3')).toBe(',');
    expect(detectCsvDelimiter('"a,b,c";d;e\n1;2;3')).toBe(';');
  });

  it('detects tab-separated text and falls back to comma', () => {
    expect(detectCsvDelimiter('title\tauthor\nDune\tHerbert')).toBe('\t');
    expect(parseCSV('title\tauthor\nDune\tHerbert').rows).toEqual([['Dune', 'Herbert']]);
    expect(detectCsvDelimiter('title')).toBe(',');
  });

  it('strips a UTF-8 BOM and handles CRLF line endings', () => {
    const csv = '﻿title,price\r\nDune,10\r\nEmma,12\r\n';
    expect(stripBom(csv).startsWith('title')).toBe(true);
    const parsed = parseCSV(csv);
    expect(parsed.headers).toEqual(['title', 'price']);
    expect(parsed.rows).toEqual([['Dune', '10'], ['Emma', '12']]);
  });

  it('honours an explicit delimiter override', () => {
    const parsed = parseCSV('a;b,c\n1;2,3', ',');
    expect(parsed.headers).toEqual(['a;b', 'c']);
  });
});
