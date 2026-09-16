typedef Json = Map<String, dynamic>;

String _s(Json json, String key, [String fallback = '']) =>
    json[key]?.toString() ?? fallback;
int _i(Json json, String key, [int fallback = 0]) =>
    json[key] is num ? (json[key] as num).toInt() : fallback;
double _d(Json json, String key, [double fallback = 0]) =>
    json[key] is num ? (json[key] as num).toDouble() : fallback;
bool _b(Json json, String key, [bool fallback = false]) => json[key] is bool
    ? json[key] as bool
    : json[key] is num
    ? json[key] != 0
    : fallback;
String? _n(Json json, String key) => json[key]?.toString();

class Workspace {
  const Workspace({
    required this.id,
    required this.name,
    this.icon = 'W',
    this.color = '#8474eb',
  });
  factory Workspace.fromJson(Json json) => Workspace(
    id: _s(json, 'id'),
    name: _s(json, 'name'),
    icon: _s(json, 'icon', 'W'),
    color: _s(json, 'color', '#8474eb'),
  );
  final String id;
  final String name;
  final String icon;
  final String color;
}

class Board {
  const Board({
    required this.id,
    required this.workspaceId,
    required this.name,
    this.description = '',
    this.background = '#eff2f5',
    this.favorite = false,
    this.visibility = 'private',
    this.ownerUserId,
  });
  factory Board.fromJson(Json json) => Board(
    id: _s(json, 'id'),
    workspaceId: _s(json, 'workspaceId'),
    name: _s(json, 'name'),
    description: _s(json, 'description'),
    background: _s(json, 'background', '#eff2f5'),
    favorite: _b(json, 'favorite'),
    visibility: _s(json, 'visibility', 'private'),
    ownerUserId: _n(json, 'ownerUserId'),
  );
  final String id;
  final String workspaceId;
  final String name;
  final String description;
  final String background;
  final bool favorite;
  final String visibility;
  final String? ownerUserId;
}

class BoardColumn {
  const BoardColumn({
    required this.id,
    required this.boardId,
    required this.name,
    required this.position,
    this.wipLimit,
    this.limitMode = 'off',
    this.color = '#9299a5',
  });
  factory BoardColumn.fromJson(Json json) => BoardColumn(
    id: _s(json, 'id'),
    boardId: _s(json, 'boardId'),
    name: _s(json, 'name'),
    position: _d(json, 'position'),
    wipLimit: json['wipLimit'] is num
        ? (json['wipLimit'] as num).toInt()
        : null,
    limitMode: _s(json, 'limitMode', 'off'),
    color: _s(json, 'color', '#9299a5'),
  );
  final String id;
  final String boardId;
  final String name;
  final double position;
  final int? wipLimit;
  final String limitMode;
  final String color;
}

class CoveCard {
  const CoveCard({
    required this.id,
    required this.workspaceId,
    required this.title,
    this.description = '',
    this.cover,
    this.dueDate,
    this.scheduledStart,
    this.scheduledEnd,
    this.archived = false,
    this.version = 1,
    this.cardNumber = 0,
  });
  factory CoveCard.fromJson(Json json) => CoveCard(
    id: _s(json, 'id'),
    workspaceId: _s(json, 'workspaceId'),
    title: _s(json, 'title'),
    description: _s(json, 'description'),
    cover: _n(json, 'cover'),
    dueDate: _n(json, 'dueDate'),
    scheduledStart: _n(json, 'scheduledStart'),
    scheduledEnd: _n(json, 'scheduledEnd'),
    archived: _b(json, 'archived'),
    version: _i(json, 'version', 1),
    cardNumber: _i(json, 'cardNumber'),
  );
  final String id;
  final String workspaceId;
  final String title;
  final String description;
  final String? cover;
  final String? dueDate;
  final String? scheduledStart;
  final String? scheduledEnd;
  final bool archived;
  final int version;
  final int cardNumber;

  DateTime? get start =>
      scheduledStart == null ? null : DateTime.tryParse(scheduledStart!);
  DateTime? get end =>
      scheduledEnd == null ? null : DateTime.tryParse(scheduledEnd!);
}

class Placement {
  const Placement({
    required this.id,
    required this.cardId,
    required this.boardId,
    required this.columnId,
    required this.position,
    this.version = 1,
  });
  factory Placement.fromJson(Json json) => Placement(
    id: _s(json, 'id'),
    cardId: _s(json, 'cardId'),
    boardId: _s(json, 'boardId'),
    columnId: _s(json, 'columnId'),
    position: _d(json, 'position'),
    version: _i(json, 'version', 1),
  );
  final String id;
  final String cardId;
  final String boardId;
  final String columnId;
  final double position;
  final int version;
}

