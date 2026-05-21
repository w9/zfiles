export function mount(container, context) {
  const wrapper = document.createElement("div");
  wrapper.className = "esm-viewer";
  const title = document.createElement("p");
  title.className = "meta";
  title.textContent = `ESM viewer for ${context.path}`;
  const body = document.createElement("pre");
  body.className = "preview-text esm-viewer-body";
  body.textContent = context.body ?? "";
  wrapper.append(title, body);
  container.replaceChildren(wrapper);
}
