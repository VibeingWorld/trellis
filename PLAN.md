# Next.js + SQLite Trello clone — implementation plan

Status: planning only. The project directory was empty when this plan was prepared.

## Product direction

Build a workspace-based Kanban app whose distinguishing features are synchronized cards across boards and a persistent side tray for carrying cards between boards.

Proposed defaults: desktop-first responsive interface; a single persistent application server; workspace-level access; cross-board operations within the same workspace. Cross-workspace transfers, public boards, and real-time collaborative editing are later extensions.

## Core experience

The left navigation contains the workspace switcher and board list. The center displays the current board with horizontally arranged columns. A collapsible Card tray stays on the right while navigating between boards. Card details open in a drawer or modal with a stable shareable URL. On smaller screens, navigation and the tray become drawers.

### Workspaces and boards

- Create, rename, and archive workspaces and boards.
- Support owner, editor, and viewer membership roles; enforce access on the server. The creator becomes the initial owner. Team invitations can follow the initial release.
- Create, rename, reorder, and archive columns; create, edit, reorder, move, and archive cards.
- Choose board backgrounds from solid colors, gradients, or uploaded images. Include a contrast overlay and image positioning controls.
- Search cards by title and filter a board by workspace tags.

### Linked cards

- Store one canonical card containing its title, Markdown body, tags, links, and attachments.
- Store a separate placement for each board where the card appears. Each placement has its own column and order.
- Editing shared content from any placement updates the same underlying card. Moving a placement affects that board's workflow only.
- Show a linked-card badge and a list of boards containing the card, with navigation to each placement.
- Permit at most one placement per card per board in the first release.
- “Remove from this board” removes that placement only. “Archive card everywhere” archives the shared card and hides all its placements. If removing the last placement, offer to archive the card or cancel.
- Also support “Related cards” inside card details: a searchable relationship to another card, including a card on another board. This does not create a board placement or synchronize two separate cards.

### Persistent Card tray

1. Drag a card into the tray, or choose “Add to tray” from its menu.
2. Leave the source placement unchanged. Display the card title, source board/column, and intended action in the tray.
3. Navigate to another board in the same workspace; tray contents survive navigation and reloads.
4. Select **Move** or **Link** before dropping. Default to Move, with the selected operation clearly visible on the drag preview and destination.
5. Move relocates the collected placement. Link creates another placement of the same canonical card.
6. On success, remove that item from the tray and offer Undo. On failure, leave both the source and tray intact with an explanation.

The tray is private to a user and scoped by workspace. Switching workspaces shows that workspace's saved tray. Multiple cards may be collected; the first release drops one card at a time. Multi-card batch drops are a later enhancement.

If the target board already contains the card, do not create a duplicate or silently merge placements. Show the existing placement and let the user navigate to it. A source placement changed by another session requires refreshing the tray item before moving it. Archived, removed, or inaccessible items display an unavailable state and cannot be dropped.

Provide keyboard controls and “Move to…” / “Link to…” menus alongside drag and drop. Undo reverses only the placement operation, preserves subsequent card-content edits, and rechecks permissions, placement revisions, and column capacity.

### Column limits

- Each column supports **Off**, **Warning**, or **Strict**, with an optional positive maximum.
- Show a counter such as `3 / 5` and a clear over-limit state.
- Count all active placements in the column, including linked cards. Board filters do not change the count; archived cards do not count.
- Warning mode allows entry and displays feedback. Strict mode rejects entry when capacity would be exceeded.
- Reordering within the same column consumes no extra capacity and remains allowed.
- Apply limits to creation, moves, links, restoration, and Undo. Validate capacity and perform the write within one database transaction.
- Lowering a limit below the existing count preserves current cards, marks the column over capacity, and blocks further additions in Strict mode.
- Restoring a globally archived card checks all its placements atomically; a blocked restore changes nothing and identifies the full column.

### Card content

