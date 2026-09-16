# Trellis

Trellis is a workspace-based Kanban app built with Next.js and SQLite. Cards can be carried between boards in a persistent tray and either moved or linked. Linked placements share one card’s description, tags, links, attachments, calendar date, and stable URL while keeping independent board positions.

## Local development

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` only if you want to change the persistent data directory.
3. Run `npm run dev` and open `http://localhost:3000`.

The local SQLite database and starter workspace are created on first launch. The first administrator must be provisioned directly on the server; browser-based setup is intentionally disabled. On the standard VPS deployment, run `runuser -u trellis -- npm --prefix /opt/trellis run admin:create -- --email you@example.com --name "Your Name"` and enter the password at the secure prompts. Running as the `trellis` service account preserves database ownership. After that, admins can create email/password accounts and assign per-workspace permissions from the profile at the bottom of the sidebar.

For a trusted private deployment that should open directly as the first active administrator, set `COVE_DISABLE_AUTH=1`. This bypasses the login screen and gives every visitor full administrator access, so do not enable it on a public or untrusted network. Remove the variable or set it to `0` to restore normal account login.

Uploaded images, PDFs, Office documents, text files, and ZIP archives live in `data/uploads`; back up that directory together with the database. Files can be dropped directly onto a card or into its details panel.

## AI / MCP access

The project includes a local MCP server and a project-level `.mcp.json`. Start it manually with `npm run mcp`, or let an MCP-capable client use the project configuration. It exposes scoped tools to list/read workspaces and boards and to create or update boards, columns, and cards.

By default, MCP runs as the first active administrator. Set `COVE_MCP_USER_EMAIL` to an active Cove account to make MCP honor that account's workspace permissions instead.

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
