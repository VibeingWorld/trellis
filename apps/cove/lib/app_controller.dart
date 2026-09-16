import 'package:flutter/foundation.dart';

import 'api.dart';
import 'models.dart';
import 'session_store.dart';
import 'widget_service.dart';

enum AppSection { board, tray, calendar }

class CoveController extends ChangeNotifier {
  CoveController({SessionStore? store}) : _store = store ?? SessionStore();

  final SessionStore _store;
  final CoveWidgetService widgetService = CoveWidgetService();
  CoveApi? _api;
  AppState state = const AppState();
  bool booting = true;
  bool connecting = false;
  bool busy = false;
  String? error;
  String? notice;
  String? serverHint;
  String? emailHint;
  String activeWorkspaceId = '';
  String activeBoardId = '';
  AppSection mobileSection = AppSection.board;
  bool trayOpen = true;
  bool calendarOpen = false;

  bool get connected => _api != null;
  String get serverUrl => _api?.baseUrl ?? serverHint ?? '';
  Workspace? get workspace =>
      first(state.workspaces, (item) => item.id == activeWorkspaceId);
  Board? get board => first(state.boards, (item) => item.id == activeBoardId);
  List<Board> get workspaceBoards => state.boards
      .where((item) => item.workspaceId == activeWorkspaceId)
      .toList();
  List<BoardColumn> get boardColumns =>
      state.columns.where((item) => item.boardId == activeBoardId).toList()
        ..sort((a, b) => a.position.compareTo(b.position));
  List<TrayItem> get workspaceTray =>
      state.tray.where((item) => item.workspaceId == activeWorkspaceId).toList()
        ..sort((a, b) => a.position.compareTo(b.position));
  bool get isAdmin => state.currentUser?.role == 'admin';
  bool can(String permission, [String? workspaceId]) {
    if (isAdmin || state.authenticationDisabled) return true;
    return state.permissionsByWorkspace[workspaceId ?? activeWorkspaceId]
            ?.contains(permission) ??
        false;
  }

  Future<void> initialize() async {
    final saved = await _store.read();
    serverHint = saved?.server;
    emailHint = saved?.email;
    if (saved != null) {
      try {
        await _resume(saved);
      } catch (_) {
        _api?.close();
        _api = null;
      }
    }
    booting = false;
    notifyListeners();
  }

  Future<void> connect(
    String server,
    String email,
    String password, {
    required bool remember,
    bool quiet = false,
  }) async {
    connecting = true;
    error = null;
    notice = null;
    notifyListeners();
    Object? lastError;
    try {
      for (final candidate in serverCandidates(server)) {
        final client = CoveApi(baseUrl: candidate);
        try {
          final status = await client.authStatus();
          if (status['setupRequired'] == true) {
            throw const ApiException(
              'This server still needs its first administrator account.',
            );
          }
          if (status['user'] == null) await client.login(email, password);
          final next = await client.state();
          _api?.close();
          _api = client;
          state = next;
          serverHint = candidate;
          emailHint = email.trim();
          _selectDefaults();
          await widgetService.sync(state);
          if (remember) {
            await _store.write(
              SavedSession(
                server: candidate,
                email: email.trim(),
                sessionCookie: client.sessionCookie,
              ),
            );
          } else {
            await _store.clear();
          }
          return;
        } catch (caught) {
          client.close();
          lastError = caught;
        }
      }
      throw lastError ??
          const ApiException('Could not connect to this Cove server.');
    } catch (caught) {
      if (!quiet) error = _message(caught);
      rethrow;
    } finally {
      connecting = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    try {
      await _api?.logout();
    } finally {
      _api?.close();
      _api = null;
      state = const AppState();
      activeWorkspaceId = '';
      activeBoardId = '';
      error = null;
      notice = null;
      await _store.clear();
      notifyListeners();
    }
  }

  Future<void> refresh({bool silent = false}) async {
    final api = _api;
    if (api == null) return;
    if (!silent) {
      busy = true;
      notifyListeners();
    }
    try {
      state = await api.state();
      _selectDefaults();
      await widgetService.sync(state);
      error = null;
    } catch (caught) {
      error = _message(caught);
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<Json?> mutate(String action, Json values, {String? success}) async {
    final api = _api;
    if (api == null || busy) return null;
    busy = true;
    error = null;
    notice = null;
    notifyListeners();
    try {
      final result = await api.action(action, values);
      if (result['state'] is Json) {
        state = AppState.fromJson(result['state'] as Json);
      }
      final warning = result['calendarWarning'] ?? result['warning'];
      notice = warning == null ? success : '${success ?? 'Saved'} · $warning';
      _selectDefaults();
      await widgetService.sync(state);
      return result;
    } catch (caught) {
      error = _message(caught);
      return null;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<bool> upload({
    required Uint8List bytes,
    required String filename,
    String? cardId,
    String? boardId,
  }) async {
    final api = _api;
    if (api == null || busy) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      final result = await api.upload(
        bytes: bytes,
        filename: filename,
        cardId: cardId,
        boardId: boardId,
      );
      if (result['state'] is Json) {
        state = AppState.fromJson(result['state'] as Json);
      }
      await widgetService.sync(state);
      notice = 'Attachment uploaded';
      return true;
    } catch (caught) {
      error = _message(caught);
      return false;
    } finally {
      busy = false;
      notifyListeners();
    }
  }

  Future<GoogleStatus?> googleStatus() async {
    try {
      return await _api?.googleStatus(activeWorkspaceId);
    } catch (caught) {
      error = _message(caught);
      notifyListeners();
      return null;
    }
  }

  Uri? resolve(String path) => _api?.uri(path);

  void selectWorkspace(String id) {
    activeWorkspaceId = id;
    activeBoardId =
        state.boards.where((item) => item.workspaceId == id).firstOrNull?.id ??
        '';
    notifyListeners();
  }

  void selectBoard(String id) {
    final selected = state.board(id);
    if (selected == null) return;
    activeBoardId = id;
    activeWorkspaceId = selected.workspaceId;
    mobileSection = AppSection.board;
    notifyListeners();
  }

  void selectSection(AppSection section) {
    mobileSection = section;
    notifyListeners();
  }

  void toggleTray() {
    trayOpen = !trayOpen;
    notifyListeners();
  }

  void toggleCalendar() {
    calendarOpen = !calendarOpen;
    notifyListeners();
  }

  void clearMessage() {
    error = null;
    notice = null;
    notifyListeners();
  }

  void _selectDefaults() {
    if (!state.workspaces.any((item) => item.id == activeWorkspaceId)) {
      activeWorkspaceId = state.workspaces.firstOrNull?.id ?? '';
    }
    if (!state.boards.any(
      (item) =>
          item.id == activeBoardId && item.workspaceId == activeWorkspaceId,
    )) {
      activeBoardId =
          state.boards
              .where((item) => item.workspaceId == activeWorkspaceId)
              .firstOrNull
              ?.id ??
          '';
    }
  }

  Future<void> _resume(SavedSession saved) async {
    final client = CoveApi(
      baseUrl: saved.server,
      sessionCookie: saved.sessionCookie,
    );
    try {
      final next = await client.state();
      _api?.close();
      _api = client;
      state = next;
      _selectDefaults();
      await widgetService.sync(state);
    } catch (_) {
      client.close();
      rethrow;
    }
  }

  String _message(Object error) => error is ApiException
      ? error.message
      : error is FormatException
      ? error.message
      : 'Could not reach the server. Check the address and your connection.';
}

T? first<T>(Iterable<T> items, bool Function(T) test) {
  for (final item in items) {
    if (test(item)) return item;
  }
  return null;
}
