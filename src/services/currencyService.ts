import type { CurrencyRate } from '@/types';

const API_URL = 'https://api.frankfurter.dev/v1/latest?base=USD';
const CACHE_KEY = 'collectvault_exchange_rates';
const HISTORICAL_CACHE_KEY = 'collectvault_historical_exchange_rates';
const CACHE_TTL = 4 * 60 * 60 * 1000; // 4 hours
const HISTORICAL_CACHE_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

interface CachedRates {
  rates: Record<string, number>;
  fetchedAt: number;
  date: string;
}

interface HistoricalRatesCache {
  [cacheKey: string]: CachedRates;
}

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.85,
  TRY: 38.5,
  GBP: 0.75,
  JPY: 157,
  CHF: 0.78,
  CAD: 1.36,
  AUD: 1.53,
  CNY: 7.24,
  KRW: 1350,
  INR: 83.5,
  BRL: 5.0,
  SEK: 10.5,
  NOK: 10.7,
  DKK: 6.9,
  PLN: 4.0,
  CZK: 23.5,
  HUF: 370,
  MXN: 17.2,
  SGD: 1.34,
  HKD: 7.82,
  NZD: 1.64,
  ZAR: 18.5,
};

let liveRates: Record<string, number> = { ...FALLBACK_RATES };
let ratesDate = '';
let fetchPromise: Promise<void> | null = null;
let initialized = false;

function getHistoricalCache(): HistoricalRatesCache {
  try {
    const raw = localStorage.getItem(HISTORICAL_CACHE_KEY);
    return raw ? (JSON.parse(raw) as HistoricalRatesCache) : {};
  } catch {
    return {};
  }
}

function saveHistoricalCache(cache: HistoricalRatesCache) {
  try {
    localStorage.setItem(HISTORICAL_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore quota errors
  }
}

function loadFromCache(): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;
    const cached: CachedRates = JSON.parse(raw);
    if (Date.now() - cached.fetchedAt > CACHE_TTL) return false;
    liveRates = { USD: 1, ...cached.rates };
    ratesDate = cached.date;
    return true;
  } catch {
    return false;
  }
}

function saveToCache(rates: Record<string, number>, date: string) {
  try {
    const data: CachedRates = { rates, fetchedAt: Date.now(), date };
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch { /* ignore quota errors */ }
}

async function fetchRates(): Promise<void> {
  try {
    const res = await fetch(API_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    liveRates = { USD: 1, ...data.rates };
    ratesDate = data.date;
    saveToCache(data.rates, data.date);
    initialized = true;
  } catch {
    if (!initialized && !loadFromCache()) {
      liveRates = { ...FALLBACK_RATES };
    }
    initialized = true;
  }
}

function ensureRates(): void {
  if (initialized) return;
  if (loadFromCache()) {
    initialized = true;
  }
  if (!fetchPromise) {
    fetchPromise = fetchRates().finally(() => { fetchPromise = null; });
  }
}

export const currencyService = {
  async init(): Promise<void> {
    if (initialized && loadFromCache()) return;
    await fetchRates();
  },

  getRate(from: string, to: string): number {
    ensureRates();
    if (from === to) return 1;
    const fromRate = liveRates[from];
    const toRate = liveRates[to];
    if (fromRate && toRate) return toRate / fromRate;
    return 1;
  },

  convertToUSD(amount: number, fromCurrency: string): number {
    const val = Number(amount) || 0;
    return val * this.getRate(fromCurrency, 'USD');
  },

  convert(amount: number, from: string, to: string): number {
    const val = Number(amount) || 0;
    if (from === to) return val;
    return val * this.getRate(from, to);
  },

  getCurrentRate(from: string, to: string): CurrencyRate {
    return {
      from,
      to,
      rate: this.getRate(from, to),
      date: ratesDate || new Date().toISOString(),
    };
  },

  projectValue(currentValue: number, targetYear: number, annualGrowthRate = 0.05): number {
    const currentYear = new Date().getFullYear();
    const years = targetYear - currentYear;
    if (years <= 0) return currentValue;
    return currentValue * Math.pow(1 + annualGrowthRate, years);
  },

  getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      TRY: '₺',
      GBP: '£',
      JPY: '¥',
      CHF: 'Fr',
      CAD: 'C$',
      AUD: 'A$',
      CNY: '¥',
      KRW: '₩',
      INR: '₹',
      BRL: 'R$',
      SEK: 'kr',
      NOK: 'kr',
      DKK: 'kr',
      PLN: 'zł',
      CZK: 'Kč',
      HUF: 'Ft',
      MXN: '$',
      SGD: 'S$',
      HKD: 'HK$',
      NZD: 'NZ$',
      ZAR: 'R',
      RUB: '₽',
      AED: 'د.إ',
      SAR: '﷼',
    };
    return symbols[currency] ?? currency;
  },

  getSupportedCurrencies(): string[] {
    return [
      'USD', 'EUR', 'TRY', 'GBP', 'JPY', 'CHF',
      'CAD', 'AUD', 'CNY', 'KRW', 'INR', 'BRL',
      'SEK', 'NOK', 'DKK', 'PLN', 'CZK', 'HUF',
      'MXN', 'SGD', 'HKD', 'NZD', 'ZAR',
    ];
  },

  getRatesDate(): string {
    ensureRates();
    return ratesDate;
  },

  async refresh(): Promise<void> {
    await fetchRates();
  },

  async getHistoricalRates(date: string, base: string): Promise<Record<string, number> | null> {
    try {
      const cacheKey = `${date}:${base}`;
      const cache = getHistoricalCache();
      const cached = cache[cacheKey];
      if (cached && Date.now() - cached.fetchedAt <= HISTORICAL_CACHE_TTL) {
        return cached.rates;
      }

      const res = await fetch(`https://api.frankfurter.dev/v1/${date}?base=${base}&symbols=USD,EUR,GBP,TRY,JPY,CHF`);
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.rates) return null;

      cache[cacheKey] = {
        rates: data.rates,
        fetchedAt: Date.now(),
        date: data.date ?? date,
      };
      saveHistoricalCache(cache);

      return data.rates;
    } catch {
      return null;
    }
  },
};

currencyService.init();
