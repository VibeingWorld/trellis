import 'dart:io';

import 'package:home_widget/home_widget.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'models.dart';

class CoveWidgetSelection {
  const CoveWidgetSelection({required this.boardId, required this.columnId});
  final String boardId;
  final String columnId;
}

class CoveWidgetService {
  static const _boardKey = 'cove.widget.board';
  static const _columnKey = 'cove.widget.column';
  static const androidProvider = 'CoveColumnWidgetProvider';

  Future<CoveWidgetSelection?> selection() async {
    final prefs = await SharedPreferences.getInstance();
    final boardId = prefs.getString(_boardKey);
    final columnId = prefs.getString(_columnKey);
    if (boardId == null || columnId == null) return null;
    return CoveWidgetSelection(boardId: boardId, columnId: columnId);
  }

  Future<void> choose(AppState state, String boardId, String columnId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_boardKey, boardId);
    await prefs.setString(_columnKey, columnId);
    await sync(state);
  }

  Future<void> sync(AppState state) async {
    if (!Platform.isAndroid) return;
    final chosen = await selection();
    if (chosen == null) return;
    final board = state.board(chosen.boardId);
    final column = state.column(chosen.columnId);
    if (board == null || column == null || column.boardId != board.id) return;
    final cards =
        state.placements.where((item) => item.columnId == column.id).toList()
          ..sort((a, b) => a.position.compareTo(b.position));
    final visible = cards
        .map((item) => state.card(item.cardId))
        .whereType<CoveCard>()
        .where((item) => !item.archived)
        .toList();
    final body = visible.isEmpty
        ? 'Nothing here yet'
        : visible
              .take(7)
              .map(
                (item) =>
                    '${item.cardNumber > 0 ? '#${item.cardNumber}  ' : ''}${item.title}',
              )
              .join('\n');
    await Future.wait([
      HomeWidget.saveWidgetData<String>('board_name', board.name),
      HomeWidget.saveWidgetData<String>('column_name', column.name),
      HomeWidget.saveWidgetData<String>('card_count', '${visible.length}'),
      HomeWidget.saveWidgetData<String>('card_list', body),
      HomeWidget.saveWidgetData<String>('board_id', board.id),
      HomeWidget.saveWidgetData<String>('column_id', column.id),
    ]);
    await HomeWidget.updateWidget(name: androidProvider);
  }
}
