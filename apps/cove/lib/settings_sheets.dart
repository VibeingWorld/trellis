import 'dart:io';

import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'models.dart';

Future<void> showIntegrationSettings(
  BuildContext context,
  CoveController controller,
) async {
  final workspaceId = controller.activeWorkspaceId;
  final saved = controller.state.integration(workspaceId);
  final owner = TextEditingController(text: saved?.githubOwner ?? '');
  final repo = TextEditingController(text: saved?.githubRepo ?? '');
  final project = TextEditingController(text: saved?.githubProjectUrl ?? '');
  final agent = TextEditingController();
  final template = TextEditingController();
  var trigger = saved?.aiTriggerColumnId ?? '';
  final boards = controller.state.boards
      .where((item) => item.workspaceId == workspaceId)
      .toList();
  final boardIds = boards.map((item) => item.id).toSet();
  final columns = controller.state.columns
      .where((item) => boardIds.contains(item.boardId))
      .toList();
  await showDialog<void>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Integrations & AI'),
        content: SizedBox(
          width: 620,
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _StatusHeader(
                  title: 'GitHub',
                  subtitle: 'Issues and Projects',
                  ready: saved?.githubConfigured ?? false,
                  readyText: 'Server ready',
                  missingText: 'VPS key needed',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: owner,
                        decoration: const InputDecoration(
                          labelText: 'Owner or organization',
                          hintText: 'acme',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: repo,
                        decoration: const InputDecoration(
                          labelText: 'Repository',
                          hintText: 'web-app',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                TextField(
                  controller: project,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(
                    labelText: 'GitHub Project URL (optional)',
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 18),
                  child: Divider(),
                ),
                _StatusHeader(
                  title: 'OpenAI coding agent',
                  subtitle: 'Start work when a card moves',
                  ready: saved?.openaiConfigured ?? false,
                  readyText: 'Server ready',
                  missingText: 'Setup needed',
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: agent,
                        decoration: InputDecoration(
                          labelText: 'Agent ID',
                          hintText: saved?.openaiConfigured == true
                              ? 'Configured — enter only to replace'
                              : 'agent_…',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextField(
                        controller: template,
                        decoration: InputDecoration(
                          labelText: 'Environment template ID',
                          hintText: saved?.openaiConfigured == true
                              ? 'Configured — enter only to replace'
                              : 'envtpl_…',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: columns.any((item) => item.id == trigger)
                      ? trigger
                      : '',
                  isExpanded: true,
                  decoration: const InputDecoration(
                    labelText: 'Start an AI session when moved to',
                  ),
                  items: [
                    const DropdownMenuItem(value: '', child: Text('Off')),
                    for (final column in columns)
                      DropdownMenuItem(
                        value: column.id,
                        child: Text(
                          '${boards.firstWhere((item) => item.id == column.boardId).name} · ${column.name}',
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                  ],
                  onChanged: (value) =>
                      setDialogState(() => trigger = value ?? ''),
                ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: controller.busy
                ? null
                : () async {
                    final result = await controller
                        .mutate('saveWorkspaceIntegration', {
                          'workspaceId': workspaceId,
                          'githubOwner': owner.text.trim(),
                          'githubRepo': repo.text.trim(),
                          'githubProjectUrl': project.text.trim(),
                          'openaiAgentId': agent.text.trim(),
                          'openaiEnvironmentTemplateId': template.text.trim(),
                          'aiTriggerColumnId': trigger.isEmpty ? null : trigger,
                        }, success: 'Integrations saved');
                    if (result != null && context.mounted) {
                      Navigator.pop(context);
                    }
                  },
            child: const Text('Save integrations'),
          ),
        ],
      ),
    ),
  );
  owner.dispose();
  repo.dispose();
  project.dispose();
  agent.dispose();
  template.dispose();
}

Future<void> showWidgetSettings(
  BuildContext context,
  CoveController controller,
) async {
  if (!Platform.isAndroid) return;
  final existing = await controller.widgetService.selection();
  if (!context.mounted) return;
  var boardId =
      controller.state.boards.any((item) => item.id == existing?.boardId)
      ? existing!.boardId
      : controller.activeBoardId;
  if (boardId.isEmpty && controller.state.boards.isNotEmpty) {
    boardId = controller.state.boards.first.id;
  }
  List<BoardColumn> availableColumns() => controller.state.columns
      .where((item) => item.boardId == boardId)
      .toList();
  var columnId = availableColumns().any((item) => item.id == existing?.columnId)
      ? existing!.columnId
      : (availableColumns().firstOrNull?.id ?? '');
  await showDialog<void>(
    context: context,
    builder: (context) => StatefulBuilder(
      builder: (context, setDialogState) => AlertDialog(
        title: const Text('Android home widget'),
        content: SizedBox(
          width: 430,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text(
                'Choose the board column that Cove should keep visible on your home screen.',
              ),
              const SizedBox(height: 18),
              DropdownButtonFormField<String>(
                initialValue: boardId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Board'),
                items: controller.state.boards
                    .map(
                      (item) => DropdownMenuItem(
                        value: item.id,
                        child: Text(item.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) => setDialogState(() {
                  boardId = value ?? boardId;
                  columnId = availableColumns().firstOrNull?.id ?? '';
                }),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                key: ValueKey(boardId),
                initialValue: columnId.isEmpty ? null : columnId,
                isExpanded: true,
                decoration: const InputDecoration(labelText: 'Column'),
                items: availableColumns()
                    .map(
                      (item) => DropdownMenuItem(
                        value: item.id,
                        child: Text(item.name),
                      ),
                    )
                    .toList(),
                onChanged: (value) =>
                    setDialogState(() => columnId = value ?? ''),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          FilledButton.icon(
            onPressed: columnId.isEmpty
                ? null
                : () async {
                    await controller.widgetService.choose(
                      controller.state,
                      boardId,
                      columnId,
                    );
                    if (context.mounted) Navigator.pop(context);
                  },
            icon: const Icon(Icons.widgets_outlined),
            label: const Text('Use this column'),
          ),
        ],
      ),
    ),
  );
}

class _StatusHeader extends StatelessWidget {
  const _StatusHeader({
    required this.title,
    required this.subtitle,
    required this.ready,
    required this.readyText,
    required this.missingText,
  });
  final String title;
  final String subtitle;
  final bool ready;
  final String readyText;
  final String missingText;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
            Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
      Chip(
        avatar: Icon(
          ready ? Icons.check_circle_outline : Icons.info_outline,
          size: 16,
        ),
        label: Text(ready ? readyText : missingText),
      ),
    ],
  );
}
