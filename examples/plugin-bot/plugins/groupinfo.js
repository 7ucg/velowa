export default {
	commands: ['groupinfo', 'gi'],
	help: 'name, size and admins of this group',
	group: true,
	run: async ({ reply, group }) =>
		reply(`${group.subject}\n${group.size} members, ${group.admins.length} admin entries`),
}
