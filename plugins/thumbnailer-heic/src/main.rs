mod rpc;

fn main() -> anyhow::Result<()> {
    rpc::run_loop()
}
