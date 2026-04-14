# Rust Dependencies

## Audio Format Parsing

| Crate            | Version     | What it does                        | Used for                                                                                              |
|------------------|-------------|-------------------------------------|-------------------------------------------------------------------------------------------------------|
| **symphonia**    | 0.5.5       | Pure Rust multimedia codec library  | Reading audio metadata (artist, album, title, etc.) and extracting duration from virtually any format |
| **id3**          | 1.16.4      | ID3 tag reader/writer (v1 & v2)     | Reading MP3 metadata                                                                                  |
| **metaflac**     | 0.2.8       | FLAC metadata block parser          | Reading FLAC Vorbis comments, pictures                                                                |
| **mp4ameta**     | 0.13.0      | MP4/M4A metadata reader             | Reading Apple AAC/iTunes metadata                                                                     |
| **opus_headers** | 0.1.2 (git) | Opus file header reader             | Reading Opus tags (uses a custom fork branch for multivalue support)                                  |
| **mp3-duration** | 0.1.10      | Fast MP3 duration calculator        | Quick MP3 length estimation without full parsing                                                      |
| **ape**          | 0.6.0       | APE (Monkey's Audio) format support | Reading APE tag metadata                                                                              |
| **lewton**       | 0.10.2      | Pure Rust Vorbis decoder            | Reading Ogg Vorbis metadata (symphonia also handles this, lewton is likely for peak extraction)       |

## Web Server & API

| Crate          | Version | What it does                       | Used for                                                           |
|----------------|---------|------------------------------------|--------------------------------------------------------------------|
| **axum**       | 0.8.8   | Ergonomic Tokio/HTTP web framework | Core HTTP server, routing, JSON handling, multipart uploads        |
| **axum-extra** | 0.12.5  | Additional axum utilities          | Typed HTTP headers                                                 |
| **axum-range** | 1.0.0   | HTTP range request support         | Byte-range streaming for audio streaming (seeking within songs)    |
| **tower**      | 0.5.3   | Modular service abstraction        | HTTP middleware chain                                              |
| **tower-http** | 0.6.8   | Tower middleware for HTTP          | Gzip compression, static file serving (web UI), path normalization |
| **http**       | 1.4.0   | HTTP types                         | HTTP request/response types                                        |
| **headers**    | 0.4.1   | Common HTTP header parsing         | Parsing Range, Content-Type, etc.                                  |

## API Documentation

| Crate             | Version | What it does                    | Used for                                                 |
|-------------------|---------|---------------------------------|----------------------------------------------------------|
| **utoipa**        | 5.4.0   | OpenAPI/Swagger spec generation | Auto-generate API documentation from Rust types          |
| **utoipa-axum**   | 0.2.0   | utoipa + axum integration       | Wire axum routes to OpenAPI                              |
| **utoipa-scalar** | 0.3.0   | Scalar API docs UI              | Render the `/api-docs/` page (alternative to Swagger UI) |

## Database

| Crate            | Version | What it does                               | Used for                                                    |
|------------------|---------|--------------------------------------------|-------------------------------------------------------------|
| **native_db**    | 0.8.2   | Embedded native Rust database (LMDB-based) | Persisting playlists, play stats, user data — no SQL needed |
| **native_model** | 0.4.20  | Schema/versioning for native_db            | Database migrations and model versioning                    |

## Serialization

| Crate                        | Version | What it does                       | Used for                                                          |
|------------------------------|---------|------------------------------------|-------------------------------------------------------------------|
| **serde** + **serde_derive** | 1.0.228 | Serialization framework            | All data serialization (JSON, TOML, binary)                       |
| **serde_json**               | 1.0.149 | JSON support                       | HTTP request/response bodies                                      |
| **toml**                     | 0.9.11  | TOML parser                        | Config file parsing (with key order preservation)                 |
| **bitcode**                  | 0.6.9   | Fast binary serialization          | Compact storage for indexed audio data (faster than JSON/msgpack) |
| **tinyvec**                  | 1.10.0  | Stack-allocated vectors with serde | Small fixed-size collections without heap allocation              |

## Search & Indexing

| Crate            | Version | What it does                   | Used for                                                                      |
|------------------|---------|--------------------------------|-------------------------------------------------------------------------------|
| **chumsky**      | 0.9.3   | Parser combinator library      | Parsing search queries (e.g. `artist:"Pink Floyd" year:>1970`)                |
| **lasso2**       | 0.8.2   | String interner                | Deduplicating repeated strings (artist names, album names) to save memory     |
| **trie-rs**      | 0.4.2   | Trie data structure            | Autocomplete / prefix search on song/artist names                             |
| **regex**        | 1.12.3  | Regular expressions            | Pattern matching in search queries                                            |
| **icu_collator** | 2.1.1   | Unicode-aware string collation | Proper alphabetical sorting across languages (case-insensitive, accent-aware) |

## Authentication & Security

| Crate      | Version | What it does                                                  | Used for                                   |
|------------|---------|---------------------------------------------------------------|--------------------------------------------|
| **branca** | 0.10.2  | Authenticated encryption tokens (XChaCha20-Poly1305 + Base62) | Session tokens — secure alternative to JWT |
| **pbkdf2** | 0.11.0  | Password-based key derivation (RFC 8018)                      | Password hashing for user accounts         |
| **rand**   | 0.8.5   | Random number generation                                      | Salt generation for PBKDF2, token IDs      |

## Async & Parallelism

| Crate        | Version | What it does        | Used for                                         |
|--------------|---------|---------------------|--------------------------------------------------|
| **tokio**    | 1.49.0  | Async runtime       | HTTP server I/O, async task scheduling           |
| **rayon**    | 1.11.0  | Data parallelism    | Parallel file scanning/indexing across CPU cores |
| **num_cpus** | 1.17.0  | CPU count detection | Determining thread pool size                     |

## File Watching

| Crate                     | Version | What it does                            | Used for                                                        |
|---------------------------|---------|-----------------------------------------|-----------------------------------------------------------------|
| **notify**                | 8.2.0   | Cross-platform filesystem notifications | Detecting new/changed music files                               |
| **notify-debouncer-full** | 0.7.0   | Event debouncer for notify              | Batching rapid filesystem events to avoid redundant re-indexing |

## Image Processing

| Crate     | Version | What it does         | Used for                                                                   |
|-----------|---------|----------------------|----------------------------------------------------------------------------|
| **image** | 0.25.9  | Image format support | Generating album art thumbnails (bmp/jpeg/png/gif only — no heavy formats) |

## Logging & Errors

| Crate         | Version | What it does                 | Used for                                |
|---------------|---------|------------------------------|-----------------------------------------|
| **log**       | 0.4.29  | Logging facade               | Abstraction over logging implementation |
| **simplelog** | 0.12.2  | Simple logger implementation | Actual log output (file + console)      |
| **thiserror** | 2.0.18  | Derive macro for error enums | Clean custom error types                |

## Networking

| Crate    | Version | What it does                                | Used for                                                |
|----------|---------|---------------------------------------------|---------------------------------------------------------|
| **ureq** | 3.2.0   | Minimal HTTP client (rustls, no native-ssl) | Dynamic DNS (DDNS) updates — telling remote DNS your IP |

## Misc Utilities

| Crate             | Version | What it does                      | Used for                                                     |
|-------------------|---------|-----------------------------------|--------------------------------------------------------------|
| **getopts**       | 0.2.24  | CLI argument parsing              | `--config`, `--port`, `--foreground`, etc.                   |
| **enum-map**      | 2.7.3   | Enum-indexed maps                 | Type-safe arrays indexed by enums (e.g. per-format stats)    |
| **nohash-hasher** | 0.2.0   | Hasher for already-hashed values  | Using pre-hashed IDs in HashMaps without re-hashing          |
| **unicase**       | 2.9.0   | Unicode case-insensitive matching | Case-insensitive string comparison (format extensions, tags) |

## Platform-Specific

| Crate                               | Version                    | What it does              | Used for                                                 |
|-------------------------------------|----------------------------|---------------------------|----------------------------------------------------------|
| **daemonize**                       | 0.5.0 (unix)               | Unix daemon process       | Background server mode (`-f` flag to stay in foreground) |
| **sd-notify**                       | 0.4.2 (unix)               | systemd socket activation | Notify systemd when server is ready                      |

## Packaging

| Crate   | Version | What it does                 | Used for                                        |
|---------|---------|------------------------------|-------------------------------------------------|
| **zip** | 8.2.0   | ZIP archive creation/reading | Likely for playlist export or collection backup |

## Dev Dependencies

| Crate                | Version | What it does                      | Used for                                     |
|----------------------|---------|-----------------------------------|----------------------------------------------|
| **axum-test**        | 18.7.0  | Integration test helpers for axum | Testing HTTP endpoints without a live server |
| **bytes**            | 1.11.1  | Byte buffer utilities             | Test data manipulation                       |
| **percent-encoding** | 2.3.2   | URL encoding                      | Encoding test query strings                  |
