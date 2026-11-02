// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
export default {
	commands: ['kick'],
	help: 'removes the quoted or mentioned member',
	group: true,
	admin: true,
	run: async ({ client, m, reply }) => {
		const target = m.quoted?.sender ?? m.mentionedJids[0]
		if (!target) return reply('quote or @mention who to remove')
		const [res] = await client.groups.updateParticipants(m.chat, [target], 'remove')
		await reply(res?.status === '200' ? 'removed' : `could not remove (${res?.status})`)
	},
}
