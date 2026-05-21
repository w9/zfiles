use anyhow::Result;
use qrcode::QrCode;

pub fn print_url(url: &str) -> Result<()> {
    let code = QrCode::new(url.as_bytes())?;
    let image = code
        .render::<qrcode::render::unicode::Dense1x2>()
        .dark_color(qrcode::render::unicode::Dense1x2::Light)
        .build();
    println!("{image}");
    Ok(())
}
