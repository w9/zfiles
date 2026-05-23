pub mod cache;
pub mod exif;
pub mod rpc;
pub mod thumb;

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

pub struct PluginState {
    pub root_path: PathBuf,
    pub storage_path: PathBuf,
    pub cache: cache::Cache,
    pub max_megapixels: u64,
}

pub type SharedState = Arc<Mutex<PluginState>>;

pub fn new_state() -> SharedState {
    Arc::new(Mutex::new(PluginState {
        root_path: PathBuf::new(),
        storage_path: PathBuf::new(),
        cache: cache::Cache::disabled(),
        max_megapixels: 200,
    }))
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use image::{ImageBuffer, Rgb};

    use crate::thumb;

    #[test]
    fn generates_webp_thumbnail_from_png_bytes() {
        let mut png = Vec::new();
        ImageBuffer::<Rgb<u8>, Vec<u8>>::from_fn(64, 48, |x, _y| {
            if x < 32 {
                Rgb([255, 0, 0])
            } else {
                Rgb([0, 128, 255])
            }
        })
        .write_to(&mut Cursor::new(&mut png), image::ImageFormat::Png)
        .unwrap();

        let webp = thumb::encode_thumbnail_from_bytes(&png, "grid", 200).unwrap();
        assert!(!webp.is_empty());
        assert!(webp.starts_with(b"RIFF"));
    }
}
