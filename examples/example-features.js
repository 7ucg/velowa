// Live check of: channel posts/polls/admin, group permissions, member tag, status privacy, communities.
// Everything is reverted/deleted at the end (a temporary channel and a temporary community are created and removed).
//
//   node examples/example-features.js
import { Client, ProtocolLogger } from '../dist/index.js'

const GROUP = process.env.TEST_GROUP ?? '120363409361773452@g.us'
const CHANNEL = process.env.TEST_CHANNEL ?? '120363402116894088@newsletter'
const OTHER = (process.env.OTHER_NUMBER ?? '+57 318 7684442').replace(/\D/g, '') + '@s.whatsapp.net'

const logger = new ProtocolLogger({ dir: 'logs', label: 'example-features' })
console.log('protocol log:', logger.sessionDir)
const client = new Client({ authDir: 'auth', logger })
client.on('qr', () => { console.error('not linked'); process.exit(2) })
const results = []
async function step(name, fn) {
	try { const out = await fn(); results.push({ name, ok: true }); console.log(`  ok    ${name}${out !== undefined ? '  ' + String(out).slice(0, 120) : ''}`); return out }
	catch (e) { results.push({ name, ok: false, error: e?.message ?? String(e) }); console.log(`  FAIL  ${name}: ${e?.message ?? e}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
await client.connect()
await Promise.race([client.ready(), sleep(60_000).then(() => { throw new Error('login timed out') })])
console.log(`logged in as ${client.me.id}\n`)
const meta = () => client.groups.metadata(GROUP)

console.log('channel posts (look at the channel on your phone: they should show as normal text/poll)')
await step('text post (conversation)', () => client.sendText(CHANNEL, 'velowa: normal text post'))
await step('poll post', () => client.sendPoll(CHANNEL, 'velowa: channel poll', ['A', 'B', 'C']))
await step('quiz post', () => client.sendQuiz(CHANNEL, 'velowa quiz: 2+2?', ['3', '4', '5'], '4'))
await step('question post', () => client.sendQuestion(CHANNEL, 'velowa question: favourite colour?'))
await step('music post', () => client.sendMusic(CHANNEL, 'velowa music post', { title: 'Test Song', author: 'Test Artist' }))
await step('channel metadata', async () => { const c = await client.newsletters.metadata('jid', CHANNEL); return `"${c.name}" role ${c.role}` })

console.log('\ntemporary channel (create, edit, post, delete)')
const created = await step('create channel', async () => { const c = await client.newsletters.create('velowa temp channel', 'created by velowa'); return JSON.stringify({ id: c.id, name: c.name }) })
if (created) {
	const id = JSON.parse(created).id
	await step('update name + description', async () => { await client.newsletters.update(id, { name: 'velowa temp renamed', description: 'edited' }); const c = await client.newsletters.metadata('jid', id); return `"${c.name}" / "${c.description}"` })
	await step('post to it', () => client.sendText(id, 'temp channel post'))
	await step('delete channel', async () => { await client.newsletters.delete(id); return 'deleted' })
}

console.log('\ngroup permissions (toggled, then restored)')
const before = await meta()
console.log(`  before: addAll=${before.memberAddAll} approval=${before.joinApprovalMode} announce=${before.announce} restrict=${before.restrict}`)
await step('"Add other members": everyone', async () => { await client.setGroupMemberAddMode(GROUP, 'all_member_add'); return `memberAddAll=${(await meta()).memberAddAll}` })
await step('"Add other members": admins only', async () => { await client.setGroupMemberAddMode(GROUP, 'admin_add'); return `memberAddAll=${(await meta()).memberAddAll}` })
await step('"Approve new members": on', async () => { await client.groups.setJoinApproval(GROUP, 'on'); return `approval=${(await meta()).joinApprovalMode}` })
await step('"Approve new members": off', async () => { await client.groups.setJoinApproval(GROUP, 'off'); return `approval=${(await meta()).joinApprovalMode}` })
await step('"Send message history": admins only', async () => JSON.stringify(await client.setGroupShareHistory(GROUP, 'admin_share')))
await step('"Send message history": everyone', async () => JSON.stringify(await client.setGroupShareHistory(GROUP, 'all_member_share')))
await step('member tag: set', async () => client.setMemberLabel(GROUP, 'velowa'))
await sleep(1500)
await step('member tag: remove', async () => client.setMemberLabel(GROUP, ''))

console.log('\nstatus privacy (set, then back to "My contacts")')
await step('wait for app-state key', async () => { if (!(await client.waitForAppState(40_000))) throw new Error('no app-state key'); await sleep(4000); return 'ok' })
await step('only share with: second account', () => client.setStatusPrivacy('only', [OTHER]).then(() => 'set'))
await step('contacts except: second account', () => client.setStatusPrivacy('except', [OTHER]).then(() => 'set'))
await step('back to my contacts', () => client.setStatusPrivacy('contacts').then(() => 'set'))

console.log('\ncommunity (create, link the test group, unlink, deactivate)')
const comm = await step('create community', async () => { const c = await client.communities.create('velowa temp community', 'temp'); return JSON.stringify({ id: c.id, community: c.isCommunity }) })
if (comm) {
	const cid = JSON.parse(comm).id
	await step('link test group to it', async () => { await client.communities.linkGroup(GROUP, cid); await sleep(1500); const m = await meta(); return `linkedParent=${m.linkedParent}` })
	await step('list sub-groups', async () => { const r = await client.communities.linkedGroups(cid); return `${r.linkedGroups.length} sub-groups: ${r.linkedGroups.map((g) => g.subject).join(', ')}` })
	await step('unlink test group', async () => { await client.communities.unlinkGroup(GROUP, cid); await sleep(1500); return `linkedParent=${(await meta()).linkedParent ?? '(none)'}` })
	await step('deactivate community', async () => { await client.communities.deactivate(cid); return 'deactivated' })
}

const after = await meta()
console.log(`\nrestored: addAll=${after.memberAddAll === before.memberAddAll} approval=${after.joinApprovalMode === before.joinApprovalMode} linkedParent=${after.linkedParent ?? '(none)'}`)
const failed = results.filter((r) => !r.ok)
console.log(`${results.length - failed.length}/${results.length} steps ok`)
for (const f of failed) console.log(`  - ${f.name}: ${f.error}`)
client.close('example finished')
setTimeout(() => process.exit(failed.length ? 1 : 0), 500)
