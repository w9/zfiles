use std::path::Path;
use std::time::Duration;

use anyhow::{Context, Result};
use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct PerfBaseline {
    pub list_small_fixture_ms: u64,
    pub download_one_mib_ms: u64,
    pub upload_one_mib_ms: u64,
}

impl PerfBaseline {
    pub fn load(path: &Path) -> Result<Self> {
        let contents = std::fs::read_to_string(path)
            .with_context(|| format!("read perf baseline {}", path.display()))?;
        toml::from_str(&contents).context("parse perf baseline")
    }

    pub fn assert_within_tolerance(&self, label: &str, elapsed: Duration, baseline_ms: u64) {
        let baseline = Duration::from_millis(baseline_ms);
        let allowed = baseline + duration_margin(baseline);
        assert!(
            elapsed <= allowed,
            "{label} took {:?}, baseline {:?} (+5%)",
            elapsed,
            baseline
        );
    }
}

fn duration_margin(baseline: Duration) -> Duration {
    Duration::from_nanos((baseline.as_nanos() as f64 * 0.05) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_baseline_fixture() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/perf-baseline.toml");
        let baseline = PerfBaseline::load(&path).expect("load baseline");
        assert_eq!(baseline.list_small_fixture_ms, 500);
    }
}
