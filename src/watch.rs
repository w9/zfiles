use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use tokio::sync::mpsc;
use tracing::warn;

use crate::events::{EventBus, KernelEvent};

const DEBOUNCE: Duration = Duration::from_millis(300);

pub fn start(root: PathBuf, events: EventBus) -> Result<()> {
    let (tx, mut rx) = mpsc::unbounded_channel();

    let watch_root = root.clone();

    std::thread::spawn(move || {
        let mut watcher = match RecommendedWatcher::new(
            move |result| {
                let _ = tx.send(result);
            },
            Config::default(),
        ) {
            Ok(watcher) => watcher,
            Err(error) => {
                warn!(%error, "failed to create filesystem watcher");
                return;
            }
        };

        if let Err(error) = watcher.watch(&watch_root, RecursiveMode::Recursive) {
            warn!(%error, "failed to watch served directory");
            return;
        }

        loop {
            std::thread::sleep(Duration::from_secs(3600));
        }
    });

    tokio::spawn(async move {
        let mut pending: Option<PathBuf> = None;
        let mut debounce = tokio::time::interval(DEBOUNCE);
        debounce.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            tokio::select! {
                message = rx.recv() => {
                    match message {
                        Some(Ok(event)) if should_emit(&event) => {
                            pending = event.paths.first().cloned();
                            debounce.reset();
                        }
                        Some(Ok(_)) => {}
                        Some(Err(error)) => warn!(%error, "filesystem watch error"),
                        None => break,
                    }
                }
                _ = debounce.tick(), if pending.is_some() => {
                    if let Some(path) = pending.take()
                        && let Ok(relative) = path.strip_prefix(&root)
                    {
                        let relative = relative.to_string_lossy().replace('\\', "/");
                        if !is_ignored_watch_path(&relative) {
                            events.publish(KernelEvent::FilesystemChanged { path: relative });
                        }
                    }
                }
            }
        }
    });

    Ok(())
}

fn should_emit(event: &notify::Event) -> bool {
    matches!(
        event.kind,
        notify::EventKind::Create(_)
            | notify::EventKind::Modify(_)
            | notify::EventKind::Remove(_)
    )
}

fn is_ignored_watch_path(relative: &str) -> bool {
    relative == ".cursor"
        || relative.starts_with(".cursor/")
        || relative == ".zfiles"
        || relative.starts_with(".zfiles/")
        || relative == "target"
        || relative.starts_with("target/")
        || relative.contains("/node_modules/")
        || relative.starts_with("node_modules/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn emits_for_modify_events() {
        let event = notify::Event {
            kind: notify::EventKind::Modify(notify::event::ModifyKind::Name(
                notify::event::RenameMode::Any,
            )),
            paths: vec![PathBuf::from("/tmp/example.txt")],
            attrs: notify::event::EventAttributes::default(),
        };
        assert!(should_emit(&event));
    }

    #[test]
    fn ignores_dotfolder_and_cursor_paths() {
        assert!(is_ignored_watch_path(".cursor/debug.log"));
        assert!(is_ignored_watch_path(".zfiles/state.db"));
        assert!(is_ignored_watch_path("target/debug/deps/foo"));
        assert!(is_ignored_watch_path("web/node_modules/.vite/deps/foo"));
        assert!(!is_ignored_watch_path("README.md"));
    }
}
