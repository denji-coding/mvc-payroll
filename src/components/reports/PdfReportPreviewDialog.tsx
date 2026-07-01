import { useEffect, useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import { PdfReportDocument, PdfReportProps } from './PdfReportDocument';
import { format } from 'date-fns';

interface Props extends PdfReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
}

export function PdfReportPreviewDialog({ open, onOpenChange, fileName, ...docProps }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const safeFile = `${fileName}-${format(docProps.generatedAt, 'yyyy-MM-dd')}.pdf`;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let currentUrl: string | null = null;

    (async () => {
      setLoading(true);
      try {
        const instance = pdf(<PdfReportDocument {...docProps} />);
        const blob = await instance.toBlob();
        if (cancelled) return;
        currentUrl = URL.createObjectURL(blob);
        setBlobUrl(currentUrl);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      setBlobUrl(null);
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

        <div className="flex-1 overflow-hidden bg-muted flex items-center justify-center">
          {loading || !blobUrl ? (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-sm">Preparing preview…</span>
            </div>
          ) : (
            <iframe
              key={blobUrl}
              src={`${blobUrl}#toolbar=0&navpanes=0&view=FitH`}
              title="PDF Preview"
              className="w-full h-full border-0 bg-white"
            />
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
