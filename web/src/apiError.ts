import type { MessageKey } from "./i18n";

type Translate = (key: MessageKey) => string;

export function mapApiErrorBody(body: string, t: Translate): string | null {
  const trimmed = body.trim();
  if (trimmed.includes("path escapes served directory")) {
    return t("error.pathEscapesRoot");
  }
  return null;
}

export async function messageFromApiResponse(
  response: Response,
  t: Translate,
): Promise<string> {
  const body = await response.text();
  return mapApiErrorBody(body, t) ?? (body.trim() || `HTTP ${response.status}`);
}
