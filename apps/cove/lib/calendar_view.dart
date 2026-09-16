import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_controller.dart';
import 'card_editor.dart';
import 'models.dart';

enum CalendarMode { month, week, workweek, day }

class CalendarView extends StatefulWidget {
  const CalendarView({super.key, required this.controller});
  final CoveController controller;
  @override
  State<CalendarView> createState() => _CalendarViewState();
}

class _CalendarViewState extends State<CalendarView> {
  CalendarMode mode = CalendarMode.month;
  DateTime anchor = DateTime.now();
  GoogleStatus? google;

  List<CoveCard> get cards => widget.controller.state.cards
      .where(
        (item) =>
            item.workspaceId == widget.controller.activeWorkspaceId &&
            !item.archived &&
            (item.dueDate != null || item.scheduledStart != null),
      )
      .toList();

  @override
  void initState() {
    super.initState();
    _loadGoogle();
  }

  @override
  void didUpdateWidget(covariant CalendarView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller.activeWorkspaceId !=
        widget.controller.activeWorkspaceId) {
      _loadGoogle();
    }
  }

  Future<void> _loadGoogle() async {
    final status = await widget.controller.googleStatus();
    if (mounted) setState(() => google = status);
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(14, 14, 14, 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Plan work in time.',
                        style: TextStyle(
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      Text(
                        '${cards.length} scheduled',
                        style: const TextStyle(
                          fontSize: 11,
                          color: Colors.grey,
                        ),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'Calendar options',
                  onSelected: _calendarAction,
                  itemBuilder: (_) => [
                    PopupMenuItem(
                      value: 'google',
                      child: Text(
                        google?.connected == true
                            ? 'Open Google Calendar'
                            : 'Connect Google Calendar',
                      ),
                    ),
                    const PopupMenuItem(
                      value: 'ics',
                      child: Text('Open ICS feed'),
                    ),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 10),
            SegmentedButton<CalendarMode>(
              showSelectedIcon: false,
              segments: const [
                ButtonSegment(value: CalendarMode.month, label: Text('Month')),
                ButtonSegment(value: CalendarMode.week, label: Text('Week')),
                ButtonSegment(
                  value: CalendarMode.workweek,
                  label: Text('5 days'),
                ),
                ButtonSegment(value: CalendarMode.day, label: Text('Day')),
              ],
              selected: {mode},
              onSelectionChanged: (value) => setState(() => mode = value.first),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  onPressed: () => _shift(-1),
                  icon: const Icon(Icons.chevron_left),
                ),
                Expanded(
                  child: Text(
                    _label(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontWeight: FontWeight.w800),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => anchor = DateTime.now()),
                  child: const Text('Today'),
                ),
                IconButton(
                  onPressed: () => _shift(1),
                  icon: const Icon(Icons.chevron_right),
                ),
              ],
            ),
          ],
        ),
      ),
      const Divider(height: 1),
      Expanded(child: mode == CalendarMode.month ? _month() : _timeline()),
    ],
  );

  Widget _month() {
    final first = DateTime(anchor.year, anchor.month, 1);
    final start = first.subtract(
      Duration(days: (first.weekday - DateTime.monday) % 7),
    );
    final days = List.generate(42, (index) => start.add(Duration(days: index)));
    return LayoutBuilder(
      builder: (context, constraints) => Column(
        children: [
          SizedBox(
            height: 28,
            child: Row(
              children: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
                  .map(
                    (item) => Expanded(
                      child: Center(
                        child: Text(
                          item,
                          style: const TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            color: Colors.grey,
                          ),
                        ),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
          Expanded(
            child: GridView.builder(
              padding: const EdgeInsets.all(5),
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                childAspectRatio: .76,
              ),
              itemCount: days.length,
              itemBuilder: (context, index) {
                final day = days[index],
                    dayCards = cards
                        .where((card) => _cardDay(card) == _key(day))
                        .toList();
                return DragTarget<Placement>(
                  onAcceptWithDetails: (details) =>
                      _schedulePlacement(details.data, day, null),
                  builder: (context, candidates, _) => InkWell(
                    onTap: () => _schedulePicker(day, null),
                    child: Container(
                      margin: const EdgeInsets.all(1),
                      padding: const EdgeInsets.all(3),
                      decoration: BoxDecoration(
                        color: candidates.isNotEmpty
                            ? const Color(0xFFE6D4C0)
                            : day.month == anchor.month
                            ? const Color(0xFFFFFBF6)
                            : const Color(0xFFF2EBE3),
                        border: Border.all(
                          color: _sameDay(day, DateTime.now())
                              ? const Color(0xFFA37A58)
                              : const Color(0xFFE5D8CA),
                          width: _sameDay(day, DateTime.now()) ? 2 : 1,
                        ),
                        borderRadius: BorderRadius.circular(5),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${day.day}',
                            style: const TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Expanded(
                            child: ListView(
                              padding: EdgeInsets.zero,
                              children: dayCards
                                  .take(4)
                                  .map(
                                    (card) => InkWell(
                                      onTap: () => _openCard(card),
                                      onLongPress: () => _unschedule(card),
                                      child: Container(
                                        margin: const EdgeInsets.only(
                                          bottom: 2,
                                        ),
                                        padding: const EdgeInsets.all(3),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFE9D9C7),
                                          borderRadius: BorderRadius.circular(
                                            3,
                                          ),
                                        ),
                                        child: Text(
                                          '${card.start == null ? '' : '${DateFormat('h:mm').format(card.start!.toLocal())} '}${card.title}',
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(fontSize: 7),
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _timeline() {
    final start = mode == CalendarMode.day
        ? DateTime(anchor.year, anchor.month, anchor.day)
        : _monday(anchor);
    final count = mode == CalendarMode.day
        ? 1
        : mode == CalendarMode.workweek
        ? 5
        : 7;
    final days = List.generate(
      count,
      (index) => start.add(Duration(days: index)),
    );
    return LayoutBuilder(
      builder: (context, constraints) {
        final contentWidth = count == 1
            ? constraints.maxWidth.clamp(320, 680).toDouble()
            : 52 + count * 120.0;
        return SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: SizedBox(
            width: contentWidth,
            height: constraints.maxHeight,
            child: Column(
              children: [
                SizedBox(
                  height: 54,
                  child: Row(
                    children: [
                      const SizedBox(
                        width: 52,
                        child: Center(
                          child: Text(
                            'Local',
                            style: TextStyle(fontSize: 9, color: Colors.grey),
                          ),
                        ),
                      ),
                      for (final day in days)
                        Expanded(
                          child: InkWell(
                            onTap: () => _schedulePicker(day, null),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(
                                  DateFormat('EEE').format(day).toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 9,
                                    color: Colors.grey,
                                  ),
                                ),
                                Text(
                                  '${day.day}',
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const Divider(height: 1),
                Expanded(
                  child: ListView.builder(
                    itemCount: 24,
                    itemExtent: 48,
                    itemBuilder: (context, hour) => Row(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        SizedBox(
                          width: 52,
                          child: Padding(
                            padding: const EdgeInsets.only(top: 4, right: 5),
                            child: Text(
                              DateFormat(
                                'ha',
                              ).format(DateTime(2000, 1, 1, hour)),
                              textAlign: TextAlign.right,
                              style: const TextStyle(
                                fontSize: 8,
                                color: Colors.grey,
                              ),
                            ),
                          ),
                        ),
                        for (final day in days) _hourCell(day, hour),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _hourCell(DateTime day, int hour) {
    final hourCards = cards.where((card) {
      final date = card.start?.toLocal();
      return date != null && _sameDay(date, day) && date.hour == hour;
    }).toList();
    return Expanded(
      child: DragTarget<Placement>(
        onAcceptWithDetails: (details) =>
            _schedulePlacement(details.data, day, hour),
        builder: (context, candidates, _) => InkWell(
          onTap: () => _schedulePicker(day, hour),
          child: Container(
            padding: const EdgeInsets.all(2),
            decoration: BoxDecoration(
              color: candidates.isNotEmpty
                  ? const Color(0xFFE6D4C0)
                  : const Color(0xFFFFFBF6),
              border: const Border(
                left: BorderSide(color: Color(0xFFE7DBCE)),
                bottom: BorderSide(color: Color(0xFFE7DBCE)),
              ),
            ),
            child: Column(
              children: [
                for (final card in hourCards)
                  Expanded(
                    child: InkWell(
                      onTap: () => _openCard(card),
                      onLongPress: () => _unschedule(card),
                      child: Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(4),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE3CFB8),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          '${DateFormat('h:mm a').format(card.start!.toLocal())} ${card.title}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 8,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _schedulePicker(DateTime day, int? hour) async {
    final available = widget.controller.state.cards
        .where(
          (item) =>
              item.workspaceId == widget.controller.activeWorkspaceId &&
              !item.archived,
        )
        .toList();
    if (available.isEmpty) return;
    var selected = available.first.id;
    final id = await showDialog<String>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, update) => AlertDialog(
          title: Text(
            hour == null
                ? 'Schedule all day'
                : 'Schedule at ${DateFormat('h a').format(DateTime(2000, 1, 1, hour))}',
          ),
          content: DropdownButtonFormField<String>(
            initialValue: selected,
            isExpanded: true,
            items: available
                .map(
                  (card) => DropdownMenuItem(
                    value: card.id,
                    child: Text(card.title, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: (value) => update(() => selected = value ?? selected),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, selected),
              child: const Text('Schedule'),
            ),
          ],
        ),
      ),
    );
    if (id == null) return;
    final placement = widget.controller.state.placements
        .where((item) => item.cardId == id)
        .firstOrNull;
    if (placement != null) await _schedulePlacement(placement, day, hour);
  }

  Future<void> _schedulePlacement(
    Placement placement,
    DateTime day,
    int? hour,
  ) async {
    final card = widget.controller.state.card(placement.cardId);
    if (card == null) return;
    final values = <String, dynamic>{
      'id': card.id,
      'version': card.version,
      'dueDate': DateFormat('yyyy-MM-dd').format(day),
    };
    if (hour == null) {
      values.addAll({'scheduledStart': null, 'scheduledEnd': null});
    } else {
      final start = DateTime(day.year, day.month, day.day, hour),
          end = start.add(const Duration(hours: 1));
      values.addAll({
        'scheduledStart': start.toUtc().toIso8601String(),
        'scheduledEnd': end.toUtc().toIso8601String(),
      });
    }
    await widget.controller.mutate(
      'updateCard',
      values,
      success: 'Card scheduled',
    );
    if (mounted) setState(() {});
  }

  Future<void> _unschedule(CoveCard card) async {
    await widget.controller.mutate('updateCard', {
      'id': card.id,
      'version': card.version,
      'dueDate': null,
      'scheduledStart': null,
      'scheduledEnd': null,
    }, success: 'Removed from calendar');
    if (mounted) setState(() {});
  }

  void _openCard(CoveCard card) {
    final placement = widget.controller.state.placements
        .where((item) => item.cardId == card.id)
        .firstOrNull;
    if (placement != null) {
      showCardEditor(context, widget.controller, card.id, placement.id);
    }
  }

  void _shift(int direction) => setState(() {
    if (mode == CalendarMode.month) {
      anchor = DateTime(anchor.year, anchor.month + direction, 1);
    } else {
      anchor = anchor.add(
        Duration(days: direction * (mode == CalendarMode.day ? 1 : 7)),
      );
    }
  });
  String _label() {
    if (mode == CalendarMode.month) return DateFormat('MMMM y').format(anchor);
    if (mode == CalendarMode.day) {
      return DateFormat('EEE, MMM d, y').format(anchor);
    }
    final start = _monday(anchor),
        end = start.add(Duration(days: mode == CalendarMode.workweek ? 4 : 6));
    return '${DateFormat('MMM d').format(start)} – ${DateFormat('MMM d, y').format(end)}';
  }

  DateTime _monday(DateTime value) => DateTime(
    value.year,
    value.month,
    value.day,
  ).subtract(Duration(days: value.weekday - 1));
  String _key(DateTime value) => DateFormat('yyyy-MM-dd').format(value);
  String _cardDay(CoveCard card) =>
      card.start == null ? card.dueDate ?? '' : _key(card.start!.toLocal());
  bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;

  Future<void> _calendarAction(String action) async {
    if (action == 'ics') {
      final uri = widget.controller.resolve(
        '/api/calendar.ics?workspaceId=${Uri.encodeQueryComponent(widget.controller.activeWorkspaceId)}',
      );
      if (uri != null) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    }
    if (action == 'google') {
      final path = google?.connected == true
          ? 'https://calendar.google.com/calendar/u/0/r'
          : widget.controller
                .resolve(
                  '/api/calendar/google/connect?workspaceId=${Uri.encodeQueryComponent(widget.controller.activeWorkspaceId)}',
                )
                .toString();
      await launchUrl(Uri.parse(path), mode: LaunchMode.externalApplication);
    }
  }
}
