import protobuf from 'protobufjs'

// The full WAProto schema (the Rust waproto crate only carries the 35 types it needs).
let root: protobuf.Root | undefined

export function protoRoot(): protobuf.Root {
	if (!root) {
		const r = new protobuf.Root()
		r.loadSync(new URL('../../proto/WAProto.proto', import.meta.url).pathname)
		r.resolveAll()
		root = r
	}
	return root
}

export const protoType = (name: string): protobuf.Type => protoRoot().lookupType(`proto.${name}`)

export const encodeProto = (type: string, obj: object): Uint8Array => {
	const t = protoType(type)
	return t.encode(t.fromObject(obj)).finish()
}
