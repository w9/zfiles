#[test]
fn download_uses_sendfile_fast_path_on_linux() {
    assert!(zfiles::download::uses_sendfile_fast_path());
}
