// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
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
