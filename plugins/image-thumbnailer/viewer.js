const IMAGE_GLOBS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".avif",
  ".tiff",
  ".tif",
  ".bmp",
  ".ico",
];

function isImagePath(path) {
  const lower = path.toLowerCase();
  return IMAGE_GLOBS.some((ext) => lower.endsWith(ext));
}

function encodePath(path) {
  return encodeURIComponent(path).replace(/%2F/g, "/");
}

function label(key, fallback) {
  return fallback;
}

export function mount(container, context) {
  const { path, dispatch, registerBridge } = context;
  if (!path || !isImagePath(path)) {
    container.replaceChildren();
    return;
  }

  const existing = container.querySelector(`[data-viewer-path="${path}"]`);
  if (existing) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "image-viewer flex min-h-[240px] flex-col gap-2";

  const viewport = document.createElement("div");
  viewport.className =
    "relative flex flex-1 items-center justify-center overflow-hidden rounded-md border bg-muted/30";
  viewport.style.minHeight = "240px";

  const img = document.createElement("img");
  img.alt = path.split("/").pop() ?? path;
  img.className = "max-h-[480px] max-w-full object-contain transition-opacity duration-200";
  img.decoding = "async";
  img.src = `/api/thumbnail?path=${encodePath(path)}&tier=preview`;

  const exifOverlay = document.createElement("pre");
  exifOverlay.className =
    "absolute bottom-2 left-2 hidden max-h-40 max-w-[80%] overflow-auto rounded bg-black/70 p-2 text-xs text-white";
  exifOverlay.textContent = "";

  const status = document.createElement("p");
  status.className = "text-xs text-muted-foreground";
  status.textContent = label("plugin.image-thumbnailer.viewer.loadingPreview", "Loading preview…");

  let statusPhase = 0;
  const setStatusPhase = (phase, text) => {
    if (phase <= statusPhase) {
      return;
    }
    statusPhase = phase;
    status.textContent = text;
  };

  const controls = document.createElement("div");
  controls.className = "flex flex-wrap gap-2 text-sm";

  let scale = 1;
  let rotation = 0;
  let fullscreen = false;

  const applyTransform = () => {
    img.style.transform = `scale(${scale}) rotate(${rotation}deg)`;
    img.style.transformOrigin = "center center";
  };

  const runAction = (actionId, fallback) => {
    if (dispatch) {
      dispatch(actionId);
      return;
    }
    fallback();
  };

  const bridge = {
    zoomIn: () => {
      scale = Math.min(scale * 1.25, 8);
      applyTransform();
    },
    zoomOut: () => {
      scale = Math.max(scale / 1.25, 0.25);
      applyTransform();
    },
    fitScreen: () => {
      scale = 1;
      applyTransform();
    },
    actualSize: () => {
      scale = 2;
      applyTransform();
    },
    rotateCw: () => {
      rotation = (rotation + 90) % 360;
      applyTransform();
    },
    toggleFullscreen: () => {
      fullscreen = !fullscreen;
      if (fullscreen) {
        viewport.requestFullscreen?.();
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.();
      }
    },
    toggleExif: () => {
      exifOverlay.classList.toggle("hidden");
    },
  };

  registerBridge?.(bridge);

  const zoomIn = document.createElement("button");
  zoomIn.type = "button";
  zoomIn.className = "rounded border px-2 py-1 hover:bg-muted";
  zoomIn.textContent = label("plugin.image-thumbnailer.viewer.zoomIn", "Zoom in");
  zoomIn.addEventListener("click", () =>
    runAction("plugin.image-thumbnailer.zoom-in", bridge.zoomIn),
  );

  const zoomOut = document.createElement("button");
  zoomOut.type = "button";
  zoomOut.className = "rounded border px-2 py-1 hover:bg-muted";
  zoomOut.textContent = label("plugin.image-thumbnailer.viewer.zoomOut", "Zoom out");
  zoomOut.addEventListener("click", () =>
    runAction("plugin.image-thumbnailer.zoom-out", bridge.zoomOut),
  );

  const fit = document.createElement("button");
  fit.type = "button";
  fit.className = "rounded border px-2 py-1 hover:bg-muted";
  fit.textContent = label("plugin.image-thumbnailer.viewer.fit", "Fit");
  fit.addEventListener("click", () =>
    runAction("plugin.image-thumbnailer.fit-screen", bridge.fitScreen),
  );

  const fullLink = document.createElement("a");
  fullLink.href = `/api/file?path=${encodePath(path)}`;
  fullLink.className = "text-primary underline-offset-4 hover:underline";
  fullLink.textContent = label("plugin.image-thumbnailer.viewer.openFull", "Open full resolution");
  fullLink.target = "_blank";
  fullLink.rel = "noopener noreferrer";

  wrapper.dataset.viewerPath = path;

  const onPreviewLoad = () => {
    setStatusPhase(
      1,
      label("plugin.image-thumbnailer.viewer.previewLoaded", "Preview loaded"),
    );
    const full = new Image();
    full.onload = () => {
      img.src = full.src;
      setStatusPhase(
        2,
        label("plugin.image-thumbnailer.viewer.fullResolution", "Full resolution"),
      );
    };
    full.onerror = () => {
      setStatusPhase(
        2,
        label(
          "plugin.image-thumbnailer.viewer.previewOnly",
          "Preview only (full file unavailable)",
        ),
      );
    };
    full.src = `/api/file?path=${encodePath(path)}`;
  };
  img.addEventListener("load", onPreviewLoad, { once: true });

  img.addEventListener("error", () => {
    setStatusPhase(
      2,
      label(
        "plugin.image-thumbnailer.viewer.thumbnailUnavailable",
        "Thumbnail unavailable",
      ),
    );
    img.remove();
  });

  void fetch(`/api/list?path=${encodePath(path.split("/").slice(0, -1).join("/"))}`)
    .then((response) => (response.ok ? response.json() : []))
    .then((entries) => {
      const entry = entries.find((item) => item.path === path);
      if (entry?.extra) {
        exifOverlay.textContent = JSON.stringify(entry.extra, null, 2);
      }
    })
    .catch(() => {});

  controls.append(zoomOut, fit, zoomIn, fullLink);
  viewport.append(img, exifOverlay);
  wrapper.append(viewport, status, controls);
  container.replaceChildren(wrapper);
}
