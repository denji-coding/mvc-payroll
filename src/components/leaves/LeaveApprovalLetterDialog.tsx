import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, ExternalLink, Loader2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  GenerateLeaveApprovalLetterParams,
  generateLeaveApprovalLetterBlob,
  leaveApprovalLetterFileName,
} from '@/lib/generateLeaveApprovalLetter';
import { loadPdfJs } from '@/lib/pdfjs';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: GenerateLeaveApprovalLetterParams | null;
}

export function LeaveApprovalLetterDialog({ open, onOpenChange, params }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !params) {
      setBlob(null);
      setUrl(null);
      return;
    }
    let cancelled = false;
    let currentUrl: string | null = null;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const generated = await generateLeaveApprovalLetterBlob(params);
        if (cancelled) return;
        currentUrl = URL.createObjectURL(generated);
        setBlob(generated);
        setUrl(currentUrl);
      } catch (err) {
        console.error('Leave letter preview error', err);
        if (!cancelled) setError('Failed to generate the letter preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, params]);

  // Mobile browsers cannot reliably render PDFs in an iframe — render pages to canvas.
  useEffect(() => {
    if (!isMobile || !blob || !open) return;
    let cancelled = false;

    (async () => {
      try {
        const buffer = await blob.arrayBuffer();
        if (cancelled) return;
        const pdfjsLib = await loadPdfJs();
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
        console.error('Leave letter mobile render error', err);
        if (!cancelled) setError('Failed to render the letter preview.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isMobile, blob, open]);

  const triggerAnchor = (target?: string) => {
    if (!url || !params) return;
    const a = document.createElement('a');
    a.href = url;
    if (target) {
      a.target = target;
      a.rel = 'noopener noreferrer';
    } else {
      a.download = leaveApprovalLetterFileName(params);
    }
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>Leave Approval Letter</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted">
          {loading || !url ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
              {error ? (
                <span className="text-sm text-destructive">{error}</span>
              ) : (
                <>
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span className="text-sm">Generating letter...</span>
                </>
              )}
            </div>
          ) : isMobile ? (
            <div ref={canvasContainerRef} className="h-full w-full overflow-auto p-2" />
          ) : (
            <iframe src={url} title="Leave Approval Letter" className="h-full w-full border-0" />
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-2 border-t p-4 sm:justify-end">
          <Button variant="outline" disabled={!url} onClick={() => triggerAnchor('_blank')}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open in New Tab
          </Button>
          <Button
            className="bg-success text-success-foreground hover:bg-success/90"
            disabled={!url}
            onClick={() => triggerAnchor()}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
