use std::time::Duration;

use anyhow::{Context, Result, bail};

pub fn parse_duration(input: &str) -> Result<Duration> {
    let input = input.trim();
    if input.is_empty() {
        bail!("duration cannot be empty");
    }

    let (value, unit) = input
        .char_indices()
        .find(|(_, ch)| !ch.is_ascii_digit())
        .map(|(index, _)| input.split_at(index))
        .unwrap_or((input, "s"));

    let amount: u64 = value
        .parse()
        .with_context(|| format!("invalid duration value {value:?}"))?;

    let secs = match unit {
        "s" | "sec" | "secs" | "second" | "seconds" => amount,
        "m" | "min" | "mins" | "minute" | "minutes" => amount * 60,
        "h" | "hr" | "hrs" | "hour" | "hours" => amount * 3600,
        "d" | "day" | "days" => amount * 86_400,
        _ => bail!("unsupported duration unit {unit:?}"),
    };

    Ok(Duration::from_secs(secs))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hours_and_minutes() {
        assert_eq!(parse_duration("2h").unwrap(), Duration::from_secs(7200));
        assert_eq!(parse_duration("30m").unwrap(), Duration::from_secs(1800));
    }
}
