# velowa

A WhatsApp Web multi-device client for Node.js, written in TypeScript. Use it to build bots, notification
senders, support desks, channel publishers and call bots, or as the engine under your own application.

The crypto- and binary-heavy parts (Signal protocol, WABinary, Noise handshake, app-state crypto, VoIP media) are
ported once from [`whatsapp-rust`](https://github.com/jlucaso1/whatsapp-rust) and run as WebAssembly; everything
else is TypeScript. The package ships **ESM and CommonJS** builds with type definitions.

> **velowa uses the unofficial WhatsApp Web protocol.** It is not affiliated with WhatsApp or Meta. Automating an
> account can get it restricted or banned; read [Reliability and safety](#reliability-and-safety) before you point
> it at an account you care about.

## How velowa differs from Baileys and its forks

velowa is **not a fork**: its TypeScript is written fresh, not copied from Baileys, and it was designed from the protocol up and
only then compared with Baileys behaviour where that helps. What that changes in practice:

| | Baileys and libraries derived from it | velowa |
| --- | --- | --- |
| Where the protocol work runs | JavaScript: Signal, Noise, binary encoding and decoding | **Rust compiled to WebAssembly** for Signal, Noise, WABinary, app-state crypto and call media; TypeScript for everything else |
| Calls | usually only seen and rejected: no audio or video | **real calls**: voice and video, one to one and in groups, call links with a waiting room, camera / hand / reactions in a call, audio and video from files or your microphone and speaker |
| Sending | one `sendMessage(jid, content)` with a loose content object | the same one-call style, **`client.send(jid, {...})`, with typed content kinds**, plus a typed method for every feature (`sendPoll`, `postToChannel`, `reportUser`, ...) |
| Connection | `connection.update` with status codes to interpret | one **`connection` event** (`state`, `qr`, `pairingCode`, `reason`, `loggedOut`) and **automatic reconnect**; no reconnect loop to write |
| Bots | you write your own message parsing | **`serialize()`** gives a ready `Message` (`text`, `sender`, `quoted`, `reply()`, `download()`), `GroupCache` / `isGroupAdmin` for permissions; **no framework is imposed**, cases and plugin bots are examples |
| Account safety | often an add-on or left to you | **`antiban`** is built in (rate caps, random gaps, new-chat delay, identical-text limit, warm-up) |
| Debugging | a logger you configure | a **protocol log of every frame and stanza**, grouped by day, rotated, compressed and pruned, with `velowa-logs` to manage it |

Also worth knowing: velowa ships **ESM and CommonJS** builds with types in a package of about 1.5 MB with three runtime
dependencies, **no install script and no Rust needed** on your machine (checked by tests, `publint` and `attw`); it is
written in strict TypeScript with a test suite that mirrors `src/`, and the code in this README and in `examples/` is
type-checked against the built package.

## What exists and works

"Checked" says how far a row has been tried: **live** means it was exercised against real WhatsApp accounts and phones;
**tests** means it is covered by unit and loopback tests only.

| Area | What you get | Checked |
| --- | --- | --- |
| Connection | QR or pairing-code linking, login from the saved folder, automatic reconnect, `connection` event | live (QR); tests (pairing code) |
| Messages | text, replies, mentions, reactions, edit, delete, forward, view-once, link previews, typing / presence, read receipts | live |
| Media | image, video, audio, voice note, document, sticker: encrypted upload and download, from bytes, files, URLs or streams | live |
| Interactive | buttons, lists, templates, native-flow buttons, Meta-AI style rich answers (text, code, table, LaTeX, map) and HTML | live |
| Polls | polls, quizzes, questions, image polls and quizzes | live |
| Groups | create, members, admins, name, description, settings, invite links, join approval, disappearing messages, member tags, permissions | live |
| Communities | create, link and unlink groups, deactivate | live for link and unlink; tests for the rest |
| Channels | create, follow, mute; post text, image, video, polls, quizzes, questions and music; AI-content and paid-partnership labels | live for posting and labels; tests for create, follow, mute |
| Status | text status with a chosen audience; group status (text, picture, video, music, voice) | live |
| Contacts and account | number lookup, "About", profile picture, username lookup, blocking, privacy settings, profile name and picture | live for lookups, blocking and reading settings; tests for changing them |
| Chats | archive, mute, pin, star, mark read, delete, clear, labels, per-chat disappearing timer | live for archive, pin, star; tests for the rest |
| Reports | report a user, a group, a channel, a message to the admins | live |
| Payments | payment requests and answers | live |
| Calls | voice and video one to one in both directions; incoming calls; group calls in both directions; call links, joining, waiting room and its admin commands; camera on and off, raised hands and reactions in a call; files and microphone / speaker as call media | live |
| Anti-ban and analytics | rate limits and pacing; WAM usage events | live |
| Business | business profile, catalog and collections, editing a business profile | live for reading a profile; tests for the rest |
| History | the history chunks the phone sends after linking | tests |
| Escape hatches | `client.request(node)` for any stanza, `client.mex(queryId, variables)` for any GraphQL query | live |

Not included: registering a new number, managed accounts and interop with other messengers. Channel *status* posts
arrive as ordinary posts, and a call that started as voice-only cannot turn the camera on later.

## Contents

1. [How velowa differs from Baileys and its forks](#how-velowa-differs-from-baileys-and-its-forks)
2. [What exists and works](#what-exists-and-works)
3. [Install and set up](#install-and-set-up)
4. [Link an account](#link-an-account)
5. [A first bot in 20 lines](#a-first-bot-in-20-lines)
6. [Receiving: messages and events](#receiving-messages-and-events)
7. [Sending: `client.send`](#sending-clientsend)
8. [Writing a bot: your style](#writing-a-bot-your-style)
9. [Feature guide](#feature-guide)
   - [Messages: reply, mention, react, edit, delete, forward](#messages-reply-mention-react-edit-delete-forward)
   - [Media](#media)
   - [Buttons, lists and rich answers](#buttons-lists-and-rich-answers)
   - [Polls, quizzes, questions](#polls-quizzes-questions)
   - [Groups and communities](#groups-and-communities)
   - [Channels](#channels)
   - [Status (stories)](#status-stories)
   - [Contacts, profile and privacy](#contacts-profile-and-privacy)
   - [Business and payments](#business-and-payments)
   - [Reports](#reports)
   - [Calls](#calls)
   - [Chats and app state](#chats-and-app-state)
10. [Events reference](#events-reference)
11. [Configuration](#configuration)
12. [What you can build](#what-you-can-build)
13. [Reliability and safety](#reliability-and-safety)
14. [Development](#development)
15. [More documentation](#more-documentation)

## Install and set up

Requirements: **Node.js 18 or newer.** That is all: `npm install velowa` installs a finished build (the WebAssembly is
inside), runs no install script, and needs no Rust or compiler.

```bash
npm install velowa
```

```ts
import { Client } from 'velowa' // ESM
```

```js
const { Client } = require('velowa') // CommonJS
```

Credentials are stored in a folder on disk (`auth/` by default); keep it private and out of git, it is the logged-in
account. Two small command line tools come with the package: `npx velowa-pair` (link an account and try things in a dev
console) and `npx velowa-logs` (look after the protocol logs).

**Building from a checkout** (to change velowa itself; needs Rust 1.94 and `wasm-pack` once):

```bash
git clone https://github.com/7ucg/velowa && cd velowa
npm install
npm run build        # wasm-pack + tsup -> dist/ (ESM + CJS)
npm test
```

Installing straight from git (`npm install github:7ucg/velowa`) does not work, because `dist/` is build output that git does not
hold; use the registry or a checkout. The rules for the package and for git are in [`CONTRIBUTING.md`](CONTRIBUTING.md).

For a bot, turn the protocol log off (it records every frame and stanza under `logs/`, which you want only while
debugging):

```ts
import { Client, ProtocolLogger } from 'velowa'

const client = new Client({
  authDir: 'auth',
  logger: new ProtocolLogger({ enabled: false }),
})
```

## Link an account

The first run has to be linked to a phone: WhatsApp → *Linked devices* → *Link a device*. The `connection` event
carries what you need to show; after linking, the next start logs in straight from `authDir`.

```ts
import qrcode from 'qrcode-terminal'
import { Client } from 'velowa'

const client = new Client({ authDir: 'auth' })

client.on('connection', (u) => {
  if (u.qr) qrcode.generate(u.qr, { small: true }) // scan with the phone
  if (u.pairingCode) console.log('code:', u.pairingCode) // or type it in (see below)
  if (u.state === 'open') console.log('online as', client.me?.id)
  if (u.state === 'close') {
    console.log('closed:', u.reason)
    if (u.loggedOut) console.log('logged out on the phone: delete auth/ and link again')
  }
})

await client.connect()
```

**Pairing code instead of a QR:** `new Client({ authDir: 'auth', pairWithPhoneNumber: '4915...' })` and show
`pairingCode` from the `connection` event; on the phone choose *Link with phone number instead*.

**Connection states:** `connecting` (also while a code or QR is on offer and after a drop that will reconnect),
`open` (ready to send and receive), `close` (finished: the client does not retry). velowa reconnects by itself
after a dropped connection (`autoReconnect`, on by default), so you do not write a reconnect loop.

## A first bot in 20 lines

```ts
import qrcode from 'qrcode-terminal'
import { Client, serialize } from 'velowa'

const client = new Client({ authDir: 'auth' })

client.on('connection', (u) => {
  if (u.qr) qrcode.generate(u.qr, { small: true })
  if (u.state === 'open') console.log('online')
})

client.on('message', async (raw) => {
  const m = serialize(client, raw) // who, where, text, quoted message, reply()
  if (m.fromMe) return
  if (m.text === '!ping') await m.reply('pong')
})

await client.connect()
```

`serialize` turns the raw event into a `Message` with `chat`, `sender`, `text`, `isGroup`, `quoted`, `reply()`,
`react()`, `download()` and more; see [Receiving](#receiving-messages-and-events).

## Receiving: messages and events

Everything arrives through `client.on(event, listener)` (it returns an unsubscribe function) or as an async
iterator with `for await (const m of client.events('message'))`.

The raw `message` event holds `{ id, from, participant, timestamp, pushName, message }` where `message` is the
decrypted WhatsApp protobuf as plain JSON. Most bots want `serialize(client, raw)` instead:

| `Message` field / method | What it is |
| --- | --- |
| `m.chat` | the chat JID: a user, a group (`…@g.us`) or a channel |
| `m.sender` | who wrote it (inside a group: the member), without device part |
| `m.pushName`, `m.fromMe`, `m.isGroup`, `m.timestamp`, `m.id` | the obvious |
| `m.type`, `m.content` | the kind (`conversation`, `imageMessage`, …) and the content with wrappers (disappearing, view-once, edited) removed |
| `m.text` | text or caption, or the id of a tapped button / chosen list row; `''` when there is none |
| `m.isMedia`, `m.mimetype` | image, video, audio, document or sticker |
| `m.mentionedJids` | who is @mentioned |
| `m.quoted` | the message this one answers: `{ id, sender, fromMe, type, text, mimetype, key, download() }` |
| `m.reply(content)` | answer in the chat, quoting the message; a string is sent as text, an object is anything `client.send` takes |
| `m.react(emoji)`, `m.delete()`, `m.markRead()`, `m.forward(jid)` | the usual actions on this message |
| `m.download()` | decrypt and download the media |
| `m.key`, `m.asQuoted` | what the `client.*` methods and the `quoted` option want |

Group helpers for permission checks:

```ts
import { GroupCache, isGroupAdmin, serialize } from 'velowa'

const groups = new GroupCache(client) // one lookup per group and minute, however busy it is

client.on('message', async (raw) => {
  const m = serialize(client, raw)
  if (!m.isGroup) return
  const group = await groups.get(m.chat) // { subject, size, admins, participants, announce }
  if (m.text === '!kick' && isGroupAdmin(group, m.sender) && m.quoted)
    await client.groups.updateParticipants(m.chat, [m.quoted.sender], 'remove')
})
```

JID helpers: `jidNormalizedUser`, `areJidsSameUser`, `isJidGroup`, `isJidUser`, `isLidUser`, `isJidNewsletter`,
`isJidStatusBroadcast`, `jidEncode`, `jidDecode`. Content helpers: `getContentType`, `normalizeMessageContent`,
`messageText`.

> **LIDs.** WhatsApp is moving accounts to anonymous ids (`…@lid`). A sender or group member can show up as a LID or a
> phone-number JID. `isGroupAdmin` and `areJidsSameUser` compare the user part, and group participants carry both
> forms (`id`, `phoneNumber`, `lid`). `client.lidsFor(pnJid)` maps a phone-number JID to its LID.

## Sending: `client.send`

One call, the content object says what to send. It returns the message id.

```ts
await client.send(jid, { text: 'hello' })
await client.send(jid, { image: fs.readFileSync('cat.jpg'), caption: 'look' })
await client.send(jid, { video: { url: 'https://example.com/clip.mp4' } }) // URLs are fetched safely
await client.send(jid, { audio: { path: './voice.ogg' }, voiceNote: true }) // a local file needs { path }
await client.send(jid, { poll: { name: 'Pizza?', values: ['yes', 'no'] } })
await client.send(jid, { text: 'thanks', mentions: ['4915...@s.whatsapp.net'] }, { quoted: m.asQuoted })
```

| Content | Fields |
| --- | --- |
| text | `text`, `mentions?`, `linkPreview?` |
| image / video | `image` or `video`, `caption?`, `mimetype?`, `viewOnce?`, `gif?` (video) |
| audio | `audio`, `voiceNote?` (push-to-talk), `seconds?`, `mimetype?` |
| document | `document`, `mimetype`, `fileName?`, `caption?` |
| sticker | `sticker` (WebP) |
| poll | `poll: { name, values, selectableCount? }` |
| location | `location: { latitude, longitude, name?, address? }` |
| contacts | `contacts: { displayName?, contacts: [{ name, vcard }] }` |
| reaction / edit / delete | `react: { key, emoji }`, `edit: key` with `text`, `revoke: key` |
| forward | `forward: message` (the WhatsApp content of a received message) |
| buttons | `text`, `buttons: [{ id, text }]` (up to 3), `footer?`, `title?` |
| list | `text`, `title`, `buttonText`, `sections: [{ title, rows: [{ id, title, description? }] }]` |

A media source is bytes (`Buffer`/`Uint8Array`), `{ url }` (an `http(s)` URL only), `{ path }` (a local file) or
`{ stream }`. URL downloads refuse private network addresses and cap the size. `{ url }` never reads local files, so
a link taken from a chat message is safe to pass; only give `{ path }` paths you chose yourself.

Options (third argument): `quoted` (reply to a message), `expiration` (disappearing-message seconds).

The older specific methods stay and take the same arguments in a more explicit form (`sendText`, `sendImage`,
`sendVideo`, `sendAudio`, `sendDocument`, `sendSticker`, `sendMedia`, `sendPoll`, `sendLocation`, `sendContact`,
`react`, `edit`, `revoke`, `forwardMessage`, `sendMessage` for a raw WhatsApp message object).

## Writing a bot: your style

velowa does not prescribe how a bot is organised. Two complete, runnable examples show the two common ways;
copy the one you like and change it:

| Example | Style |
| --- | --- |
| [`examples/cases-bot.js`](examples/cases-bot.js) | **Cases**: one `switch (command)` over the message text, helper values (`isOwner`, `isAdmin`, `group`) computed on the way |
| [`examples/plugin-bot/`](examples/plugin-bot) | **Plugins**: one file per command (`export default { commands: ['ping'], run }`), loaded from a folder and reloaded when a file changes |

All examples, with how to run them, are listed in [`examples/`](examples/README.md).

The cases style in short:

```ts
import { serialize } from 'velowa'

const PREFIXES = ['!', '.']

client.on('message', async (raw) => {
  const m = serialize(client, raw)
  if (m.fromMe) return
  const prefix = PREFIXES.find((p) => m.text.startsWith(p))
  if (!prefix) return
  const [word, ...args] = m.text.slice(prefix.length).trim().split(/\s+/)
  const text = args.join(' ')

  switch (word.toLowerCase()) {
    case 'ping':
      await m.reply('pong')
      break
    case 'say':
      await m.reply(text || 'say what?')
      break
    case 'poll': {
      const [name, ...values] = text.split('|').map((s) => s.trim())
      await client.send(m.chat, { poll: { name, values } })
      break
    }
  }
})
```

The plugin style in short:

```js
// plugins/ping.js
export default {
  commands: ['ping', 'p'],
  help: 'answers pong',
  run: async ({ reply }) => reply('pong'),
}
```

Things nearly every bot needs, and where to get them:

| Need | How |
| --- | --- |
| ignore old messages after a reconnect | compare `m.timestamp` with the clock (the examples skip anything older than 2 minutes) |
| ignore the bot's own messages | `if (m.fromMe) return` |
| owner-only commands | compare `m.sender`'s number with a list; owners can also appear as LIDs, `client.lidsFor` maps them |
| admin-only commands | `isGroupAdmin(await groups.get(m.chat), m.sender)` |
| "typing…" before answering | `await client.sendChatState(m.chat, 'composing')` then `'paused'` |
| button and list taps | they arrive as messages; `m.text` holds the id you gave the button |
| keep an account safe | `new Client({ antiban: true })`, see [Reliability and safety](#reliability-and-safety) |

## Feature guide

Every example assumes `const client = new Client(...)` is connected and `jid` is a chat JID
(`4915…@s.whatsapp.net`, `…@g.us`, `…@newsletter`).

### Messages: reply, mention, react, edit, delete, forward

```ts
const id = await client.sendText(jid, 'hi @4915…', { mentions: ['4915…@s.whatsapp.net'] })
await client.sendText(jid, 'a reply', { quoted: { key: m.key, message: m.raw.message } })
await client.react({ remoteJid: jid, id, fromMe: true }, '👍') // '' removes the reaction
await client.edit({ remoteJid: jid, id, fromMe: true }, 'hi (edited)')
await client.revoke({ remoteJid: jid, id, fromMe: true }) // delete for everyone
await client.forwardMessage(otherJid, m.raw.message)
await client.markRead([m.key])
await client.sendChatState(jid, 'composing') // 'recording' | 'paused'
await client.sendPresence('available') // needs client.setName('…') once
await client.subscribePresence(jid) // then listen to the 'presence' event
```

Link previews: `sendText(jid, 'https://…', { linkPreview: true })` fetches title, description and picture of the first
link (private addresses are refused; use `fetchLinkPreview` and pass your own preview if you want control).

### Media

```ts
await client.sendImage(jid, bytes, { caption: 'hi' })
await client.sendVideo(jid, bytes, { gifPlayback: true })
await client.sendAudio(jid, bytes, { ptt: true }) // voice note
await client.sendDocument(jid, bytes, { mimetype: 'application/pdf', fileName: 'a.pdf' })
await client.sendSticker(jid, webpBytes)

const data = await client.downloadMedia(m.raw.message) // Buffer, decrypted
```

Media is encrypted and uploaded for you; channels get unencrypted uploads automatically. Options (`viewOnce`, `seconds`,
`width`, `height`, `groupStatus`, …) are on `MediaOptions`.

### Buttons, lists and rich answers

```ts
import { quickReply, urlButton, parseButtonReply } from 'velowa'

await client.sendButtons(jid, { text: 'Pick one', buttons: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] })
await client.sendList(jid, {
  title: 'Menu', text: 'Choose', buttonText: 'Open',
  sections: [{ title: 'Drinks', rows: [{ id: 'tea', title: 'Tea' }, { id: 'coffee', title: 'Coffee' }] }],
})
await client.sendTemplate(jid, {
  text: 'Need help?',
  buttons: [
    { type: 'reply', text: 'Yes', id: 'yes' },
    { type: 'url', text: 'Website', url: 'https://example.com' },
    { type: 'call', text: 'Call us', phone: '+4915…' },
  ],
})
await client.sendInteractive(jid, {
  body: 'Choose',
  footer: 'velowa',
  buttons: [quickReply('Yes', 'yes'), urlButton('Docs', 'https://example.com')],
})

// the tap comes back as a normal message
client.on('message', (raw) => {
  const reply = parseButtonReply(raw.message)
  if (reply) console.log(reply.kind, reply.id, reply.text)
})
```

Meta AI style answers: `sendRichResponse(jid, { text, code, table, latex, map, images })` and `sendHtml` (HTML is rendered
as markup; pass only HTML you wrote yourself, never received text).

### Polls, quizzes, questions

```ts
await client.sendPoll(jid, 'Pizza?', ['yes', 'no'], 1) // 2-12 options, last argument = how many may be chosen
await client.sendQuiz(jid, '2 + 2?', ['3', '4', '5'], '4') // a poll with a right answer
await client.sendQuestion(jid, 'What should we build?') // the audience answers in a box
await client.sendImagePoll(jid, 'Which logo?', ['A', 'B'], [imageA, imageB]) // channels
```

Votes arrive encrypted as poll updates (`pollUpdateMessage`); `pollOptionHash(name)` gives the hash a vote refers to an option by.

### Groups and communities

```ts
const g = await client.groups.create('Team', ['4915…@s.whatsapp.net'])
await client.groups.metadata(g.id) // subject, owner, participants (id / phoneNumber / lid / admin), settings
await client.groups.fetchAll() // every group the account is in
await client.groups.updateParticipants(g.id, [jid], 'add') // | 'remove' | 'promote' | 'demote'
await client.groups.setSubject(g.id, 'Team 2')
await client.groups.setDescription(g.id, 'Rules: be nice')
await client.groups.setting(g.id, 'announcement') // only admins write; 'locked' = only admins edit info
await client.groups.setEphemeral(g.id, 604800) // disappearing messages, seconds (0 = off)
await client.groups.inviteCode(g.id) // + revokeInvite, acceptInvite(code), inviteInfo(code)
await client.groups.setJoinApproval(g.id, 'on') // + joinRequests(), updateJoinRequests()
await client.groups.leave(g.id)

await client.setGroupMemberAddMode(g.id, 'admin_add') // permissions, member tag, share history
await client.setMemberLabel(g.id, 'Moderator')

await client.communities.create('Club') // + createGroup, linkGroup, unlinkGroup, linkedGroups, deactivate
```

`group.update` events report joins, leaves, promotions, subject and setting changes.

### Channels

```ts
const ch = await client.newsletters.create('News', 'Daily news')
await client.newsletters.metadata('invite', 'CODE') // or ('jid', jid)
await client.newsletters.follow(jid) // unfollow, mute, unmute, subscribers, update, react

await client.postToChannel(ch.id, 'Hello channel') // text
await client.postToChannel(ch.id, { /* any message */ }, { aiContent: true }) // label: AI content / paid partnership
await client.sendImage(jid, bytes, { caption: 'photo' }) // images, videos, polls, quizzes, questions and music
await client.sendMusic(channelJid, videoWithSongTrack, { title: 'Song', author: 'Artist', songId: '…' }) // the sound must be in the video's own track; catalog data (`MusicInfo`) is best copied from a music post you received
```

Channel posts are not end-to-end encrypted (the server fans them out); velowa handles the different wire format.

### Status (stories)

```ts
await client.sendStatusText('good morning', ['4915…@s.whatsapp.net'], 'allowlist') // audience must be given
await client.setStatusPrivacy('only', ['4915…@s.whatsapp.net']) // 'contacts' (all) | 'except' (all but …) | 'only' (just …)
await client.sendGroupStatusText(groupJid, 'hello group') // group status; pictures/videos: sendImage(group, data, { groupStatus: true })
```

### Contacts, profile and privacy

```ts
await client.onWhatsApp('4915…', '4916…') // [{ jid, exists }]
await client.fetchStatus(jid) // "About" text
await client.profilePictureUrl(jid, 'image')
await client.findUserByUsername('someone')
await client.usernames.check('wanted-name') // + set, mine
await client.lidsFor(jid)

await client.updateProfileName('My Bot')
await client.updateProfileStatus('Ask me with !help')
await client.updateProfilePicture(jpegBytes) // square JPEG; pass a group JID as second argument for a group
await client.fetchPrivacySettings()
await client.updatePrivacy('last', 'contacts') // last, online, profile, status, groupadd, readreceipts, calladd, messages
await client.blockUser(jid)
await client.unblockUser(jid)
await client.fetchBlocklist()
```

### Business and payments

```ts
await client.getBusinessProfile(jid) // null for a private account
await client.getCatalog(jid)
await client.updateBusinessProfile({ description: 'We repair bikes' }) // Business accounts only
await client.requestPayment(jid, { amount1000: 12_500, currency: 'EUR', note: 'Lunch' }) // 12.50 EUR; + sendPaymentNote, declinePaymentRequest, cancelPaymentRequest
```

### Reports

```ts
await client.reportUser(jid, { block: true, deleteChat: true }) // sends the latest messages as evidence
await client.reportGroup(groupJid, { leave: true })
await client.reportChannel(channelJid, { unfollow: true }) // …@newsletter
await client.reportToAdmins(groupJid, m.id) // tells the admins about that message id ("reported messages")
```

### Calls

Voice and video, one to one, in groups and through call links ("rooms"), in both directions. Media can come from
files or from this machine's microphone and speaker.

```ts
// one to one
const call = await client.startCall(jid, { audioFile: 'announcement.mp3' }) // voice, plays the file
await client.startCall(jid, { video: true, videoFile: 'clip.mp4' }) // video with the sound of the file
await client.startCall(jid, { localAudio: { mic: true, speaker: true } }) // talk through this machine
await client.endCall(call.callId)

// incoming
client.on('call', async (c) => {
  if (c.status === 'offer') await client.acceptCall(c.callId, { audioFile: 'busy.mp3' }) // or rejectCall(c.callId, c.creator ?? c.from)
})

// groups and rooms
const gc = await client.startGroupCall([], { group: groupJid, audioFile: 'hello.mp3' }) // rings every member
const link = await client.createCallLink('audio') // https://call.whatsapp.com/voice/…
await client.joinCallLink(link.url, 'audio') // waits in the waiting room if the creator wants approval
await client.setApprovalRequired(gc.callId, true) // creator: require approval
await client.answerWaitingRoom(gc.callId, userLid, true) // creator: admit (false = turn away)

// during a call
await client.enableCamera(call.callId, { videoFile: 'clip.mp4' }) // ask to turn video on
await client.disableCamera(call.callId)
await client.raiseHand(gc.callId, true) // group calls
await client.sendReaction(gc.callId, '👍') // group calls
```

Raw media is also possible: `audioIn` (16 kHz mono PCM), `videoFrames` (H.264 access units, see `splitAnnexB`),
`recordTo` / `recordVideoTo` to save what comes in. File decoding needs `ffmpeg` on the machine; `localAudio` needs
PulseAudio or PipeWire (`parec`, `pacat`). Events of a call arrive as `call` events (`offer`, `accept`, `terminate`,
`group_update`, `video`, `user_action`, …).

### Chats and app state

Changes that sync to every device the account has (the phone shows them too):

```ts
await client.archiveChat(jid)
await client.muteChat(jid, Date.now() + 8 * 3600_000) // until; -1 = forever, null = unmute
await client.pinChat(jid)
await client.markChatRead(jid)
await client.starMessage(m.key)
await client.deleteChat(jid) // clearChat, deleteMessageForMe
await client.addLabel({ id: '1', name: 'Customers', color: 3 }) // then labelChat(jid, '1'), labelMessage(jid, '1', messageId)
await client.setChatEphemeral(jid, 86400)
```

They need the phone to have shared the app-state keys once: `await client.waitForAppState()`.

## Events reference

| Event | Payload |
| --- | --- |
| `connection` | `{ state: 'connecting' \| 'open' \| 'close', qr?, pairingCode?, newLogin?, reason?, code?, willReconnect?, loggedOut? }` |
| `message` | a decrypted incoming message (`serialize` it) |
| `receipt` | delivery / read / played receipts for what we sent |
| `presence` | online / typing / recording of a chat or member |
| `group.update` | a group changed: members, subject, settings |
| `call` | calls and everything inside a call (`offer`, `accept`, `terminate`, `group_update`, `video`, `user_action`, …) |
| `chat.update`, `contact.update` | a chat was muted / archived / pinned / read on another device; a saved name changed |
| `channel.status` | a channel status or a reaction / edit / revoke of one |
| `history` | a chunk of chat history the phone sent after linking |
| `app-state`, `notification` | raw app-state changes and any other server notification |
| `qr`, `pairing-code`, `paired`, `open`, `close` | the individual connection events (the `connection` event carries the same) |

## Configuration

```ts
import { Client, ProtocolLogger } from 'velowa'

new Client({
  authDir: 'auth', // credentials and Signal state
  logger: new ProtocolLogger({ enabled: false }), // or { dir, label, rotateMB, retention, compressAfterHours, keep }
  autoReconnect: true, // reconnect after a drop (default)
  pairWithPhoneNumber: '4915…', // link with a code instead of a QR
  antiban: true, // or your own limits, see below
  config: { /* override the WhatsApp Web version / browser identity */ },
})
```

`antiban` throttles sending like a person would: caps per minute, hour and day (a send over the minute cap waits,
over the hour or day cap it throws `AntiBanError`), random gaps, a pause before the first message to a new chat, a
limit on identical texts, a warm-up for new accounts, and "typing…" before text. Pass `true` for the defaults
(`ANTIBAN_DEFAULTS`) or a partial `AntiBanConfig`.

**Protocol logs** (for debugging) are kept as `logs/<day>/<time>-<label>/` with a `session.json` per run; `logs/latest`
points at the newest one. Big files rotate, runs older than a day are compressed, and runs older than 30 days (or beyond
1 GB) are deleted when the next logger starts. Manage them with
`npm run logs -- list | migrate | compress | prune --dry | keep <run>`.

## What you can build

- **Command bots** for a group or a team: `!help`, `!poll`, `!remind`, admin tools (kick, promote, lock the group).
- **Support desks**: answer with buttons and lists, hand over to a person, keep the conversation in one place.
- **Notifications**: send alerts, receipts or reports from a script, a CI job or a server to a person, a group or a channel.
- **Channel publishers**: post text, images, videos, polls, quizzes and music to a channel on a schedule, with AI or
  paid-partnership labels.
- **Moderation**: watch `group.update` and messages, report or remove, answer with rules.
- **Call bots**: pick up incoming calls and play an announcement, call people with a recorded message, join a room.
- **Archiving and sync**: read the `history` event, mirror chats to your own storage, download media.
- **Anything else on top of the protocol**: `client.request(node)` sends a raw stanza and `client.mex(queryId, variables)`
  runs any WhatsApp GraphQL query.

## Reliability and safety

- **Use a number you can lose.** Unofficial clients can be restricted or banned. Start slowly, warm accounts up, do not
  message people who have not written to you, and turn on `antiban`.
- **`auth/` is the account.** Anyone with the folder can act as the account; keep it out of git and off shared disks.
- **Logs contain account data** (ids, message content). The default `logs/` folder is git-ignored; give a bot
  `new ProtocolLogger({ enabled: false })` unless you are debugging.
- **Untrusted input.** Do not pass received text to `sendHtml`; `{ url }` media downloads and link previews refuse private
  network addresses, but only fetch URLs you trust.
- **One process per account.** Two processes using the same `authDir` fight over the session.
- **Handle errors.** Wrap handlers in `try/catch` (a thrown error in a listener is yours to handle) and expect `AntiBanError`
  when limits are on.

## Development

```bash
npm run build         # wasm-pack (bridge + voip) and tsup -> dist/index.js, dist/index.cjs, types
npm run build:js      # only the TypeScript part (when the WebAssembly did not change)
npm test              # vitest
npm run lint          # tsc --noEmit + eslint (src and tests)
npm run check:package # publint + are-the-types-wrong + the package rules (tests/package)
npm run check:docs    # type-checks the code in this README and in examples/ against the built package
npm run pair          # a dev console that exercises everything and logs every frame
npm run example       # a tour of the features against your own account (examples/tour.js)
npm run logs -- list  # look after the protocol logs
```

```text
src/
  client/            Client, connection, sender, receiver
    features/<area>/ request builders and parsers, one folder per area:
                     account call channel chat community contact group message payment report
  bot/               serialize() and GroupCache: helpers for people who write bots
  crypto/ codec/     WebAssembly-backed Signal, Noise, app-state and WABinary
  auth/ logging/ events/ wam/ cli/
tests/               mirrors src/ one to one; tests/helpers has the fake remote world
rust/                the WebAssembly crates (wacore-* are one-time copies from whatsapp-rust)
examples/            runnable programs: echo-bot, cases-bot, plugin-bot, notifier, channel-post, group-admin, calls, tour
docs/                longer notes
```

The Rust crates copied from `whatsapp-rust` are a one-time copy, not a live dependency; they are owned and maintained here.

## More documentation

- [`CONTRIBUTING.md`](CONTRIBUTING.md): rules for git, for what `npm install` puts on a machine, and for releases.
- [`CHANGELOG.md`](CHANGELOG.md): what changed, newest first.
