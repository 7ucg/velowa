// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import protobuf from 'protobufjs'

/** The schema sits next to the built bundle (`dist/proto/`), or two levels up from this file in the source tree. */
function schemaPath(): string {
	for (const rel of ['./proto/WAProto.proto', '../../proto/WAProto.proto']) {
		const path = fileURLToPath(new URL(rel, import.meta.url))
		if (existsSync(path)) return path
	}
	throw new Error('WAProto.proto not found next to the library')
}

// The full WAProto schema (the Rust waproto crate only carries the 35 types it needs).
let root: protobuf.Root | undefined

export function protoRoot(): protobuf.Root {
	if (!root) {
		const r = new protobuf.Root()
		r.loadSync(schemaPath())
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
