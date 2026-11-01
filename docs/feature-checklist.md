# Feature checklist (from baron-baileys-v2 `src/`, ~15.7k lines in Socket/)

Not a plan - the shape of "done". Sizes are lines of the reference JS. Order of work is in TODO.md.

| Area | Reference | Notes |
| --- | --- | --- |
| Connection, Noise, keepalive, login/pairing | Socket/socket.js (1096), Utils/noise-handler, validate-connection | Phase 2/5 |
| Registration | Socket/registration.js (434) | |
| Receive pipeline, decrypt, retries, receipts | Socket/messages-recv.js (3127), Utils/decode-wa-message, message-retry-manager, offline-node-processor | biggest single file |
| Send pipeline, fanout, media | Socket/messages-send.js (2255), Utils/messages, messages-media, message-composer | |
| Chats, app-state sync, labels, presence | Socket/chats.js (2401), Utils/chat-utils, lt-hash, sync-action-utils | Phase 4 crypto |
| Groups / AI groups | Socket/groups.js (889), aigroups.js (240) | |
| Communities | Socket/communities.js (605) | |
| Newsletters | Socket/newsletter.js (1078) | |
| Business | Socket/business.js (522), Utils/business | |
| Privacy, username | Socket/privacy.js (452), username.js (230) | |
| Interop, managed accounts | Socket/interop.js (566), managed-account.js (214) | |
| Mex / GraphQL | Socket/mex.js, graphql.js (915) | query ids: ~/Dokumente/GitHub/Whatsapp `Querys/` |
| Interactive messages | Socket/interactive-handler.js (579) | |
| History sync | Utils/history.js, group-history.js | |
| Signal, pre-key management, identity change | Signal/, Utils/signal, pre-key-manager, identity-change-handler | Phase 3 |
| Auth state | Utils/auth-utils, use-multi-file-auth-state | |
| Antiban / fingerprint | antiban.js, Utils/browser-utils | Phase 8 |
| WAM telemetry | WAM/ | Phase 8 |
| VoIP rekey | Utils/voip-rekey.js | Phase 8 |

## Status against baron-baileys-v2 (2026-11-01)

Legend: **done** = implemented with tests; **live** = also exercised against a real account; **open** = not built.

| Area | Status |
| --- | --- |
| Connection, Noise, keepalive, QR + pairing-code login | done; QR/login **live**, pairing code verified against a simulated phone only |
| Receive pipeline (1:1, groups, channels, Meta AI, retries, receipts, acks, history, polls) | done; decryption/acks/retries/Meta AI **live** |
| Send pipeline (1:1, groups, status, channels, media, polls, interactive, forward, edit/revoke/react) | done; to the own chat **live**: text, reply, react, edit, delete, poll, location, contact, buttons, image, document; groups/status/channels/other contacts loopback-tested only |
| Chats / app-state sync (read + write), labels, presence | done; sync (key request to the phone, 328 mutations) and pin/archive writes **live** |
| Groups, AI-group bot, communities | done (request-level tests) |
| Newsletters | done (w:mex; ids may be stale) |
| Business profile, catalog, collections | done (read + profile update) |
| Privacy, contacts, blocklist, username | done |
| Mex / GraphQL | generic `client.mex(queryId, variables, path)`; no typed wrappers for the ~hundreds of Baileys query ids |
| Registration (primary device) | open (not needed for a companion client) |
| Interop, managed accounts, payments/passkey, ads | open (use `client.mex` with the ids from Baileys) |
| Link previews, thumbnails, waveforms, audio duration | open (no image/ffmpeg dependency bundled) |
| Antiban / fingerprinting, WAM telemetry, VoIP rekey | open (Phase 8) |
