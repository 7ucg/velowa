//! App-state (syncd) crypto: LTHash, patch / snapshot MAC validation and mutation decryption.
//!
//! `AppStateCollection` owns the hash state of one collection (`regular`, `critical_block`, ...).
//! Orchestration (which collections to sync, when, retries, turning mutations into events) stays
//! in TS; this class is only the math. Patches are applied transactionally: the state is cloned,
//! the patch folded into the clone and committed only on success, so a rejected patch never
//! leaves a half-updated LTHash behind.
//!
//! Key lookup is a synchronous TS callback `(keyId) => 32-byte key data | undefined`; the HKDF
//! expansion happens here.
//!
//! Mutation values are returned as encoded `SyncActionValue` protobuf bytes: TS holds the full
//! WAProto schema and decodes them, so Rust need not mirror 35+ message types across the boundary.

use js_sys::{Array, Function, Object, Reflect, Uint8Array};
use std::sync::Arc;
use wacore_appstate::hash::HashState;
use wacore_appstate::processor::{AppStateMutationMAC, process_patch, process_snapshot};
use wacore_appstate::{AppStateError, ExpandedAppStateKeys, Mutation, expand_app_state_keys};
use waproto::whatsapp::syncd_mutation::SyncdOperation;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(typescript_custom_section)]
const TS_APPSTATE: &str = r#"
/** Resolve an app-state sync key by id; return the 32-byte key data or undefined. */
export type AppStateKeyLookup = (keyId: Uint8Array) => Uint8Array | undefined;
/** Value MAC of the previous SET for an index MAC, or undefined if none is stored. */
export type PreviousValueMacLookup = (indexMac: Uint8Array) => Uint8Array | undefined;

export interface AppStateMutation {
  /** Index components, e.g. ["mute", "123@s.whatsapp.net"]. */
  index: string[];
  operation: 'set' | 'remove';
  /** Encoded SyncActionValue protobuf (absent for a bare remove). */
  value?: Uint8Array;
}
export interface AppStateMac { indexMac: Uint8Array; valueMac: Uint8Array }
export interface AppStateResult {
  mutations: AppStateMutation[];
  /** MACs to persist so later patches can resolve REMOVEs. */
  addedMacs: AppStateMac[];
  /** Index MACs whose stored value MAC must be deleted. */
  removedIndexMacs: Uint8Array[];
}
"#;

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(typescript_type = "AppStateKeyLookup")]
    pub type JsKeyLookup;
    #[wasm_bindgen(typescript_type = "PreviousValueMacLookup")]
    pub type JsMacLookup;
    #[wasm_bindgen(typescript_type = "AppStateResult")]
    pub type JsAppStateResult;
}

fn err(e: impl std::fmt::Display) -> JsError {
    JsError::new(&e.to_string())
}

fn set(o: &Object, k: &str, v: &JsValue) {
    let _ = Reflect::set(o, &JsValue::from_str(k), v);
}

fn call1(f: &JsValue, arg: &[u8]) -> Result<JsValue, ()> {
    let f: &Function = f.unchecked_ref();
    f.call1(&JsValue::NULL, &Uint8Array::from(arg))
        .map_err(|_| ())
}

fn lookup_keys(f: &JsValue, key_id: &[u8]) -> Result<Arc<ExpandedAppStateKeys>, AppStateError> {
    let v = call1(f, key_id).map_err(|_| AppStateError::KeyNotFound)?;
    if v.is_undefined() || v.is_null() {
        return Err(AppStateError::KeyNotFound);
    }
    Ok(Arc::new(expand_app_state_keys(
        &Uint8Array::new(&v).to_vec(),
    )))
}

fn mac_obj(m: &AppStateMutationMAC) -> JsValue {
    let o = Object::new();
    set(&o, "indexMac", &Uint8Array::from(m.index_mac.as_slice()));
    set(&o, "valueMac", &Uint8Array::from(m.value_mac.as_slice()));
    o.into()
}

fn mutation_obj(m: &Mutation) -> JsValue {
    let o = Object::new();
    let index = Array::new();
    for part in &m.index {
        index.push(&JsValue::from_str(part));
    }
    set(&o, "index", &index);
    let op = if m.operation == SyncdOperation::REMOVE {
        "remove"
    } else {
        "set"
    };
    set(&o, "operation", &JsValue::from_str(op));
    if let Some(v) = &m.action_value {
        set(
            &o,
            "value",
            &Uint8Array::from(waproto::codec::sync_action_value_to_vec(v).as_slice()),
        );
    }
    o.into()
}

