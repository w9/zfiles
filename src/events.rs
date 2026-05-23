use serde::Serialize;
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum KernelEvent {
    Connected {
        version: String,
        read_only: bool,
    },
    UploadProgress {
        id: String,
        offset: u64,
        length: Option<u64>,
    },
    FilesystemChanged { path: String },
    PluginReady { name: String },
    ListingEnrichment {
        path: String,
        entries: Vec<crate::fs::FileEntry>,
    },
    ThumbnailReady {
        path: String,
        url: String,
    },
}

#[derive(Clone)]
pub struct EventBus {
    sender: broadcast::Sender<KernelEvent>,
}

impl EventBus {
    pub fn new() -> Self {
        let (sender, _) = broadcast::channel(256);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<KernelEvent> {
        self.sender.subscribe()
    }

    pub fn publish(&self, event: KernelEvent) {
        let _ = self.sender.send(event);
    }
}

impl Default for EventBus {
    fn default() -> Self {
        Self::new()
    }
}
