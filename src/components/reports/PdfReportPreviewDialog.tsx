import { PDFViewer, PDFDownloadLink } from '@react-pdf/renderer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { PdfReportDocument, PdfReportProps } from './PdfReportDocument';
import { format } from 'date-fns';

interface Props extends PdfReportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
}

export function PdfReportPreviewDialog({ open, onOpenChange, fileName, ...docProps }: Props) {
  const doc = <PdfReportDocument {...docProps} />;
  const safeFile = `${fileName}-${format(docProps.generatedAt, 'yyyy-MM-dd')}.pdf`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle>{docProps.reportTitle} — Preview</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted">
          {open && (
            <PDFViewer width="100%" height="100%" showToolbar={false} style={{ border: 0 }}>
              {doc}
            </PDFViewer>
          )}
        </div>

        <DialogFooter className="p-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <PDFDownloadLink document={doc} fileName={safeFile}>
            {({ loading }) => (
              <Button disabled={loading}>
                <Download className="mr-2 h-4 w-4" />
                {loading ? 'Preparing...' : 'Download PDF'}
              </Button>
            )}
          </PDFDownloadLink>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
