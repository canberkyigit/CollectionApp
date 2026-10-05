import { useState, useEffect, useMemo } from 'react';
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
import { resolveCategorySlug } from '@/lib/categorySlug';
import { useT } from '@/i18n';
import { ICON_NAMES, getCategoryIcon } from '@/lib/icons';
import { useCollectionStore } from '@/store/useCollectionStore';

const FIELD_TYPE_OPTIONS: FieldType[] = [
  'text', 'textarea', 'number', 'date', 'select', 'multi-select',
  'currency', 'boolean', 'image', 'tags', 'rich-notes',
];

const ICON_OPTIONS = ICON_NAMES;

type Translate = ReturnType<typeof useT>;

const buildFieldSchema = (t: Translate) => z.object({
  id: z.string(),
  label: z.string().min(1, t('admin.form.error.labelRequired')),
  key: z.string().min(1, t('admin.form.error.keyRequired')),
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

const buildCategoryFormSchema = (t: Translate) => z.object({
  name: z.string().min(1, t('admin.form.error.nameRequired')),
  slug: z.string().min(1, t('admin.form.error.slugRequired')),
  icon: z.string().min(1, t('admin.form.error.iconRequired')),
  description: z.string(),
  fields: z.array(buildFieldSchema(t)),
});

type CategoryFormValues = z.infer<ReturnType<typeof buildCategoryFormSchema>>;

export default function AdminCategoryForm() {
  const t = useT();
  const categoryFormSchema = useMemo(() => buildCategoryFormSchema(t), [t]);
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(categoryId);
  const search = searchParams.toString();
  const searchSuffix = search ? `?${search}` : '';
  const categoriesPath = withAdminSource('/admin/categories', searchSuffix);

  const { getCategoryById, addCategory, updateCategory, categories } = useCollectionStore();
  const existingCategory = categoryId ? getCategoryById(categoryId) : undefined;

  const [expandedFields, setExpandedFields] = useState<Set<number>>(new Set());
  const [slugTouched, setSlugTouched] = useState(false);

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
  const watchSlug = useWatch({ control, name: 'slug' });
  const watchFields = useWatch({ control, name: 'fields' });
  const resolvedSlug = resolveCategorySlug(watchSlug, watchName ?? '', categories ?? [], categoryId);

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
    if (!isEdit && !slugTouched && watchName) {
      setValue('slug', slugify(watchName));
    }
  }, [watchName, isEdit, slugTouched, setValue]);

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
      toast.success(t('admin.form.updated'));
    } else {
      addCategory({
        name: data.name,
        slug: data.slug,
        icon: data.icon,
        description: data.description,
        fields: fieldsWithOrder,
      });
      toast.success(t('admin.form.created'));
    }

    navigate(categoriesPath);
  };

  if (isEdit && !existingCategory) {
    return (
      <div className="space-y-4 sm:space-y-6 md:space-y-8">
        <PageHeader
          title={t('admin.form.notFoundTitle')}
          breadcrumbs={getAdminBreadcrumbs(searchSuffix, [{ label: t('admin.categories.title'), href: categoriesPath }])}
        />
        <p className="text-muted-foreground">{t('admin.form.notFoundDescription')}</p>
        <Button variant="outline" onClick={() => navigate(categoriesPath)}>
          {t('admin.form.backToCategories')}
        </Button>
      </div>
    );
  }

  const labelClass = 'text-xs font-medium text-muted-foreground';

  return (
    <PageTransition>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pb-24 sm:space-y-6 md:space-y-8">
      <PageHeader
        title={isEdit ? t('admin.form.editTitle') : t('admin.form.newTitle')}
        description={isEdit ? t('admin.form.editDescription') : t('admin.form.newDescription')}
        breadcrumbs={getAdminBreadcrumbs(searchSuffix, [
          { label: t('admin.categories.title'), href: categoriesPath },
          { label: isEdit ? t('admin.form.crumbEdit') : t('admin.form.crumbNew') },
        ])}
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">{t('admin.form.basicTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.form.basicDescription')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">
                {t('admin.form.name')} <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="name"
                placeholder={t('admin.form.namePlaceholder')}
                aria-invalid={Boolean(errors.name)}
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">
                {t('admin.form.slug')} <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Input
                id="slug"
                placeholder={t('admin.form.slugPlaceholder')}
                className="font-mono text-sm"
                aria-invalid={Boolean(errors.slug)}
                aria-describedby="slug-preview"
                {...register('slug', { onChange: () => setSlugTouched(true) })}
              />
              {errors.slug ? (
                <p className="text-sm text-destructive">{errors.slug.message}</p>
              ) : (
                <p id="slug-preview" className="text-xs text-muted-foreground">
                  {t('admin.form.slugPreview')}{' '}
                  <span className="font-mono text-foreground">/collections/{resolvedSlug}</span>
                  {slugify(watchSlug || watchName || '') !== resolvedSlug && (
                    <> · {t('admin.form.slugTaken')}</>
                  )}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-icon">{t('admin.form.icon')}</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => {
                const SelectedIcon = getCategoryIcon(field.value);
                return (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="category-icon" className="w-full sm:w-64">
                      <SelectValue>
                        <span className="flex items-center gap-2">
                          <SelectedIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
                          <span>{field.value === 'MoreHorizontal' ? t('admin.form.iconOther') : field.value}</span>
                        </span>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {ICON_OPTIONS.map((iconName) => {
                        const Icon = getCategoryIcon(iconName);
                        const isOther = iconName === 'MoreHorizontal';
                        return (
                          <SelectItem key={iconName} value={iconName}>
                            <span className="flex items-center gap-2.5">
                              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                              <span>{isOther ? t('admin.form.iconOther') : iconName}</span>
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
            <Label htmlFor="description">{t('admin.form.description')}</Label>
            <Textarea
              id="description"
              placeholder={t('admin.form.descriptionPlaceholder')}
              rows={3}
              {...register('description')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">{t('admin.form.fieldsTitle')}</h2>
              <p className="text-sm text-muted-foreground">{t('admin.form.fieldsDescription')}</p>
            </div>
            <Button type="button" variant="outline" onClick={handleAddField}>
              <Plus className="size-4" aria-hidden="true" />
              {t('admin.form.addField')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {fields.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed px-4 py-12 text-center">
              <p className="text-sm font-medium text-muted-foreground">{t('admin.form.noFieldsTitle')}</p>
              <p className="mt-1 text-xs text-muted-foreground/70">{t('admin.form.noFieldsDescription')}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={handleAddField}
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t('admin.form.addFirstField')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {fields.map((field, index) => {
                const fieldType = watchFields?.[index]?.type;
                const isExpanded = expandedFields.has(index);
                const showOptions = fieldType === 'select' || fieldType === 'multi-select';
                const currentOptions = watchFields?.[index]?.options ?? [];
                const fieldLabel = watchFields?.[index]?.label || t('admin.form.fieldN', { n: index + 1 });
                const idBase = `field-${index}`;

                return (
                  <div
                    key={field.id}
                    className={cn(
                      'flex items-start gap-2 rounded-lg border bg-card p-4 transition-all',
                      errors.fields?.[index] && 'border-destructive/50',
                    )}
                  >
                    <div className="mt-2.5 text-muted-foreground/50" aria-hidden="true">
                      <GripVertical className="size-4" />
                    </div>

                    <div className="flex-1 space-y-3">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`${idBase}-label`} className={labelClass}>{t('admin.form.fieldLabel')}</Label>
                          <Input
                            id={`${idBase}-label`}
                            placeholder={t('admin.form.fieldLabelPlaceholder')}
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
                            <p className="text-xs text-destructive">{errors.fields[index]?.label?.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`${idBase}-key`} className={labelClass}>{t('admin.form.fieldKey')}</Label>
                          <Input
                            id={`${idBase}-key`}
                            placeholder="field_key"
                            className="font-mono text-sm"
                            {...register(`fields.${index}.key`)}
                          />
                          {errors.fields?.[index]?.key && (
                            <p className="text-xs text-destructive">{errors.fields[index]?.key?.message}</p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor={`${idBase}-type`} className={labelClass}>{t('admin.form.fieldType')}</Label>
                          <Controller
                            control={control}
                            name={`fields.${index}.type`}
                            render={({ field: typeField }) => (
                              <Select value={typeField.value} onValueChange={typeField.onChange}>
                                <SelectTrigger id={`${idBase}-type`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {FIELD_TYPE_OPTIONS.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {t(`admin.fieldType.${type}`)}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <Controller
                            control={control}
                            name={`fields.${index}.required`}
                            render={({ field: reqField }) => (
                              <Switch
                                checked={reqField.value}
                                onCheckedChange={reqField.onChange}
                                id={`${idBase}-required`}
                              />
                            )}
                          />
                          <Label htmlFor={`${idBase}-required`} className="cursor-pointer text-sm font-normal">
                            {t('admin.form.required')}
                          </Label>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-muted-foreground"
                          aria-expanded={isExpanded}
                          onClick={() => toggleFieldExpansion(index)}
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp className="size-3.5" aria-hidden="true" />
                              {t('admin.form.lessOptions')}
                            </>
                          ) : (
                            <>
                              <ChevronDown className="size-3.5" aria-hidden="true" />
                              {t('admin.form.moreOptions')}
                            </>
                          )}
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="space-y-3 pt-1">
                          <Separator />
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div className="space-y-1.5">
                              <Label htmlFor={`${idBase}-placeholder`} className={labelClass}>
                                {t('admin.form.placeholder')}
                              </Label>
                              <Input
                                id={`${idBase}-placeholder`}
                                placeholder={t('admin.form.placeholderPlaceholder')}
                                {...register(`fields.${index}.placeholder`)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor={`${idBase}-help`} className={labelClass}>
                                {t('admin.form.helpText')}
                              </Label>
                              <Input
                                id={`${idBase}-help`}
                                placeholder={t('admin.form.helpTextPlaceholder')}
                                {...register(`fields.${index}.helpText`)}
                              />
                            </div>
                          </div>

                          {showOptions && (
                            <div className="space-y-2">
                              <Label htmlFor={`${idBase}-options`} className={labelClass}>
                                {t('admin.form.options')}
                              </Label>
                              <Input
                                id={`${idBase}-options`}
                                placeholder={t('admin.form.optionsPlaceholder')}
                                value={watchFields?.[index]?.options?.join(', ') ?? ''}
                                onChange={(e) => handleOptionsChange(index, e.target.value)}
                              />
                              {currentOptions.length > 0 && (
                                <div
                                  className="flex flex-wrap gap-1.5"
                                  aria-label={t('admin.form.optionsCount', { count: currentOptions.length })}
                                  role="group"
                                >
                                  {currentOptions.map((option, optionIndex) => (
                                    <Badge key={`${option}-${optionIndex}`} variant="secondary" className="text-xs">
                                      {option}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6 size-8 shrink-0 text-destructive hover:text-destructive"
                      aria-label={t('admin.form.removeFieldAria', { name: fieldLabel })}
                      onClick={() => handleRemoveField(index)}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-sm text-muted-foreground tabular-nums">
            {t('admin.form.fieldsDefined', { count: fields.length })}
          </p>
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(categoriesPath)}>
              <X className="size-4" aria-hidden="true" />
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <Save className="size-4" aria-hidden="true" />
              {isEdit ? t('admin.form.update') : t('admin.form.save')}
            </Button>
          </div>
        </div>
      </div>
    </form>
    </PageTransition>
  );
}
