import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'card_editor.dart';
import 'models.dart';

class TrayView extends StatelessWidget {
  const TrayView({super.key, required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) {
    final items = controller.workspaceTray;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 18, 16, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.inventory_2_outlined,
                    color: Color(0xFF667B5F),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'Card tray',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800),
                  ),
                  const Spacer(),
                  Chip(label: Text('${items.length}')),
                ],
              ),
              const SizedBox(height: 7),
              const Text(
                'A pocket for cards on the move. Choose move or link, then place one on any board.',
                style: TextStyle(
                  fontSize: 12,
                  height: 1.45,
                  color: Color(0xFF897E73),
                ),
              ),
            ],
          ),
        ),
        Expanded(
          child: items.isEmpty
              ? const _EmptyTray()
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: items.length,
                  itemBuilder: (context, index) =>
                      _TrayCard(controller: controller, item: items[index]),
                ),
        ),
      ],
    );
  }
}

class _EmptyTray extends StatelessWidget {
  const _EmptyTray();
  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(28),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 74,
            height: 74,
            decoration: BoxDecoration(
              color: const Color(0xFFEAF0E4),
              borderRadius: BorderRadius.circular(20),
            ),
            child: const Icon(
              Icons.move_to_inbox_outlined,
              size: 36,
              color: Color(0xFF819778),
            ),
          ),
          const SizedBox(height: 17),
          const Text(
            'Good ideas travel.',
            style: TextStyle(fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 7),
          const Text(
            'Use the tray icon on a card to collect it here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
          ),
        ],
      ),
    ),
  );
}

class _TrayCard extends StatefulWidget {
  const _TrayCard({required this.controller, required this.item});
  final CoveController controller;
  final TrayItem item;
  @override
  State<_TrayCard> createState() => _TrayCardState();
}

class _TrayCardState extends State<_TrayCard> {
  String? boardId;
  String? columnId;

  @override
  Widget build(BuildContext context) {
    final state = widget.controller.state;
    final placement = state.placement(widget.item.placementId);
    final card = placement == null ? null : state.card(placement.cardId);
    final source = placement == null ? null : state.board(placement.boardId);
    boardId ??= widget.controller.activeBoardId.isNotEmpty
        ? widget.controller.activeBoardId
        : widget.controller.workspaceBoards.firstOrNull?.id;
    var columns = state.columns
        .where((item) => item.boardId == boardId)
        .toList();
    columnId = columns.any((item) => item.id == columnId)
        ? columnId
        : columns.firstOrNull?.id;
    if (placement == null || card == null) {
      return Card(
        child: ListTile(
          title: const Text('Unavailable card'),
          trailing: IconButton(
            onPressed: _remove,
            icon: const Icon(Icons.close),
          ),
        ),
      );
    }
    final content = Card(
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                const Icon(Icons.view_kanban_outlined, size: 13),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    source?.name ?? 'Unknown board',
                    style: const TextStyle(fontSize: 10, color: Colors.grey),
                  ),
                ),
                IconButton(
                  visualDensity: VisualDensity.compact,
                  tooltip: 'Remove from tray',
                  onPressed: _remove,
                  icon: const Icon(Icons.close, size: 17),
                ),
              ],
            ),
            InkWell(
              onTap: () => showCardEditor(
                context,
                widget.controller,
                card.id,
                placement.id,
              ),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 7),
                child: Text(
                  card.title,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
              ),
            ),
            const SizedBox(height: 8),
            SegmentedButton<String>(
              segments: const [
                ButtonSegment(
                  value: 'move',
                  icon: Icon(Icons.arrow_forward, size: 15),
                  label: Text('Move'),
                ),
                ButtonSegment(
                  value: 'link',
                  icon: Icon(Icons.link, size: 15),
                  label: Text('Link'),
                ),
              ],
              selected: {widget.item.mode},
              onSelectionChanged: (value) => widget.controller.mutate(
                'updateTray',
                {'id': widget.item.id, 'mode': value.first},
              ),
            ),
            const SizedBox(height: 11),
            DropdownButtonFormField<String>(
              initialValue: boardId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Destination board',
                isDense: true,
              ),
              items: widget.controller.workspaceBoards
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.id,
                      child: Text(item.name, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() {
                boardId = value;
                columnId = null;
              }),
            ),
            const SizedBox(height: 8),
            DropdownButtonFormField<String>(
              key: ValueKey(boardId),
              initialValue: columnId,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Column',
                isDense: true,
              ),
              items: columns
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.id,
                      child: Text(item.name, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (value) => setState(() => columnId = value),
            ),
            const SizedBox(height: 10),
            FilledButton.icon(
              onPressed: columnId == null
                  ? null
                  : () => widget.controller.mutate(
                      'dropTray',
                      {
                        'id': widget.item.id,
                        'columnId': columnId,
                        'mode': widget.item.mode,
                      },
                      success: widget.item.mode == 'link'
                          ? 'Card linked'
                          : 'Card moved',
                    ),
              icon: Icon(
                widget.item.mode == 'link' ? Icons.link : Icons.arrow_forward,
              ),
              label: Text(
                widget.item.mode == 'link'
                    ? 'Link to column'
                    : 'Move to column',
              ),
            ),
          ],
        ),
      ),
    );
    return LongPressDraggable<Placement>(
      data: placement,
      feedback: Material(
        color: Colors.transparent,
        child: SizedBox(width: 260, child: content),
      ),
      childWhenDragging: Opacity(opacity: .35, child: content),
      child: content,
    );
  }

  Future<void> _remove() async {
    await widget.controller.mutate('removeFromTray', {
      'id': widget.item.id,
    }, success: 'Removed from tray');
    if (mounted) setState(() {});
  }
}
