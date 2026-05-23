use std::io::Cursor;

use exif::{In, Tag, Value};
use image::{DynamicImage, imageops};

fn ascii_string(values: &[Vec<u8>]) -> Option<String> {
    let bytes = values.first()?;
    String::from_utf8(bytes.clone()).ok()
}

pub fn parse_exif_fields(bytes: &[u8]) -> serde_json::Value {
    let mut fields = serde_json::Map::new();
    if let Ok(exif) = exif::Reader::new().read_from_container(&mut Cursor::new(bytes)) {
        if let Some(field) = exif.get_field(Tag::Model, In::PRIMARY) {
            if let Value::Ascii(values) = &field.value {
                if let Some(model) = ascii_string(values) {
                    fields.insert("camera".into(), serde_json::Value::String(model));
                }
            }
        }
        if let Some(field) = exif.get_field(Tag::LensModel, In::PRIMARY) {
            if let Value::Ascii(values) = &field.value {
                if let Some(lens) = ascii_string(values) {
                    fields.insert("lens".into(), serde_json::Value::String(lens));
                }
            }
        }
        if let Some(field) = exif.get_field(Tag::PhotographicSensitivity, In::PRIMARY) {
            if let Value::Short(values) = &field.value {
                if let Some(iso) = values.first() {
                    fields.insert("iso".into(), serde_json::json!(iso));
                }
            }
        }
        if let Some(field) = exif.get_field(Tag::ExposureTime, In::PRIMARY) {
            if let Value::Rational(values) = &field.value {
                if let Some(rational) = values.first() {
                    fields.insert(
                        "shutter".into(),
                        serde_json::Value::String(format!("{}/{}", rational.num, rational.denom)),
                    );
                }
            }
        }
        if let Some(field) = exif.get_field(Tag::FocalLength, In::PRIMARY) {
            if let Value::Rational(values) = &field.value {
                if let Some(rational) = values.first() {
                    fields.insert(
                        "focalLength".into(),
                        serde_json::Value::String(format!(
                            "{:.1} mm",
                            rational.num as f64 / rational.denom as f64
                        )),
                    );
                }
            }
        }
        if let Some(field) = exif.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
            if let Value::Ascii(values) = &field.value {
                if let Some(taken) = ascii_string(values) {
                    fields.insert("dateTaken".into(), serde_json::Value::String(taken));
                }
            }
        }
    }

    fields.insert(
        "plugin".into(),
        serde_json::Value::String("image-thumbnailer".into()),
    );
    serde_json::Value::Object(fields)
}

pub fn orientation_from_exif(bytes: &[u8]) -> u8 {
    let Ok(exif) = exif::Reader::new().read_from_container(&mut Cursor::new(bytes)) else {
        return 1;
    };
    exif.get_field(Tag::Orientation, In::PRIMARY)
        .and_then(|field| field.value.get_uint(0))
        .unwrap_or(1) as u8
}

pub fn apply_orientation(image: DynamicImage, orientation: u8) -> DynamicImage {
    match orientation {
        2 => DynamicImage::from(imageops::flip_horizontal(&image)),
        3 => DynamicImage::from(imageops::rotate180(&image)),
        4 => DynamicImage::from(imageops::flip_vertical(&image)),
        5 => DynamicImage::from(imageops::rotate90(&imageops::flip_horizontal(&image))),
        6 => DynamicImage::from(imageops::rotate90(&image)),
        7 => DynamicImage::from(imageops::rotate270(&imageops::flip_horizontal(&image))),
        8 => DynamicImage::from(imageops::rotate270(&image)),
        _ => image,
    }
}