fn result_obj(
    mutations: &[Mutation],
    added: &[AppStateMutationMAC],
    removed: &[Vec<u8>],
) -> JsAppStateResult {
    let out = Object::new();
    let muts = Array::new();
    for m in mutations {
        muts.push(&mutation_obj(m));
    }
    let macs = Array::new();
    for m in added {
        macs.push(&mac_obj(m));
    }
    let rem = Array::new();
    for r in removed {
        rem.push(&Uint8Array::from(r.as_slice()));
    }
    set(&out, "mutations", &muts);
    set(&out, "addedMacs", &macs);
    set(&out, "removedIndexMacs", &rem);
    out.unchecked_into()
}

/// Hash state + MAC verification for one app-state collection.
#[wasm_bindgen]
pub struct AppStateCollection {
    name: String,
    state: HashState,
}

#[wasm_bindgen]
impl AppStateCollection {
    /// A fresh, never-synced collection.
    #[wasm_bindgen(constructor)]
    pub fn new(name: &str) -> AppStateCollection {
        AppStateCollection {
            name: name.to_owned(),
            state: HashState::default(),
        }
    }

    /// Restore from bytes produced by `serializeState`.
    #[wasm_bindgen(js_name = fromState)]
    pub fn from_state(name: &str, state: &[u8]) -> Result<AppStateCollection, JsError> {
        let state = serde_json::from_slice(state).map_err(err)?;
        Ok(AppStateCollection {
            name: name.to_owned(),
            state,
        })
    }

    /// Opaque bytes to persist; feed back to `fromState`.
    #[wasm_bindgen(js_name = serializeState)]
    pub fn serialize_state(&self) -> Result<Vec<u8>, JsError> {
        serde_json::to_vec(&self.state).map_err(err)
    }

    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn version(&self) -> f64 {
        self.state.version as f64
    }

    /// 128-byte LTHash.
    #[wasm_bindgen(getter)]
    pub fn hash(&self) -> Vec<u8> {
        self.state.hash.to_vec()
    }

    /// Apply an encoded `SyncdSnapshot`, rebuilding the collection from scratch.
    #[wasm_bindgen(js_name = applySnapshot)]
    pub fn apply_snapshot(
        &mut self,
        snapshot: &[u8],
        get_key: JsKeyLookup,
    ) -> Result<JsAppStateResult, JsError> {
        let snapshot = waproto::codec::syncd_snapshot_decode(snapshot).map_err(err)?;
        let get_key: JsValue = get_key.into();
        let mut next = HashState::default();
        let out = process_snapshot(
            &snapshot,
            &mut next,
            |id| lookup_keys(&get_key, id),
            true,
            &self.name,
        )
        .map_err(err)?;
        // `process_snapshot` leaves the snapshot MAC check to the caller.
        let key_id = snapshot
            .key_id
            .id
            .as_deref()
            .ok_or_else(|| err(AppStateError::MissingKeyId))?;
        let keys = lookup_keys(&get_key, key_id).map_err(err)?;
        wacore_appstate::validate_snapshot_mac(&snapshot, &out.state, &keys, &self.name)
            .map_err(err)?;
        self.state = out.state;
        Ok(result_obj(&out.mutations, &out.mutation_macs, &[]))
    }

    /// Apply an encoded `SyncdPatch`. Transactional: on error the collection is unchanged.
    #[wasm_bindgen(js_name = applyPatch)]
    pub fn apply_patch(
        &mut self,
        patch: &[u8],
        get_key: JsKeyLookup,
        get_previous_value_mac: JsMacLookup,
    ) -> Result<JsAppStateResult, JsError> {
        let patch = waproto::codec::syncd_patch_decode(patch).map_err(err)?;
        let get_key: JsValue = get_key.into();
        let get_prev: JsValue = get_previous_value_mac.into();
        let mut next = self.state.clone();
        let out = process_patch(
            &patch,
            &mut next,
            |id| lookup_keys(&get_key, id),
            |index_mac| {
                let v = call1(&get_prev, index_mac)
                    .map_err(|_| AppStateError::MissingPreviousSetValueOperation)?;
                Ok(if v.is_undefined() || v.is_null() {
                    None
                } else {
                    Some(Uint8Array::new(&v).to_vec())
                })
            },
            true,
            &self.name,
        )
        .map_err(err)?;
        self.state = out.state;
        Ok(result_obj(
            &out.mutations,
            &out.added_macs,
            &out.removed_index_macs,
        ))
    }
}
