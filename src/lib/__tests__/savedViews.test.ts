import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_FILTERS } from '@/components/shared/advancedFilters.types';
import {
  buildSavedViewSearch,
  filterSavedViews,
  getSavedViewHref,
  useSavedViewsStore,
  type SavedViewInput,
} from '@/lib/savedViews';

const baseInput: SavedViewInput = {
  name: '  Signed firsts ',
  categoryId: 'cat-books',
  filters: { ...DEFAULT_FILTERS, tags: ['signed'] },
  search: 'dune',
  sort: { field: 'title', order: 'asc' },
  viewMode: 'covers',
  libraryId: 'lib-books',
  ownerUserId: 'user-1',
};

describe('saved views store', () => {
  beforeEach(() => {
    useSavedViewsStore.setState({ savedViews: [] });
  });

  it('adds, renames, updates and removes views', () => {
    const view = useSavedViewsStore.getState().addSavedView(baseInput);
    expect(view.name).toBe('Signed firsts');
    expect(useSavedViewsStore.getState().savedViews).toHaveLength(1);

    useSavedViewsStore.getState().updateSavedView(view.id, { name: 'Signed first editions' });
    expect(useSavedViewsStore.getState().savedViews[0].name).toBe('Signed first editions');

    useSavedViewsStore.getState().updateSavedView(view.id, { name: '   ' });
    expect(useSavedViewsStore.getState().savedViews[0].name).toBe('Signed first editions');

    useSavedViewsStore.getState().updateSavedView(view.id, { search: 'herbert' });
    expect(useSavedViewsStore.getState().savedViews[0].search).toBe('herbert');

    useSavedViewsStore.getState().removeSavedView(view.id);
    expect(useSavedViewsStore.getState().savedViews).toHaveLength(0);
  });

  it('scopes views by owner and page', () => {
    const store = useSavedViewsStore.getState();
    store.addSavedView(baseInput);
    store.addSavedView({ ...baseInput, name: 'Favourites view', categoryId: null });
    store.addSavedView({ ...baseInput, name: 'Someone else', ownerUserId: 'user-2' });
    const views = useSavedViewsStore.getState().savedViews;

    expect(filterSavedViews(views, 'user-1').map((view) => view.name)).toEqual(['Favourites view', 'Signed firsts']);
    expect(filterSavedViews(views, 'user-1', null).map((view) => view.name)).toEqual(['Favourites view']);
    expect(filterSavedViews(views, 'user-1', 'cat-books').map((view) => view.name)).toEqual(['Signed firsts']);
    expect(filterSavedViews(views, 'user-2')).toHaveLength(1);
  });

  it('builds links that reproduce the view', () => {
    const view = useSavedViewsStore.getState().addSavedView(baseInput);
    const search = new URLSearchParams(buildSavedViewSearch(view));
    expect(search.get('library')).toBe('lib-books');
    expect(search.get('q')).toBe('dune');
    expect(search.getAll('tag')).toEqual(['signed']);
    expect(search.get('sort')).toBe('title');
    expect(search.get('view')).toBe('covers');

    const categories = [{ id: 'cat-books', slug: 'books' }];
    expect(getSavedViewHref(view, categories)).toMatch(/^\/collections\/books\?/);
    expect(getSavedViewHref({ ...view, categoryId: null }, categories)).toMatch(/^\/favorites\?/);
    expect(getSavedViewHref({ ...view, categoryId: 'gone' }, categories)).toBeNull();
  });
});
