# More account, chat, group, channel, event and business functions

Everything here is covered by unit tests against the stanza or GraphQL request it builds. What was also tried on a real account is in the table below: some `w:mex` GraphQL calls were answered with `Bad Request` (their query ids come from the Baileys fork and may belong to another WhatsApp build), some got no answer, many are untested live. Use those at your own risk; `client.mex(queryId, variables)` lets you replace an id yourself.

```ts
// Account and chats
await client.account.trustedDevices() // + trustDevice, untrustDevice, removeDevice(jid), setLinkedProfiles
await client.lockChat(jid) // + setFavorites([jid]), muteContactStatus(jid), reorderLabels([1, 2])
await client.pinMessage(m.key, 7 * 86_400) // + unpinMessage(m.key); live-verified
await client.sendAlbum(jid, [{ image: bytes }, { image: bytes, caption: 'two' }])
const next = await client.waitForMessage((x) => x.from === jid, 60_000)
await client.logout({ deleteAuth: true }) // unlinks this device on the server and deletes the saved folder

// Privacy and contacts
await client.privacy.blockingStatus() // + setBlocking, optOutList, pushConfig, disclosures
await client.privacy.setTextStatus('Busy', '🔕') // + textStatusList, createReminder, deleteReminder
await client.contactUsernames('4915…@s.whatsapp.net')

// Groups, communities, channels
await client.groups.pastParticipants(groupJid) // who left, why and when
await client.groups.reportedMessages(groupJid)
await client.communities.transferOwnership(communityJid, newOwnerJid)
await client.newsletters.promoteAdmin(channelJid, userJid) // + demoteAdmin, changeOwner, pinMessage, setPicture
await client.newsletters.search('news') // + directoryList, recommended, directoryCategories, following

// Calendar events (HTTP GraphQL; the token comes from two w:mex calls)
await client.calendar.list()
await client.calendar.rsvp(eventId, 'GOING') // + create, get, update, delete, invite, inviteLink, linkPreview

// Media, history, devices (round 2)
const fresh = await client.updateMediaMessage(m.key, m.content!) // the phone uploads expired media again
await client.fetchMessageHistory(50, m.key, Date.now()) // older messages arrive as a `history` event
await client.requestPlaceholderResend(m.key) // "waiting for this message": arrives as `message.resent`
await client.sendMessage(jid, { conversation: 'hi' }, { devices: 'primary' }) // 'recipient' | 'primary' | 'no-linked'
await client.rotateSignedPreKey() // also done automatically every 27 days
await client.resyncAppState(undefined, { fromScratch: true })

// Events as chat cards, comments, sticker packs, menu widgets
const cardId = await client.sendEvent(groupJid, { name: 'Launch', startTime: new Date(Date.now() + 86_400_000) })
await client.respondToEvent({ remoteJid: groupJid, id: cardId, fromMe: true }, userJid, 'GOING') // answers arrive as `eventResponse`
await client.sendComment(m.key, 'nice') // under a post in a community announcement group; arrives as `addon`
await client.sendStickerPack(jid, { name: 'Pack', publisher: 'Me', stickers: [{ data: webpBytes, emojis: ['😀'] }], cover: webpBytes, thumbnail: jpegBytes })
await client.sendRichResponse(jid, {
	text: 'Pick one',
	buttons: { title: 'Menu', labels: ['Profile', 'Help'] },
	cards: { items: [{ title: 'Card', buttons: ['A', 'B'] }], layout: 'carousel' },
	footer: { text: 'Open', url: 'https://example.com' },
})

// Server info, clock, a small store
const flags = await client.server.abProps() // the server's experiment flags: { props, hash, refresh }
await client.server.reachoutTimelock() // is the account blocked from starting chats?
await client.server.newChatCap() // how many new chats may it start this period
await client.server.setPassive(true) // background mode
client.serverTime() // unix seconds on the server's clock
const store = new MemoryStore().bind(client) // later: store.messages(jid, 20), store.name(jid), store.chats()

// Bots, group calls
await client.listBots() // the AI bot directory
await client.fetchBotProfile(jid, productId) // one bot's name/description/category, prompts and slash commands
await client.setScreenShare(callId, true) // only the signal; others see `screenShare` on the call event

// Business accounts
await client.business.createProduct({ name: 'Tee', price: 15_000, currency: 'EUR', images: [{ url }] })
await client.business.deleteProducts([productId])
await client.business.broadcastQuota() // + deleteBroadcastList, createCollection, updateCollection
await client.setQuickReply({ shortcut: 'hi', message: 'Hello, how can we help?' })
await client.setBusinessCoverPhoto(jpegBytes) // + business.removeCoverPhoto(id)
```

**Status of the functions in this section** (checked against a real account):

| Status | Functions |
| --- | --- |
| Live, works | `pinMessage`, `unpinMessage`, `sendAlbum`, `groups.info`, `infoWithBots`, `isInternal`, `subgroups`, `reportedMessages`, `privacy.settings`, `blockingStatus`, `pushConfig`, `disclosures`, `optOutList`, `textStatusList`, `newsletters.search`, `directoryList`, `recommended`, `directoryCategories`, `linkPreviewCheck`, `dehydrated`, `following` |
| Live, reaches the server (answer "Not Authorized" because the account does not run the channel) | `newsletters.adminCapabilities`, `enforcements` |
| Live, **Bad Request** (the server refuses the query id or its variables) | `calendar.*` (the token query already fails), `account.trustedDevices`, `privacy.contactList`, `pictureInfo`, `onlineStatus`, `onlineStatusLastSeen`, `suggestedContacts`, `newsletters.similar`, `groups.batch`, `inviteLink`, `participating` |
| Live, **no answer** (timeout) | `groups.pastParticipants`, `groups.linkedSubgroups`, `business.broadcastQuota` |
| Live, arrived on the phone | `sendRichResponse` with `buttons` / `cards` / `footer`, `sendEvent`, `sendStickerPack` |
| Live, sent without error, no visible result yet | `tctoken` (our token is issued after a 1:1 send; none came back yet), `fetchMessageHistory`, `requestPlaceholderResend` |
| Live, works | `rotateSignedPreKey` (messages kept decrypting afterwards), `resyncAppState`, `server.abProps`, `server.reachoutTimelock`, `server.newChatCap`, `server.setPassive`, `serverTime` |
| Live, answered `403 forbidden` for this account | `listBots` |
| **Not tested live**, unit tests only | `MemoryStore`, `updateMediaMessage`, `respondToEvent`, `sendComment`, `setScreenShare`, `setBusinessCoverPhoto`, `lockChat`, `setFavorites`, `muteContactStatus`, `reorderLabels`, `setLinkPreviewsDisabled`, `setRelayAllCalls`, `setPrivateProcessing`, `logout`, `waitForMessage`, `contactUsernames`, `setQuickReply` (sent without error, but never seen on a business phone), `account.trustDevice` / `untrustDevice` / `removeDevice` / `setLinkedProfiles`, all other `privacy.*` setters and reminders, the other `groups.*` additions (invite V4, acknowledge, cancel request, linked participants, GraphQL create / add / reset link), `communities.*` additions, the other channel admin, insight, report and pin calls, `business.createProduct` / `updateProduct` / `deleteProducts` / collections / `deleteBroadcastList` |

The query ids of the channel and group calls come from WhatsApp Web itself; the ones that answer `Bad Request` come from the Baileys fork and are not in the Web build (probably Android-only). Directory calls need country codes (default `US`). Product images must already be on WhatsApp's servers (`{ url }`); uploading new ones is not built.
