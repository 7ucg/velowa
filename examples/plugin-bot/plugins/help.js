export default {
	commands: ['help', 'menu'],
	help: 'lists the commands',
	run: async ({ reply, plugins }) =>
		reply(
			plugins
				.filter((p) => p.help)
				.map((p) => `!${p.commands[0]}  ${p.help}`)
				.join('\n'),
		),
}
