// velowa (https://github.com/7ucg/velowa) (c) 2026 Baron. Copying any part of this file, however small, requires credit: see LICENSE.
/** Typed event bus. `EventMap` maps event name -> payload type. */
export type Listener<T> = (payload: T) => void
export type Unsubscribe = () => void

export class TypedEmitter<EventMap extends Record<string, unknown>> {
	readonly #listeners = new Map<keyof EventMap, Set<Listener<never>>>()

	on<K extends keyof EventMap>(event: K, listener: Listener<EventMap[K]>): Unsubscribe {
		let set = this.#listeners.get(event)
		if (!set) this.#listeners.set(event, (set = new Set()))
		set.add(listener as Listener<never>)
		return () => set.delete(listener as Listener<never>)
	}

	emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): void {
		for (const l of [...(this.#listeners.get(event) ?? [])]) (l as Listener<EventMap[K]>)(payload)
	}

	/** Async-iterable view of one event; stops when `signal` aborts. */
	async *events<K extends keyof EventMap>(
		event: K,
		signal?: AbortSignal,
	): AsyncGenerator<EventMap[K]> {
		const queue: EventMap[K][] = []
		let wake: (() => void) | undefined
		const off = this.on(event, (p) => {
			queue.push(p)
			wake?.()
		})
		const onAbort = () => wake?.()
		signal?.addEventListener('abort', onAbort)
		try {
			while (!signal?.aborted) {
				if (queue.length === 0) await new Promise<void>((r) => (wake = r))
				while (queue.length > 0) yield queue.shift() as EventMap[K]
			}
		} finally {
			off()
			signal?.removeEventListener('abort', onAbort)
		}
	}
}
