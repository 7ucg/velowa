/*!
 * velowa - https://github.com/7ucg/velowa - (c) 2026 Baron
 * velowa License (MIT with mandatory credit): copying any part of this code, however small, requires credit. See LICENSE.
 * Parts from other projects keep their own licences: see THIRD_PARTY_NOTICES.md.
 */

// src/logging/storage.ts
import { createReadStream, createWriteStream } from "fs";
import {
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  unlinkSync,
  writeFileSync
} from "fs";
import { join } from "path";
import { pipeline } from "stream/promises";
import { createGzip } from "zlib";
var DAY = /^\d{4}-\d{2}-\d{2}$/;
var LEGACY = /^(.+)-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/;
var KEEP_FILE = ".keep";
var SESSION_FILE = "session.json";
function dirBytes(path) {
  let total = 0;
  for (const f of readdirSync(path, { withFileTypes: true })) {
    if (f.isFile()) total += lstatSync(join(path, f.name)).size;
  }
  return total;
}
function readMeta(path) {
  try {
    return JSON.parse(readFileSync(join(path, SESSION_FILE), "utf8"));
  } catch {
    return void 0;
  }
}
function describe(path, name) {
  const files = readdirSync(path);
  const meta = readMeta(path);
  const legacy = LEGACY.exec(name.split("/").pop());
  if (!meta && !(legacy && files.some((f) => f.startsWith("events.jsonl")))) return void 0;
  const started = typeof meta?.["startedAt"] === "string" ? new Date(meta["startedAt"]) : /* @__PURE__ */ new Date(`${legacy[2]}T${legacy[3]}:${legacy[4]}:${legacy[5]}.${legacy[6]}Z`);
  if (Number.isNaN(started.getTime())) return void 0;
  return {
    path,
    name,
    label: typeof meta?.["label"] === "string" ? meta["label"] : legacy?.[1] ?? name.split("-").slice(1).join("-"),
    startedAt: started,
    ...typeof meta?.["endedAt"] === "string" && { endedAt: new Date(meta["endedAt"]) },
    ...typeof meta?.["reason"] === "string" && { reason: meta["reason"] },
    bytes: dirBytes(path),
    pinned: files.includes(KEEP_FILE),
    compressed: files.some((f) => f.endsWith(".gz"))
  };
}
function listSessions(dir) {
  const out = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const path = join(dir, e.name);
    if (DAY.test(e.name)) {
      for (const s of readdirSync(path, { withFileTypes: true })) {
        if (!s.isDirectory()) continue;
        const info = describe(join(path, s.name), `${e.name}/${s.name}`);
        if (info) out.push(info);
      }
    } else {
      const info = describe(path, e.name);
      if (info) out.push(info);
    }
  }
  return out.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
}
function dayAndTime(at) {
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return {
    day: `${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}`,
    time: `${p(at.getHours())}-${p(at.getMinutes())}-${p(at.getSeconds())}`
  };
}
function migrateFlatSessions(dir) {
  let moved = 0;
  for (const s of listSessions(dir)) {
    if (s.name.includes("/")) continue;
    const { day, time } = dayAndTime(s.startedAt);
    const target = join(dir, day, `${time}-${s.label}`);
    try {
      mkdirSync(join(dir, day), { recursive: true, mode: 448 });
      renameSync(s.path, target);
      if (!readMeta(target)) {
        const newest = Math.max(
          ...readdirSync(target).map((f) => lstatSync(join(target, f)).mtimeMs)
        );
        writeFileSync(
          join(target, SESSION_FILE),
          JSON.stringify(
            {
              version: 1,
              label: s.label,
              startedAt: s.startedAt.toISOString(),
              endedAt: new Date(newest).toISOString(),
              migrated: true
            },
            null,
            2
          ) + "\n",
          { mode: 384 }
        );
      }
      moved++;
    } catch {
    }
  }
  return moved;
}
async function compressSession(path) {
  let saved = 0;
  for (const f of readdirSync(path)) {
    if (f.endsWith(".gz") || f === SESSION_FILE || f === KEEP_FILE) continue;
    if (!/\.(jsonl|log)$/.test(f)) continue;
    const from = join(path, f);
    const before = lstatSync(from).size;
    if (before < 4096) continue;
    const to = `${from}.gz`;
    try {
      await pipeline(
        createReadStream(from),
        createGzip({ level: 9 }),
        createWriteStream(to, { mode: 384 })
      );
      saved += before - lstatSync(to).size;
      unlinkSync(from);
    } catch {
      try {
        unlinkSync(to);
      } catch {
      }
    }
  }
  if (saved > 0) {
    const meta = readMeta(path);
    if (meta) {
      try {
        writeFileSync(
          join(path, SESSION_FILE),
          JSON.stringify({ ...meta, compressed: true }, null, 2) + "\n"
        );
      } catch {
      }
    }
  }
  return saved;
}
function pruneSessions(dir, retention = {}, keep = []) {
  const maxAge = (retention.maxAgeDays ?? 30) * 864e5;
  const maxBytes = (retention.maxTotalMB ?? 1024) * 1024 * 1024;
  const maxSessions = retention.maxSessions ?? 0;
  const all = listSessions(dir);
  const removable = (s) => !s.pinned && !keep.includes(s.path);
  const gone = [];
  const remove = (s) => {
    try {
      rmSync(s.path, { recursive: true, force: true });
      gone.push(s);
    } catch {
    }
  };
  const now = Date.now();
  let rest = all;
  if (maxAge > 0)
    rest = rest.filter((s) => {
      if (!removable(s) || now - s.startedAt.getTime() <= maxAge) return true;
      remove(s);
      return false;
    });
  if (maxSessions > 0) {
    for (const s of [...rest]) {
      if (rest.length <= maxSessions) break;
      if (!removable(s)) continue;
      remove(s);
      rest = rest.filter((r) => r !== s);
    }
  }
  if (maxBytes > 0) {
    let total = rest.reduce((n, s) => n + s.bytes, 0);
    for (const s of rest) {
      if (total <= maxBytes) break;
      if (!removable(s)) continue;
      remove(s);
      total -= s.bytes;
    }
  }
  try {
    for (const e of readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && DAY.test(e.name)) {
        try {
          rmdirSync(join(dir, e.name));
        } catch {
        }
      }
  } catch {
  }
  return gone;
}
async function housekeeping(dir, o = {}) {
  const keep = o.current ? [o.current] : [];
  let compressed = 0;
  const hours = o.compressAfterHours ?? 24;
  if (hours > 0) {
    for (const s of listSessions(dir)) {
      if (s.compressed || keep.includes(s.path)) continue;
      if (Date.now() - s.startedAt.getTime() < hours * 36e5) continue;
      const meta = readMeta(s.path);
      if (meta && meta["endedAt"] === void 0 && Date.now() - s.startedAt.getTime() < 7 * 864e5)
        continue;
      if (await compressSession(s.path) > 0) compressed++;
    }
  }
  const removed = o.retention === false ? 0 : pruneSessions(dir, o.retention ?? {}, keep).length;
  return { compressed, removed };
}

export {
  KEEP_FILE,
  SESSION_FILE,
  listSessions,
  dayAndTime,
  migrateFlatSessions,
  compressSession,
  pruneSessions,
  housekeeping
};
