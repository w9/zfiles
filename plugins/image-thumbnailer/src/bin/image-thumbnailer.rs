use image_thumbnailer::{new_state, rpc};

fn main() -> anyhow::Result<()> {
    rpc::run_loop(new_state())
}
