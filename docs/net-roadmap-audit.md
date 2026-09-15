# NET capability audit - 2026-09-15

Implemented means present in source, not that an unreachable server is healthy.
The current UI changes still need deployment to CM5.

## Implemented

- Versioned API, shared Bearer authentication, JSON persistence.
- Docker frontend/backend deployment, update backups, image rollback, deployment metadata.
- Host telemetry and normal/eco mode; eco is not host suspend.
- Fan manual test with expiry and kernel fallback; not a custom automatic fan curve.
- Device admission, rejection and reopening; commands require approved devices.
- Device command queue, acknowledgement and active verification.
- ESP heartbeat RSSI, uptime and free heap; frontend stale/offline handling.
- NodeMCU interactive reference, board assignment, purpose and per-card size.
- This batch: event search, severity/type filters, JSON export of visible events,
  refresh every five seconds while the Logs view is visible, explicit failed/stale states.

## Partial

- Event audit records operations and acknowledgements, not individual actors.
  A shared token cannot distinguish users from devices.
- Docker runtime indicator is environment-reported, not Docker daemon inspection.
- Automatic backup exists during updates; scheduled backups, retention and restore drills remain.
- Discovery is not admission: approved registration works, LAN scanning/QR pairing does not.
- Event export covers the loaded window (at most 100 events), not full retained history.
- Notifications: persisted offline/recovery transitions and browser toast/history are
  implemented; Telegram, email and OS push delivery remain unimplemented.

## Next bounded batches

1. Storage status, backup age and retention with dry-run and protected restore points.
2. Separate dashboard/device credentials, migration and revocation tests.
3. Interactive GPIO configuration with firmware validation and safe startup defaults.

## Deferred architectural work

- MQTT broker and command delivery migration.
- OTA firmware rollout, verification and failure recovery.
- Full availability/latency history and alert escalation.
- Automated network exposure checks, VPN profiles, mDNS/UDP discovery.
- Host reboot/shutdown and release notifications: helper/API/UI implemented in the
  host-control batch; pending CM5 installation and real-host verification, not yet deployed.
- Automatic fan curves: no competing controller fighting kernel policy.

## Removed or corrected UI claims

- Removed fictional fallback log records and fallback API live status.
- Removed telemetry pending/next, future allowlist, obsolete Docker export preparation.
- Replaced monitoring latency/history placeholders with actual RSSI/free heap.
- Removed no-op service restart buttons.
- Corrected LAN-only claim: CORS is not network isolation.
- Security badges now distinguish implemented admission, partial audit and planned features.
