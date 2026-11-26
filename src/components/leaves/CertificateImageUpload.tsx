import { useRef, useState } from 'react';
import { CloudUpload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function CertificateImageUpload({ onFiles }: { onFiles: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        aria-label="Upload Medical Certificate images"
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />
      <Button
        type="button"
        variant="outline"
        className={cn('h-44 w-full flex-col gap-3 rounded-lg border-2 border-dashed border-primary/50 bg-primary/20 text-foreground hover:bg-primary/25 [&_svg]:!size-16', dragging && 'border-primary bg-primary/30')}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onFiles(Array.from(event.dataTransfer.files));
        }}
        aria-label="Drag and drop images here or click to browse"
      >
        <span className="text-base font-semibold">Drag &amp; Drop Images Here</span>
        <CloudUpload className="h-16 w-16 stroke-1 text-primary/50" aria-hidden="true" />
        <span className="text-xs font-normal">or click to browse</span>
      </Button>
    </>
  );
}