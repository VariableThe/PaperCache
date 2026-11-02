use super::*;

const DEV_A: &str = "11111111-1111-4111-8111-111111111111";
const DEV_B: &str = "22222222-2222-4222-8222-222222222222";

fn body_hash(s: &str) -> String {
    hash_content(s.as_bytes())
}

#[test]
fn delete_edit_race_does_not_resurrect_the_note() {
    let note_id = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    let base = Revision::upsert(
        note_id,
        None,
        "note.md",
        body_hash("base"),
        4,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let base_rev = base.rev_id();

    // A delete and a concurrent edit race on the same base.
    let del = Revision::delete(
        note_id,
        Some(base_rev.clone()),
        "note.md",
        DEV_A,
        "2026-01-01T00:00:01.000Z",
    );
    let edit = Revision::upsert(
        note_id,
        Some(base_rev.clone()),
        "note.md",
        body_hash("edited"),
        6,
        DEV_B,
        "2026-01-01T00:00:01.000Z",
    );

    // The tombstone must win regardless of rev_id ordering.
    let idx = rebuild_index(&[base.clone(), del.clone(), edit.clone()]);
    assert!(idx.notes[note_id].deleted, "delete/edit race must not resurrect");

    // The concurrent edit is preserved as a conflict, not silently dropped.
    let conflicts = find_conflicts(&[base, del, edit.clone()]);
    assert_eq!(conflicts, vec![edit.rev_id()]);
}

/// Pins the canonical serialization and `rev_id` values that the compatibility
/// fixtures (`sync/fixtures/`) document. Any change to field order, key naming,
/// or optional-field handling MUST update this test and the fixtures together,
/// and is a protocol-breaking change.
#[test]
fn canonical_form_is_pinned_to_fixtures() {
    let note = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let dev_a = "11111111-1111-4111-8111-111111111111";
    let content = "# Hello\n\nWorld\n";

    assert_eq!(hash_content(content.as_bytes()), "2759f0691bc5a2f46d51a6094a21bafe0cd8455a5b000e8238978fc4c6321dda");

    let r0 = Revision::upsert(
        note,
        None,
        "notes/hello.md",
        hash_content(content.as_bytes()),
        content.len() as u64,
        dev_a,
        "2026-01-01T00:00:00.000Z",
    );
    assert_eq!(
        serde_json::to_string(&r0).unwrap(),
        r#"{"format_version":1,"note_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","parent_rev":null,"op":"upsert","path":"notes/hello.md","old_path":null,"content_hash":"2759f0691bc5a2f46d51a6094a21bafe0cd8455a5b000e8238978fc4c6321dda","content_length":15,"device_id":"11111111-1111-4111-8111-111111111111","created_at":"2026-01-01T00:00:00.000Z"}"#
    );
    assert_eq!(
        r0.rev_id(),
        "ed12bc3626fed6539d4e1d2403fe20faed401b87761ebd127b14e874566cd398"
    );
}

#[test]
fn rev_id_is_deterministic_and_content_addressed() {
    let a = Revision::upsert(
        "n1",
        None,
        "hello.md",
        body_hash("# hi"),
        5,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let b = a.clone();
    assert_eq!(a.rev_id(), b.rev_id());

    let c = Revision::upsert(
        "n1",
        None,
        "hello.md",
        body_hash("# hi"),
        5,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    // A record is a pure function of its fields, so identical inputs (including
    // attribution) collapse to the same rev_id.
    assert_eq!(a.rev_id(), c.rev_id());

    let d = Revision::upsert(
        "n1",
        None,
        "hello.md",
        body_hash("# hi there"),
        10,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    assert_ne!(a.rev_id(), d.rev_id());

    // Two concurrent identical-content edits by different devices are distinct
    // records (distinct rev_ids), which is what lets a fork be detected.
    let e = Revision::upsert(
        "n1",
        None,
        "hello.md",
        body_hash("# hi"),
        5,
        DEV_B,
        "2026-01-01T00:00:00.000Z",
    );
    assert_ne!(a.rev_id(), e.rev_id());
}

#[test]
fn replay_is_idempotent() {
    let r = Revision::upsert(
        "n1",
        None,
        "a.md",
        body_hash("one"),
        3,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let once = rebuild_index(&[r.clone()]);
    let twice = rebuild_index(&[r.clone(), r.clone()]);
    assert_eq!(once, twice);
}

#[test]
fn rename_preserves_note_id_and_updates_path() {
    let note_id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    let r0 = Revision::upsert(
        note_id,
        None,
        "old/name.md",
        body_hash("body"),
        4,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let r1 = Revision::rename(
        note_id,
        Some(r0.rev_id()),
        "old/name.md",
        "new/name.md",
        DEV_A,
        "2026-01-01T00:00:01.000Z",
    );

    let idx = rebuild_index(&[r1.clone(), r0.clone()]);
    let state = idx.notes.get(note_id).expect("note present");
    assert_eq!(state.path, "new/name.md");
    assert!(!state.deleted);
    // content survives a rename (carried on the previous head)
    assert_eq!(state.content_hash.as_deref(), Some(body_hash("body").as_str()));
}

#[test]
fn delete_is_a_durable_tombstone() {
    let note_id = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    let r0 = Revision::upsert(
        note_id,
        None,
        "gone.md",
        body_hash("x"),
        1,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let r1 = Revision::delete(
        note_id,
        Some(r0.rev_id()),
        "gone.md",
        DEV_A,
        "2026-01-01T00:00:01.000Z",
    );

    let idx = rebuild_index(&[r1, r0]);
    let state = idx.notes.get(note_id).expect("tombstone keeps note in index");
    assert!(state.deleted);
    assert_eq!(state.content_hash, None);
}

#[test]
fn concurrent_edits_fork_and_preserve_both_sides() {
    let note_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    let base = Revision::upsert(
        note_id,
        None,
        "note.md",
        body_hash("base"),
        4,
        DEV_A,
        "2026-01-01T00:00:00.000Z",
    );
    let base_rev = base.rev_id();

    // Two devices edit concurrently on top of the same base.
    let edit_a = Revision::upsert(
        note_id,
        Some(base_rev.clone()),
        "note.md",
        body_hash("from A"),
        6,
        DEV_A,
        "2026-01-01T00:00:01.000Z",
    );
    let edit_b = Revision::upsert(
        note_id,
        Some(base_rev.clone()),
        "note.md",
        body_hash("from B"),
        6,
        DEV_B,
        "2026-01-01T00:00:01.000Z",
    );

    let conflicts = find_conflicts(&[base.clone(), edit_a.clone(), edit_b.clone()]);
    assert_eq!(conflicts.len(), 1, "exactly one branch is a conflict");

    // The head is deterministic (smallest rev_id), independent of timestamps.
    let idx = rebuild_index(&[edit_b.clone(), edit_a.clone(), base.clone()]);
    let state = idx.notes.get(note_id).expect("note present");
    let expected_head = if edit_a.rev_id() < edit_b.rev_id() {
        edit_a.rev_id()
    } else {
        edit_b.rev_id()
    };
    assert_eq!(state.head_rev, expected_head);
    // The other side is preserved as a conflict, never silently dropped.
    assert!(conflicts.iter().all(|c| *c != state.head_rev));
    assert_eq!(conflicts.len() + 1, 2, "both branches survive");
}

#[test]
fn conflict_detection_never_uses_mtime() {
    let base = "rev-0";

    // Fast-forward: local base == remote head.
    assert!(!detect_conflict(Some(base), Some(base)));
    // Remote has no note: fast-forward create.
    assert!(!detect_conflict(Some(base), None));
    assert!(!detect_conflict(None, None));
    // Diverged heads: conflict, regardless of any timestamps involved.
    assert!(detect_conflict(Some(base), Some("rev-other")));
    // Local thinks it's new but remote already has it.
    assert!(detect_conflict(None, Some(base)));
}
