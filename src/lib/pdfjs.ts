// Lazy loader for pdfjs-dist.
//
// pdfjs-dist ships very modern JavaScript. Importing it at module scope pulls it
// into the main bundle, so an older browser that cannot parse it blanks the whole
// app. Loading it on demand keeps any incompatibility contained to the PDF preview.

let pdfjsPromise: Promise<any> | null = null;

export function loadPdfJs(): Promise<any> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib: any = await import('pdfjs-dist');
      const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;
      return pdfjsLib;
    })().catch((err) => {
      pdfjsPromise = null;
      throw err;
    });
  }
  return pdfjsPromise;
}
