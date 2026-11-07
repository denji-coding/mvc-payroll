import { toast } from 'sonner';

/**
 * System-wide form notification standard.
 *
 * One persistent pop-up (sonner) per save operation:
 *  1. On submit: "Saving..." with a loading animation, no auto-dismiss.
 *  2. It stays visible while the data is being processed/saved.
 *  3. On success it changes in place to the entity's success message.
 *  4. On failure it changes in place to "Failed to save <Entity>. Please try again."
 *     with the specific error as the description.
 *  5. Auto-dismiss: success 4s, error 5s.
 *
 * The Processing state always shows for at least MIN_PROCESSING_MS so it
 * does not flash when the request is fast.
 */

const MIN_PROCESSING_MS = 600;
const SUCCESS_DURATION_MS = 4000;
const ERROR_DURATION_MS = 5000;

export type NotifyId = string | number;

const startedAt = new Map<NotifyId, number>();

/** Start the persistent "Processing" pop-up. Returns the toast id. */
export function notifyProcessing(message = 'Saving...'): NotifyId {
  const id = toast.loading(message, { duration: Infinity });
  startedAt.set(id, Date.now());
  return id;
}

/** Transition a processing toast to its success state. */
export function notifySuccess(id: NotifyId, message: string, description?: string): void {
  const delay = remainingDelay(id);
  window.setTimeout(() => {
    toast.success(message, { id, duration: SUCCESS_DURATION_MS, description });
    startedAt.delete(id);
  }, delay);
}

/**
 * Transition a processing toast to its error state.
 * `verb` is "save" by default; use "delete" or "process" where it reads better.
 */
export function notifyError(
  id: NotifyId,
  entityLabel: string,
  error?: unknown,
  verb: 'save' | 'delete' | 'process' | 'restore' | 'generate' = 'save',
): void {
  const delay = remainingDelay(id);
  const detail =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : undefined;
  window.setTimeout(() => {
    toast.error(`Failed to ${verb} ${entityLabel}. Please try again.`, {
      id,
      duration: ERROR_DURATION_MS,
      description: detail,
    });
    startedAt.delete(id);
  }, delay);
}

function remainingDelay(id: NotifyId): number {
  const start = startedAt.get(id) ?? Date.now();
  return Math.max(0, MIN_PROCESSING_MS - (Date.now() - start));
}

/**
 * Run an async operation with the standard notification flow.
 * Used by form pages that manage their own save logic instead of a mutation hook.
 */
export async function withNotifications<T>(
  work: () => Promise<T>,
  options: {
    processing?: string;
    success?: string;
    entityLabel: string;
    verb?: 'save' | 'delete' | 'process';
  },
): Promise<T> {
  const id = notifyProcessing(options.processing);
  try {
    const result = await work();
    if (options.success) notifySuccess(id, options.success);
    else toast.dismiss(id);
    return result;
  } catch (error) {
    notifyError(id, options.entityLabel, error, options.verb);
    throw error;
  }
}
