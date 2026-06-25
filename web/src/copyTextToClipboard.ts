function fallbackCopyText(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export type CopyTextMethod = "clipboard-api" | "exec-command";

export async function copyTextToClipboard(
  text: string,
): Promise<CopyTextMethod> {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return "clipboard-api";
    } catch {
      // Fall back when permission or user-gesture checks fail.
    }
  }

  if (fallbackCopyText(text)) {
    return "exec-command";
  }

  throw new Error("copy unavailable");
}
