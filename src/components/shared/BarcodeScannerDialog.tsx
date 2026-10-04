import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import {
  Camera, CameraOff, Keyboard, Loader2, ScanBarcode, ScanQrCode, BookOpen, ChevronRight, ExternalLink, RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { parseItemLink } from '@/lib/search';
import { useT } from '@/i18n';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';
import { useCollectionStore } from '@/store/useCollectionStore';

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Default: scan a book's ISBN barcode and look it up on Open Library. */
interface IsbnScannerProps extends BaseProps {
  mode?: 'isbn';
  onSelect: (book: BookSearchResult) => void;
  onItemFound?: never;
}

/** Scan a printed Curio QR label (`<origin>/items/<id>`) and report the item id. */
interface ItemScannerProps extends BaseProps {
  mode: 'item';
  onItemFound: (itemId: string) => void;
  onSelect?: never;
}

export type BarcodeScannerDialogProps = IsbnScannerProps | ItemScannerProps;

type InputMode = 'camera' | 'manual';

const SCANNING_STATE = 2;

export function BarcodeScannerDialog(props: BarcodeScannerDialogProps) {
  const { open, onOpenChange } = props;
  const scanTarget = props.mode ?? 'isbn';
  const isItemMode = scanTarget === 'item';
  const onSelect = props.mode === 'item' ? undefined : props.onSelect;
  const onItemFound = props.mode === 'item' ? props.onItemFound : undefined;

  const t = useT();
  const [mode, setMode] = useState<InputMode>('camera');
  const [manualValue, setManualValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  /** Camera stopped after a decode that did not lead anywhere — offer "Scan again". */
  const [scanStopped, setScanStopped] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = isItemMode ? 'item-qr-scanner-region' : 'barcode-scanner-region';
  const isInitializingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        const state = scanner.getState();
        if (state === SCANNING_STATE) {
          await scanner.stop();
        }
        scanner.clear();
        scannerRef.current = null;
      }
    } catch {
      scannerRef.current = null;
    }
  }, []);

  const lookupISBN = useCallback(async (isbn: string) => {
    const cleaned = isbn.replace(/[^0-9X]/gi, '');
    if (cleaned.length !== 10 && cleaned.length !== 13) {
      toast.error(t('nav.scanner.invalidIsbn'));
      setScanStopped(true);
      return;
    }
    setScannedCode(cleaned);
    setLoading(true);
    setResult(null);
    try {
      const book = await bookSearchService.searchByISBN(cleaned);
      if (book) {
        setResult(book);
      } else {
        toast.error(t('nav.scanner.noBook', { isbn: cleaned }));
        setScanStopped(true);
      }
    } catch {
      toast.error(t('nav.scanner.lookupFailed'));
      setScanStopped(true);
    } finally {
      setLoading(false);
    }
  }, [t]);

  const openItemCode = useCallback((text: string) => {
    const trimmed = text.trim();
    const { items } = useCollectionStore.getState();
    const itemId = parseItemLink(trimmed) ?? (items.some((item) => item.id === trimmed) ? trimmed : null);
    if (!itemId) {
      toast.error(t('nav.scanner.notCurioLabel'));
      setScanStopped(true);
      return;
    }
    if (!items.some((item) => item.id === itemId)) {
      toast.error(t('nav.scanner.itemNotFound'));
      setScanStopped(true);
      return;
    }
    onItemFound?.(itemId);
    onOpenChange(false);
  }, [onItemFound, onOpenChange, t]);

  const handleDecoded = useCallback((text: string) => {
    if (isItemMode) openItemCode(text);
    else void lookupISBN(text);
  }, [isItemMode, lookupISBN, openItemCode]);
  // Read through a ref so a parent re-render (new callback identity) never restarts the camera.
  const handleDecodedRef = useRef(handleDecoded);
  useEffect(() => {
    handleDecodedRef.current = handleDecoded;
  }, [handleDecoded]);

  const startScanner = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setCameraError(null);
    setScanStopped(false);

    await stopScanner();

    await new Promise((r) => setTimeout(r, 300));

    const container = document.getElementById(scannerContainerId);
    if (!container) {
      isInitializingRef.current = false;
      return;
    }

    try {
      const scanner = new Html5Qrcode(scannerContainerId, { verbose: false });
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: isItemMode ? { width: 220, height: 220 } : { width: 280, height: 120 },
          aspectRatio: isItemMode ? 1 : 1.5,
          disableFlip: false,
        },
        (decodedText) => {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
          scannerRef.current = null;
          handleDecodedRef.current(decodedText);
        },
        () => {},
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError(t('nav.scanner.permissionDenied'));
      } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
        setCameraError(t('nav.scanner.noCamera'));
      } else {
        setCameraError(isItemMode ? t('nav.scanner.cameraFailedItem') : t('nav.scanner.cameraFailedIsbn'));
      }
      setMode('manual');
    } finally {
      isInitializingRef.current = false;
    }
  }, [stopScanner, scannerContainerId, isItemMode, t]);

  useEffect(() => {
    if (open && mode === 'camera') {
      const timer = setTimeout(startScanner, 200);
      return () => clearTimeout(timer);
    }
    if (!open || mode !== 'camera') {
      stopScanner();
    }
  }, [open, mode, startScanner, stopScanner]);

  useEffect(() => {
    if (!open) {
      stopScanner();
      setResult(null);
      setScannedCode(null);
      setManualValue('');
      setCameraError(null);
      setScanStopped(false);
      setMode('camera');
      isInitializingRef.current = false;
    }
  }, [open, stopScanner]);

  const handleManualSubmit = () => {
    const value = manualValue.trim();
    if (!value) return;
    if (isItemMode) openItemCode(value);
    else void lookupISBN(value);
  };

  const handleSelectBook = () => {
    if (result) {
      onSelect?.(result);
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setScannedCode(null);
    if (mode === 'camera') startScanner();
  };

  const tabClass = (active: boolean) => cn(
    'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/50',
    active
      ? 'border-b-2 border-primary text-primary'
      : 'text-muted-foreground hover:text-foreground',
  );

  const TitleIcon = isItemMode ? ScanQrCode : ScanBarcode;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <TitleIcon aria-hidden="true" className="size-5 text-primary" />
            {isItemMode ? t('nav.scanner.itemTitle') : t('nav.scanner.isbnTitle')}
          </DialogTitle>
          <DialogDescription>
            {isItemMode ? t('nav.scanner.itemDescription') : t('nav.scanner.isbnDescription')}
          </DialogDescription>
        </DialogHeader>

        {/* Input mode */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setMode('camera')}
            aria-pressed={mode === 'camera'}
            className={tabClass(mode === 'camera')}
          >
            <Camera aria-hidden="true" className="size-4" /> {t('nav.scanner.camera')}
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            aria-pressed={mode === 'manual'}
            className={tabClass(mode === 'manual')}
          >
            <Keyboard aria-hidden="true" className="size-4" /> {t('nav.scanner.manual')}
          </button>
        </div>

        <div className="p-6">
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-lg border bg-muted/30 p-4">
                {result.coverUrl ? (
                  <img src={result.coverUrl} alt={result.title}
                    className="h-24 w-16 shrink-0 rounded-md border object-cover shadow-sm" />
                ) : (
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md border bg-muted">
                    <BookOpen aria-hidden="true" className="size-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold leading-tight">{result.title}</p>
                  <p className="text-sm text-muted-foreground">{result.author}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.publishYear && <Badge variant="secondary" className="text-[10px] tabular-nums">{result.publishYear}</Badge>}
                    {result.pageCount && (
                      <Badge variant="outline" className="text-[10px] tabular-nums">
                        {t('nav.scanner.pages', { count: result.pageCount })}
                      </Badge>
                    )}
                    {scannedCode && <Badge variant="outline" className="font-mono text-[10px]">ISBN: {scannedCode}</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetry} className="flex-1">
                  {t('nav.scanner.scanAgain')}
                </Button>
                <Button onClick={handleSelectBook} className="flex-1 gap-1.5">
                  {t('nav.scanner.useBook')} <ChevronRight aria-hidden="true" className="size-4" />
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12" role="status">
              <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                {t('nav.scanner.lookingUp')} <span className="font-mono">{scannedCode}</span>
              </p>
            </div>
          ) : mode === 'camera' ? (
            <div className="space-y-4">
              {cameraError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 p-8 text-center">
                  <CameraOff aria-hidden="true" className="size-10 text-destructive/60" />
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button variant="outline" size="sm" onClick={() => startScanner()}>
                    {t('common.retry')}
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-primary/30 bg-black">
                    <div id={scannerContainerId} className="w-full" />
                    {!scanStopped && (
                      <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <div className="h-[2px] w-3/4 animate-pulse bg-primary/60 shadow-[0_0_8px_2px] shadow-primary/30" />
                      </div>
                    )}
                    {scanStopped && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                        <Button variant="outline" size="sm" onClick={() => startScanner()}>
                          <RotateCcw aria-hidden="true" />
                          {t('nav.scanner.scanAgain')}
                        </Button>
                      </div>
                    )}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    {isItemMode ? t('nav.scanner.itemCameraHint') : t('nav.scanner.isbnCameraHint')}
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label htmlFor="scanner-manual-input" className="text-sm font-medium">
                {isItemMode ? t('nav.scanner.itemManualLabel') : t('nav.scanner.isbnManualLabel')}
              </label>
              <div className="flex gap-2">
                <Input
                  id="scanner-manual-input"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={isItemMode ? t('nav.scanner.itemManualPlaceholder') : t('nav.scanner.isbnManualPlaceholder')}
                  className="font-mono"
                  inputMode={isItemMode ? 'url' : 'numeric'}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); } }}
                  autoFocus
                />
                <Button onClick={handleManualSubmit} disabled={!manualValue.trim()}>
                  {isItemMode ? t('nav.scanner.open') : t('common.search')}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {isItemMode ? t('nav.scanner.itemManualHelp') : t('nav.scanner.isbnManualHelp')}
              </p>
            </div>
          )}
        </div>

        {!isItemMode && (
          <div className="flex items-center border-t px-6 py-3">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ExternalLink aria-hidden="true" className="size-3" />
              {t('nav.scanner.poweredBy')}
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
