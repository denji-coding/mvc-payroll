import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Polyfill Promise.withResolvers for older desktop browsers (Chrome <119, etc.)
// Required by pdfjs-dist v4+ used in the report preview.
if (typeof (Promise as any).withResolvers !== "function") {
  (Promise as any).withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// Polyfill Promise.try for environments that don't support it yet
if (typeof (Promise as any).try !== "function") {
  (Promise as any).try = function <T>(fn: () => T | PromiseLike<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      try {
        resolve(fn());
      } catch (error) {
        reject(error);
      }
    });
  };
}

createRoot(document.getElementById("root")!).render(<App />);
