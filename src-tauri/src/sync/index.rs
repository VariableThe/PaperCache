use std::cmp::Ordering;
use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

use crate::sync::revision::{Op, Revision, FORMAT_VERSION};

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct NoteState {
    pub path: String,
    pub head_rev: String,
    pub content_hash: Option<String>,
    pub deleted: bool,
}

/// The rebuildable index. Derived from immutable records, never authoritative.
#[derive(Serialize, Deserialize, Clone, Debug, Default, PartialEq, Eq)]
pub struct Index {
    pub format_version: u32,
    pub notes: BTreeMap<String, NoteState>,
}

/// Rebuild the index by replaying all records in causal order. Duplicate
/// records (same `rev_id`) collapse, making replay idempotent. When a note's
/// history forks (concurrent edits), the head is chosen deterministically as
/// the branch with the smallest `rev_id`; the other branches are conflicts and
/// are returned by [`find_conflicts`].
pub fn rebuild_index(records: &[Revision]) -> Index {
    let deduped = dedup_by_rev_id(records);

    let mut by_note: BTreeMap<String, Vec<&Revision>> = BTreeMap::new();
    for r in &deduped {
        by_note.entry(r.note_id.clone()).or_default().push(r);
    }

    let mut notes = BTreeMap::new();
    for (note_id, revs) in by_note {
        // A note whose chain has no reachable root (dangling parent) is
        // incomplete; omit it rather than emitting a ghost with an empty path.
        if let Some(state) = rebuild_note(&revs) {
            notes.insert(note_id, state);
        }
    }

    Index {
        format_version: FORMAT_VERSION,
        notes,
    }
}

/// Return the `rev_id`s of fork branches (non-head concurrent edits) that must
/// be preserved as conflict copies.
pub fn find_conflicts(records: &[Revision]) -> Vec<String> {
    let deduped = dedup_by_rev_id(records);

    let mut by_note: BTreeMap<String, Vec<&Revision>> = BTreeMap::new();
    for r in &deduped {
        by_note.entry(r.note_id.clone()).or_default().push(r);
    }

    let mut conflicts = Vec::new();
    for revs in by_note.values() {
        let mut children: BTreeMap<Option<String>, Vec<&Revision>> = BTreeMap::new();
        for r in revs {
            children.entry(r.parent_rev.clone()).or_default().push(r);
        }
        for kids in children.values() {
            if kids.len() > 1 {
                let mut sorted = kids.clone();
                sorted.sort_by(fork_order);
                for k in &sorted[1..] {
                    conflicts.push(k.rev_id());
                }
            }
        }
    }

    conflicts.sort();
    conflicts
}

/// Deterministic fork resolution: a `Delete` tombstone always wins over a
/// concurrent edit, so a delete/edit race never resurrects a note. Among same-
/// kind branches, the smallest `rev_id` wins. Never uses wall-clock time.
fn fork_order(a: &&Revision, b: &&Revision) -> Ordering {
    let (a, b) = (*a, *b);
    let a_del = a.op == Op::Delete;
    let b_del = b.op == Op::Delete;
    match (a_del, b_del) {
        (true, false) => Ordering::Less,
        (false, true) => Ordering::Greater,
        _ => a.rev_id().cmp(&b.rev_id()),
    }
}

fn dedup_by_rev_id(records: &[Revision]) -> Vec<&Revision> {
    let mut seen: BTreeMap<String, &Revision> = BTreeMap::new();
    for r in records {
        seen.entry(r.rev_id()).or_insert(r);
    }
    seen.into_values().collect()
}

fn rebuild_note(revs: &[&Revision]) -> Option<NoteState> {
    let mut children: BTreeMap<Option<String>, Vec<&Revision>> = BTreeMap::new();
    for r in revs {
        children.entry(r.parent_rev.clone()).or_default().push(r);
    }

    let mut state = NoteState {
        path: String::new(),
        head_rev: String::new(),
        content_hash: None,
        deleted: false,
    };

    let mut parent: Option<String> = None;
    loop {
        let Some(kids) = children.get(&parent) else {
            break;
        };
        if kids.is_empty() {
            break;
        }
        let mut sorted = kids.clone();
        sorted.sort_by(fork_order);
        let head = sorted[0];
        apply_revision(head, &mut state);
        parent = Some(head.rev_id());
    }

    // No reachable root means the chain is incomplete (partial sync); treat as
    // no information rather than an empty note.
    if state.head_rev.is_empty() {
        return None;
    }
    Some(state)
}

fn apply_revision(r: &Revision, state: &mut NoteState) {
    match r.op {
        Op::Upsert => {
            state.path = r.path.clone();
            state.content_hash = r.content_hash.clone();
            state.deleted = false;
        }
        Op::Rename => {
            state.path = r.path.clone();
        }
        Op::Delete => {
            state.path = r.path.clone();
            state.content_hash = None;
            state.deleted = true;
        }
    }
    state.head_rev = r.rev_id();
}
