import type { Category, CollectionItem, Contributor } from '@/types';
import { mockCategories } from '@/data/categories';
import { mockItems } from '@/data/items';
import { mockContributors } from '@/data/contributors';

/**
 * Abstract data service layer.
 * Currently backed by local state/mock data.
 * Designed to be swapped with Firebase or any other backend.
 */
export interface DataService {
  getCategories(): Promise<Category[]>;
  getCategoryById(id: string): Promise<Category | undefined>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: Category): Promise<Category>;
  updateCategory(id: string, updates: Partial<Category>): Promise<Category>;
  deleteCategory(id: string): Promise<void>;

  getItems(): Promise<CollectionItem[]>;
  getItemById(id: string): Promise<CollectionItem | undefined>;
  getItemsByCategory(categoryId: string): Promise<CollectionItem[]>;
  createItem(item: CollectionItem): Promise<CollectionItem>;
  updateItem(id: string, updates: Partial<CollectionItem>): Promise<CollectionItem>;
  deleteItem(id: string): Promise<void>;

  getContributors(): Promise<Contributor[]>;
  getContributorById(id: string): Promise<Contributor | undefined>;
}

class LocalDataService implements DataService {
  private categories: Category[] = [...mockCategories];
  private items: CollectionItem[] = [...mockItems];
  private contributors: Contributor[] = [...mockContributors];

  async getCategories(): Promise<Category[]> {
    return [...this.categories];
  }

  async getCategoryById(id: string): Promise<Category | undefined> {
    return this.categories.find((c) => c.id === id);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    return this.categories.find((c) => c.slug === slug);
  }

  async createCategory(category: Category): Promise<Category> {
    this.categories.push(category);
    return category;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category> {
    const idx = this.categories.findIndex((c) => c.id === id);
    if (idx === -1) throw new Error('Category not found');
    this.categories[idx] = { ...this.categories[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.categories[idx];
  }

  async deleteCategory(id: string): Promise<void> {
    this.categories = this.categories.filter((c) => c.id !== id);
    this.items = this.items.filter((i) => i.categoryId !== id);
  }

  async getItems(): Promise<CollectionItem[]> {
    return [...this.items];
  }

  async getItemById(id: string): Promise<CollectionItem | undefined> {
    return this.items.find((i) => i.id === id);
  }

  async getItemsByCategory(categoryId: string): Promise<CollectionItem[]> {
    return this.items.filter((i) => i.categoryId === categoryId);
  }

  async createItem(item: CollectionItem): Promise<CollectionItem> {
    this.items.push(item);
    return item;
  }

  async updateItem(id: string, updates: Partial<CollectionItem>): Promise<CollectionItem> {
    const idx = this.items.findIndex((i) => i.id === id);
    if (idx === -1) throw new Error('Item not found');
    this.items[idx] = { ...this.items[idx], ...updates, updatedAt: new Date().toISOString() };
    return this.items[idx];
  }

  async deleteItem(id: string): Promise<void> {
    this.items = this.items.filter((i) => i.id !== id);
  }

  async getContributors(): Promise<Contributor[]> {
    return [...this.contributors];
  }

  async getContributorById(id: string): Promise<Contributor | undefined> {
    return this.contributors.find((c) => c.id === id);
  }
}

export const dataService: DataService = new LocalDataService();
