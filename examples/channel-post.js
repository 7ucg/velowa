// Publish to a WhatsApp channel you own: a text, a poll and (optionally) a picture, with the "AI content" label.
//
//   CHANNEL=1203...@newsletter node examples/channel-post.js [picture.jpg]
//
// Create a channel first (WhatsApp > Updates > Channels > +), or from code: `await client.newsletters.create('News')`.
import { readFile } from 'node:fs/promises'
import { Client, ProtocolLogger } from 'velowa'

const channel = process.env.CHANNEL
if (!channel) {
	console.error('usage: CHANNEL=1203...@newsletter node examples/channel-post.js [picture.jpg]')
	process.exit(2)
}

const client = new Client({ authDir: 'auth', logger: new ProtocolLogger({ enabled: false }) })
await client.connect()
await client.ready()

const meta = await client.newsletters.metadata('jid', channel)
console.log(`posting to "${meta.name}"`)

// text, with the "AI content" label (shown under the post)
const post = await client.postToChannel(channel, 'Hello from velowa', { aiContent: true })
console.log('text post', post.id, 'number', post.serverId)

// a poll
await client.send(channel, {
	poll: { name: 'Do you like channels?', values: ['yes', 'very much'] },
})

// a picture with a caption, if you give one
const picture = process.argv[2]
if (picture)
	await client.send(channel, { image: await readFile(picture), caption: 'Posted by velowa' })

client.close('done')
