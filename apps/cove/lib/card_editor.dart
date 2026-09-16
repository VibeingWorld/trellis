import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'app_controller.dart';
import 'board_view.dart';
import 'home_screen.dart';
import 'models.dart';

Future<void> showCardEditor(
  BuildContext context,
  CoveController controller,
  String cardId,
  String placementId,
) async {
  final content = _CardEditor(
    controller: controller,
    cardId: cardId,
    placementId: placementId,
  );
  if (MediaQuery.sizeOf(context).width < 760) {
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: const Color(0xFFFFFAF4),
      builder: (_) => FractionallySizedBox(heightFactor: .94, child: content),
    );
  } else {
    await showDialog(
      context: context,
      builder: (_) => Dialog(
        backgroundColor: const Color(0xFFFFFAF4),
        insetPadding: const EdgeInsets.all(26),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 780, maxHeight: 820),
          child: content,
        ),
      ),
    );
  }
}

class _CardEditor extends StatefulWidget {
  const _CardEditor({
    required this.controller,
    required this.cardId,
    required this.placementId,
  });
  final CoveController controller;
  final String cardId;
  final String placementId;
  @override
  State<_CardEditor> createState() => _CardEditorState();
}

class _CardEditorState extends State<_CardEditor> {
  late final TextEditingController title;
  late final TextEditingController description;
  DateTime? day;
  TimeOfDay? startTime;
  TimeOfDay? endTime;
  bool allDay = true;

  CoveCard get card => widget.controller.state.card(widget.cardId)!;
  Placement? get placement =>
      widget.controller.state.placement(widget.placementId);

  @override
  void initState() {
    super.initState();
    final item = card;
    title = TextEditingController(text: item.title);
    description = TextEditingController(text: item.description);
    final start = item.start?.toLocal();
    day =
        start ??
        (item.dueDate == null
            ? null
            : DateTime.tryParse('${item.dueDate}T12:00:00'));
    allDay = start == null;
    if (start != null) {
      startTime = TimeOfDay.fromDateTime(start);
      final end = item.end?.toLocal() ?? start.add(const Duration(hours: 1));
      endTime = TimeOfDay.fromDateTime(end);
    }
  }

