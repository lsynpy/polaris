# Polaris

A self-hosted music streaming server, to enjoy your music collection from any computer or mobile device.

This is a fork of the original [agersant/polaris](https://github.com/agersant/polaris), customized for personal use with ARM64 deployment.

## Original Project

- **Server**: [github.com/agersant/polaris](https://github.com/agersant/polaris)
- **Web UI**: [github.com/agersant/polaris-web](https://github.com/agersant/polaris-web)
- **Demo**: [demo.polaris.stream](https://demo.polaris.stream) (user: `demo_user`, pass: `demo_password`)
- **License**: MIT

## Project Structure

| Directory | Description                       |
|-----------|-----------------------------------|
| `server/` | Rust backend (Cargo project root) |
| `web/`    | Vue.js frontend web UI            |
| `deploy/` | Deployment scripts                |
| `docs/`   | Documentation                     |

## Build & Run

### Server (Rust)

```bash
cd server
cargo build --release
cargo run -- -f   # -f = foreground (don't daemonize)
```

### Web UI (Vue.js)

```bash
cd web
npm install       # first time only
npm run dev       # Vite dev server with hot reload
```

### Tests

```bash
cd server && cargo test    # Rust unit tests
cd web && npm test         # Playwright E2E tests
```

API docs available at `http://localhost:5050/api-docs/` after starting the server.

## Deployment

ARM64 binary is built by GitHub Actions on `ubuntu-24.04-arm`. Deploy uses the pre-built release (no local cross-compilation):

```bash
# Build web, download ARM64 release, build runtime image, push to registry, deploy via SSH
deploy/deploy-to.sh jdc
```
