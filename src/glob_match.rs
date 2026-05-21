pub fn matches_any(globs: &[String], path: &str) -> bool {
    let name = path.rsplit('/').next().unwrap_or(path);
    globs.iter().any(|glob| matches_glob(glob, name))
}

pub fn matches_glob(glob: &str, name: &str) -> bool {
    if glob == "*" {
        return true;
    }
    if let Some(ext) = glob.strip_prefix("*.") {
        return name.ends_with(&format!(".{ext}")) || name == ext;
    }
    glob == name
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn matches_txt_glob() {
        assert!(matches_glob("*.txt", "notes.txt"));
        assert!(!matches_glob("*.txt", "photo.jpg"));
    }

    #[test]
    fn matches_wildcard() {
        assert!(matches_glob("*", "anything.bin"));
    }
}
