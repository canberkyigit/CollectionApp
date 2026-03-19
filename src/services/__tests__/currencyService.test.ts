import { describe, it, expect, vi, beforeEach } from 'vitest';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

async function getService() {
  vi.resetModules();
  const mod = await import('../currencyService');
  return mod.currencyService;
}

describe('currencyService', () => {
  describe('getCurrencySymbol', () => {
    it('returns correct symbols for known currencies', async () => {
      const service = await getService();
      expect(service.getCurrencySymbol('USD')).toBe('$');
      expect(service.getCurrencySymbol('EUR')).toBe('€');
      expect(service.getCurrencySymbol('GBP')).toBe('£');
      expect(service.getCurrencySymbol('TRY')).toBe('₺');
      expect(service.getCurrencySymbol('JPY')).toBe('¥');
    });

    it('returns currency code for unknown currencies', async () => {
      const service = await getService();
      expect(service.getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });

  describe('getRate', () => {
    it('returns 1 for same currency', async () => {
      const service = await getService();
      expect(service.getRate('USD', 'USD')).toBe(1);
    });

    it('returns a numeric rate for different currencies', async () => {
      const service = await getService();
      const rate = service.getRate('EUR', 'USD');
      expect(typeof rate).toBe('number');
      expect(rate).toBeGreaterThan(0);
    });
  });

  describe('convert', () => {
    it('returns same amount for same currency', async () => {
      const service = await getService();
      expect(service.convert(100, 'USD', 'USD')).toBe(100);
    });

    it('converts between currencies', async () => {
      const service = await getService();
      const result = service.convert(100, 'USD', 'EUR');
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThan(0);
      expect(result).not.toBe(100);
    });

    it('handles zero amount', async () => {
      const service = await getService();
      expect(service.convert(0, 'USD', 'EUR')).toBe(0);
    });
  });

  describe('projectValue', () => {
    it('projects value with default growth rate', async () => {
      const service = await getService();
      const currentYear = new Date().getFullYear();
      const projected = service.projectValue(100, currentYear + 5);
      expect(projected).toBeGreaterThan(100);
    });

    it('returns same value for current or past year', async () => {
      const service = await getService();
      const currentYear = new Date().getFullYear();
      expect(service.projectValue(100, currentYear)).toBe(100);
      expect(service.projectValue(100, currentYear - 1)).toBe(100);
    });
  });

  describe('getSupportedCurrencies', () => {
    it('returns an array of currency codes', async () => {
      const service = await getService();
      const currencies = service.getSupportedCurrencies();
      expect(Array.isArray(currencies)).toBe(true);
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies).toContain('TRY');
    });
  });
});
