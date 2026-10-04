import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CategoryField } from '@/types';
import { setIntegrationKey } from '@/lib/integrationKeys';

const mocks = vi.hoisted(() => ({ parse: vi.fn(), constructed: vi.fn() }));

vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status?: number;
    constructor(status?: number, message = 'api error') {
      super(message);
      this.status = status;
    }
  }
  class APIUserAbortError extends APIError {}
  class AuthenticationError extends APIError {}
  class PermissionDeniedError extends APIError {}
  class RateLimitError extends APIError {}
  class BadRequestError extends APIError {}
  class APIConnectionError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static APIUserAbortError = APIUserAbortError;
    static AuthenticationError = AuthenticationError;
    static PermissionDeniedError = PermissionDeniedError;
    static RateLimitError = RateLimitError;
    static BadRequestError = BadRequestError;
    static APIConnectionError = APIConnectionError;
    beta = { messages: { parse: mocks.parse } };
    constructor(options: unknown) {
      mocks.constructed(options);
    }
  }
  return { default: Anthropic };
});

vi.mock('@anthropic-ai/sdk/helpers/beta/zod', () => ({
  betaZodOutputFormat: vi.fn(() => ({ type: 'json_schema', schema: {} })),
}));

const fields: CategoryField[] = [
  { id: 'country', key: 'country', label: 'Country', type: 'text', required: false, order: 1 },
  { id: 'year', key: 'year', label: 'Year', type: 'number', required: false, order: 2 },
];

const output = {
  identified: true,
  title: '1 Lira 1960',
  description: 'Turkish stainless steel coin.',
  fields: [
    { key: 'country', value: 'Turkey' },
    { key: 'year', value: '1960' },
    { key: 'serial', value: 'invented' },
  ],
  tags: ['turkey', 'lira'],
  condition: 'Very Fine (VF)',
  estimatedValue: { low: 2, high: 5, currency: 'usd' },
  confidence: 0.82,
  notes: 'Read from the date and legend.',
};

describe('aiCatalogService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('refuses to run without a key', async () => {
    const { aiCatalogService } = await import('@/services/aiCatalogService');
    await expect(aiCatalogService.identify({
      image: 'data:image/jpeg;base64,abc', category: { name: 'Coins' }, fields, conditionOptions: [], currency: 'USD',
    })).rejects.toMatchObject({ code: 'no-key', provider: 'claude' });
  });

  it('sends the photo to Claude and maps the structured answer to a candidate', async () => {
    setIntegrationKey('anthropic', 'sk-test');
    mocks.parse.mockResolvedValueOnce({ stop_reason: 'end_turn', parsed_output: output });
    const { aiCatalogService, AI_CATALOG_MODEL } = await import('@/services/aiCatalogService');

    const result = await aiCatalogService.identify({
      image: 'data:image/jpeg;base64,abc123',
      category: { name: 'Coins' },
      fields,
      conditionOptions: ['Very Fine (VF)', 'Fine (F)'],
      currency: 'USD',
    });

    expect(mocks.constructed).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'sk-test', dangerouslyAllowBrowser: true }));
    const request = mocks.parse.mock.calls[0][0];
    expect(request.model).toBe(AI_CATALOG_MODEL);
    expect(request.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'abc123' },
    });
    expect(request.messages[0].content[1].text).toContain('country ("Country", text)');

    expect(result.notes).toBe('Read from the date and legend.');
    expect(result.candidate).toMatchObject({
      provider: 'claude',
      title: '1 Lira 1960',
      condition: 'Very Fine (VF)',
      confidence: 0.82,
      estimatedValue: { low: 2, high: 5, currency: 'USD', basis: 'estimate' },
    });
    expect(result.candidate.fields).toEqual([
      { keys: ['country'], value: 'Turkey' },
      { keys: ['year'], value: '1960' },
    ]);
  });

  it('drops value estimates when the identification is not confident', async () => {
    const { outputToCandidate } = await import('@/services/aiCatalogService');
    expect(outputToCandidate({ ...output, confidence: 0.3 }, fields).estimatedValue).toBeUndefined();
    expect(outputToCandidate({ ...output, identified: false }, fields).title).toBeUndefined();
  });

  it('maps SDK failures and refusals to typed errors', async () => {
    setIntegrationKey('anthropic', 'sk-test');
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as {
      AuthenticationError: new (status?: number) => Error;
      RateLimitError: new (status?: number) => Error;
      APIConnectionError: new (status?: number) => Error;
    };
    const { aiCatalogService } = await import('@/services/aiCatalogService');
    const input = { image: 'https://example.com/coin.jpg', category: { name: 'Coins' }, fields, conditionOptions: [], currency: 'USD' };

    mocks.parse.mockRejectedValueOnce(new Anthropic.AuthenticationError(401));
    await expect(aiCatalogService.identify(input)).rejects.toMatchObject({ code: 'auth' });
    mocks.parse.mockRejectedValueOnce(new Anthropic.RateLimitError(429));
    await expect(aiCatalogService.identify(input)).rejects.toMatchObject({ code: 'rate-limit' });
    mocks.parse.mockRejectedValueOnce(new Anthropic.APIConnectionError());
    await expect(aiCatalogService.identify(input)).rejects.toMatchObject({ code: 'network' });
    mocks.parse.mockResolvedValueOnce({ stop_reason: 'refusal', parsed_output: null });
    await expect(aiCatalogService.identify(input)).rejects.toMatchObject({ code: 'refusal' });
    mocks.parse.mockResolvedValueOnce({ stop_reason: 'max_tokens', parsed_output: null });
    await expect(aiCatalogService.identify(input)).rejects.toMatchObject({ code: 'invalid-response' });

    expect(mocks.parse.mock.calls[0][0].messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'url', url: 'https://example.com/coin.jpg' },
    });
  });

  it('rejects images it cannot send', async () => {
    const { toImageSource } = await import('@/services/aiCatalogService');
    expect(() => toImageSource('data:image/heic;base64,xyz')).toThrow();
    expect(() => toImageSource('blob:local')).toThrow();
  });
});
