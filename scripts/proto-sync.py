#!/usr/bin/env python3
"""Regenerate rust/waproto/src/whatsapp.{proto,desc} from baron-baileys-v2's WAProto.proto.

Keeps only the top-level declarations transitively reachable from ROOTS (the
types wacore-{libsignal,noise,appstate} reference), renames the package to
`whatsapp` (what the vendored crates import), and compiles a descriptor set so
consumers never need protoc. Usage: scripts/proto-sync.py [path/to/WAProto.proto]
"""
import hashlib, re, subprocess, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / "Dokumente/GitHub/baron-baileys-v2/WAProto/WAProto.proto")
OUT = Path(__file__).resolve().parent.parent / "rust/waproto/src"

ROOTS = [
    "PreKeySignalMessage", "SignalMessage", "SenderKeyMessage", "SenderKeyDistributionMessage",
    "RecordStructure", "SessionStructure", "PreKeyRecordStructure", "SignedPreKeyRecordStructure",
    "SenderKeyRecordStructure", "SenderKeyStateStructure", "KeyId",
    "HandshakeMessage", "CertChain", "NoiseCertificate", "ExternalBlobReference",
    "SyncActionData", "SyncActionValue", "SyncdPatch", "SyncdSnapshot", "SyncdMutation",
    "SyncdMutations", "SyncdRecord", "SyncdIndex", "SyncdValue", "SyncdVersion", "SyncdSnapshotRecovery",
    "KeyId", "IdentityKeyPairStructure", "SyncdPatch",
]

text = SRC.read_text()
header_end = text.index("\n\n", text.index("package proto;")) if "package proto;" in text else 0
blocks, cur, name = {}, [], None
for line in text.splitlines():
    m = re.match(r"^(message|enum)\s+(\w+)\s*\{", line)
    if m and name is None:
        name, cur = m.group(2), [line]
    elif name is not None:
        cur.append(line)
        if line == "}":
            blocks[name] = "\n".join(cur); name, cur = None, []
ident = re.compile(r"[A-Za-z_]\w*")
keep, todo = set(), [r for r in ROOTS if r in blocks]
missing = [r for r in ROOTS if r not in blocks]
while todo:
    n = todo.pop()
    if n in keep: continue
    keep.add(n)
    for tok in set(ident.findall(blocks[n])):
        if tok in blocks and tok not in keep: todo.append(tok)

def to_proto2(src):
    """proto3 -> proto2: Baileys' file relies on protobufjs leniency (enums not starting at 0),
    which protoc only accepts in proto2. Bare singular fields get `optional`; oneof members stay bare."""
    stack, res = [], []
    field = re.compile(r"^(\s+)(?!optional\b|repeated\b|required\b|map<|oneof\b|message\b|enum\b|reserved\b|option\b)([\w.]+\s+\w+\s*=\s*\d+.*;)\s*$")
    for line in src.splitlines():
        st = line.strip()
        if st.endswith("{"):
            stack.append(st.split()[0]); res.append(line); continue
        if st == "}":
            stack.pop(); res.append(line); continue
        m = field.match(line)
        if m and stack and stack[-1] == "message":
            line = f"{m.group(1)}optional {m.group(2)}"
        res.append(line)
    return "\n".join(res)

out = 'syntax = "proto2";\npackage whatsapp;\n\n' + to_proto2("\n\n".join(blocks[n] for n in sorted(keep))) + "\n"
(OUT / "whatsapp.proto").write_text(out)
subprocess.run(["protoc", f"--proto_path={OUT}", f"--descriptor_set_out={OUT/'whatsapp.desc'}", "whatsapp.proto"], check=True)
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
(OUT / "whatsapp.desc.sha256").write_text(f"proto {sha(OUT/'whatsapp.proto')}\ndesc {sha(OUT/'whatsapp.desc')}\n")
print(f"kept {len(keep)}/{len(blocks)} top-level types; missing roots: {missing}")
