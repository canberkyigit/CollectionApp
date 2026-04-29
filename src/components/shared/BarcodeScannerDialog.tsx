import { useCallback, useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { toast } from 'sonner';
import {
  Camera, CameraOff, Keyboard, Loader2, ScanBarcode, BookOpen, ChevronRight, ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { bookSearchService, type BookSearchResult } from '@/services/bookSearchService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (book: BookSearchResult) => void;
}

type ScanMode = 'camera' | 'manual';

export function BarcodeScannerDialog({ open, onOpenChange, onSelect }: Props) {
  const [mode, setMode] = useState<ScanMode>('camera');
  const [manualIsbn, setManualIsbn] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BookSearchResult | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string | null>(null);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = 'barcode-scanner-region';
  const isInitializingRef = useRef(false);

  const stopScanner = useCallback(async () => {
    try {
      const scanner = scannerRef.current;
      if (scanner) {
        const state = scanner.getState();
        if (state === 2) { // SCANNING
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
      toast.error('Invalid ISBN. Must be 10 or 13 digits.');
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
        toast.error(`No book found for ISBN: ${cleaned}`);
      }
    } catch {
      toast.error('ISBN lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;
    setCameraError(null);

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
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.5,
          disableFlip: false,
        },
        (decodedText) => {
          scanner.stop().then(() => scanner.clear()).catch(() => {});
          scannerRef.current = null;
          lookupISBN(decodedText);
        },
        () => {},
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        setCameraError('Camera permission was denied. Enable camera access in your browser settings and try again.');
      } else if (msg.includes('NotFound') || msg.includes('Requested device not found')) {
        setCameraError('No camera detected on this device. Switch to manual entry to continue.');
      } else {
        setCameraError('Could not start the camera. You can enter the ISBN manually instead.');
      }
      setMode('manual');
    } finally {
      isInitializingRef.current = false;
    }
  }, [stopScanner, lookupISBN]);

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
      setManualIsbn('');
      setCameraError(null);
      setMode('camera');
      isInitializingRef.current = false;
    }
  }, [open, stopScanner]);

  const handleManualSubmit = () => {
    if (manualIsbn.trim()) lookupISBN(manualIsbn.trim());
  };

  const handleSelectBook = () => {
    if (result) {
      onSelect(result);
      onOpenChange(false);
    }
  };

  const handleRetry = () => {
    setResult(null);
    setScannedCode(null);
    if (mode === 'camera') startScanner();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <ScanBarcode className="size-5 text-primary" />
            ISBN Barcode Scanner
          </DialogTitle>
          <DialogDescription>Scan a book's barcode or enter ISBN manually</DialogDescription>
        </DialogHeader>

        {/* Mode Tabs */}
        <div className="flex border-b">
          <button
            type="button"
            onClick={() => setMode('camera')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
              mode === 'camera'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Camera className="size-4" /> Camera
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 py-2.5 text-sm font-medium transition-colors',
              mode === 'manual'
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Keyboard className="size-4" /> Manual
          </button>
        </div>

        <div className="p-6">
          {/* Result Display */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-lg border bg-muted/30 p-4">
                {result.coverUrl ? (
                  <img src={result.coverUrl} alt={result.title}
                    className="h-24 w-16 shrink-0 rounded-md border object-cover shadow-sm" />
                ) : (
                  <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-md border bg-muted">
                    <BookOpen className="size-6 text-muted-foreground/50" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold leading-tight">{result.title}</p>
                  <p className="text-sm text-muted-foreground">{result.author}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {result.publishYear && <Badge variant="secondary" className="text-[10px]">{result.publishYear}</Badge>}
                    {result.pageCount && <Badge variant="outline" className="text-[10px]">{result.pageCount} pages</Badge>}
                    {scannedCode && <Badge variant="outline" className="text-[10px] font-mono">ISBN: {scannedCode}</Badge>}
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={handleRetry} className="flex-1">
                  Scan Again
                </Button>
                <Button onClick={handleSelectBook} className="flex-1 gap-1.5">
                  Use This Book <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Looking up ISBN: {scannedCode}...</p>
            </div>
          ) : mode === 'camera' ? (
            <div className="space-y-4">
              {cameraError ? (
                <div className="flex flex-col items-center gap-3 rounded-lg border-2 border-dashed border-destructive/30 bg-destructive/5 p-8 text-center">
                  <CameraOff className="size-10 text-destructive/60" />
                  <p className="text-sm text-destructive">{cameraError}</p>
                  <Button variant="outline" size="sm" onClick={() => startScanner()}>
                    Retry
                  </Button>
                </div>
              ) : (
                <>
                  <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-primary/30 bg-black">
                    <div id={scannerContainerId} className="w-full" />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="h-[2px] w-3/4 animate-pulse bg-primary/60 shadow-[0_0_8px_2px] shadow-primary/30" />
                    </div>
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Position the barcode within the frame. It will be detected automatically.
                  </p>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Enter ISBN</p>
                <div className="flex gap-2">
                  <Input
                    value={manualIsbn}
                    onChange={(e) => setManualIsbn(e.target.value)}
                    placeholder="e.g. 9780141439518"
                    className="font-mono"
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleManualSubmit(); } }}
                    autoFocus
                  />
                  <Button onClick={handleManualSubmit} disabled={!manualIsbn.trim()}>
                    Search
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  ISBN-10 or ISBN-13 accepted. Usually found on the back cover.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-6 py-3">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3" />Powered by Open Library
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
