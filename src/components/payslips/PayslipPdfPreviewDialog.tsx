import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { loadPdfJs } from '@/lib/pdfjs';
import { buildPayslipPdfBlob, generatePayslipPdf, type GeneratePayslipPdfParams } from '@/lib/generatePayslipPdf';

interface Props {
  params: GeneratePayslipPdfParams;
  canDownload: boolean;
  title: string;
  description?: string;
  onClose: () => void;
}

/** View-only payslip PDF preview rendered to canvas (no native viewer toolbar, so it can't be saved unless allowed). */
export function PayslipPdfPreviewDialog({ params, canDownload, title, description, onClose }: Props) {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    buildPayslipPdfBlob(params).then((b) => { if (!cancelled) setBlob(b); }).catch((e) => {
      console.error('Payslip preview error', e);
      if (!cancelled) { setError('Failed to generate payslip preview.'); setRendering(false); }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    (async () => {
      try {
        const buffer = await blob.arrayBuffer();
        const pdfjsLib = await loadPdfJs();
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const container = containerRef.current;
        if (!container || cancelled) return;
        container.innerHTML = '';
        const width = Math.min(container.clientWidth || 320, 820);
        for (let n = 1; n <= doc.numPages; n++) {
          if (cancelled) return;
          const page = await doc.getPage(n);
          const base = page.getViewport({ scale: 1 });
          const vp = page.getViewport({ scale: (width - 16) / base.width });
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d')!;
          const dpr = window.devicePixelRatio || 1;
          canvas.width = vp.width * dpr;
          canvas.height = vp.height * dpr;
          canvas.style.width = `${vp.width}px`;
          canvas.style.height = `${vp.height}px`;
          canvas.className = 'mx-auto mb-3 shadow-sm bg-white';
          canvas.oncontextmenu = (e) => { if (!canDownload) e.preventDefault(); };
          ctx.scale(dpr, dpr);
          container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
        }
      } catch (e) {
        console.error('Payslip render error', e);
        if (!cancelled) setError('Failed to render payslip preview.');
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => { cancelled = true; };
  }, [blob, canDownload]);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative flex-1 overflow-auto bg-muted p-2">
          {(rendering || error) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              {error ? <span className="text-sm text-destructive">{error}</span> : <><Loader2 className="h-8 w-8 animate-spin" /><span className="text-sm">Preparing preview…</span></>}
            </div>
          )}
          <div ref={containerRef} className="w-full" />
        </div>
        <DialogFooter className="p-4 border-t flex-col sm:flex-row gap-2">
          {!canDownload && <p className="text-xs text-muted-foreground sm:mr-auto self-center">Download will be available after the payroll is processed.</p>}
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Close</Button>
          {canDownload && (
            <Button onClick={() => generatePayslipPdf(params, blob ?? undefined)} disabled={!blob} className="w-full sm:w-auto">
              <Download className="mr-2 h-4 w-4" /> Download Payslip
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
