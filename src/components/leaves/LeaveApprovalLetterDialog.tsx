import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  GenerateLeaveApprovalLetterParams,
  generateLeaveApprovalLetterBlobUrl,
  downloadLeaveApprovalLetter,
} from '@/lib/generateLeaveApprovalLetter';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  params: GenerateLeaveApprovalLetterParams | null;
}

export function LeaveApprovalLetterDialog({ open, onOpenChange, params }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !params) {
      setUrl(null);
      return;
    }
    const objectUrl = generateLeaveApprovalLetterBlobUrl(params);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [open, params]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Leave Approval Letter</DialogTitle>
        </DialogHeader>
        <div className="h-[70vh] w-full overflow-hidden rounded-md border bg-muted">
          {url && (
            <iframe src={url} title="Leave Approval Letter" className="h-full w-full" />
          )}
        </div>
        <div className="flex justify-end">
          <Button
            className="bg-success text-success-foreground hover:bg-success/90"
            onClick={() => params && downloadLeaveApprovalLetter(params)}
          >
            <Download className="mr-2 h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
