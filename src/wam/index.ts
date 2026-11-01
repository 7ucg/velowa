import { WAM_EVENTS, WAM_GLOBALS } from './schema.js'

export { WAM_EVENTS, WAM_GLOBALS }

const FLAG_GLOBAL = 0
const FLAG_EVENT = 1
const FLAG_FIELD = 2
const FLAG_EXTENDED = 4
const FLAG_BYTE = 8

export type WamValue = number | string | boolean | null

export interface WamEvent {
	/** Name from `WAM_EVENTS`, e.g. `WebcSocketConnect`. */
	name: string
	/** Property name -> value (enums are their numeric value, booleans become 0/1). */
	props?: Record<string, WamValue>
	/** Global attribute name (see `WAM_GLOBALS`) -> value. */
	globals?: Record<string, WamValue>
}

function header(buf: number[], key: number, flag: number): void {
	if (key < 256) buf.push(flag, key)
	else buf.push(flag | FLAG_BYTE, key & 0xff, key >> 8)
}

/** One `key = value` entry in the compact WAM encoding (integers shrink to 0/1, int8, int16, int32; floats are doubles). */
function serialize(key: number, raw: WamValue, flag: number): number[] {
	const out: number[] = []
	const value = typeof raw === 'boolean' ? (raw ? 1 : 0) : raw
	if (value === null) {
		if (flag === FLAG_GLOBAL) {
			header(out, key, flag)
			return out
		}
		throw new Error(`WAM: null is only valid for globals (key ${key})`)
	}
	if (typeof value === 'number') {
		const b = Buffer.alloc(8)
		if (Number.isInteger(value)) {
			if (value === 0 || value === 1) return (header(out, key, flag | ((value + 1) << 4)), out)
			if (value >= -128 && value < 128) {
				header(out, key, flag | (3 << 4))
				b.writeInt8(value)
				return out.concat([...b.subarray(0, 1)])
			}
			if (value >= -32768 && value < 32768) {
				header(out, key, flag | (4 << 4))
				b.writeInt16LE(value)
				return out.concat([...b.subarray(0, 2)])
			}
			if (value >= -2147483648 && value < 2147483648) {
				header(out, key, flag | (5 << 4))
				b.writeInt32LE(value)
				return out.concat([...b.subarray(0, 4)])
			}
		}
		header(out, key, flag | (7 << 4))
		b.writeDoubleLE(value)
		return out.concat([...b])
	}
	const bytes = Buffer.from(value, 'utf8')
	if (bytes.length < 256) {
		header(out, key, flag | (8 << 4))
		out.push(bytes.length)
	} else if (bytes.length < 65536) {
		header(out, key, flag | (9 << 4))
		out.push(bytes.length & 0xff, bytes.length >> 8)
	} else {
		header(out, key, flag | (10 << 4))
		const l = Buffer.alloc(4)
		l.writeUInt32LE(bytes.length)
		out.push(...l)
	}
	return out.concat([...bytes])
}

/**
 * Encode stats events into the WAM wire format sent in `iq set w:stats <add t=...>`.
 * `sequence` is a counter that goes up with every flushed buffer (16 bit).
 */
export function encodeWam(events: WamEvent[], sequence = 0, protocolVersion = 5): Buffer {
	const out: number[] = [
		0x57,
		0x41,
		0x4d,
		protocolVersion,
		1,
		(sequence >> 8) & 0xff,
		sequence & 0xff,
		0,
	]
	for (const e of events) {
		const def = WAM_EVENTS[e.name]
		if (!def) throw new Error(`unknown WAM event ${e.name}`)
		for (const [g, v] of Object.entries(e.globals ?? {})) {
			const id = WAM_GLOBALS[g]
			if (id === undefined) throw new Error(`unknown WAM global ${g}`)
			out.push(...serialize(id, v, FLAG_GLOBAL))
		}
		const props = Object.entries(e.props ?? {})
		// An event without properties is closed by its own header; otherwise the last property carries the end marker.
		const hasProps = props.length > 0
		out.push(...serialize(def.id, -def.weight, hasProps ? FLAG_EVENT : FLAG_EVENT | FLAG_EXTENDED))
		props.forEach(([k, v], i) => {
			const id = def.props[k]
			if (id === undefined) throw new Error(`unknown property ${k} of WAM event ${e.name}`)
			const last = i === props.length - 1
			// Same flags as the reference encoder: inner fields reuse the event flag, the last one closes with FIELD|EXTENDED.
			out.push(...serialize(id, v, last ? FLAG_FIELD | FLAG_EXTENDED : FLAG_EVENT))
		})
	}
	return Buffer.from(out)
}
