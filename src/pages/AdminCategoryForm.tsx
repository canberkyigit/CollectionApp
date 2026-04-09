import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, Controller, useFieldArray, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

import type { FieldType } from '@/types';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  Save,
  X,
} from 'lucide-react';

import { PageHeader } from '@/components/shared';
import { PageTransition } from '@/components/shared/motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { cn, generateId, slugify } from '@/lib/utils';
import { getAdminBreadcrumbs, withAdminSource } from '@/lib/adminNavigation';
import { ICON_NAMES, getCategoryIcon } from '@/lib/icons';
import { useCollectionStore } from '@/store/useCollectionStore';

const FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Text' },
  { value: 'textarea', label: 'Text Area' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'select', label: 'Select' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'currency', label: 'Currency' },
  { value: 'boolean', label: 'Yes/No' },
  { value: 'image', label: 'Image' },
  { value: 'tags', label: 'Tags' },
  { value: 'rich-notes', label: 'Rich Notes' },
];

const ICON_OPTIONS = ICON_NAMES;

const fieldSchema = z.object({
  id: z.string(),
  label: z.string().min(1, 'Label is required'),
  key: z.string().min(1, 'Key is required'),
  type: z.enum([
    'text', 'textarea', 'number', 'date', 'select',
    'multi-select', 'currency', 'boolean', 'image', 'tags', 'rich-notes',
  ] as const),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  order: z.number(),
  helpText: z.string().optional(),
});

const categoryFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  icon: z.string().min(1, 'Icon is required'),
  description: z.string(),
  fields: z.array(fieldSchema),
});