  @override
  void dispose() {
    title.dispose();
    description.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.controller.state.card(widget.cardId) == null) {
      return const Center(child: Text('This card is no longer available.'));
    }
    final state = widget.controller.state;
    final tags = state.tags
        .where((item) => item.workspaceId == card.workspaceId)
        .toList();
    final links = state.links.where((item) => item.cardId == card.id).toList();
    final attachments = state.attachments
        .where((item) => item.cardId == card.id)
        .toList();
    final relations = state.relations
        .where(
          (item) => item.cardId == card.id || item.relatedCardId == card.id,
        )
        .toList();
    final integration = state.integration(card.workspaceId);
    final githubLink = state.githubLink(card.id);
    final aiRun = state.aiRun(card.id);
    final canEdit = widget.controller.can('editCard', card.workspaceId);
    final canUpload = widget.controller.can('uploadFiles', card.workspaceId);
    final canMove = widget.controller.can('moveCard', card.workspaceId);
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 13, 10, 10),
          child: Row(
            children: [
              const Icon(Icons.credit_card, size: 19),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  card.cardNumber > 0
                      ? 'Card #${card.cardNumber}'
                      : 'Card details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                ),
              ),
              if (widget.controller.busy)
                const Padding(
                  padding: EdgeInsets.only(right: 8),
                  child: SizedBox.square(
                    dimension: 17,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  ),
                ),
              IconButton(
                tooltip: 'Close',
                onPressed: () => Navigator.pop(context),
                icon: const Icon(Icons.close),
              ),
            ],
          ),
        ),
        const Divider(height: 1),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(20),
            children: [
              TextField(
                controller: title,
                style: const TextStyle(
                  fontSize: 21,
                  fontWeight: FontWeight.w800,
                ),
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: description,
                minLines: 4,
                maxLines: 10,
                decoration: const InputDecoration(
                  labelText: 'Description',
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 22),
              _Section(
                title: 'Schedule',
                icon: Icons.calendar_month_outlined,
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: _pickDay,
                            icon: const Icon(Icons.event),
                            label: Text(
                              day == null
                                  ? 'Choose date'
                                  : DateFormat('EEE, MMM d, y').format(day!),
                            ),
                          ),
                        ),
                        if (day != null)
                          IconButton(
                            tooltip: 'Clear schedule',
                            onPressed: () => setState(() {
                              day = null;
                              startTime = null;
                              endTime = null;
                            }),
                            icon: const Icon(Icons.close),
                          ),
                      ],
                    ),
                    if (day != null) ...[
                      SwitchListTile(
                        contentPadding: EdgeInsets.zero,
                        value: allDay,
                        title: const Text('All-day task'),
                        onChanged: (value) => setState(() {
                          allDay = value;
                          if (!value) {
                            startTime ??= const TimeOfDay(hour: 9, minute: 0);
                            endTime ??= const TimeOfDay(hour: 10, minute: 0);
                          }
                        }),
                      ),
                      if (!allDay)
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _pickTime(true),
                                icon: const Icon(Icons.schedule),
                                label: Text(
                                  startTime?.format(context) ?? 'Start time',
                                ),
                              ),
                            ),
                            const SizedBox(width: 9),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () => _pickTime(false),
                                icon: const Icon(Icons.schedule),
                                label: Text(
                                  endTime?.format(context) ?? 'End time',
                                ),
                              ),
                            ),
                          ],
                        ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _Section(
                title: 'GitHub & AI',
                icon: Icons.hub_outlined,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (githubLink != null)
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.bug_report_outlined),
                        title: Text(
                          '#${githubLink.issueNumber} · ${githubLink.issueTitle}',
                        ),
                        subtitle: Text(
                          githubLink.projectItemId == null
                              ? 'Linked GitHub issue'
                              : 'Linked issue · Added to project',
                        ),
                        onTap: () => launchUrl(
                          Uri.parse(githubLink.issueUrl),
                          mode: LaunchMode.externalApplication,
                        ),
                        trailing: canEdit
                            ? IconButton(
                                tooltip: 'Unlink issue',
                                onPressed: _unlinkGithubIssue,
                                icon: const Icon(Icons.link_off),
                              )
                            : null,
                      )
                    else if (integration?.githubConfigured == true)
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          FilledButton.icon(
                            onPressed: canEdit ? _createGithubIssue : null,
                            icon: const Icon(Icons.add_task),
                            label: const Text('Create GitHub issue'),
                          ),
                          OutlinedButton.icon(
                            onPressed: canEdit ? _linkGithubIssue : null,
                            icon: const Icon(Icons.link),
                            label: const Text('Link existing issue'),
                          ),
                        ],
                      )
                    else
                      const Text(
                        'GitHub is not configured for this workspace.',
                        style: TextStyle(color: Colors.grey),
                      ),
                    if (aiRun != null) ...[
                      const Divider(height: 24),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          aiRun.status == 'failed'
                              ? Icons.error_outline
                              : aiRun.status == 'running'
                              ? Icons.auto_awesome
                              : Icons.check_circle_outline,
                        ),
                        title: Text('AI run · ${aiRun.status}'),
                        subtitle: Text(
                          aiRun.error ??
                              (aiRun.sessionId == null
                                  ? 'The coding agent was triggered.'
                                  : 'Session ${aiRun.sessionId}'),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 18),
              _Section(
                title: 'Tags',
                icon: Icons.sell_outlined,
                trailing: IconButton(
                  tooltip: 'Create tag',
                  onPressed: canEdit ? _createTag : null,
                  icon: const Icon(Icons.add),
                ),
                child: tags.isEmpty
                    ? const Text(
                        'No tags yet.',
                        style: TextStyle(color: Colors.grey),
                      )
                    : Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: tags.map((tag) {
                          final selected = state.cardTags.any(
                            (item) =>
                                item.cardId == card.id && item.tagId == tag.id,
                          );
                          return FilterChip(
                            selected: selected,
                            label: Text(tag.name),
                            avatar: CircleAvatar(
                              backgroundColor: parseColor(tag.color),
                            ),
                            onSelected: canEdit
                                ? (_) async {
                                    await widget.controller.mutate(
                                      'toggleTag',
                                      {'cardId': card.id, 'tagId': tag.id},
                                    );
                                    if (mounted) setState(() {});
                                  }
                                : null,
                          );
                        }).toList(),
                      ),
              ),
              const SizedBox(height: 18),
              _Section(
                title: 'Links',
                icon: Icons.link,
                trailing: IconButton(
                  tooltip: 'Add link',
                  onPressed: canEdit ? _addLink : null,
                  icon: const Icon(Icons.add),
                ),
                child: links.isEmpty
                    ? const Text(
                        'No links attached.',
                        style: TextStyle(color: Colors.grey),
                      )
                    : Column(
                        children: links
                            .map(
                              (link) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: const Icon(
                                  Icons.open_in_new,
                                  size: 18,
                                ),
                                title: Text(link.title),
                                subtitle: Text(
                                  link.url,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                onTap: () => launchUrl(
                                  Uri.parse(link.url),
                                  mode: LaunchMode.externalApplication,
                                ),
                                trailing: canEdit
                                    ? IconButton(
                                        tooltip: 'Delete link',
                                        onPressed: () async {
                                          await widget.controller.mutate(
                                            'deleteLink',
                                            {'id': link.id},
                                            success: 'Link removed',
                                          );
                                          if (mounted) setState(() {});
                                        },
                                        icon: const Icon(Icons.delete_outline),
                                      )
                                    : null,
                              ),
                            )
                            .toList(),
                      ),
              ),
              const SizedBox(height: 18),
              _Section(
                title: 'Attachments',
                icon: Icons.attach_file,
                trailing: IconButton(
                  tooltip: 'Upload attachment',
                  onPressed: canUpload ? _upload : null,
                  icon: const Icon(Icons.add),
                ),
                child: attachments.isEmpty
                    ? const Text(
                        'Images and PDFs can be attached here.',
                        style: TextStyle(color: Colors.grey),
                      )
                    : Column(
                        children: attachments
                            .map(
                              (attachment) => ListTile(
                                contentPadding: EdgeInsets.zero,
                                leading: Icon(
                                  attachment.mimeType == 'application/pdf'
                                      ? Icons.picture_as_pdf_outlined
                                      : Icons.image_outlined,
                                ),
                                title: Text(attachment.name),
                                subtitle: Text(_size(attachment.size)),
                                onTap: () {
                                  final uri = widget.controller.resolve(
                                    attachment.url,
                                  );
                                  if (uri != null) {
                                    launchUrl(
                                      uri,
                                      mode: LaunchMode.externalApplication,
                                    );
                                  }
                                },
                                trailing: canUpload
                                    ? PopupMenuButton<String>(
                                        onSelected: (action) =>
                                            _attachmentAction(
                                              attachment,
                                              action,
                                            ),
                                        itemBuilder: (_) => [
                                          if (attachment.mimeType.startsWith(
                                            'image/',
                                          ))
                                            const PopupMenuItem(
                                              value: 'cover',
                                              child: Text('Use as cover'),
                                            ),
                                          const PopupMenuItem(
                                            value: 'delete',
                                            child: Text('Delete'),
                                          ),
                                        ],
                                      )
                                    : null,
                              ),
                            )
                            .toList(),
                      ),
              ),
              const SizedBox(height: 18),
              _Section(
                title: 'Related cards',
                icon: Icons.account_tree_outlined,
                trailing: IconButton(
                  tooltip: 'Relate card',
                  onPressed: canEdit ? _addRelation : null,
                  icon: const Icon(Icons.add),
                ),
                child: relations.isEmpty
                    ? const Text(
                        'No related cards.',
                        style: TextStyle(color: Colors.grey),
                      )
                    : Column(
                        children: relations.map((relation) {
                          final otherId = relation.cardId == card.id
                              ? relation.relatedCardId
                              : relation.cardId;
                          final other = state.card(otherId);
                          return ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.credit_card, size: 18),
                            title: Text(other?.title ?? 'Unavailable card'),
                            trailing: canEdit
                                ? IconButton(
                                    tooltip: 'Remove relation',
                                    onPressed: () async {
                                      await widget.controller.mutate(
                                        'deleteRelation',
                                        {'id': relation.id},
                                      );
                                      if (mounted) setState(() {});
                                    },
                                    icon: const Icon(Icons.close),
                                  )
                                : null,
                          );
                        }).toList(),
                      ),
              ),
              if (placement != null && canMove) ...[
                const SizedBox(height: 18),
                _Section(
                  title: 'Move card',
                  icon: Icons.drive_file_move_outline,
                  child: _MovePlacement(
                    controller: widget.controller,
                    placement: placement!,
                    onMoved: () {
                      if (mounted) setState(() {});
                    },
                  ),
                ),
              ],
            ],
          ),
        ),
        const Divider(height: 1),
        Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              TextButton.icon(
                onPressed: canEdit ? _archive : null,
                icon: const Icon(Icons.archive_outlined),
                label: const Text('Archive'),
              ),
              const Spacer(),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              const SizedBox(width: 8),
              FilledButton.icon(
                onPressed: widget.controller.busy || !canEdit ? null : _save,
                icon: const Icon(Icons.check),
                label: const Text('Save card'),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _pickDay() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: day ?? DateTime.now(),
      firstDate: DateTime(2000),
      lastDate: DateTime(2100),
    );
    if (picked != null) setState(() => day = picked);
  }

  Future<void> _pickTime(bool start) async {
    final initial = start
        ? startTime ?? const TimeOfDay(hour: 9, minute: 0)
        : endTime ?? const TimeOfDay(hour: 10, minute: 0);
    final picked = await showTimePicker(context: context, initialTime: initial);
    if (picked != null) {
      setState(() {
        if (start) {
          startTime = picked;
        } else {
          endTime = picked;
        }
      });
    }
  }

  Future<void> _save() async {
    final values = <String, dynamic>{
      'id': card.id,
      'version': card.version,
      'title': title.text.trim(),
      'description': description.text,
    };
    if (day == null) {
      values.addAll({
        'dueDate': null,
        'scheduledStart': null,
        'scheduledEnd': null,
      });
    } else if (allDay) {
      values.addAll({
        'dueDate': DateFormat('yyyy-MM-dd').format(day!),
        'scheduledStart': null,
        'scheduledEnd': null,
      });
    } else {
      final start = _combine(
        day!,
        startTime ?? const TimeOfDay(hour: 9, minute: 0),
      );
      var end = _combine(day!, endTime ?? const TimeOfDay(hour: 10, minute: 0));
      if (!end.isAfter(start)) end = end.add(const Duration(days: 1));
      values.addAll({
        'dueDate': DateFormat('yyyy-MM-dd').format(day!),
        'scheduledStart': start.toUtc().toIso8601String(),
        'scheduledEnd': end.toUtc().toIso8601String(),
      });
    }
    final result = await widget.controller.mutate(
      'updateCard',
      values,
      success: 'Card saved',
    );
    if (result != null && mounted) Navigator.pop(context);
  }

  Future<void> _archive() async {
    if (!await confirm(
      context,
      'Archive this card?',
      'It will be hidden from every board where it appears.',
    )) {
      return;
    }
    final result = await widget.controller.mutate('deleteCard', {
      'id': card.id,
    }, success: 'Card archived');
    if (result != null && mounted) Navigator.pop(context);
  }

  Future<void> _createTag() async {
    final name = await promptText(
      context,
      title: 'Create tag',
      label: 'Tag name',
    );
    if (name == null) return;
    await widget.controller.mutate('createTag', {
      'workspaceId': card.workspaceId,
      'name': name,
      'color': '#d9c7eb',
    }, success: 'Tag created');
    if (mounted) setState(() {});
  }

  Future<void> _addLink() async {
    final result = await showDialog<List<String>>(
      context: context,
      builder: (context) {
        final name = TextEditingController(), url = TextEditingController();
        return AlertDialog(
          title: const Text('Add link'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                decoration: const InputDecoration(labelText: 'Title'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: url,
                keyboardType: TextInputType.url,
                decoration: const InputDecoration(labelText: 'https://…'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () =>
                  Navigator.pop(context, [name.text.trim(), url.text.trim()]),
              child: const Text('Add'),
            ),
          ],
        );
      },
    );
    if (result == null || result[1].isEmpty) return;
    await widget.controller.mutate('addLink', {
      'cardId': card.id,
      'title': result[0],
      'url': result[1],
    }, success: 'Link added');
    if (mounted) setState(() {});
  }

  Future<void> _createGithubIssue() async {
    final result = await widget.controller.mutate('createGithubIssue', {
      'cardId': card.id,
    }, success: 'GitHub issue created');
    if (result != null && mounted) setState(() {});
  }

  Future<void> _linkGithubIssue() async {
    final url = await promptText(
      context,
      title: 'Link GitHub issue',
      label: 'GitHub issue URL',
    );
    if (url == null) return;
    final result = await widget.controller.mutate('linkGithubIssue', {
      'cardId': card.id,
      'url': url,
    }, success: 'GitHub issue linked');
    if (result != null && mounted) setState(() {});
  }

  Future<void> _unlinkGithubIssue() async {
    if (!await confirm(
      context,
      'Unlink GitHub issue?',
      'The GitHub issue will stay open, but it will no longer be connected to this card.',
    )) {
      return;
    }
    final result = await widget.controller.mutate('unlinkGithubIssue', {
      'cardId': card.id,
    }, success: 'GitHub issue unlinked');
    if (result != null && mounted) setState(() {});
  }

  Future<void> _upload() async {
    final file = await FilePicker.pickFile(
      type: FileType.custom,
      allowedExtensions: const ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf'],
    );
    if (file == null) return;
    final bytes = await file.readAsBytes();
    await widget.controller.upload(
      bytes: bytes,
      filename: file.name,
      cardId: card.id,
    );
    if (mounted) setState(() {});
  }

  Future<void> _attachmentAction(Attachment attachment, String action) async {
    if (action == 'cover') {
      await widget.controller.mutate('updateCard', {
        'id': card.id,
        'version': card.version,
        'cover': attachment.url,
      }, success: 'Cover updated');
    } else if (action == 'delete') {
      final approved = await confirm(
        context,
        'Delete attachment?',
        attachment.name,
      );
      if (approved) {
        await widget.controller.mutate('deleteAttachment', {
          'id': attachment.id,
        }, success: 'Attachment deleted');
      }
    }
    if (mounted) setState(() {});
  }

  Future<void> _addRelation() async {
    final choices = widget.controller.state.cards
        .where(
          (item) =>
              item.workspaceId == card.workspaceId &&
              item.id != card.id &&
              !item.archived,
        )
        .toList();
    if (choices.isEmpty) return;
    final selected = await showDialog<String>(
      context: context,
      builder: (context) {
        String value = choices.first.id;
        return StatefulBuilder(
          builder: (context, setDialogState) => AlertDialog(
            title: const Text('Relate a card'),
            content: DropdownButtonFormField<String>(
              initialValue: value,
              isExpanded: true,
              items: choices
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.id,
                      child: Text(item.title, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (next) => setDialogState(() => value = next ?? value),
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, value),
                child: const Text('Relate'),
              ),
            ],
          ),
        );
      },
    );
    if (selected != null) {
      await widget.controller.mutate('addRelation', {
        'cardId': card.id,
        'relatedCardId': selected,
      }, success: 'Cards related');
    }
    if (mounted) setState(() {});
  }

  DateTime _combine(DateTime date, TimeOfDay time) =>
      DateTime(date.year, date.month, date.day, time.hour, time.minute);
  String _size(int bytes) => bytes >= 1024 * 1024
      ? '${(bytes / 1024 / 1024).toStringAsFixed(1)} MB'
      : '${(bytes / 1024).ceil()} KB';
}

