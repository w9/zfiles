export type FileActivation = "preview";

// Every non-directory listing entry opens the Preview overlay. Unsupported
// native types show an unavailable message with an optional text view.
export function resolveFileActivation(_path: string): FileActivation {
  return "preview";
}