- Markdown description editor with Write and Preview modes; support headings, lists, task-list formatting, links, tables, and fenced code blocks.
- Store Markdown source and render it without raw HTML, using safe URL handling.
- Structured external links with a label and URL; support add, edit, remove, and opening the link. Automatic external previews are optional later work.
- Workspace-level colored tags with create, rename, recolor, assign, remove, and board filtering. Tags stay attached when cards move or appear on another board.
- Image upload through file picker or drag and drop, thumbnails, full-size preview, and optional card cover selection.
- Initial image policy: JPEG, PNG, and WebP; configurable size cap with a proposed default of 10 MB. Validate actual image content as well as file type and size.
- Store image files on persistent disk and metadata in SQLite. Serve uploads through access-checked routes using generated storage names. Removing one board placement must not delete shared attachments.

## Technical architecture

| Area | Proposed approach |
| --- | --- |
| Application | Next.js App Router, TypeScript, Node.js runtime |
| Rendering | Server Components for initial reads; Client Components for board interactions, editor, and persistent tray |
| Database | SQLite with Drizzle ORM, better-sqlite3, and versioned migrations |
| Mutations | Server Actions for ordinary writes; Route Handlers for image upload/download |
| Business rules | Shared server-side services for access checks, placement operations, limits, and transactions |
| Interface | Tailwind CSS and accessible reusable controls |
| Drag and drop | dnd-kit with pointer, keyboard, and touch support; non-drag menus |
| Markdown | react-markdown with remark-gfm, raw HTML disabled |
| Client updates | Optimistic interaction feedback with rollback; invalidate/refetch affected boards and tray after writes |
| Verification | Service integration tests against temporary SQLite files and browser end-to-end tests |

Keep the tray provider and drag context in the shared workspace layout so board navigation preserves the interaction shell. Persist tray items in SQLite; browser state is a cache, not the only copy.

Shared card content has a revision number to reject stale edits. Open boards refresh on focus and after relevant mutations; cross-tab notifications can trigger refetches. Live multi-user push updates are outside the initial release, so another user's already-open board may need a refresh.

SQLite runs beside the application on a persistent local volume, with foreign keys enabled, WAL mode, a busy timeout, and short write transactions. Use one application instance initially. The database and uploads both need backups and a tested restore procedure; do not place the only database copy on an ephemeral filesystem.

## Data model

| Entity | Main purpose and fields |
| --- | --- |
| User / Session | Identity and authenticated sessions |
| Workspace | Name, owner, archive state |
| WorkspaceMember | User, workspace, role; unique membership |
| Board | Workspace, title, background settings, archive state |
| Column | Board, title, position, limit mode, maximum, archive state |
| Card | Workspace, title, Markdown body, cover attachment, revision, archive state |
| CardPlacement | Card, board, column, position, revision; unique card/board pair |
| CardRelation | Two related card IDs in the same workspace; no self-links or duplicate pairs |
| Tag / CardTag | Workspace tag name/color and unique card/tag assignments |
| CardLink | Card, display label, validated URL, order |
| Asset / CardAttachment | Storage key, media metadata, workspace, card attachment association |
| TrayItem | User, workspace, source placement, card, observed source revision, intended action, order |
| PlacementOperation | Actor, action, before/after placement state, revision, idempotency key, Undo status |

Use foreign keys, indexes for board loading and tray lookups, and transactions for multi-row mutations. Validate that cards, tags, placements, relations, uploads, and destination boards belong to the same workspace. Enforce column-to-board consistency in the schema where possible with composite foreign keys.

Use integer ordering with gaps and transactional renumbering when a gap is exhausted. A move updates the destination column/order and source/destination ordering as one operation. A retry with the same idempotency key returns the previous result instead of duplicating a link or consuming a tray item twice.

Archiving boards and columns preserves placements. Before permanently deleting a board or column, explicitly resolve cards that would lose their last placement by relocating or archiving them. Hard deletion and unreferenced-file cleanup should be separate, deliberate maintenance operations.

## Implementation sequence

