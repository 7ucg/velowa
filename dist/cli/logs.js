#!/usr/bin/env node
/*!
 * velowa - https://github.com/7ucg/velowa - (c) 2026 Baron
 * velowa License (MIT with mandatory credit): copying any part of this code, however small, requires credit. See LICENSE.
 * Parts from other projects keep their own licences: see THIRD_PARTY_NOTICES.md.
 */
import {
  KEEP_FILE,
  compressSession,
  listSessions,
  migrateFlatSessions,
  pruneSessions
} from "../chunk-UJTLWSE6.js";

// src/cli/logs.ts
import { rmSync, writeFileSync } from "fs";
import { join } from "path";
var args = process.argv.slice(2);
var command = args.find((a) => !a.startsWith("--")) ?? "list";
var flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
var dir = flag("dir") ?? "logs";
var mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
var line = (s) => `${s.name.padEnd(48)} ${mb(s.bytes).padStart(9)}  ${s.compressed ? "gz " : "   "}${s.pinned ? "kept " : "     "}${s.endedAt ? s.reason ?? "" : "no end recorded"}`;
function main() {
  if (command === "list") {
    const label = flag("label");
    const runs = listSessions(dir).filter((s) => !label || s.label.includes(label));
    for (const s of runs) console.log(line(s));
    console.log(`${runs.length} runs, ${mb(runs.reduce((n, s) => n + s.bytes, 0))} in ${dir}`);
  } else if (command === "migrate") {
    console.log(`moved ${migrateFlatSessions(dir)} runs into day folders`);
  } else if (command === "compress") {
    const hours = Number(flag("hours") ?? 24);
    void (async () => {
      let saved = 0;
      for (const s of listSessions(dir)) {
        if (s.compressed || Date.now() - s.startedAt.getTime() < hours * 36e5) continue;
        if (s.endedAt === void 0 && Date.now() - s.startedAt.getTime() < 7 * 864e5) continue;
        saved += await compressSession(s.path);
      }
      console.log(`saved ${mb(saved)}`);
    })();
  } else if (command === "prune") {
    const retention = {
      maxAgeDays: Number(flag("days") ?? 30),
      maxTotalMB: Number(flag("mb") ?? 1024),
      ...flag("sessions") && { maxSessions: Number(flag("sessions")) }
    };
    if (args.includes("--dry")) {
      const before = listSessions(dir);
      const cutoff = Date.now() - retention.maxAgeDays * 864e5;
      const old = before.filter(
        (s) => !s.pinned && retention.maxAgeDays > 0 && s.startedAt.getTime() < cutoff
      );
      for (const s of old) console.log(`would delete ${line(s)}`);
      console.log(`${old.length} runs by age; the size limit may remove more`);
    } else {
      const gone = pruneSessions(dir, retention);
      for (const s of gone) console.log(`deleted ${s.name}`);
      console.log(`${gone.length} runs deleted`);
    }
  } else if (command === "keep" || command === "unkeep") {
    const name = args.filter((a) => !a.startsWith("--"))[1];
    const run = listSessions(dir).find((s) => s.name === name);
    if (!run) throw new Error(`no run named ${name} in ${dir} (see: list)`);
    if (command === "keep") writeFileSync(join(run.path, KEEP_FILE), "");
    else rmSync(join(run.path, KEEP_FILE), { force: true });
    console.log(`${name}: ${command === "keep" ? "kept" : "no longer kept"}`);
  } else {
    console.log("commands: list, migrate, compress, prune, keep <run>, unkeep <run>");
    process.exitCode = 1;
  }
}
main();
