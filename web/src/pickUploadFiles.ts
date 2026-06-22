/**
 * Open the native file picker. Invokes `onPicked` synchronously from the input
 * change handler (required on iOS Safari — Promise continuations after the native
 * picker often never run).
 */
export function pickUploadFiles(
  onPicked: (files: File[]) => void,
  multiple = true,
): void {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = multiple;
  input.style.display = "none";

  const finish = (files: File[]) => {
    onPicked(files);
    input.remove();
  };

  input.onchange = () => {
    const files = input.files ? Array.from(input.files) : [];
    finish(files);
  };

  input.oncancel = () => {
    finish([]);
  };

  document.body.appendChild(input);
  input.click();
}