| Phase | Work | Completion check |
| --- | --- | --- |
| 1. Foundation | Scaffold Next.js; establish SQLite connection, schema, migrations, sessions, workspace access, layout, and seed data | Two workspaces and two boards load with persisted data; unauthorized workspace reads/writes fail |
| 2. Core Kanban | Board/column/card CRUD, card drawer, ordering, drag and drop, accessible move menus, archive behavior | Cards retain position and content after reload; failed writes roll back visibly |
| 3. Distinctive workflow | Canonical cards and placements, linked-board indicators, related cards, persistent tray, Move/Link, duplicate handling, operation log, Undo | Collect on A, reload, navigate to B, move or link successfully; shared content and independent column positions behave correctly |
| 4. Limits and concurrency | Off/Warning/Strict settings, counters, atomic capacity checks on every entry path, revision conflicts and retries | Concurrent additions cannot overfill a Strict column; failed transfers retain their source and tray entry |
| 5. Content and appearance | Markdown editor/preview, links, workspace tags/filtering, image uploads/covers, board backgrounds | Rich card content survives moves and reloads; linked appearances show shared updates; backgrounds retain readable text |
| 6. Release readiness | Responsive polish, keyboard/touch verification, integration/end-to-end checks, migration checks, persistent deployment configuration, backup/restore documentation | All acceptance scenarios pass; restart and backup restoration preserve database records and image files |

Design placement operations for limits in Phase 3, then complete configurable limit behavior in Phase 4. Implement these phases in order; all six are required for the first release covering this request.

If implementation is delegated later, first agree on schema and server-service contracts. Then assign separate ownership of board UI, card content/uploads, and persistence/transfer services. Integrate against the same move/link/limit contract before final end-to-end verification.

## Acceptance scenarios

1. Create a workspace, two boards, several columns, and cards; reload and verify persistence.
2. Collect a card on Board A, reload, switch to Board B, and move it. It leaves A only after a successful drop, with tags, body, links, and images preserved.
3. Link a card from A onto B. Editing shared content on either board appears on the other after refetch; moving it between columns on B leaves A's position unchanged.
4. Add a related-card link across boards and navigate between the two independent cards.
5. Remove one linked placement without deleting the card or its other appearances; archive globally with explicit wording.
6. Test Off, Warning, and Strict limits; filtered-out cards still count, same-column reorder works, and two concurrent entrants cannot take the same final slot.
7. A rejected drop preserves the original placement and tray. A retried request does not duplicate the result.
8. Undo a move or link while retaining later body edits; explain a conflicting placement change or newly full source column.
9. Upload and preview an image, select a cover, set a board background, and verify files after an application restart.
10. Render representative Markdown and reject executable HTML/unsafe URLs; reject invalid or oversized image uploads.
11. Verify viewer restrictions and workspace isolation on reads, writes, uploads, direct URLs, relations, and tray operations.
12. Complete core movement by keyboard and through menus; verify touch and narrow-screen drawer behavior.
13. Restore a backup into a clean instance and confirm that cards, placements, images, and backgrounds remain usable.

## Technical references

- Next.js documents Server Components for server data access and Client Components for stateful interactions: [Server and Client Components](https://nextjs.org/docs/app/getting-started/server-and-client-components).
- A shared layout provides the navigation shell for the proposed persistent tray: [Layouts and Pages](https://nextjs.org/docs/app/getting-started/layouts-and-pages).
- Drizzle supports SQLite drivers including better-sqlite3 and versioned migrations: [Drizzle SQLite guide](https://orm.drizzle.team/docs/get-started/sqlite-new). Select compatible stable package versions at implementation time.
- SQLite WAL permits readers alongside a writer but still permits only one writer at a time, informing the short-transaction, single-server design: [SQLite WAL](https://www.sqlite.org/wal.html).
- The proposed drag interactions use [dnd-kit](https://dndkit.com/); Markdown rendering uses [react-markdown](https://github.com/remarkjs/react-markdown).