class Tag {
  const Tag({
    required this.id,
    required this.workspaceId,
    required this.name,
    required this.color,
  });
  factory Tag.fromJson(Json json) => Tag(
    id: _s(json, 'id'),
    workspaceId: _s(json, 'workspaceId'),
    name: _s(json, 'name'),
    color: _s(json, 'color'),
  );
  final String id;
  final String workspaceId;
  final String name;
  final String color;
}

class CardTag {
  const CardTag({required this.cardId, required this.tagId});
  factory CardTag.fromJson(Json json) =>
      CardTag(cardId: _s(json, 'cardId'), tagId: _s(json, 'tagId'));
  final String cardId;
  final String tagId;
}

class CardLink {
  const CardLink({
    required this.id,
    required this.cardId,
    required this.title,
    required this.url,
  });
  factory CardLink.fromJson(Json json) => CardLink(
    id: _s(json, 'id'),
    cardId: _s(json, 'cardId'),
    title: _s(json, 'title'),
    url: _s(json, 'url'),
  );
  final String id;
  final String cardId;
  final String title;
  final String url;
}

class Attachment {
  const Attachment({
    required this.id,
    this.cardId,
    this.boardId,
    required this.name,
    required this.url,
    required this.mimeType,
    required this.size,
  });
  factory Attachment.fromJson(Json json) => Attachment(
    id: _s(json, 'id'),
    cardId: _n(json, 'cardId'),
    boardId: _n(json, 'boardId'),
    name: _s(json, 'name'),
    url: _s(json, 'url'),
    mimeType: _s(json, 'mimeType'),
    size: _i(json, 'size'),
  );
  final String id;
  final String? cardId;
  final String? boardId;
  final String name;
  final String url;
  final String mimeType;
  final int size;
}

class TrayItem {
  const TrayItem({
    required this.id,
    required this.workspaceId,
    required this.placementId,
    required this.mode,
    this.sourceVersion = 1,
    this.position = 0,
  });
  factory TrayItem.fromJson(Json json) => TrayItem(
    id: _s(json, 'id'),
    workspaceId: _s(json, 'workspaceId'),
    placementId: _s(json, 'placementId'),
    mode: _s(json, 'mode', 'move'),
    sourceVersion: _i(json, 'sourceVersion', 1),
    position: _d(json, 'position'),
  );
  final String id;
  final String workspaceId;
  final String placementId;
  final String mode;
  final int sourceVersion;
  final double position;
}

class CardRelation {
  const CardRelation({
    required this.id,
    required this.cardId,
    required this.relatedCardId,
  });
  factory CardRelation.fromJson(Json json) => CardRelation(
    id: _s(json, 'id'),
    cardId: _s(json, 'cardId'),
    relatedCardId: _s(json, 'relatedCardId'),
  );
  final String id;
  final String cardId;
  final String relatedCardId;
}

class AppUser {
  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });
  factory AppUser.fromJson(Json json) => AppUser(
    id: _s(json, 'id'),
    name: _s(json, 'name'),
    email: _s(json, 'email'),
    role: _s(json, 'role', 'member'),
  );
  final String id;
  final String name;
  final String email;
  final String role;
}

class WorkspaceIntegration {
  const WorkspaceIntegration({
    required this.workspaceId,
    this.githubOwner,
    this.githubRepo,
    this.githubProjectUrl,
    this.aiTriggerColumnId,
    this.githubConfigured = false,
    this.openaiConfigured = false,
  });
  factory WorkspaceIntegration.fromJson(Json json) => WorkspaceIntegration(
    workspaceId: _s(json, 'workspaceId'),
    githubOwner: _n(json, 'githubOwner'),
    githubRepo: _n(json, 'githubRepo'),
    githubProjectUrl: _n(json, 'githubProjectUrl'),
    aiTriggerColumnId: _n(json, 'aiTriggerColumnId'),
    githubConfigured: _b(json, 'githubConfigured'),
    openaiConfigured: _b(json, 'openaiConfigured'),
  );
  final String workspaceId;
  final String? githubOwner;
  final String? githubRepo;
  final String? githubProjectUrl;
  final String? aiTriggerColumnId;
  final bool githubConfigured;
  final bool openaiConfigured;
}

class GithubLink {
  const GithubLink({
    required this.id,
    required this.cardId,
    required this.issueNumber,
    required this.issueUrl,
    required this.issueTitle,
    this.projectItemId,
  });
  factory GithubLink.fromJson(Json json) => GithubLink(
    id: _s(json, 'id'),
    cardId: _s(json, 'cardId'),
    issueNumber: _i(json, 'issueNumber'),
    issueUrl: _s(json, 'issueUrl'),
    issueTitle: _s(json, 'issueTitle'),
    projectItemId: _n(json, 'projectItemId'),
  );
  final String id;
  final String cardId;
  final int issueNumber;
  final String issueUrl;
  final String issueTitle;
  final String? projectItemId;
}

