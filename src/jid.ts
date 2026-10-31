/** Server -> Signal "domain type" (the suffix libsignal uses to keep PN, LID and hosted ids apart). */
const DOMAIN_TYPE: Record<string, number> = {
	's.whatsapp.net': 0,
	'c.us': 0,
	lid: 1,
	hosted: 128,
	'hosted.lid': 129,
}

export interface DecodedJid {
	user: string
	server: string
	device: number
	domainType: number
}

/** `user[:device]@server` -> parts. Group ("g.us") and other non-user servers decode as well. */
export function jidDecode(jid: string): DecodedJid {
	const at = jid.indexOf('@')
	if (at < 0) throw new Error(`not a JID: "${jid}"`)
	const server = jid.slice(at + 1)
	const left = jid.slice(0, at)
	const [userAgent, deviceStr] = left.split(':')
	const user = userAgent!.split('_')[0]!
	const device = deviceStr ? Number(deviceStr) : 0
	return { user, server, device, domainType: DOMAIN_TYPE[server] ?? 0 }
}

/** Signal address (name, deviceId) for a user JID, as the encryption layer keys sessions. */
export function signalAddress(jid: string): { name: string; device: number } {
	const { user, device, domainType } = jidDecode(jid)
	if (!user) throw new Error(`JID has no user: "${jid}"`)
	return { name: domainType === 0 ? user : `${user}_${domainType}`, device }
}

/** Stable string form of a signal address, used to name sender keys. */
export const signalAddressString = (jid: string): string => {
	const a = signalAddress(jid)
	return `${a.name}.${a.device}`
}
