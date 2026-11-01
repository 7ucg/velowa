import { randomUUID } from 'node:crypto'
import type { MexFn } from './mex.js'

// Query ids of the WhatsApp Web build the reference was verified against; a stale id surfaces as a MexError.
export const USERNAME_QUERY = {
	CHECK: '26122779627399568',
	CHECK_MULTI: '27134626522840286',
	SET: '27108705368767936',
	GET: '25347099718279209',
	GET_RECOMMENDATIONS: '26077456248616957',
	PIN_SET: '9749436995157074',
} as const

export type UsernameSource = 'FB' | 'IG' | 'USER_INPUT' | 'SUGGESTION'

export type UsernameCheck =
	| { available: true; username: string; sessionId: string }
	| {
			available: false
			username: string
			sessionId: string
			suggestions: string[]
			rejectionReasons: string[]
			suggestionsEligible: boolean
	  }

/** WhatsApp usernames (@name): availability, claiming, deleting, PIN. */
export class Usernames {
	constructor(private readonly mex: MexFn) {}

	async check(
		username: string,
		includeSuggestions = true,
		sessionId: string = randomUUID(),
	): Promise<UsernameCheck> {
		const data = await this.mex<{
			result?: string
			suggestions?: string[]
			rejection_reasons?: string[]
			suggestions_eligible?: boolean
		}>(
			USERNAME_QUERY.CHECK,
			{
				username,
				include_suggestions: includeSuggestions,
				session_id: sessionId,
				source: 'USER_INPUT' satisfies UsernameSource,
			},
			'xwa2_username_check',
		)
		if (data?.result === 'SUCCESS') return { available: true, username, sessionId }
		return {
			available: false,
			username,
			sessionId,
			suggestions: data?.suggestions ?? [],
			rejectionReasons: data?.rejection_reasons ?? [],
			suggestionsEligible: data?.suggestions_eligible ?? true,
		}
	}

	checkMany = (usernames: string[]) =>
		this.mex(USERNAME_QUERY.CHECK_MULTI, { usernames }, 'xwa2_username_check_multi')

	/** Claim a username. */
	set = (username: string, o: { source?: UsernameSource; sessionId?: string; pin?: string } = {}) =>
		this.mex(
			USERNAME_QUERY.SET,
			{
				username,
				reserved: true,
				source: o.source ?? 'USER_INPUT',
				session_id: o.sessionId ?? randomUUID(),
				...(o.pin && { pin: o.pin }),
			},
			'xwa2_username_set',
		)

	delete = () => this.mex(USERNAME_QUERY.SET, { username: null }, 'xwa2_username_delete')

	async mine(): Promise<string | null> {
		const data = await this.mex<{ username?: string }>(USERNAME_QUERY.GET, {}, 'xwa2_username_get')
		return data?.username ?? null
	}

	recommendations = (source?: UsernameSource) =>
		this.mex(
			USERNAME_QUERY.GET_RECOMMENDATIONS,
			source ? { source } : {},
			'xwa2_username_get_recommendations',
		)

	/** Set (or with `null` clear) the 4-digit PIN others need to message you by username. */
	setPin = (pin: string | null) =>
		this.mex(USERNAME_QUERY.PIN_SET, pin != null ? { pin } : {}, 'xwa2_username_pin_set')
}
