import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(), name: text('name').notNull(), icon: text('icon').notNull().default('W'),
  color: text('color').notNull().default('#8474eb'), createdAt: integer('created_at').notNull(),
});
export const boards = sqliteTable('boards', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(), description: text('description').notNull().default(''),
  background: text('background').notNull().default('#eff2f5'), favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  visibility: text('visibility').notNull().default('private'), ownerUserId: text('owner_user_id'),
  createdAt: integer('created_at').notNull(),
});
export const columns = sqliteTable('columns', {
  id: text('id').primaryKey(), boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), position: real('position').notNull(),
  wipLimit: integer('wip_limit'), limitMode: text('limit_mode').notNull().default('off'), color: text('color').notNull().default('#9299a5'),
});
export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  cardNumber: integer('card_number').notNull(),
  title: text('title').notNull(), description: text('description').notNull().default(''),
  cover: text('cover'), dueDate: text('due_date'), scheduledStart: text('scheduled_start'), scheduledEnd: text('scheduled_end'), archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  version: integer('version').notNull().default(1), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), email: text('email').notNull().unique(), name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(), passwordSalt: text('password_salt').notNull(),
  role: text('role').notNull().default('member'), active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(), expiresAt: integer('expires_at').notNull(), createdAt: integer('created_at').notNull(),
});
export const workspaceMembers = sqliteTable('workspace_members', {
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  permissions: text('permissions').notNull().default('[]'),
}, (t) => [uniqueIndex('workspace_member_unique').on(t.userId, t.workspaceId)]);
export const boardMembers = sqliteTable('board_members', {
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('board_member_unique').on(t.boardId, t.userId)]);
export const calendarConnections = sqliteTable('calendar_connections', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('google'), accessToken: text('access_token').notNull(), refreshToken: text('refresh_token'),
  expiresAt: integer('expires_at').notNull(), calendarId: text('calendar_id').notNull().default('primary'), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (t) => [uniqueIndex('calendar_connection_workspace_provider').on(t.workspaceId, t.provider)]);
export const calendarEvents = sqliteTable('calendar_events', {
  id: text('id').primaryKey(), connectionId: text('connection_id').notNull().references(() => calendarConnections.id, { onDelete: 'cascade' }),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), externalEventId: text('external_event_id').notNull(),
}, (t) => [uniqueIndex('calendar_event_connection_card').on(t.connectionId, t.cardId)]);
export const workspaceIntegrations = sqliteTable('workspace_integrations', {
  workspaceId: text('workspace_id').primaryKey().references(() => workspaces.id, { onDelete: 'cascade' }),
  githubOwner: text('github_owner'), githubRepo: text('github_repo'), githubProjectUrl: text('github_project_url'),
  codexProjectName: text('codex_project_name'),
  aiTriggerColumnId: text('ai_trigger_column_id').references(() => columns.id, { onDelete: 'set null' }),
  updatedAt: integer('updated_at').notNull(),
});
export const githubLinks = sqliteTable('github_links', {
  id: text('id').primaryKey(), cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  issueNumber: integer('issue_number').notNull(), issueNodeId: text('issue_node_id').notNull(), issueUrl: text('issue_url').notNull(),
  issueTitle: text('issue_title').notNull(), projectItemId: text('project_item_id'), createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
}, (t) => [uniqueIndex('github_link_card').on(t.cardId)]);
export const aiRuns = sqliteTable('ai_runs', {
  id: text('id').primaryKey(), cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  placementId: text('placement_id').notNull(), threadId: text('codex_thread_id'), status: text('status').notNull(), error: text('error'),
  createdAt: integer('created_at').notNull(), updatedAt: integer('updated_at').notNull(),
});
export const placements = sqliteTable('placements', {
  id: text('id').primaryKey(), cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  boardId: text('board_id').notNull().references(() => boards.id, { onDelete: 'cascade' }),
  columnId: text('column_id').notNull().references(() => columns.id, { onDelete: 'cascade' }), position: real('position').notNull(),
  version: integer('version').notNull().default(1),
}, (t) => [uniqueIndex('one_card_per_board').on(t.cardId, t.boardId)]);
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id),
  name: text('name').notNull(), color: text('color').notNull(),
});
export const cardTags = sqliteTable('card_tags', {
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), tagId: text('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('card_tag_unique').on(t.cardId, t.tagId)]);
export const links = sqliteTable('links', {
  id: text('id').primaryKey(), cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), title: text('title').notNull(), url: text('url').notNull(),
});
export const attachments = sqliteTable('attachments', {
  id: text('id').primaryKey(), cardId: text('card_id').references(() => cards.id, { onDelete: 'cascade' }), boardId: text('board_id').references(() => boards.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), url: text('url').notNull(), mimeType: text('mime_type').notNull(), size: integer('size').notNull(), createdAt: integer('created_at').notNull(),
});
export const tray = sqliteTable('tray', {
  id: text('id').primaryKey(), workspaceId: text('workspace_id').notNull().references(() => workspaces.id), placementId: text('placement_id').notNull(),
  mode: text('mode').notNull().default('move'), sourceVersion: integer('source_version').notNull(), position: real('position').notNull(),
}, (t) => [uniqueIndex('tray_placement_unique').on(t.placementId)]);
export const relations = sqliteTable('relations', {
  id: text('id').primaryKey(), cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }), relatedCardId: text('related_card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
}, (t) => [uniqueIndex('relation_unique').on(t.cardId, t.relatedCardId)]);
export const operations = sqliteTable('operations', {
  id: text('id').primaryKey(), result: text('result').notNull(), createdAt: integer('created_at').notNull(),
});
export const undoOperations = sqliteTable('undo_operations', {
  id: text('id').primaryKey(), payload: text('payload').notNull(), used: integer('used').notNull().default(0),
});
