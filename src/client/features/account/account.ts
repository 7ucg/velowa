// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
import type { RequestFn } from '../group/groups.js'
import type { MexFn } from '../mex.js'

// The account itself: logging out, the devices it is linked to, devices it trusts, profile links.

export interface TrustedDevice {
	device_id?: string
	device_name?: string
	[key: string]: unknown
}

/** The stanza that removes a linked device (our own device id logs this client out). */
export const removeDeviceNode = (jid: string, reason = 'user_initiated') => ({
	tag: 'iq',
	attrs: { to: 's.whatsapp.net', xmlns: 'md', type: 'set' },
	content: [{ tag: 'remove-companion-device', attrs: { jid, reason } }],
})

const IDS = {
	TRUSTED_ADD: '24522952587403287',
	TRUSTED_LIST: '27391232653862770',
	TRUSTED_UNTRUST: '26574930682133620',
	TRUSTED_DELETE: '33867503889559538',
	LINKED_PROFILES_SET: '25013968611531010',
	LINKED_PROFILES_REMOVE: '24537675509265525',
	LINKED_PROFILES_UPDATE: '24876967165297614',
}

export type LinkedProfile = { type: string; vid?: string; username?: string }

export class Account {
	constructor(
		private readonly request: RequestFn,
		private readonly mex: MexFn,
	) {}

	/** Remove one of the account's linked devices (a phone's "Linked devices" entry). Needs the device's own JID. */
	async removeDevice(jid: string, reason = 'user_initiated'): Promise<void> {
		await this.request(removeDeviceNode(jid, reason))
	}

	/** Devices that are marked trusted for this account. */
	trustedDevices = (): Promise<TrustedDevice[]> =>
		this.mex<TrustedDevice[]>(IDS.TRUSTED_LIST, {}, 'xwa2_get_trusted_devices')

	trustDevice = (deviceId: string, deviceName: string): Promise<unknown> =>
		this.mex(
			IDS.TRUSTED_ADD,
			{ device_id: deviceId, device_name: deviceName },
			'xwa2_add_trusted_device',
		)

	untrustDevice = (deviceId: string, reason = 'USER_INITIATED'): Promise<unknown> =>
		this.mex(IDS.TRUSTED_UNTRUST, { device_id: deviceId, reason }, 'xwa2_untrust_trusted_device')

	deleteTrustedDevice = (deviceId: string): Promise<unknown> =>
		this.mex(IDS.TRUSTED_DELETE, { device_id: deviceId }, 'xwa2_delete_trusted_device')

	/** Show other accounts on the profile (Instagram, Facebook, ...): by account id (`vid`) or username. */
	setLinkedProfiles = (profiles: LinkedProfile[]): Promise<unknown> =>
		this.mex(
			IDS.LINKED_PROFILES_SET,
			{
				profiles: profiles.map((p) => ({
					type: p.type,
					...(p.vid ? { vid: p.vid } : p.username ? { username: p.username } : {}),
				})),
			},
			'xwa2_linked_profiles_set',
		)

	removeLinkedProfiles = (types: string[]): Promise<unknown> =>
		this.mex(
			IDS.LINKED_PROFILES_REMOVE,
			{ profiles: types.map((type) => ({ type })) },
			'xwa2_linked_profiles_remove',
		)

	showLinkedProfiles = (profiles: { type: string; showOnProfile: boolean }[]): Promise<unknown> =>
		this.mex(
			IDS.LINKED_PROFILES_UPDATE,
			{ profiles: profiles.map((p) => ({ type: p.type, show_on_profile: p.showOnProfile })) },
			'xwa2_linked_profiles_update',
		)
}
