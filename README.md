# Polaris

A self-hosted music streaming server, to enjoy your music collection from any computer or mobile device.

This is a fork of the original [agersant/polaris](https://github.com/agersant/polaris), customized for personal use with ARM64 deployment.

## Original Project

- **Repository**: [github.com/agersant/polaris](https://github.com/agersant/polaris)
- **Demo**: [demo.polaris.stream](https://demo.polaris.stream) (user: `demo_user`, pass: `demo_password`)
- **License**: MIT

## Deployment

- GitHub Actions builds ARM64 binary natively on `ubuntu-24.04-arm` runner
- Local `deploy/deploy-to.sh` script builds minimal Docker image and deploys via SSH

## Build & Run

```bash
cargo build --release
cargo run
```

API docs available at `http://localhost:5050/api-docs/` after starting the server.
