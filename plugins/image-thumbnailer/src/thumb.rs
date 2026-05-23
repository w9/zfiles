use std::io::Cursor;

use anyhow::{Context, Result, bail};
use image::imageops::FilterType;
use image::{DynamicImage, GenericImageView, ImageReader};
use sha2::{Digest, Sha256};
use webp::Encoder;

use crate::exif::{apply_orientation, orientation_from_exif};

pub fn tier_max_dimension(tier: &str) -> u32 {
    match tier {
        "preview" => 1024,
        _ => 256,
    }
}

pub fn encode_thumbnail_from_bytes(
    bytes: &[u8],
    tier: &str,
    max_megapixels: u64,
) -> Result<Vec<u8>> {
    let _hash = hash_bytes(bytes);
    let orientation = orientation_from_exif(bytes);
    let image = decode_with_limit(bytes, max_megapixels)?;
    let oriented = apply_orientation(image, orientation);
    let resized = resize_to_tier(oriented, tier_max_dimension(tier));
    encode_webp(&resized)
}

pub fn hash_bytes(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
}

fn decode_with_limit(bytes: &[u8], max_megapixels: u64) -> Result<DynamicImage> {
    let reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .context("guess image format")?;
    let (width, height) = reader
        .into_dimensions()
        .context("read image dimensions")?;
    let pixels = width as u64 * height as u64;
    let limit = max_megapixels.saturating_mul(1_000_000);
    if pixels > limit {
        bail!("image exceeds {max_megapixels} megapixel limit ({width}x{height})");
    }

    ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .context("guess image format")?
        .decode()
        .context("decode image")
}

fn resize_to_tier(image: DynamicImage, max_dimension: u32) -> DynamicImage {
    let (width, height) = image.dimensions();
    let longest = width.max(height);
    if longest <= max_dimension {
        return image;
    }
    let scale = max_dimension as f32 / longest as f32;
    let target_w = ((width as f32 * scale).round() as u32).max(1);
    let target_h = ((height as f32 * scale).round() as u32).max(1);
    image.resize(target_w, target_h, FilterType::Triangle)
}

pub fn encode_thumbnail_from_dynamic_image(
    image: DynamicImage,
    tier: &str,
) -> Result<Vec<u8>> {
    let resized = resize_to_tier(image, tier_max_dimension(tier));
    encode_webp(&resized)
}

fn encode_webp(image: &DynamicImage) -> Result<Vec<u8>> {
    let rgba = image.to_rgba8();
    let (width, height) = rgba.dimensions();
    let encoder = Encoder::from_rgba(&rgba, width, height);
    Ok(encoder.encode(82.0).to_vec())
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageBuffer, Rgb};

    #[test]
    fn resize_keeps_small_images_unchanged_dimensions() {
        let image = DynamicImage::ImageRgb8(ImageBuffer::from_fn(100, 80, |_, _| Rgb([1, 2, 3])));
        let resized = resize_to_tier(image, 256);
        assert_eq!(resized.dimensions(), (100, 80));
    }
}
