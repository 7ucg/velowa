// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
// Group administration, on a TEST group you admin: change the name, description and settings, remove / add / promote /
// demote a member, post a status. Every change is put back at the end.
//
//   GROUP=1203...@g.us MEMBER=4915... node examples/group-admin.js
//
// GROUP  the group's JID (list yours with `await client.groups.fetchAll()`); you must be an admin there
// MEMBER the phone number of a second account that is removed, added, promoted and demoted again
import { Client, ProtocolLogger } from 'velowa'

if (!process.env.GROUP || !process.env.MEMBER) {
	console.error('usage: GROUP=1203...@g.us MEMBER=4915... node examples/group-admin.js')
	process.exit(2)
}
const GROUP = process.env.GROUP
const OTHER = process.env.MEMBER.replace(/\D/g, '') + '@s.whatsapp.net'

const logger = new ProtocolLogger({
	enabled: process.env.VELOWA_LOG === '1',
	dir: 'logs',
	label: 'group-admin',
})
const client = new Client({ authDir: 'auth', logger })
const groupEvents = []
client.on('group.update', (e) => groupEvents.push(e))
client.on('qr', () => {
	console.error('not linked: run examples/echo-bot.js once and scan the QR code')
	process.exit(2)
})

const results = []
async function step(name, fn) {
	try {
		const out = await fn()
		results.push({ name, ok: true })
		console.log(`  ok    ${name}${out !== undefined ? '  ' + String(out).slice(0, 120) : ''}`)
		return out
	} catch (e) {
		results.push({ name, ok: false, error: e?.message ?? String(e) })
		console.log(`  FAIL  ${name}: ${e?.message ?? e}`)
	}
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const statusOf = (res) => res.map((r) => `${r.status}`).join(',')

await client.connect()
await Promise.race([
	client.ready(),
	sleep(60_000).then(() => {
		throw new Error('login timed out')
	}),
])
console.log(`logged in as ${client.me.id}\n`)

const before = await client.groups.metadata(GROUP)
console.log(
	`group "${before.subject}", ${before.participants.length} members, desc=${JSON.stringify(before.desc ?? null)}, ephemeral=${before.ephemeralDuration ?? 0}, announce=${before.announce}, restrict=${before.restrict}\n`,
)
const lids = await client.lidsFor(OTHER)
const otherKeys = new Set([OTHER, ...lids.map((l) => l.lid)])
const isMember = () =>
	client.groups.metadata(GROUP).then((m) => m.participants.some((p) => otherKeys.has(p.id)))
const roleOf = () =>
	client.groups
		.metadata(GROUP)
		.then((m) => m.participants.find((p) => otherKeys.has(p.id))?.admin ?? null)

console.log('info changes')
const originalSubject = before.subject
await step('change subject', async () => {
	await client.groups.setSubject(GROUP, 'velowa group-admin demo')
	return (await client.groups.metadata(GROUP)).subject
})
await step('restore subject', async () => {
	await client.groups.setSubject(GROUP, originalSubject)
	return (await client.groups.metadata(GROUP)).subject
})
await step('set description', async () => {
	await client.groups.setDescription(GROUP, 'set by velowa')
	return (await client.groups.metadata(GROUP)).desc
})
await step('remove description', async () => {
	await client.groups.setDescription(GROUP, before.desc ?? '')
	return String((await client.groups.metadata(GROUP)).desc ?? '(none)')
})

console.log('\nsettings (toggled and restored)')
await step('only admins may send: on', async () => {
	await client.groups.setting(GROUP, 'announcement')
	return (await client.groups.metadata(GROUP)).announce
})
await step('only admins may send: off', async () => {
	await client.groups.setting(GROUP, 'not_announcement')
	return (await client.groups.metadata(GROUP)).announce
})
await step('only admins edit info: on', async () => {
	await client.groups.setting(GROUP, 'locked')
	return (await client.groups.metadata(GROUP)).restrict
})
await step('only admins edit info: off', async () => {
	await client.groups.setting(GROUP, 'unlocked')
	return (await client.groups.metadata(GROUP)).restrict
})
await step('disappearing messages: 24 h', async () => {
	await client.groups.setEphemeral(GROUP, 86400)
	return (await client.groups.metadata(GROUP)).ephemeralDuration
})
await step('disappearing messages: off', async () => {
	await client.groups.setEphemeral(GROUP, 0)
	return String((await client.groups.metadata(GROUP)).ephemeralDuration ?? 0)
})

console.log('\nmembers (second account)')
if (await isMember()) {
	await step('remove second account', async () => {
		const r = await client.groups.updateParticipants(GROUP, [OTHER], 'remove')
		await sleep(1500)
		return `${statusOf(r)}, member now: ${await isMember()}`
	})
	await step('add it back', async () => {
		const r = await client.groups.updateParticipants(GROUP, [OTHER], 'add')
		await sleep(1500)
		return `${statusOf(r)}, member now: ${await isMember()}`
	})
} else {
	await step('add second account', async () => {
		const r = await client.groups.updateParticipants(GROUP, [OTHER], 'add')
		await sleep(1500)
		return `${statusOf(r)}, member now: ${await isMember()}`
	})
}
await step('promote to admin', async () => {
	const r = await client.groups.updateParticipants(GROUP, [OTHER], 'promote')
	await sleep(1500)
	return `${statusOf(r)}, role now: ${await roleOf()}`
})
await step('demote again', async () => {
	const r = await client.groups.updateParticipants(GROUP, [OTHER], 'demote')
	await sleep(1500)
	return `${statusOf(r)}, role now: ${await roleOf()}`
})

console.log('\nmessages after the changes')
await step('send text to group', () =>
	client.sendText(GROUP, 'velowa group-admin demo: still works after the changes'),
)

console.log('\nstatus (story), audience = the second account only')
await step('post text status', () => client.sendStatusText('velowa demo status', [OTHER]))

await sleep(4000)
console.log(
	`\ngroup notifications seen: ${groupEvents.length} (${[...new Set(groupEvents.map((e) => e.action))].join(', ')})`,
)
const after = await client.groups.metadata(GROUP)
const same =
	after.subject === before.subject &&
	after.announce === before.announce &&
	after.restrict === before.restrict &&
	(after.ephemeralDuration ?? 0) === (before.ephemeralDuration ?? 0)
console.log(`restored to the original settings: ${same}`)

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} steps ok`)
for (const f of failed) console.log(`  - ${f.name}: ${f.error}`)
client.close('finished')
setTimeout(() => process.exit(failed.length ? 1 : 0), 500)
