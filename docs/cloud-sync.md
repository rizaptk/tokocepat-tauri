# Cloud Sync (FireLite v0.7.0)

TokoCepat supports two optional replication layers built on the **FireLite v0.7.0**
sync engine:

- **Net Sync** — peer-to-peer mesh replication over LAN (mDNS discovery).
- **Cloud Sync** — centralized client-server replication over WebSockets
  (offline-first clients converge through a central server).

This document describes the Cloud Sync feature added in this branch.

## Enabling the feature

The `cloud-sync` feature must be enabled on the `firelite` crate:

```toml
[dependencies]
firelite = { git = "https://github.com/rizaptk/firelite", branch = "main", version = "0.7.0", features = ["tauri-gateway", "net-sync", "cloud-sync"] }
```

## Backend commands (`src-tauri/src/cloud_sync.rs`)

| Command | Description |
|---|---|
| `toggle_cloud_sync` | Start or stop Cloud Sync. Persists config to `app_state/cloud_sync_prefs`. Emits `cloud_sync_on` / `cloud_sync_off` events. |
| `get_cloud_sync_status` | Returns the current `CloudStatus` (connected, room, active clients, hosted rooms) or `null` when stopped. |
| `bootstrap_cloud_sync` | On startup, restarts Cloud Sync if `app_state/cloud_sync_prefs.enabled` is `true`. |

### `toggle_cloud_sync` parameters

| Argument | Type | Meaning |
|---|---|---|
| `enabled` | `bool` | Start (`true`) or stop (`false`) Cloud Sync. |
| `mode` | `string` | `"client"` or `"server"`. |
| `serverUrl` | `string \| null` | Client mode: target server URL (`ws://`, `wss://`, or `https://`). |
| `bindAddr` | `string \| null` | Server mode: bind address (e.g. `0.0.0.0:8056`). |
| `roomName` | `string \| null` | Client mode: room to join (default `"default"`). |
| `roomKey` | `string \| null` | Client mode: room security key. |
| `authToken` | `string` | Auth token presented to the server on connect. |

### Implementation notes

- The server is **room-agnostic**: any `(room_name, room_key)` pair it receives is
  stored under its own prefix in `__firelite_rooms`. Clients sharing a room sync
  together; data never mixes across rooms.
- Client collections are stored server-side with the room prefix (e.g. `users`
  → `roomUsers`) and presented back to clients as plain collection names.
- `https://` / `wss://` URLs work through cloud proxies.
- State is guarded by a `tauri::State<CloudSyncState>` holding
  `Arc<Mutex<Option<CloudSync>>>`, exactly like `sync::SyncState` for Net Sync.

## Persisted config

Stored in the encrypted `app_state` collection under `cloud_sync_prefs`:

```json
{
    "enabled": true,
    "mode": "client",
    "server_url": "wss://your-firelite-server",
    "bind_addr": null,
    "room_name": "toko",
    "room_key": "secret-room-key",
    "auth_token": "jwt-or-token"
}
```

## Cloud Sync server (separate deploy)

The Cloud Sync hub is a standalone FireLite server (room-agnostic). It can be run
from the `firelite` CLI:

```bash
firelite --bind 0.0.0.0:8080 --token server-token serve
```

or embedded in another Rust process:

```rust
use firelite::cloud_sync::CloudSync;
use firelite::engine::FireLite;

let db = FireLite::open("./data/cloud_server_db", Default::default())?;
let cloud_server = CloudSync::server(db, "server_node_01", "master_jwt_secret");
cloud_server.start("0.0.0.0:8080").await?;
```