// Calls: ring someone and play an audio file (or a video), ring a group, or make a call link ("room").
//
//   node examples/calls.js voice 4915... announcement.mp3     voice call, plays the file, hangs up when it is over
//   node examples/calls.js video 4915... clip.mp4             video call with the picture and sound of the file
//   node examples/calls.js group 1203...@g.us hello.mp3       rings everyone in the group
//   node examples/calls.js room                               creates a call link and prints it
//   node examples/calls.js join https://call.whatsapp.com/voice/TOKEN [hello.mp3]
//
// Decoding the files needs ffmpeg on the machine. For your own microphone and speaker instead of a file, use
// `localAudio: { mic: true, speaker: true }` (PulseAudio or PipeWire).
import { Client, ProtocolLogger } from 'velowa'

const [mode, target, file] = process.argv.slice(2)
if (!['voice', 'video', 'group', 'room', 'join'].includes(mode)) {
	console.error('usage: node examples/calls.js voice|video|group|room|join <target> [file]')
	process.exit(2)
}

const client = new Client({ authDir: 'auth', logger: new ProtocolLogger({ enabled: false }) })
client.on('call', (c) => {
	if (['preaccept', 'accept', 'terminate', 'reject'].includes(c.status))
		console.log('call:', c.status)
})
await client.connect()
await client.ready()

const jidOf = async (n) => (n.includes('@') ? n : (await client.onWhatsApp(n))[0]?.jid)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Wait until the other side picked up, then let the media run for `seconds` (or until the call ends). */
async function stayFor(call, seconds) {
	for (let i = 0; i < 60 && client.calls.get(call.callId)?.status !== 'connected'; i++)
		await sleep(500)
	if (client.calls.get(call.callId)?.status !== 'connected') return console.log('nobody answered')
	console.log('connected')
	for (let i = 0; i < seconds * 2 && client.calls.get(call.callId)?.status === 'connected'; i++)
		await sleep(500)
}

try {
	if (mode === 'room') {
		const link = await client.createCallLink('audio')
		console.log('call link:', link.url)
	} else if (mode === 'join') {
		const call = await client.joinCallLink(target, 'audio', file ? { audioFile: file } : {})
		console.log(call.waiting ? 'waiting for the host to let us in' : 'joined')
		await stayFor(call, 30)
		await client.endCall(call.callId)
	} else if (mode === 'group') {
		const call = await client.startGroupCall([], {
			group: target,
			...(file && { audioFile: file }),
		})
		await stayFor(call, 30)
		await client.endCall(call.callId)
	} else {
		const jid = await jidOf(target)
		if (!jid) throw new Error(`${target} is not on WhatsApp`)
		const call = await client.startCall(jid, {
			video: mode === 'video',
			...(mode === 'video' ? { videoFile: file } : { audioFile: file }),
		})
		await stayFor(call, 60)
		await client.endCall(call.callId)
	}
} catch (error) {
	console.error('failed:', error.message)
	process.exitCode = 1
}
client.close('done')
setTimeout(() => process.exit(), 500)