class _Section extends StatelessWidget {
  const _Section({
    required this.title,
    required this.icon,
    required this.child,
    this.trailing,
  });
  final String title;
  final IconData icon;
  final Widget child;
  final Widget? trailing;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(14),
    decoration: BoxDecoration(
      color: Colors.white.withValues(alpha: .62),
      border: Border.all(color: const Color(0xFFE6DBCF)),
      borderRadius: BorderRadius.circular(12),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: const Color(0xFF6D8066)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(fontWeight: FontWeight.w800),
              ),
            ),
            ?trailing,
          ],
        ),
        const SizedBox(height: 11),
        child,
      ],
    ),
  );
}

class _MovePlacement extends StatefulWidget {
  const _MovePlacement({
    required this.controller,
    required this.placement,
    required this.onMoved,
  });
  final CoveController controller;
  final Placement placement;
  final VoidCallback onMoved;
  @override
  State<_MovePlacement> createState() => _MovePlacementState();
}

class _MovePlacementState extends State<_MovePlacement> {
  late String boardId = widget.placement.boardId;
  late String columnId = widget.placement.columnId;
  @override
  Widget build(BuildContext context) {
    final boards = widget.controller.workspaceBoards;
    final columns = widget.controller.state.columns
        .where((item) => item.boardId == boardId)
        .toList();
    if (!columns.any((item) => item.id == columnId)) {
      columnId = columns.firstOrNull?.id ?? '';
    }
    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            initialValue: boardId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Board'),
            items: boards
                .map(
                  (item) => DropdownMenuItem(
                    value: item.id,
                    child: Text(item.name, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() {
              boardId = value ?? boardId;
              columnId =
                  widget.controller.state.columns
                      .where((item) => item.boardId == boardId)
                      .firstOrNull
                      ?.id ??
                  '';
            }),
          ),
        ),
        const SizedBox(width: 9),
        Expanded(
          child: DropdownButtonFormField<String>(
            key: ValueKey(boardId),
            initialValue: columnId.isEmpty ? null : columnId,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'Column'),
            items: columns
                .map(
                  (item) => DropdownMenuItem(
                    value: item.id,
                    child: Text(item.name, overflow: TextOverflow.ellipsis),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => columnId = value ?? columnId),
          ),
        ),
        const SizedBox(width: 9),
        IconButton.filledTonal(
          tooltip: 'Move',
          onPressed: columnId.isEmpty || columnId == widget.placement.columnId
              ? null
              : () async {
                  await widget.controller.mutate('movePlacement', {
                    'placementId': widget.placement.id,
                    'columnId': columnId,
                    'version': widget.placement.version,
                  }, success: 'Card moved');
                  widget.onMoved();
                },
          icon: const Icon(Icons.arrow_forward),
        ),
      ],
    );
  }
}
