import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import * as schema from './schema';
import { seed } from './seed';

export const dataDirectory = process.env.DATA_DIR || path.join(process.cwd(), 'data');
type Connection = { sqlite: Database.Database; db: BetterSQLite3Database<typeof schema> };
const globalDb = globalThis as unknown as { trellisConnections?: Map<string, Connection> };
const connections = globalDb.trellisConnections ??= new Map();
const databasePath = path.join(dataDirectory, 'trellis.sqlite');
const schemaSql = `
CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT 'W', color TEXT NOT NULL DEFAULT '#8474eb', created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', background TEXT NOT NULL DEFAULT '#eff2f5', favorite INTEGER NOT NULL DEFAULT 0, visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','members','public')), owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, name TEXT NOT NULL, position REAL NOT NULL, wip_limit INTEGER CHECK(wip_limit IS NULL OR wip_limit >= 1), limit_mode TEXT NOT NULL DEFAULT 'off' CHECK(limit_mode IN ('off','warning','strict')), color TEXT NOT NULL DEFAULT '#9299a5');
CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), card_number INTEGER NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', cover TEXT, due_date TEXT, scheduled_start TEXT, scheduled_end TEXT, archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS placements (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, column_id TEXT NOT NULL REFERENCES columns(id) ON DELETE CASCADE, position REAL NOT NULL, version INTEGER NOT NULL DEFAULT 1, UNIQUE(card_id, board_id));
CREATE TABLE IF NOT EXISTS tags (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, color TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS card_tags (card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE, UNIQUE(card_id,tag_id));
CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, title TEXT NOT NULL, url TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, card_id TEXT REFERENCES cards(id) ON DELETE CASCADE, board_id TEXT REFERENCES boards(id) ON DELETE CASCADE, name TEXT NOT NULL, url TEXT NOT NULL, mime_type TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS tray (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), placement_id TEXT NOT NULL UNIQUE, mode TEXT NOT NULL DEFAULT 'move', source_version INTEGER NOT NULL, position REAL NOT NULL);
CREATE TABLE IF NOT EXISTS relations (id TEXT PRIMARY KEY, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, related_card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, UNIQUE(card_id, related_card_id));
CREATE TABLE IF NOT EXISTS operations (id TEXT PRIMARY KEY, result TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS undo_operations (id TEXT PRIMARY KEY, payload TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS calendar_connections (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, provider TEXT NOT NULL DEFAULT 'google', access_token TEXT NOT NULL, refresh_token TEXT, expires_at INTEGER NOT NULL, calendar_id TEXT NOT NULL DEFAULT 'primary', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(workspace_id, provider));
CREATE TABLE IF NOT EXISTS calendar_events (id TEXT PRIMARY KEY, connection_id TEXT NOT NULL REFERENCES calendar_connections(id) ON DELETE CASCADE, card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE, external_event_id TEXT NOT NULL, UNIQUE(connection_id, card_id));
CREATE TABLE IF NOT EXISTS google_oauth_settings (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, client_secret TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_members (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, permissions TEXT NOT NULL DEFAULT '[]', UNIQUE(user_id, workspace_id));
CREATE TABLE IF NOT EXISTS board_members (board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(board_id, user_id));
CREATE INDEX IF NOT EXISTS placements_column_idx ON placements(column_id);
CREATE INDEX IF NOT EXISTS boards_workspace_idx ON boards(workspace_id);
CREATE INDEX IF NOT EXISTS cards_workspace_idx ON cards(workspace_id);
CREATE INDEX IF NOT EXISTS sessions_token_idx ON sessions(token_hash);
CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members(user_id);
`;

function addMissingColumns(connection: Database.Database) {
  const names = new Set((connection.prepare('PRAGMA table_info(cards)').all() as { name: string }[]).map((column) => column.name));
  if (!names.has('scheduled_start')) connection.exec('ALTER TABLE cards ADD COLUMN scheduled_start TEXT');
  if (!names.has('scheduled_end')) connection.exec('ALTER TABLE cards ADD COLUMN scheduled_end TEXT');
  if (!names.has('card_number')) {
    connection.exec('ALTER TABLE cards ADD COLUMN card_number INTEGER');
    const cards = connection.prepare('SELECT id, workspace_id FROM cards ORDER BY workspace_id, created_at, id').all() as {id:string;workspace_id:string}[];
    const counters = new Map<string, number>();
    const update = connection.prepare('UPDATE cards SET card_number=? WHERE id=?');
    for (const card of cards) { const number=(counters.get(card.workspace_id)||0)+1; counters.set(card.workspace_id,number); update.run(number,card.id); }
  }
  connection.exec('CREATE UNIQUE INDEX IF NOT EXISTS cards_workspace_number_idx ON cards(workspace_id, card_number)');
  const boardColumns = new Set((connection.prepare('PRAGMA table_info(boards)').all() as { name: string }[]).map((column) => column.name));
  if (!boardColumns.has('visibility')) connection.exec("ALTER TABLE boards ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private'");
  if (!boardColumns.has('owner_user_id')) connection.exec('ALTER TABLE boards ADD COLUMN owner_user_id TEXT');
  connection.exec('CREATE TABLE IF NOT EXISTS board_members (board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, UNIQUE(board_id, user_id))');
  connection.exec('CREATE INDEX IF NOT EXISTS board_members_user_idx ON board_members(user_id)');
  const firstAdmin = connection.prepare("SELECT id FROM users WHERE role='admin' AND active=1 ORDER BY created_at LIMIT 1").get() as {id:string}|undefined;
  if (firstAdmin) connection.prepare('UPDATE boards SET owner_user_id=? WHERE owner_user_id IS NULL').run(firstAdmin.id);
}

function retryBusy<T>(operation: () => T): T {
  const deadline = Date.now() + 10000;
  for (;;) {
    try { return operation(); }
    catch (error) {
      const code = (error as { code?: string }).code;
      if (!['SQLITE_BUSY', 'SQLITE_LOCKED'].includes(code || '') || Date.now() >= deadline) throw error;
      // This is only used during first connection initialization, before serving a request.
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50);
    }
  }
}

function getConnection(): Connection {
  const existing = connections.get(databasePath);
  if (existing?.sqlite.open) return existing;
  fs.mkdirSync(dataDirectory, { recursive: true });
  const connection = new Database(databasePath, { timeout: 10000 });
  try {
    connection.pragma('busy_timeout = 10000');
    connection.pragma('foreign_keys = ON');
    retryBusy(() => connection.pragma('journal_mode = WAL'));
    retryBusy(() => connection.transaction(() => {
      connection.exec(schemaSql);
      addMissingColumns(connection);
      if (process.env.SKIP_DEMO_SEED !== '1') seed(connection);
    }).immediate());
    const result = { sqlite: connection, db: drizzle(connection, { schema }) };
    connections.set(databasePath, result);
    return result;
  } catch (error) {
    connection.close();
    throw error;
  }
}

// Route imports are side-effect free: SQLite is opened only when a query runs.
export const sqlite = new Proxy({} as Database.Database, {
  get(_target, property) {
    const connection = getConnection().sqlite;
    const value = Reflect.get(connection, property);
    return typeof value === 'function' ? value.bind(connection) : value;
  },
});
export const db = new Proxy({} as BetterSQLite3Database<typeof schema>, {
  get(_target, property) {
    const database = getConnection().db;
    const value = Reflect.get(database, property);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});
