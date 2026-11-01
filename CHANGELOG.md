# Changelog

## Unreleased
- Phase 0: TypeScript scaffold, vendored `wacore-{derive,binary,libsignal,noise,appstate}` building for native and wasm32, own `waproto`, CI skeleton.
- Phase 1: WABinary binding (`encodeNode`/`decodeNode`) and TS codec.
- Phase 2: Noise XX handshake, transport cipher and frame codec.
- Phase 3: Signal sessions and sender keys over TS-owned storage; key generation.
- Phase 4: app-state `AppStateCollection` (LTHash, MAC validation, mutation decryption, outgoing `buildPatch`).
- Phase 5: `Client` (QR pairing verified live, login, auto-reconnect), protocol logger, receiver (pre-keys, acks, receipts, 1:1/group decryption, retries, Meta AI `msmsg`), sender (1:1, groups, channels; send verified live to own number).
- Phase 6: media, replies/mentions/reactions/edit/delete, polls, groups, communities, newsletters, contacts/privacy, app-state sync and chat actions, history sync, calls (events + reject).
- Pairing-code linking, status posting, interactive messages, business profile/catalog, usernames, forwarding, retry resends, poll votes, `client.mex()`.
- LID addressing for Signal sessions (fixes the phone not decrypting our own-device copies), serialized cipher calls, app-state key request to the phone, `examples/example.js` live check (31/31).
- Username lookup; `examples/example-others.js` live check against a second account, a group and a channel.
- `examples/example-manage.js`: group management and status posting verified live (16/16).
- Channel posts in the phone's wire format (captured from the app): images/videos upload raw to `/newsletter/...` with `mediatype` on the plaintext node, quizzes as `pollCreationMessageV5` + `polltype=quiz_creation`, image polls/quizzes (`sendImagePoll`), questions as `questionMessage` + `questiontype=question` (text and image), music as a video with MUSIC attribution (`sendMusic`). All acked live.
- Channel image quizzes/polls: option images are posted first (MEDIA_POLL association), then the poll with the same pre-chosen id (`sendImagePoll`); music posts carry `annotations` on the video; confirmed on the phone.
- Music posts: the song has to be mixed into the video's audio track; `sendMusic` only adds the music card. Verified on the phone.
- Channel post labels: `client.newsletters.labelAiContent(jid, serverId)` and `labelPaidPartnership(jid, serverId)` (mex mutations on existing posts, seen in the phone's notifications; accepted live).
- `client.postToChannel(channel, message, {aiContent, paidPartnership})` posts and labels in one call, returns `{id, serverId}`.
- AI-content label is only shown by the app on image/video channel posts (confirmed on the phone); paid partnership shows on all.
- Channel `<status>` stanzas (reactions to channel posts, edits/revokes) are acked and emitted as the `channel.status` event.
- Group status (captured from the phone): `sendGroupStatusText`, and `groupStatus: true` on `sendImage` / `sendVideo` / `sendAudio` / `sendMusic` (groupStatusMessageV2 + `<meta is_group_status>`, text-typed stanza, no enc mediatype).
- Group status voice notes need real Opus audio (OGG) with `ptt: true`; verified on the phone.
- Channel status could not be reproduced: posts with a NEWSLETTER_STATUS attribution show up as normal posts; the real wire format needs a capture from an account that can post one.
- Channel videos (music posts) upload their own thumbnail to `/newsletter/newsletter-thumbnail-image` and reference it with `thumbnailDirectPath` / `thumbnailSha256`.
