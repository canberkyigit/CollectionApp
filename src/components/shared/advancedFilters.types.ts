export interface FilterState {
  conditions: string[];
  priceRange: [number, number];
  valueRange: [number, number];
  dateFrom: string;
  dateTo: string;
  tags: string[];
  favoritesOnly: boolean;
  hasImages: boolean | null;
  readStatus: 'all' | 'read' | 'unread';
  currencies: string[];
  customSelects: Record<string, string[]>;
  customBooleans: Record<string, boolean | null>;
}

export const DEFAULT_FILTERS: FilterState = {
  conditions: [],
  priceRange: [0, 0],
  valueRange: [0, 0],
  dateFrom: '',
  dateTo: '',
  tags: [],
  favoritesOnly: false,
  hasImages: null,
  readStatus: 'all',
  currencies: [],
  customSelects: {},
  customBooleans: {},
};
