// Look after the protocol logs.
//   node dist/cli/logs.js list     [--dir=logs] [--label=call]     runs, newest last, with sizes
//   node dist/cli/logs.js migrate  [--dir=logs]                    sort old flat run folders into day folders
//   node dist/cli/logs.js compress [--dir=logs] [--hours=24]       gzip runs older than that
//   node dist/cli/logs.js prune    [--dir=logs] [--days=30] [--mb=1024] [--sessions=N] [--dry]
//   node dist/cli/logs.js keep     <run name>                      never delete this run (`unkeep` undoes it)
import { rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
	compressSession,
	KEEP_FILE,
	listSessions,
	migrateFlatSessions,
	pruneSessions,
	type SessionInfo,
} from '../logging/storage.js'

const args = process.argv.slice(2)
const command = args.find((a) => !a.startsWith('--')) ?? 'list'
const flag = (name: string): string | undefined =>
	args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3)
const dir = flag('dir') ?? 'logs'
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`
const line = (s: SessionInfo) =>
	`${s.name.padEnd(48)} ${mb(s.bytes).padStart(9)}  ${s.compressed ? 'gz ' : '   '}${s.pinned ? 'kept ' : '     '}${s.endedAt ? (s.reason ?? '') : 'no end recorded'}`

function main(): void {
	if (command === 'list') {
		const label = flag('label')
		const runs = listSessions(dir).filter((s) => !label || s.label.includes(label))
		for (const s of runs) console.log(line(s))
		console.log(`${runs.length} runs, ${mb(runs.reduce((n, s) => n + s.bytes, 0))} in ${dir}`)
	} else if (command === 'migrate') {
		console.log(`moved ${migrateFlatSessions(dir)} runs into day folders`)
	} else if (command === 'compress') {
		const hours = Number(flag('hours') ?? 24)
		void (async () => {
			let saved = 0
			for (const s of listSessions(dir)) {
				if (s.compressed || Date.now() - s.startedAt.getTime() < hours * 3_600_000) continue
				if (s.endedAt === undefined && Date.now() - s.startedAt.getTime() < 7 * 86_400_000) continue
				saved += await compressSession(s.path)
			}
			console.log(`saved ${mb(saved)}`)
		})()
	} else if (command === 'prune') {
		const retention = {
			maxAgeDays: Number(flag('days') ?? 30),
			maxTotalMB: Number(flag('mb') ?? 1024),
			...(flag('sessions') && { maxSessions: Number(flag('sessions')) }),
		}
		if (args.includes('--dry')) {
			const before = listSessions(dir)
			const cutoff = Date.now() - retention.maxAgeDays * 86_400_000
			const old = before.filter(
				(s) => !s.pinned && retention.maxAgeDays > 0 && s.startedAt.getTime() < cutoff,
			)
			for (const s of old) console.log(`would delete ${line(s)}`)
			console.log(`${old.length} runs by age; the size limit may remove more`)
		} else {
			const gone = pruneSessions(dir, retention)
			for (const s of gone) console.log(`deleted ${s.name}`)
			console.log(`${gone.length} runs deleted`)
		}
	} else if (command === 'keep' || command === 'unkeep') {
		const name = args.filter((a) => !a.startsWith('--'))[1]
		const run = listSessions(dir).find((s) => s.name === name)
		if (!run) throw new Error(`no run named ${name} in ${dir} (see: list)`)
		if (command === 'keep') writeFileSync(join(run.path, KEEP_FILE), '')
		else rmSync(join(run.path, KEEP_FILE), { force: true })
		console.log(`${name}: ${command === 'keep' ? 'kept' : 'no longer kept'}`)
	} else {
		console.log('commands: list, migrate, compress, prune, keep <run>, unkeep <run>')
		process.exitCode = 1
	}
}

main()
