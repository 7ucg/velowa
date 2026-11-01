/* eslint-disable @typescript-eslint/no-explicit-any */
import { hkdfSync, randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { encodeProto } from '../proto.js'
import {
	buildReport,
	reportId,
	ReportStore,
	reportedMessageNode,
	reportToAdmins,
	setMemberReports,
	type ReportedMessage,
} from './report.js'

const secret = randomBytes(32)
const msg = (over: Partial<ReportedMessage> = {}): ReportedMessage => ({
	id: 'M1',
	t: 1700000000,
	fromMe: true,
	chat: '4915600000000@s.whatsapp.net',
	message: { conversation: 'spam!', messageContextInfo: { messageSecret: secret } },
	...over,
})

describe('reports', () => {
	it('builds one spam_list per report with flow, trace and known-chat flags', () => {
		const iq = buildReport('user', '4915600000000:3@s.whatsapp.net', 'id1', {
			wiTraceId: 'a'.repeat(24),
			isKnownChat: false,
			messages: [],
		})
		expect(iq.attrs).toEqual({ id: 'id1', to: 's.whatsapp.net', type: 'set', xmlns: 'spam' })
		expect((iq.content as any[]).length).toBe(1)
		expect((iq.content as any[])[0]).toMatchObject({
			tag: 'spam_list',
			attrs: {
				jid: '4915600000000@s.whatsapp.net',
				spam_flow: 'chat',
				wi_trace_id: 'a'.repeat(24),
				is_known_chat: 'false',
			},
		})
	})

	it('needs a subject for groups and channels, and refuses flows the app refuses', () => {
		expect(() => buildReport('group', '1@g.us', 'i', {})).toThrow(/subject/)
		const g = buildReport('group', '1@g.us', 'i', { subject: 'Team', source: '49@s.whatsapp.net' })
		expect((g.content as any[])[0].attrs).toMatchObject({
			spam_flow: 'group_info_report',
			subject: 'Team',
			source: '49@s.whatsapp.net',
		})
		expect(() => buildReport('user', 'a@s.whatsapp.net', 'i', { flow: 'block_dialog' })).toThrow(
			/refused/,
		)
		expect(() => buildReport('user', 'a@s.whatsapp.net', 'i', { wiTraceId: 'short' })).toThrow()
	})

	it('sends our own messages as plain content (the server has no tag to match a token against)', () => {
		const m = msg()
		const node = reportedMessageNode(m, 'user')
		expect(node.attrs).toEqual({ to: m.chat, t: '1700000000', id: 'M1' })
		const kids = node.content as any[]
		expect(kids.map((c) => c.tag)).toEqual(['raw'])
		expect(Buffer.from(kids[0].content)).toEqual(Buffer.from(encodeProto('Message', m.message)))
	})

	it('proves received messages with the sender token and the derived key', () => {
		const chat = '4915600000000@s.whatsapp.net'
		const meId = '4915611111111@s.whatsapp.net'
		const tag = randomBytes(20)
		const token = randomBytes(16)
		const m = msg({ fromMe: false, chat, meId, reporting: { tag, token, version: 2 } })
		const [raw, reporting, cv] = reportedMessageNode(m, 'user').content as any[]
		expect(raw.tag).toBe('raw')
		expect(reporting.content[0]).toMatchObject({ tag: 'reporting_tag' })
		expect(Buffer.from(reporting.content[0].content)).toEqual(tag)
		expect(cv.attrs.type).toBe('e2e_proto_message')
		const key = hkdfSync(
			'sha256',
			secret,
			Buffer.alloc(0),
			Buffer.from('M1' + chat + meId + 'Report Token'),
			32,
		)
		expect(Buffer.from(cv.content[0].content)).toEqual(token)
		expect(Buffer.from(cv.content[1].content)).toEqual(Buffer.from(key))
	})

	it('marks received group messages with from + participant and omits evidence it cannot prove', () => {
		const n = reportedMessageNode(
			msg({ fromMe: false, chat: '1@g.us', participant: '99@lid', message: { conversation: 'x' } }),
			'group',
		)
		expect(n.attrs).toMatchObject({ from: '1@g.us', participant: '99@lid' })
		expect((n.content as any[]).map((c) => c.tag)).toEqual(['raw']) // no secret, no token
	})

	it('keeps the latest messages per chat and reads the report id', () => {
		const s = new ReportStore(3)
		for (let i = 0; i < 5; i++) s.add(msg({ id: `m${i}`, fromMe: i % 2 === 0 }))
		expect(s.recent(msg().chat, 5).map((m) => m.id)).toEqual(['m2', 'm3', 'm4'])
		expect(s.recent(msg().chat, 5, true).map((m) => m.id)).toEqual(['m3'])
		expect(
			reportId({ tag: 'iq', attrs: {}, content: [{ tag: 'report', attrs: { id: 'R9' } }] }),
		).toBe('R9')
	})

	it('builds the admin report and the member-report toggle', () => {
		expect(reportToAdmins('1@g.us', 'i', 'MID')).toMatchObject({
			attrs: { to: '1@g.us', xmlns: 'w:g2', type: 'set' },
			content: [{ tag: 'reports', content: [{ tag: 'report', attrs: { message_id: 'MID' } }] }],
		})
		expect((setMemberReports('1@g.us', 'i', false).content as any[])[0].tag).toBe(
			'not_allow_admin_reports',
		)
	})
})
