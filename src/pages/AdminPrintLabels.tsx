import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Search, Check } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { PageHeader } from '@/components/shared/PageHeader';
import { PageTransition } from '@/components/shared/motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { getAdminBreadcrumbs } from '@/lib/adminNavigation';
import { useCollectionStore } from '@/store/useCollectionStore';
import { cn } from '@/lib/utils';

export default function AdminPrintLabels() {
  const [searchParams] = useSearchParams();
  const searchQueryString = searchParams.toString();
  const { items, categories } = useCollectionStore();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const categoryNameById = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const activeItems = useMemo(
    () => items.filter((i) => !i.isArchived),
    [items],
  );

  const filtered = useMemo(() => {
    if (!search.trim()) return activeItems;
    const q = search.toLowerCase();
    return activeItems.filter(
      (i) => i.title.toLowerCase().includes(q) || (categoryNameById.get(i.categoryId)?.toLowerCase().includes(q) ?? false),
    );
  }, [activeItems, search, categoryNameById]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((i) => i.id)));
    }
  };

  const selectedItems = useMemo(
    () => activeItems.filter((i) => selected.has(i.id)),
    [activeItems, selected],
  );

  const handlePrint = () => window.print();

  return (
    <PageTransition>
      <div className="space-y-6">
        {/* Screen-only header */}
        <div className="print:hidden">
          <PageHeader
            title="Print Labels"
            description="Select items and print QR code labels for your collection"
            breadcrumbs={getAdminBreadcrumbs(searchQueryString ? `?${searchQueryString}` : '', [{ label: 'Print Labels' }])}
          >
            <Button onClick={handlePrint} disabled={selected.size === 0} className="gap-2">
              <Printer className="size-4" />
              Print {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </PageHeader>

          {/* Search + select all */}
          <div className="mt-4 flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search items..."
                className="pl-9"
              />
            </div>
            <Button variant="outline" size="sm" onClick={toggleAll} className="gap-1.5 shrink-0">
              <Check className="size-3.5" />
              {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          {/* Item list */}
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => {
              const cat = categoryNameById.get(item.categoryId);
              const isSelected = selected.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleSelect(item.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    {cat && <Badge variant="secondary" className="mt-0.5 text-[10px]">{cat}</Badge>}
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <p className="col-span-full py-8 text-center text-sm text-muted-foreground">No items found</p>
            )}
          </div>
        </div>

        {/* Print layout — only visible when printing */}
        {selectedItems.length > 0 && (
          <div className="hidden print:block">
            <div className="grid grid-cols-3 gap-4 p-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {selectedItems.map((item) => {
                const cat = categoryNameById.get(item.categoryId);
                return (
                  <div
                    key={item.id}
                    className="flex flex-col items-center gap-1 rounded-lg border p-3 text-center break-inside-avoid"
                  >
                    <QRCodeSVG
                      value={`${window.location.origin}/items/${item.id}`}
                      size={80}
                      includeMargin={false}
                    />
                    <p className="mt-1 text-[10px] font-semibold leading-tight line-clamp-2">{item.title}</p>
                    {cat && <p className="text-[9px] text-gray-500">{cat}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Screen preview of print layout */}
        {selectedItems.length > 0 && (
          <div className="print:hidden">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Preview ({selectedItems.length} labels)</h3>
            <Card>
              <CardContent className="p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {selectedItems.map((item) => {
                    const cat = categoryNameById.get(item.categoryId);
                    return (
                      <div key={item.id} className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center">
                        <div className="rounded bg-white p-1">
                          <QRCodeSVG
                            value={`${window.location.origin}/items/${item.id}`}
                            size={64}
                            includeMargin={false}
                          />
                        </div>
                        <p className="text-[9px] font-medium leading-tight line-clamp-2">{item.title}</p>
                        {cat && <p className="text-[8px] text-muted-foreground">{cat}</p>}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
