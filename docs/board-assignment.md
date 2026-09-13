# Device board assignment

Devices may have `boardProfile: { id, revision }` or `null`. Missing values in
older backends/data are treated as unassigned. Revision means catalogue revision,
not a verified physical PCB revision. No existing data migration is required.

`POST /api/v1/devices/:id/board-profile`

Body: `{ "boardProfile": { "id": "nodemcu-amica-esp12e-cp2102", "revision": 1 } }`
Use `{ "boardProfile": null }` to remove assignment. Uses existing bearer auth.
Only approved devices may be assigned. Unknown profiles/revisions return 400,
unapproved devices 403, missing devices 404. Changes are recorded in the log.
Register/heartbeat cannot set or overwrite this field.

Deploy backend before frontend. An older backend returns an error on save;
the frontend must never pretend assignment was saved. Images remain local-only
until redistribution permissions are resolved. Firmware is unchanged.

Current shared token does not distinguish admin and device identities. This is
not per-device authorization; credential separation remains a later task.
Profile assignment does not queue commands, configure GPIO or grant pin access.

When adding a profile, update frontend `src/catalog/boards.ts` and backend
`src/services/boardProfiles.js` together, including revision validation/tests.
