use std::ops::RangeInclusive;

use anyhow::{Context, Result, bail};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ByteRange {
    pub start: u64,
    pub end: u64,
}

impl ByteRange {
    pub fn len(&self) -> u64 {
        self.end.saturating_sub(self.start) + 1
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    pub fn as_range(&self) -> RangeInclusive<u64> {
        self.start..=self.end
    }
}

pub fn parse_range_header(header: &str, file_size: u64) -> Result<ByteRange> {
    let Some(spec) = header.strip_prefix("bytes=") else {
        bail!("unsupported range unit");
    };

    if spec.contains(',') {
        bail!("multipart ranges are not supported");
    }

    if let Some((start, end)) = spec.split_once('-') {
        if start.is_empty() {
            let suffix = end
                .parse::<u64>()
                .with_context(|| format!("invalid suffix range {spec:?}"))?;
            if suffix == 0 {
                bail!("invalid suffix range");
            }
            let start = file_size.saturating_sub(suffix);
            return normalize_range(start, file_size - 1, file_size);
        }

        let start = start
            .parse::<u64>()
            .with_context(|| format!("invalid range start in {spec:?}"))?;
        let end = if end.is_empty() {
            file_size.saturating_sub(1)
        } else {
            end.parse::<u64>()
                .with_context(|| format!("invalid range end in {spec:?}"))?
        };
        return normalize_range(start, end, file_size);
    }

    bail!("invalid range header {header:?}");
}

fn normalize_range(start: u64, end: u64, file_size: u64) -> Result<ByteRange> {
    if file_size == 0 {
        bail!("cannot range over empty file");
    }

    if start >= file_size {
        bail!("range start out of bounds");
    }

    let end = end.min(file_size - 1);
    if end < start {
        bail!("invalid range bounds");
    }

    Ok(ByteRange { start, end })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_closed_range() {
        let range = parse_range_header("bytes=0-4", 100).unwrap();
        assert_eq!(range, ByteRange { start: 0, end: 4 });
        assert_eq!(range.len(), 5);
    }

    #[test]
    fn parse_open_ended_range() {
        let range = parse_range_header("bytes=10-", 100).unwrap();
        assert_eq!(range, ByteRange { start: 10, end: 99 });
    }

    #[test]
    fn parse_suffix_range() {
        let range = parse_range_header("bytes=-10", 100).unwrap();
        assert_eq!(range, ByteRange { start: 90, end: 99 });
    }

    #[test]
    fn rejects_out_of_bounds() {
        assert!(parse_range_header("bytes=100-200", 100).is_err());
    }

    #[test]
    fn rejects_multipart() {
        assert!(parse_range_header("bytes=0-1,2-3", 100).is_err());
    }
}