type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function AdminCategoryForm() {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(categoryId);
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : '';
  const categoriesPath = withAdminSource('/admin/categories', searchSuffix);

  const { getCategoryById, addCategory, updateCategory } = useCollectionStore();
  const existingCategory = categoryId ? getCategoryById(categoryId) : undefined;

  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: {
      name: '',
      slug: '',
      icon: 'Package',
      description: '',
      fields: [],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'fields',
  });

  const watchName = useWatch({ control, name: 'name' });
  const watchFields = useWatch({ control, name: 'fields' });

  useEffect(() => {
    if (existingCategory) {
      setValue('name', existingCategory.name);
      setValue('slug', existingCategory.slug);
      setValue('icon', existingCategory.icon);
      setValue('description', existingCategory.description);
      setValue('fields', existingCategory.fields);
    }
  }, [existingCategory, setValue]);

  useEffect(() => {
    if (!isEdit && watchName) {
      setValue('slug', slugify(watchName));
    }
  }, [watchName, isEdit, setValue]);

  const toggleFieldExpansion = (index: number) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleAddField = () => {
    const newField = {
      id: generateId(),
      label: '',
      key: '',
      type: 'text' as FieldType,
      required: false,
      placeholder: '',
      options: [] as string[],
      order: fields.length,
      helpText: '',
    };
    append(newField);
    setExpandedFields((prev) => new Set(prev).add(fields.length));
  };

  const handleRemoveField = (index: number) => {
    remove(index);
    setExpandedFields((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleOptionsChange = (index: number, value: string) => {
    const parsed = value
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setValue(`fields.${index}.options`, parsed);
  };

  const onSubmit = (data: CategoryFormValues) => {
    const fieldsWithOrder = data.fields.map((f, idx) => ({ ...f, order: idx }));

    if (isEdit && categoryId) {
      updateCategory(categoryId, {
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        description: data.description,
        fields: fieldsWithOrder,
      });
      toast.success('Category updated successfully');
    } else {
      addCategory({
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        description: data.description,
        fields: fieldsWithOrder,
      });
      toast.success('Category created successfully');
    }

    navigate(categoriesPath);
  };

  if (isEdit && !existingCategory) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Category Not Found"
          breadcrumbs={getAdminBreadcrumbs(searchSuffix, [{ label: 'Categories', href: categoriesPath }])}
        />
        <p className="text-muted-foreground">
          The category you're trying to edit doesn't exist.
        </p>
        <Button variant="outline" onClick={() => navigate(categoriesPath)}>
          Back to Categories
        </Button>
      </div>
    );
  }

  return (
    <PageTransition>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pb-24">
      <PageHeader
        title={isEdit ? 'Edit Category' : 'New Category'}
        description={isEdit ? 'Update category details and custom fields' : 'Create a new collection category with custom fields'}
        breadcrumbs={getAdminBreadcrumbs(searchSuffix, [
          { label: 'Categories', href: categoriesPath },
          { label: isEdit ? 'Edit' : 'New' },
        ])}
      />

      {/* Basic Info */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Basic Information</h2>
          <p className="text-sm text-muted-foreground">
            General details about this collection category
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g. Vinyl Records"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                Slug <span className="text-destructive">*</span>
              </Label>
              <Input
                id="slug"
                placeholder="e.g. vinyl-records"
                className="font-mono text-sm"
                {...register('slug')}
              />
              {errors.slug && (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => {
                const SelectedIcon = getCategoryIcon(field.value);
                return (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full sm:w-64 [&>span]:flex [&>span]:items-center [&>span]:gap-2">
                      <SelectValue>
                        <SelectedIcon className="size-4 shrink-0 text-primary" />
                        <span>{field.value === 'MoreHorizontal' ? 'Other' : field.value}</span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {ICON_OPTIONS.map((iconName) => {
                        const Icon = getCategoryIcon(iconName);
                        const isOther = iconName === 'MoreHorizontal';
                        return (
                          <SelectItem key={iconName} value={iconName}>
                            <span className="flex items-center gap-2.5">
                              <Icon className="size-4 text-muted-foreground" />
                              <span>{isOther ? 'Other' : iconName}</span>
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Describe what this category is for..."
              rows={3}
              {...register('description')}
            />
          </div>
        </CardContent>
      </Card>

      {/* Field Builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Custom Fields</h2>
              <p className="text-sm text-muted-foreground">
                Define the fields for items in this category
              </p>
            </div>
            <Button type="button" variant="outline" onClick={handleAddField}>
              <Plus className="size-4" />
              Add Field
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">
                No fields defined yet
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Add fields to define the structure of items in this category
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleAddField}
              >
                <Plus className="size-3.5" />
                Add First Field
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const fieldType = watchFields?.[index]?.type;
                const isExpanded = expandedFields.has(index);
                const showOptions = fieldType === 'select' || fieldType === 'multi-select';
                const currentOptions = watchFields?.[index]?.options ?? [];

                return (
                  <div
                    key={field.id}
                    className={cn(
                      'rounded-lg border bg-card transition-all',
                      errors.fields?.[index] && 'border-destructive/50',
                    )}
                  >
                    {/* Field Header */}
                    <div className="flex items-start gap-2 p-4">
                      <div className="mt-2.5 cursor-grab text-muted-foreground/50">
                        <GripVertical className="size-4" />
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          {/* Label */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Label</Label>
                            <Input
                              placeholder="Field label"
                              {...register(`fields.${index}.label`, {
                                onChange: (e) => {
                                  const label = e.target.value;
                                  if (!isEdit || !watchFields?.[index]?.key) {
                                    setValue(`fields.${index}.key`, slugify(label).replace(/-/g, '_'));
                                  }
                                },
                              })}
                            />
                            {errors.fields?.[index]?.label && (
                              <p className="text-xs text-destructive">
                                {errors.fields[index]?.label?.message}
                              </p>
                            )}
                          </div>

                          {/* Key */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Key</Label>
                            <Input
                              placeholder="field_key"
                              className="font-mono text-sm"
                              {...register(`fields.${index}.key`)}
                            />
                            {errors.fields?.[index]?.key && (
                              <p className="text-xs text-destructive">
                                {errors.fields[index]?.key?.message}
                              </p>
                            )}
                          </div>

                          {/* Type */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">Type</Label>
                            <Controller
                              control={control}
                              name={`fields.${index}.type`}
                              render={({ field: typeField }) => (
                                <Select
                                  value={typeField.value}
                                  onValueChange={typeField.onChange}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FIELD_TYPE_OPTIONS.map((opt) => (
                                      <SelectItem key={opt.value} value={opt.value}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        </div>

                        {/* Required Toggle */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Controller
                              control={control}
                              name={`fields.${index}.required`}
                              render={({ field: reqField }) => (
                                <Switch
                                  checked={reqField.value}
                                  onCheckedChange={reqField.onChange}
                                  id={`required-${index}`}
                                />
                              )}
                            />
                            <Label
                              htmlFor={`required-${index}`}
                              className="text-sm cursor-pointer"
                            >
                              Required
                            </Label>
                          </div>

                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground"
                            onClick={() => toggleFieldExpansion(index)}
                          >
                            {isExpanded ? (
                              <>
                                <ChevronUp className="size-3.5" />
                                Less options
                              </>
                            ) : (
                              <>
                                <ChevronDown className="size-3.5" />
                                More options
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expanded Options */}
                        {isExpanded && (
                          <div className="space-y-3 pt-1">
                            <Separator />
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Placeholder
                                </Label>
                                <Input
                                  placeholder="Enter placeholder text"
                                  {...register(`fields.${index}.placeholder`)}
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">
                                  Help Text
                                </Label>
                                <Input
                                  placeholder="Help text for this field"
                                  {...register(`fields.${index}.helpText`)}
                                />
                              </div>
                            </div>

                            {showOptions && (
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">
                                  Options (comma-separated)
                                </Label>
                                <Input
                                  placeholder="Option 1, Option 2, Option 3"
                                  value={watchFields?.[index]?.options?.join(', ') ?? ''}
                                  onChange={(e) => handleOptionsChange(index, e.target.value)}
                                />
                                {currentOptions.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5">
                                    {currentOptions.map((opt) => (
                                      <Badge
                                        key={opt}
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        {opt}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Delete Button */}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-1.5 size-8 shrink-0 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveField(index)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sticky Bottom Actions */}
      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between px-6 py-4">
          <p className="text-sm text-muted-foreground">
            {fields.length} {fields.length === 1 ? 'field' : 'fields'} defined
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(categoriesPath)}
            >
              <X className="size-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="size-4" />
              {isEdit ? 'Update Category' : 'Save Category'}
            </Button>
          </div>
        </div>
      </div>
    </form>
    </PageTransition>
  );
}
