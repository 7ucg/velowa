# Call rooms, guest joining and raw call media

The everyday call API (starting, accepting, group calls, call links, camera/hand/reactions) is in the main
[README's Calls section](../README.md#calls). This page covers the three more specialized parts: running your own
room, joining a call link without a WhatsApp account, and working with raw audio/video instead of files.

## A room

A room is a call link you own and run: guests open it in a browser (no WhatsApp account needed), ask to join, and
the room lets them in by a rule you choose. `createRoom` makes the link, joins it as its owner, requires approval
and handles every request; everything it sees is also written to the protocol log (`room.*` events).

```ts
const room = await client.createRoom({ media: 'video', admit: 'all' }) // 'all' | 'guests' | 'none' | (person) => boolean
console.log(room.url) // https://call.whatsapp.com/video/…
room.on('request', (p) => console.log(p.guest ? 'guest' : 'member', p.name, 'wants in'))
room.on('joined', (p) => console.log(p.name, 'is in'))
room.on('left', (p) => console.log(p.name, 'left'))
await room.admit(jid) // by hand, with admit: 'none'; also room.deny(jid)
await room.close() // ends the call for everybody
```

Underneath, the `call` event carries `waitingRoom` (who waits, `guest` for people without an account, the name they
typed) and `roster` (who is connected or left). `client.answerWaitingRoom(callId, jid, true)` lets one person in;
`createRoom` already calls it for you, by whatever `admit` rule you gave it.

## Raw call media

`audioIn` (16 kHz mono PCM), `videoFrames` (H.264 access units, see `splitAnnexB`), `recordTo` / `recordVideoTo` to
save what comes in - an alternative to passing `audioFile`/`videoFile`/`localAudio` when you want to generate or
process the stream yourself instead of pointing at a file. File decoding needs `ffmpeg` on the machine; `localAudio`
needs PulseAudio or PipeWire (`parec`, `pacat`). Events of a call arrive as `call` events (`offer`, `accept`,
`terminate`, `group_update`, `video`, `user_action`, …).

## Joining as a guest

No WhatsApp account, no pairing - one call link, one throwaway identity:

```ts
import { Client } from 'velowa'

const guest = new Client({
  guest: { inviteCode: link.url, guestName: 'Baron' }, // the token, or the whole https://call.whatsapp.com/... URL
})
await guest.connect()
await guest.ready() // registers (guest_reg) then logs in; guest.me is the server-assigned lid once this resolves

const call = await guest.joinCallLink(link.url, 'video', { audioFile: 'hello.mp3' }) // or localAudio, videoFile, ...
// waits in the host's waiting room if one is on (call.waiting === true until a group_update admits it)

await guest.endCall(call.callId) // leaves properly (the host sees it go, not just drop)
```

That's the whole guest API: `authDir`, chats, groups, channels and messaging do not apply (a guest is not an
account) - everything else (`joinCallLink`'s media options, the `call` event, `enableCamera`/`raiseHand`/
`sendReaction` during the call) works exactly as it does for a paired account joining its own room. A fresh,
unused `Client` is a fresh guest identity every time: nothing is reused or persisted across runs by design.
`guest_reg` may be gated behind an anti-automation check on repeated/high-volume registration (not handled here;
this is for real interactive use, not for running many guests at once).
