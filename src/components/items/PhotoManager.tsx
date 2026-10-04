import { useRef, useState, type DragEvent } from 'react';
import { ArrowLeft, ArrowRight, Camera, ImagePlus, Plus, Star, Trash2 } from 'lucide-react';

import { useT } from '@/i18n';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ItemPhotosState } from '@/components/items/useItemPhotos';
import { useIsTouchDevice } from '@/components/items/itemEditorUtils';

const overlayButton =
  'flex items-center justify-center rounded-md bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white';

export function PhotoManager({
  photos,
  onChange,
  dense,
}: {
  photos: ItemPhotosState;
  /** Called after any user change (for the unsaved-changes guard). */
  onChange?: () => void;
  dense?: boolean;
}) {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const isTouch = useIsTouchDevice();
  const { images, coverIndex } = photos;

  const handleFiles = (files: FileList | null) => {
    photos.addFiles(files, onChange);
  };

  const dropHandlers = {
    onDragOver: (event: DragEvent) => { event.preventDefault(); setDragOver(true); },
    onDragLeave: () => setDragOver(false),
    onDrop: (event: DragEvent) => {
      event.preventDefault();
      setDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
  };

  // The full page always shows the dropzone (as the original did); the dialog only while empty.
  const showDropzone = !dense || images.length === 0;
  const actionSize = dense ? 'size-6' : 'size-7';
  const actionIcon = dense ? 'size-3' : 'size-3.5';

  return (
    <div className={cn(dense ? 'space-y-2' : 'space-y-4')}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple
        className="hidden"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-hidden="true"
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {showDropzone && (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          {...dropHandlers}
          className={cn(
            'group/drop relative flex w-full flex-col items-center justify-center overflow-hidden border-2 border-dashed text-center transition-all duration-200',
            dense ? 'gap-2 rounded-lg p-6' : 'gap-3 rounded-xl p-8',
            dragOver
              ? 'border-primary bg-primary/5 shadow-inner'
              : 'border-muted-foreground/25 bg-gradient-to-br from-primary/[0.03] via-transparent to-transparent hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          {dense ? (
            <ImagePlus className={cn('size-8', dragOver ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
          ) : (
            <span
              className={cn(
                'flex size-14 items-center justify-center rounded-full transition-all duration-200 group-hover/drop:scale-105',
                dragOver ? 'bg-primary/10' : 'bg-muted group-hover/drop:bg-primary/10',
              )}
            >
              <ImagePlus
                className={cn('size-7 transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground group-hover/drop:text-primary')}
                aria-hidden="true"
              />
            </span>
          )}
          <span className="block">
            <span className={cn('block', dense ? 'text-sm text-muted-foreground' : 'text-sm font-medium')}>
              {dragOver ? t('itemForm.photos.dropToUpload') : t('itemForm.photos.dropzone')}
            </span>
            <span className={cn('block text-xs text-muted-foreground', !dense && 'mt-1')}>
              {t('itemForm.photos.formats')}
            </span>
          </span>
        </button>
      )}

      {images.length > 0 && (
        <ul
          className={cn('grid', dense ? 'grid-cols-4 gap-2 sm:grid-cols-5' : 'grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4')}
          {...(showDropzone ? {} : dropHandlers)}
        >
          {images.map((src, index) => {
            const isCover = index === coverIndex;
            return (
              <li
                key={`${index}-${src.slice(-24)}`}
                className={cn(
                  'group relative aspect-square overflow-hidden border-2 bg-muted transition-all',
                  dense ? 'rounded-lg' : 'rounded-xl',
                  isCover
                    ? cn('border-primary', dense ? 'shadow-md' : 'shadow-lg shadow-primary/10')
                    : 'border-transparent hover:border-muted-foreground/30',
                )}
              >
                <img
                  src={src}
                  alt={t('itemForm.photos.alt', { index: index + 1 })}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />

                {isCover && (
                  <span
                    className={cn(
                      'absolute flex items-center gap-1 bg-primary font-semibold text-primary-foreground shadow',
                      dense ? 'left-1 top-1 rounded px-1.5 py-0.5 text-[9px]' : 'left-2 top-2 rounded-md px-2 py-0.5 text-[10px]',
                    )}
                  >
                    <Star className={dense ? 'size-2.5' : 'size-3'} aria-hidden="true" />
                    {t('itemForm.photos.cover')}
                  </span>
                )}

                {/* Hover overlay — also shown on keyboard focus and always on touch screens. */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-end justify-between bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity',
                    dense ? 'p-1' : 'p-2',
                    isTouch ? 'opacity-100' : 'opacity-0 group-focus-within:opacity-100 group-hover:opacity-100',
                  )}
                >
                  <div className="flex gap-1">
                    {!isCover && (
                      <button
                        type="button"
                        aria-label={t('itemForm.photos.setCover')}
                        title={t('itemForm.photos.setCover')}
                        onClick={() => { photos.setCoverIndex(index); onChange?.(); }}
                        className={cn(overlayButton, dense ? actionSize : 'h-7 gap-1 px-2 text-[10px] font-medium')}
                      >
                        <Star className={dense ? actionIcon : 'size-3'} aria-hidden="true" />
                        {!dense && <span aria-hidden="true">{t('itemForm.photos.cover')}</span>}
                      </button>
                    )}
                    {index > 0 && (
                      <button
                        type="button"
                        aria-label={t('itemForm.photos.moveLeft')}
                        title={t('itemForm.photos.moveLeft')}
                        onClick={() => { photos.moveImage(index, index - 1); onChange?.(); }}
                        className={cn(overlayButton, actionSize)}
                      >
                        <ArrowLeft className={actionIcon} aria-hidden="true" />
                      </button>
                    )}
                    {index < images.length - 1 && (
                      <button
                        type="button"
                        aria-label={t('itemForm.photos.moveRight')}
                        title={t('itemForm.photos.moveRight')}
                        onClick={() => { photos.moveImage(index, index + 1); onChange?.(); }}
                        className={cn(overlayButton, actionSize)}
                      >
                        <ArrowRight className={actionIcon} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={t('itemForm.photos.remove')}
                    title={t('itemForm.photos.remove')}
                    onClick={() => { photos.removeImage(index); onChange?.(); }}
                    className={cn(
                      'flex shrink-0 items-center justify-center rounded-md bg-red-500/90 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                      actionSize,
                    )}
                  >
                    <Trash2 className={actionIcon} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}

          <li>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex aspect-square w-full flex-col items-center justify-center border-2 border-dashed border-muted-foreground/25 transition-colors hover:border-primary/50 hover:bg-muted/30',
                dense ? 'gap-1 rounded-lg' : 'gap-2 rounded-xl',
              )}
            >
              <Plus className={cn('text-muted-foreground', dense ? 'size-5' : 'size-6')} aria-hidden="true" />
              <span className={cn('text-muted-foreground', dense ? 'text-[10px]' : 'text-xs')}>
                {t('itemForm.photos.addMore')}
              </span>
            </button>
          </li>
        </ul>
      )}

      {(isTouch || images.length > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {images.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              <span className="tabular-nums">{t('itemForm.photos.count', { count: images.length })}</span>
              {' · '}
              {isTouch ? t('itemForm.photos.tapHint') : t('itemForm.photos.hoverHint')}
            </p>
          ) : <span />}
          {isTouch && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 border-2 border-dashed"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera aria-hidden="true" />
              {t('itemForm.photos.takePhoto')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
