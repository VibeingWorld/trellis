# Trellis

Trellis is a workspace-based Kanban app built with Next.js and SQLite. Cards can be carried between boards in a persistent tray and either moved or linked. Linked placements share one card’s description, tags, links, attachments, calendar date, and stable URL while keeping independent board positions.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` only if you want to change the persistent data directory.
3. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and starter workspace are created on first launch. Uploaded images and PDFs live in `data/uploads`; back up that directory together with the database.

## Calendar connections

The shared side panel has Tray and Calendar tabs and can expand to half the window. Drag a card directly from a board column or from the tray. Month view schedules an all-day card; Week, 5 days, and Day views show hours and schedule a one-hour block when you drop onto a time.

No account connection or OAuth setup is required. Scheduled cards have an **Add to Google Calendar** shortcut that opens a prefilled Google event, and **Download .ics** exports the workspace for Google Calendar, Apple Calendar, Outlook, and other ICS-compatible apps. The ICS feed is one-way, so scheduling changes remain controlled by Cove.

Every card also has a stable `/cards/{cardId}` URL under the configured base path. Opening it resolves the card’s current board placement and opens its details.

## Checks

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

Maintenance commands:

- `npm run db:migrate` initializes or upgrades the local database.
- `npm run db:seed` adds the starter workspace when the database is empty.
- `npm run db:backup -- ./backups` creates a consistent database and upload backup.

Product and architecture decisions are documented in [PLAN.md](./PLAN.md).
