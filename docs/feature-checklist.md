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