class AiRun {
  const AiRun({
    required this.id,
    required this.cardId,
    required this.status,
    required this.createdAt,
    this.sessionId,
    this.error,
  });
  factory AiRun.fromJson(Json json) => AiRun(
    id: _s(json, 'id'),
    cardId: _s(json, 'cardId'),
    status: _s(json, 'status'),
    createdAt: _i(json, 'createdAt'),
    sessionId: _n(json, 'sessionId'),
    error: _n(json, 'error'),
  );
  final String id;
  final String cardId;
  final String status;
  final int createdAt;
  final String? sessionId;
  final String? error;
}

class AppState {
  const AppState({
    this.workspaces = const [],
    this.boards = const [],
    this.columns = const [],
    this.cards = const [],
    this.placements = const [],
    this.tags = const [],
    this.cardTags = const [],
    this.links = const [],
    this.attachments = const [],
    this.tray = const [],
    this.relations = const [],
    this.workspaceIntegrations = const [],
    this.githubLinks = const [],
    this.aiRuns = const [],
    this.permissionsByWorkspace = const {},
    this.authenticationDisabled = false,
    this.currentUser,
  });
  factory AppState.fromJson(Json json) => AppState(
    workspaces: _list(json, 'workspaces', Workspace.fromJson),
    boards: _list(json, 'boards', Board.fromJson),
    columns: _list(json, 'columns', BoardColumn.fromJson),
    cards: _list(json, 'cards', CoveCard.fromJson),
    placements: _list(json, 'placements', Placement.fromJson),
    tags: _list(json, 'tags', Tag.fromJson),
    cardTags: _list(json, 'cardTags', CardTag.fromJson),
    links: _list(json, 'links', CardLink.fromJson),
    attachments: _list(json, 'attachments', Attachment.fromJson),
    tray: _list(json, 'tray', TrayItem.fromJson),
    relations: _list(json, 'relations', CardRelation.fromJson),
    workspaceIntegrations: _list(
      json,
      'workspaceIntegrations',
      WorkspaceIntegration.fromJson,
    ),
    githubLinks: _list(json, 'githubLinks', GithubLink.fromJson),
    aiRuns: _list(json, 'aiRuns', AiRun.fromJson),
    permissionsByWorkspace:
        (json['permissionsByWorkspace'] as Map<String, dynamic>? ?? const {})
            .map(
              (key, value) => MapEntry(
                key,
                (value as List<dynamic>? ?? const [])
                    .map((item) => item.toString())
                    .toList(growable: false),
              ),
            ),
    authenticationDisabled: _b(json, 'authenticationDisabled'),
    currentUser: json['currentUser'] is Json
        ? AppUser.fromJson(json['currentUser'] as Json)
        : null,
  );
  final List<Workspace> workspaces;
  final List<Board> boards;
  final List<BoardColumn> columns;
  final List<CoveCard> cards;
  final List<Placement> placements;
  final List<Tag> tags;
  final List<CardTag> cardTags;
  final List<CardLink> links;
  final List<Attachment> attachments;
  final List<TrayItem> tray;
  final List<CardRelation> relations;
  final List<WorkspaceIntegration> workspaceIntegrations;
  final List<GithubLink> githubLinks;
  final List<AiRun> aiRuns;
  final Map<String, List<String>> permissionsByWorkspace;
  final bool authenticationDisabled;
  final AppUser? currentUser;

  CoveCard? card(String id) => _first(cards, (item) => item.id == id);
  Placement? placement(String id) =>
      _first(placements, (item) => item.id == id);
  Board? board(String id) => _first(boards, (item) => item.id == id);
  BoardColumn? column(String id) => _first(columns, (item) => item.id == id);
  WorkspaceIntegration? integration(String workspaceId) =>
      _first(workspaceIntegrations, (item) => item.workspaceId == workspaceId);
  GithubLink? githubLink(String cardId) =>
      _first(githubLinks, (item) => item.cardId == cardId);
  AiRun? aiRun(String cardId) =>
      _first(aiRuns, (item) => item.cardId == cardId);
}

List<T> _list<T>(Json json, String key, T Function(Json) fromJson) =>
    (json[key] as List<dynamic>? ?? const [])
        .whereType<Map<String, dynamic>>()
        .map(fromJson)
        .toList(growable: false);
T? _first<T>(Iterable<T> values, bool Function(T) test) {
  for (final value in values) {
    if (test(value)) return value;
  }
  return null;
}

class GoogleStatus {
  const GoogleStatus({
    required this.configured,
    required this.connected,
    required this.redirectUri,
  });
  factory GoogleStatus.fromJson(Json json) => GoogleStatus(
    configured: _b(json, 'configured'),
    connected: _b(json, 'connected'),
    redirectUri: _s(json, 'redirectUri'),
  );
  final bool configured;
  final bool connected;
  final String redirectUri;
}
