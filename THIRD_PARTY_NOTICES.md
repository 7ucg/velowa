# Third-party notices

velowa contains and ships code written by other people. It keeps its own licences and credits, which this repository
cannot change. This file lists what comes from where, with the original notices. The licence in [`LICENSE`](LICENSE)
covers only the code written for velowa (the files that carry the velowa header).

If you copy code from this repository, you must credit the author of that code: velowa for its own code (see
[`LICENSE`](LICENSE)), and the sections below for the parts that come from them.

## 1. whatsapp-rust (MIT)

Copied once into this repository and maintained here since: `rust/wacore-appstate`, `rust/wacore-binary`,
`rust/wacore-derive`, `rust/wacore-noise`, the parts of `rust/wacore-libsignal` listed in section 2 as not carrying the
Signal notice, `rust/wacore-voip` (from `oxidezap/whatsapp-rust`, commit `0d1373a8f06e0dfa72f3ea1c4c33abae9fd21d61`, see
`rust/wacore-voip/VENDORED.md` for what was changed), and the build script and codec wrappers of `rust/waproto`.
`rust/wasm-voip/src/relay.rs` is adapted from the relay code of the same project.

Sources: <https://github.com/jlucaso1/whatsapp-rust> and <https://github.com/oxidezap/whatsapp-rust>.

```text
MIT License

Copyright (c) 2025 João Lucas de Oliveira Lopes

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 2. libsignal (AGPL-3.0-only)  - please read

`rust/wacore-libsignal` implements the Signal protocol and is derived from Signal's libsignal. These 31 of its
43 source files
carry the header `Copyright 2020 Signal Messenger, LLC` and `SPDX-License-Identifier: AGPL-3.0-only`:

- `rust/wacore-libsignal/src/core/curve/curve25519.rs`
- `rust/wacore-libsignal/src/core/curve.rs`
- `rust/wacore-libsignal/src/core/curve/utils.rs`
- `rust/wacore-libsignal/src/core/mod.rs`
- `rust/wacore-libsignal/src/crypto/aes_cbc.rs`
- `rust/wacore-libsignal/src/crypto/aes_ctr.rs`
- `rust/wacore-libsignal/src/crypto/aes_gcm.rs`
- `rust/wacore-libsignal/src/crypto/error.rs`
- `rust/wacore-libsignal/src/crypto/hash.rs`
- `rust/wacore-libsignal/src/crypto/mod.rs`
- `rust/wacore-libsignal/src/protocol/consts.rs`
- `rust/wacore-libsignal/src/protocol/crypto.rs`
- `rust/wacore-libsignal/src/protocol/error.rs`
- `rust/wacore-libsignal/src/protocol/group_cipher.rs`
- `rust/wacore-libsignal/src/protocol/identity_key.rs`
- `rust/wacore-libsignal/src/protocol/mod.rs`
- `rust/wacore-libsignal/src/protocol/protocol.rs`
- `rust/wacore-libsignal/src/protocol/ratchet/keys.rs`
- `rust/wacore-libsignal/src/protocol/ratchet/params.rs`
- `rust/wacore-libsignal/src/protocol/ratchet.rs`
- `rust/wacore-libsignal/src/protocol/sender_keys.rs`
- `rust/wacore-libsignal/src/protocol/session_cipher.rs`
- `rust/wacore-libsignal/src/protocol/session.rs`
- `rust/wacore-libsignal/src/protocol/state/bundle.rs`
- `rust/wacore-libsignal/src/protocol/state/mod.rs`
- `rust/wacore-libsignal/src/protocol/state/prekey.rs`
- `rust/wacore-libsignal/src/protocol/state/session.rs`
- `rust/wacore-libsignal/src/protocol/state/signed_prekey.rs`
- `rust/wacore-libsignal/src/protocol/storage.rs`
- `rust/wacore-libsignal/src/protocol/storage/traits.rs`
- `rust/wacore-libsignal/src/protocol/timestamp.rs`

The licence is the GNU Affero General Public License, version 3: <https://www.gnu.org/licenses/agpl-3.0.txt>. The other
files of that crate (address, provider, counter lease, legacy session, local field, record components, stores, and the
`store/` module) carry no such header. They were part of whatsapp-rust's copy of the crate (section 1); whether they too
derive from libsignal has not been checked.

**This crate is compiled into the WebAssembly that velowa ships (`dist/wasm/velowa_wasm_bridge_bg.wasm`).** The AGPL has
conditions for distributing a work that contains such code and for offering it over a network. Whether and how they reach
the rest of velowa and the programs that use it has not been settled; get legal advice before you rely on velowa in a
product, or before you publish it under a licence other than the AGPL.

## 3. WhatsApp protobuf schema (MIT)

`proto/WAProto.proto` and the types generated from it (`rust/waproto`) come from the WhatsApp schema maintained by the
Baileys project, through the author's own fork `baron-baileys-v2` (`scripts/proto-sync.py` trims and converts it).
Baileys: <https://github.com/WhiskeySockets/Baileys>.

```text
MIT License

Copyright (c) 2026 Rajeh Taher/WhiskeySockets

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 4. npm packages velowa depends on (installed separately, not bundled)

| Package | Licence | Used for |
| --- | --- | --- |
| [`opusscript`](https://github.com/abbbi/opusscript) | MIT (contains the Opus codec, BSD-3-Clause) | Opus audio in calls |
| [`protobufjs`](https://github.com/protobufjs/protobuf.js) | BSD-3-Clause | the WhatsApp protobuf messages |
| [`ws`](https://github.com/websockets/ws) | MIT | the WebSocket connection |
| [`qrcode-terminal`](https://github.com/gtanner/qrcode-terminal) (optional) | Apache-2.0 | printing a QR code in the pairing helper |

Their licence files are inside the packages when you install them.
