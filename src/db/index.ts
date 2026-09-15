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
CREATE TABLE IF NOT EXISTS boards (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', background TEXT NOT NULL DEFAULT '#eff2f5', favorite INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS columns (id TEXT PRIMARY KEY, board_id TEXT NOT NULL REFERENCES boards(id) ON DELETE CASCADE, name TEXT NOT NULL, position REAL NOT NULL, wip_limit INTEGER CHECK(wip_limit IS NULL OR wip_limit >= 1), limit_mode TEXT NOT NULL DEFAULT 'off' CHECK(limit_mode IN ('off','warning','strict')), color TEXT NOT NULL DEFAULT '#9299a5');
CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', cover TEXT, due_date TEXT, scheduled_start TEXT, scheduled_end TEXT, archived INTEGER NOT NULL DEFAULT 0, version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
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
CREATE INDEX IF NOT EXISTS placements_column_idx ON placements(column_id);
CREATE INDEX IF NOT EXISTS boards_workspace_idx ON boards(workspace_id);
CREATE INDEX IF NOT EXISTS cards_workspace_idx ON cards(workspace_id);
`;

function addMissingColumns(connection: Database.Database) {
  const names = new Set((connection.prepare('PRAGMA table_info(cards)').all() as { name: string }[]).map((column) => column.name));
  if (!names.has('scheduled_start')) connection.exec('ALTER TABLE cards ADD COLUMN scheduled_start TEXT');
  if (!names.has('scheduled_end')) connection.exec('ALTER TABLE cards ADD COLUMN scheduled_end TEXT');
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
      seed(connection);
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
