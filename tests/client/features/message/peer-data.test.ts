import { describe, expect, it } from 'vitest'
import { encodeProto, protoType } from '../../../../src/client/proto.js'

describe('peer data operation requests', () => {
	const decode = (m: object) => {
		const t = protoType('Message')
		return t.toObject(t.decode(encodeProto('Message', m)), { enums: String, longs: Number }) as {
			protocolMessage: { type: string; peerDataOperationRequestMessage: Record<string, unknown> }
		}
	}

	it('encodes a history request', () => {
		const d = decode({
			protocolMessage: {
				type: 'PEER_DATA_OPERATION_REQUEST_MESSAGE',
				peerDataOperationRequestMessage: {
					peerDataOperationRequestType: 'HISTORY_SYNC_ON_DEMAND',
					historySyncOnDemandRequest: {
						chatJid: 'g@g.us',
						oldestMsgFromMe: false,
						oldestMsgId: 'ID1',
						oldestMsgTimestampMs: 1700000000000,
						onDemandMsgCount: 20,
					},
				},
			},
		})
		expect(d.protocolMessage.type).toBe('PEER_DATA_OPERATION_REQUEST_MESSAGE')
		expect(d.protocolMessage.peerDataOperationRequestMessage).toMatchObject({
			peerDataOperationRequestType: 'HISTORY_SYNC_ON_DEMAND',
			historySyncOnDemandRequest: { chatJid: 'g@g.us', oldestMsgId: 'ID1', onDemandMsgCount: 20 },
		})
	})

	it('encodes a placeholder resend request', () => {
		const d = decode({
			protocolMessage: {
				type: 'PEER_DATA_OPERATION_REQUEST_MESSAGE',
				peerDataOperationRequestMessage: {
					peerDataOperationRequestType: 'PLACEHOLDER_MESSAGE_RESEND',
					placeholderMessageResendRequest: [{ messageKey: { remoteJid: 'g@g.us', id: 'ID2' } }],
				},
			},
		})
		expect(d.protocolMessage.peerDataOperationRequestMessage).toMatchObject({
			peerDataOperationRequestType: 'PLACEHOLDER_MESSAGE_RESEND',
			placeholderMessageResendRequest: [{ messageKey: { id: 'ID2' } }],
		})
	})
})
