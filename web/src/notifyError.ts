import { toast } from "sonner";

import { messageFromApiResponse } from "./apiError";
import type { MessageKey } from "./i18n";

type Translate = (key: MessageKey, params?: Record<string, string>) => string;

export function notifyError(message: string): void {
  toast.error(message);
}

export async function notifyApiError(
  response: Response,
  t: Translate,
): Promise<void> {
  notifyError(await messageFromApiResponse(response, t));
}
