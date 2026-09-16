import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'app_controller.dart';
import 'card_editor.dart';
import 'home_screen.dart';
import 'models.dart';

class BoardView extends StatefulWidget {
  const BoardView({super.key, required this.controller});
  final CoveController controller;
  @override
  State<BoardView> createState() => _BoardViewState();
}

class _BoardViewState extends State<BoardView> {
  String search = '';
  String tagId = '';

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final board = controller.board;
    if (board == null) return _EmptyBoard(controller: controller);
    final columns = controller.boardColumns;
    return Container(
      color: boardColor(board.background),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 16, 24, 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              board.name,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 23,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -1,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Chip(
                            visualDensity: VisualDensity.compact,
                            avatar: Icon(
                              board.visibility == 'public'
                                  ? Icons.public
                                  : board.visibility == 'members'
                                  ? Icons.group_outlined
                                  : Icons.lock_outline,
                              size: 14,
                            ),
                            label: Text(board.visibility),
                          ),
                          if (controller.can('manageWorkspace'))
                            PopupMenuButton<String>(
                              tooltip: 'Board settings',
                              icon: const Icon(Icons.more_horiz),
                              onSelected: (value) =>
                                  _boardAction(context, board, value),
                              itemBuilder: (_) => const [
                                PopupMenuItem(
                                  value: 'rename',
                                  child: Text('Rename board'),
                                ),
                                PopupMenuItem(
                                  value: 'description',
                                  child: Text('Edit description'),
                                ),
                                PopupMenuDivider(),
                                PopupMenuItem(
                                  value: 'delete',
                                  child: Text('Delete board'),
                                ),
                              ],
                            ),
                        ],
                      ),
                      if (board.description.isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 5),
                          child: Text(
                            board.description,
                            style: const TextStyle(color: Color(0xFF7C897B)),
                          ),
                        ),
                    ],
                  ),
                ),
                IconButton.filledTonal(
                  tooltip: 'Add column',
                  onPressed: controller.can('createColumn')
                      ? () => _createColumn(context)
                      : null,
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(28, 0, 24, 12),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    onChanged: (value) => setState(() => search = value),
                    decoration: const InputDecoration(
                      isDense: true,
                      hintText: 'Search cards…',
                      prefixIcon: Icon(Icons.search, size: 19),
                    ),
                  ),
                ),
                const SizedBox(width: 9),
                SizedBox(
                  width: 145,
                  child: DropdownButtonFormField<String>(
                    initialValue: tagId,
                    isExpanded: true,
                    decoration: const InputDecoration(isDense: true),
                    items: [
                      const DropdownMenuItem(
                        value: '',
                        child: Text('All tags'),
                      ),
                      ...controller.state.tags
                          .where(
                            (item) =>
                                item.workspaceId ==
                                controller.activeWorkspaceId,
                          )
                          .map(
                            (item) => DropdownMenuItem(
                              value: item.id,
                              child: Text(
                                item.name,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                          ),
                    ],
                    onChanged: (value) => setState(() => tagId = value ?? ''),
                  ),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: columns.isEmpty
                ? Center(
                    child: FilledButton.icon(
                      onPressed: controller.can('createColumn')
                          ? () => _createColumn(context)
                          : null,
                      icon: const Icon(Icons.add),
                      label: const Text('Create first column'),
                    ),
                  )
                : ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.all(22),
                    itemCount: columns.length * 2 + 2,
                    itemBuilder: (context, index) {
                      if (index == columns.length * 2 + 1) {
                        return SizedBox(
                          width: 205,
                          child: Align(
                            alignment: Alignment.topCenter,
                            child: OutlinedButton.icon(
                              onPressed: controller.can('createColumn')
                                  ? () => _createColumn(context)
                                  : null,
                              icon: const Icon(Icons.add),
                              label: const Text('Add column'),
                            ),
                          ),
                        );
                      }
                      if (index.isEven) {
                        final slot = index ~/ 2;
                        return _ColumnDropTarget(
                          enabled: controller.can('createColumn'),
                          canAccept: (column) =>
                              _canReorderColumn(column, slot, columns),
                          onAccept: (column) =>
                              _reorderColumn(column, slot, columns),
                        );
                      }
                      final columnIndex = index ~/ 2;
                      return _ColumnLane(
                        controller: controller,
                        column: columns[columnIndex],
                        search: search,
                        tagId: tagId,
                        onSettings: (action) => _columnAction(
                          context,
                          columns[columnIndex],
                          action,
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Future<void> _createColumn(BuildContext context) async {
    final name = await promptText(
      context,
      title: 'Add column',
      label: 'Column name',
    );
    if (name == null) return;
    await widget.controller.mutate('createColumn', {
      'boardId': widget.controller.activeBoardId,
      'name': name,
    }, success: 'Column created');
  }

  bool _canReorderColumn(
    BoardColumn column,
    int slot,
    List<BoardColumn> columns,
  ) {
    final source = columns.indexWhere((item) => item.id == column.id);
    return source >= 0 && source != slot && source + 1 != slot;
  }

  Future<void> _reorderColumn(
    BoardColumn column,
    int slot,
    List<BoardColumn> columns,
  ) async {
    final source = columns.indexWhere((item) => item.id == column.id);
    if (source < 0 || source == slot || source + 1 == slot) return;
    final remaining = columns.where((item) => item.id != column.id).toList();
    var insertion = slot;
    if (source < insertion) insertion -= 1;
    insertion = insertion.clamp(0, remaining.length);
    final before = insertion == 0 ? null : remaining[insertion - 1].position;
    final after = insertion == remaining.length
        ? null
        : remaining[insertion].position;
    final position = before == null
        ? (after ?? 0) - 1
        : after == null
        ? before + 1
        : (before + after) / 2;
    await widget.controller.mutate('updateColumn', {
      'id': column.id,
      'position': position,
    }, success: 'Column moved');
  }

  Future<void> _boardAction(
    BuildContext context,
    Board board,
    String action,
  ) async {
    if (action == 'rename') {
      final name = await promptText(
        context,
        title: 'Rename board',
        value: board.name,
      );
      if (name != null) {
        await widget.controller.mutate('updateBoard', {
          'id': board.id,
          'name': name,
        }, success: 'Board renamed');
      }
    } else if (action == 'description') {
      final description = await promptText(
        context,
        title: 'Board description',
        label: 'Description',
        value: board.description,
        maxLines: 4,
      );
      if (description != null) {
        await widget.controller.mutate('updateBoard', {
          'id': board.id,
          'description': description,
        }, success: 'Description saved');
      }
    } else if (action == 'delete' &&
        await confirm(
          context,
          'Delete “${board.name}”?',
          'Cards that appear nowhere else will be archived.',
        )) {
      await widget.controller.mutate('deleteBoard', {
        'id': board.id,
      }, success: 'Board deleted');
    }
  }

  Future<void> _columnAction(
    BuildContext context,
    BoardColumn column,
    String action,
  ) async {
    if (action == 'rename') {
      final name = await promptText(
        context,
        title: 'Rename column',
        value: column.name,
      );
      if (name != null) {
        await widget.controller.mutate('updateColumn', {
          'id': column.id,
          'name': name,
        }, success: 'Column renamed');
      }
    } else if (action == 'limit') {
      final value = await promptText(
        context,
        title: 'Work-in-progress limit',
        label: 'Whole number (blank turns it off)',
        value: column.wipLimit?.toString() ?? '',
      );
      final parsed = value == null || value.isEmpty
          ? null
          : int.tryParse(value);
      if (value != null && value.isNotEmpty && parsed == null) return;
      await widget.controller.mutate('updateColumn', {
        'id': column.id,
        'wipLimit': parsed,
        'limitMode': parsed == null ? 'off' : 'warning',
      }, success: 'Column limit saved');
    } else if (action == 'delete' &&
        await confirm(
          context,
          'Delete “${column.name}”?',
          'The column must be empty first.',
        )) {
      await widget.controller.mutate('deleteColumn', {
        'id': column.id,
      }, success: 'Column deleted');
    }
  }
}

class _ColumnLane extends StatelessWidget {
  const _ColumnLane({
    required this.controller,
    required this.column,
    required this.search,
    required this.tagId,
    required this.onSettings,
  });
  final CoveController controller;
  final BoardColumn column;
  final String search;
  final String tagId;
  final ValueChanged<String> onSettings;

  @override
  Widget build(BuildContext context) {
    final placements =
        controller.state.placements
            .where((item) => item.columnId == column.id)
            .toList()
          ..sort((a, b) => a.position.compareTo(b.position));
    final visible = placements.where((placement) {
      final card = controller.state.card(placement.cardId);
      if (card == null || card.archived) return false;
      if (!card.title.toLowerCase().contains(search.toLowerCase())) {
        return false;
      }
      return tagId.isEmpty ||
          controller.state.cardTags.any(
            (item) => item.cardId == card.id && item.tagId == tagId,
          );
    }).toList();
    final atLimit =
        column.wipLimit != null && placements.length >= column.wipLimit!;
    return DragTarget<Placement>(
      onWillAcceptWithDetails: (details) =>
          controller.can('moveCard') && details.data.columnId != column.id,
      onAcceptWithDetails: (details) => controller.mutate('movePlacement', {
        'placementId': details.data.id,
        'columnId': column.id,
        'version': details.data.version,
      }, success: 'Card moved'),
      builder: (context, candidates, _) => AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        width: 286,
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: candidates.isNotEmpty
              ? const Color(0xFFDDEAD8)
              : Colors.white.withValues(alpha: .20),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(
            color: candidates.isNotEmpty
                ? const Color(0xFF79966F)
                : const Color(0xFFD5C9BC),
            width: candidates.isNotEmpty ? 2 : 1,
          ),
        ),
        child: Column(
          children: [
            Row(
              children: [
                if (controller.can('createColumn'))
                  LongPressDraggable<BoardColumn>(
                    data: column,
                    maxSimultaneousDrags: 1,
                    feedback: Material(
                      color: Colors.transparent,
                      child: Container(
                        width: 250,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(10),
                          boxShadow: const [
                            BoxShadow(blurRadius: 18, color: Color(0x33000000)),
                          ],
                        ),
                        child: Text(
                          column.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ),
                    child: const Tooltip(
                      message: 'Hold and drag to reorder column',
                      child: Padding(
                        padding: EdgeInsets.only(right: 5),
                        child: Icon(
                          Icons.drag_indicator,
                          size: 20,
                          color: Color(0xFF849181),
                        ),
                      ),
                    ),
                  ),
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: parseColor(column.color),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    column.name,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(
                  column.wipLimit == null
                      ? '${placements.length}'
                      : '${placements.length} / ${column.wipLimit}',
                  style: TextStyle(
                    fontSize: 11,
                    color: atLimit ? Colors.deepOrange : Colors.grey.shade600,
                  ),
                ),
                if (controller.can('createColumn'))
                  PopupMenuButton<String>(
                    icon: const Icon(Icons.more_horiz, size: 19),
                    onSelected: onSettings,
                    itemBuilder: (_) => const [
                      PopupMenuItem(value: 'rename', child: Text('Rename')),
                      PopupMenuItem(
                        value: 'limit',
                        child: Text('Set WIP limit'),
                      ),
                      PopupMenuItem(value: 'delete', child: Text('Delete')),
                    ],
                  ),
              ],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: ListView.builder(
                itemCount: visible.length,
                itemBuilder: (context, index) {
                  final placement = visible[index],
                      card = controller.state.card(placement.cardId)!;
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 9),
                    child: LongPressDraggable<Placement>(
                      maxSimultaneousDrags: controller.can('moveCard') ? 1 : 0,
                      data: placement,
                      feedback: Material(
                        color: Colors.transparent,
                        child: SizedBox(
                          width: 270,
                          child: _CardTile(
                            controller: controller,
                            card: card,
                            placement: placement,
                          ),
                        ),
                      ),
                      childWhenDragging: Opacity(
                        opacity: .35,
                        child: _CardTile(
                          controller: controller,
                          card: card,
                          placement: placement,
                        ),
                      ),
                      child: _CardTile(
                        controller: controller,
                        card: card,
                        placement: placement,
                      ),
                    ),
                  );
                },
              ),
            ),
            TextButton.icon(
              onPressed: controller.can('createCard')
                  ? () => createCard(context, controller, columnId: column.id)
                  : null,
              icon: const Icon(Icons.add, size: 18),
              label: const Text('Add a card'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ColumnDropTarget extends StatelessWidget {
  const _ColumnDropTarget({
    required this.enabled,
    required this.canAccept,
    required this.onAccept,
  });

  final bool enabled;
  final bool Function(BoardColumn) canAccept;
  final ValueChanged<BoardColumn> onAccept;

  @override
  Widget build(BuildContext context) => DragTarget<BoardColumn>(
    onWillAcceptWithDetails: (details) => enabled && canAccept(details.data),
    onAcceptWithDetails: (details) => onAccept(details.data),
    builder: (context, candidates, _) => AnimatedContainer(
      duration: const Duration(milliseconds: 140),
      width: candidates.isEmpty ? 15 : 34,
      margin: const EdgeInsets.symmetric(vertical: 5),
      decoration: BoxDecoration(
        color: candidates.isEmpty
            ? Colors.transparent
            : const Color(0x4479966F),
        borderRadius: BorderRadius.circular(8),
        border: candidates.isEmpty
            ? null
            : Border.all(color: const Color(0xFF79966F), width: 2),
      ),
    ),
  );
}

class _CardTile extends StatelessWidget {
  const _CardTile({
    required this.controller,
    required this.card,
    required this.placement,
  });
  final CoveController controller;
  final CoveCard card;
  final Placement placement;
  @override
  Widget build(BuildContext context) {
    final tags = controller.state.tags
        .where(
          (tag) => controller.state.cardTags.any(
            (link) => link.cardId == card.id && link.tagId == tag.id,
          ),
        )
        .toList();
    final inTray = controller.state.tray.any(
      (item) => item.placementId == placement.id,
    );
    return Card(
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: () => showCardEditor(context, controller, card.id, placement.id),
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (tags.isNotEmpty)
                Wrap(
                  spacing: 5,
                  runSpacing: 4,
                  children: tags
                      .map(
                        (tag) => Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: parseColor(tag.color).withValues(alpha: .25),
                            borderRadius: BorderRadius.circular(5),
                          ),
                          child: Text(
                            tag.name,
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      )
                      .toList(),
                ),
              if (tags.isNotEmpty) const SizedBox(height: 9),
              Text(
                card.title,
                style: const TextStyle(
                  fontWeight: FontWeight.w600,
                  height: 1.35,
                ),
              ),
              if (card.description.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text(
                    card.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      height: 1.4,
                      color: Colors.grey.shade600,
                    ),
                  ),
                ),
              const SizedBox(height: 9),
              Row(
                children: [
                  if (card.dueDate != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 7,
                        vertical: 4,
                      ),
                      decoration: BoxDecoration(
                        color: const Color(0xFFF2E5D6),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today_outlined, size: 11),
                          const SizedBox(width: 4),
                          Text(
                            _date(card),
                            style: const TextStyle(fontSize: 9),
                          ),
                        ],
                      ),
                    ),
                  const Spacer(),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    tooltip: inTray ? 'In tray' : 'Add to tray',
                    onPressed: inTray
                        ? null
                        : controller.can('moveCard')
                        ? () => controller.mutate('addToTray', {
                            'placementId': placement.id,
                            'mode': 'move',
                          }, success: 'Card added to tray')
                        : null,
                    icon: Icon(
                      inTray ? Icons.inventory_2 : Icons.inventory_2_outlined,
                      size: 18,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _date(CoveCard card) {
    if (card.start != null) {
      return DateFormat('MMM d, h:mm a').format(card.start!.toLocal());
    }
    final value = DateTime.tryParse('${card.dueDate}T12:00:00');
    return value == null ? card.dueDate! : DateFormat('MMM d').format(value);
  }
}

class _EmptyBoard extends StatelessWidget {
  const _EmptyBoard({required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(30),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(
            Icons.view_kanban_outlined,
            size: 58,
            color: Color(0xFF6E8968),
          ),
          const SizedBox(height: 18),
          Text(
            controller.state.workspaces.isEmpty
                ? 'Create your first workspace.'
                : 'A fresh space for your ideas.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 18),
          FilledButton.icon(
            onPressed:
                (controller.state.workspaces.isEmpty
                    ? controller.isAdmin
                    : controller.can('createBoard'))
                ? () => controller.state.workspaces.isEmpty
                      ? createWorkspace(context, controller)
                      : createBoard(context, controller)
                : null,
            icon: const Icon(Icons.add),
            label: Text(
              controller.state.workspaces.isEmpty
                  ? 'Create workspace'
                  : 'Create board',
            ),
          ),
        ],
      ),
    ),
  );
}

Color boardColor(String value) =>
    parseColor(value, fallback: const Color(0xFFE8EEE8));
Color parseColor(String value, {Color fallback = const Color(0xFF8A9B87)}) {
  final hex = value.replaceFirst('#', '');
  if (hex.length == 6 || hex.length == 8) {
    final parsed = int.tryParse(hex, radix: 16);
    if (parsed != null) {
      return Color((hex.length == 6 ? 0xFF000000 : 0) | parsed);
    }
  }
  return fallback;
}
