import { useEffect, useRef, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { PdfReportDocument, PdfReportProps } from './PdfReportDocument';
import { format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore vite worker import
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

interface Props extends PdfReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
}

export function PdfReportPreviewDialog({ open, onOpenChange, fileName, ...docProps }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [pageImages, setPageImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const safeFile = `${fileName}-${format(docProps.generatedAt, 'yyyy-MM-dd')}.pdf`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    (async () => {
      setLoading(true);
      setPageImages([]);
      try {
        const instance = pdf(<PdfReportDocument {...docProps} />);
        const blob = await instance.toBlob();
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);

        const arrayBuffer = await blob.arrayBuffer();
        const doc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const images: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
          images.push(canvas.toDataURL('image/png'));
        }
        if (!cancelled) setPageImages(images);
      } catch (err) {
        console.error('PDF preview error', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setBlobUrl(null);
      setPageImages([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = safeFile;
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

        <div ref={scrollRef} className="flex-1 overflow-auto bg-muted p-4">
          {loading && pageImages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Preparing preview…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              {pageImages.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Page ${i + 1}`}
                  className="w-full max-w-4xl h-auto shadow-lg bg-white"
                />
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
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
