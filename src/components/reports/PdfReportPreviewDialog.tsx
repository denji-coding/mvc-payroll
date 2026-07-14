import { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2, ExternalLink } from 'lucide-react';
import { PdfReportDocument, PdfReportProps } from './PdfReportDocument';
import { format } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface Props extends PdfReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
}

export function PdfReportPreviewDialog({ open, onOpenChange, fileName, ...docProps }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const safeFile = `${fileName}-${format(docProps.generatedAt, 'yyyy-MM-dd')}.pdf`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const instance = pdf(<PdfReportDocument {...docProps} />);
        const generatedBlob = await instance.toBlob();
        if (cancelled) return;
        currentUrl = URL.createObjectURL(generatedBlob);
        setBlob(generatedBlob);
        setBlobUrl(currentUrl);
      } catch (err) {
        console.error('PDF preview error', err);
        if (!cancelled) setError('Failed to generate PDF preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setBlobUrl(null);
      setBlob(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Render pages to canvases on mobile (iframe PDF preview is unreliable on mobile browsers).
  useEffect(() => {
    if (!isMobile || !blob || !open) return;
    let cancelled = false;

    (async () => {
      try {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const pdfDoc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const container = canvasContainerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';
        const containerWidth = container.clientWidth || 320;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
          if (cancelled) return;
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1 });
          const scale = (containerWidth - 16) / viewport.width;
          const scaledViewport = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = scaledViewport.width * dpr;
          canvas.height = scaledViewport.height * dpr;
          canvas.style.width = `${scaledViewport.width}px`;
          canvas.style.height = `${scaledViewport.height}px`;
          canvas.className = 'mx-auto mb-3 shadow-sm bg-white';
          ctx.scale(dpr, dpr);
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport: scaledViewport, canvas }).promise;
        }
      } catch (err) {
        console.error('PDF mobile render error', err);
        if (!cancelled) setError('Failed to render PDF preview.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isMobile, blob, open]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFile;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleOpenNewTab = () => {
    if (!blobUrl) return;
    // window.open with blob URLs is unreliable on mobile; use an anchor click instead.
    const a = document.createElement('a');
    a.href = blobUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{docProps.reportTitle} — Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted">
          {loading || !blobUrl ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {error ? (
                <span className="text-sm text-destructive">{error}</span>
              ) : (
                <>
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="text-sm">Preparing preview…</span>
                </>
              )}
            </div>
          ) : isMobile ? (
            <div
              ref={canvasContainerRef}
              className="w-full h-full overflow-auto p-2 bg-muted"
            />
          ) : (
            <iframe
              key={blobUrl}
              src={blobUrl}
              title="PDF Preview"
              className="w-full h-full border-0 bg-white"
            />
          )}
        </div>

        <DialogFooter className="p-4 border-t gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button variant="outline" onClick={handleOpenNewTab} disabled={!blobUrl || loading}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in New Tab
          </Button>
          <Button
            onClick={handleDownload}
            disabled={!blobUrl || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
