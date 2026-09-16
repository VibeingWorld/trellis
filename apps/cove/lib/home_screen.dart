import 'dart:io';

import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'board_view.dart';
import 'calendar_view.dart';
import 'main.dart';
import 'settings_sheets.dart';
import 'tray_view.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key, required this.controller});
  final CoveController controller;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    return width >= 1000
        ? _DesktopHome(controller: controller)
        : _MobileHome(controller: controller);
  }
}

class _DesktopHome extends StatelessWidget {
  const _DesktopHome({required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: Column(
      children: [
        _TopBar(controller: controller),
        _MessageBar(controller: controller),
        Expanded(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SizedBox(width: 238, child: _Sidebar(controller: controller)),
              Expanded(child: BoardView(controller: controller)),
              if (controller.trayOpen)
                SizedBox(
                  width: MediaQuery.sizeOf(context).width < 1250 ? 230 : 270,
                  child: _PanelFrame(
                    title: 'Tray',
                    icon: Icons.inbox_outlined,
                    onClose: controller.toggleTray,
                    child: TrayView(controller: controller),
                  ),
                ),
              if (controller.calendarOpen)
                SizedBox(
                  width: MediaQuery.sizeOf(context).width < 1350 ? 370 : 440,
                  child: _PanelFrame(
                    title: 'Calendar',
                    icon: Icons.calendar_month_outlined,
                    onClose: controller.toggleCalendar,
                    child: CalendarView(controller: controller),
                  ),
                ),
            ],
          ),
        ),
      ],
    ),
  );
}

class _MobileHome extends StatelessWidget {
  const _MobileHome({required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) {
    final section = controller.mobileSection;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 8,
        title: Row(
          children: [
            const CoveMark(size: 32),
            const Spacer(),
            Flexible(
              child: Text(
                controller.board?.name ?? controller.workspace?.name ?? 'Cove',
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 15),
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: controller.busy ? null : controller.refresh,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(child: _Sidebar(controller: controller, mobile: true)),
      ),
      body: Column(
        children: [
          _MessageBar(controller: controller),
          Expanded(
            child: switch (section) {
              AppSection.board => BoardView(controller: controller),
              AppSection.tray => TrayView(controller: controller),
              AppSection.calendar => CalendarView(controller: controller),
            },
          ),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: section.index,
        onDestinationSelected: (index) =>
            controller.selectSection(AppSection.values[index]),
        destinations: [
          const NavigationDestination(
            icon: Icon(Icons.view_kanban_outlined),
            selectedIcon: Icon(Icons.view_kanban),
            label: 'Board',
          ),
          NavigationDestination(
            icon: Badge(
              isLabelVisible: controller.workspaceTray.isNotEmpty,
              label: Text('${controller.workspaceTray.length}'),
              child: const Icon(Icons.inbox_outlined),
            ),
            selectedIcon: const Icon(Icons.inbox),
            label: 'Tray',
          ),
          const NavigationDestination(
            icon: Icon(Icons.calendar_month_outlined),
            selectedIcon: Icon(Icons.calendar_month),
            label: 'Calendar',
          ),
        ],
      ),
      floatingActionButton:
          section == AppSection.board && controller.board != null
          ? FloatingActionButton.extended(
              onPressed: () => createCard(context, controller),
              icon: const Icon(Icons.add),
              label: const Text('Card'),
            )
          : null,
    );
  }
}

class _TopBar extends StatelessWidget {
  const _TopBar({required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) => Container(
    height: 62,
    padding: const EdgeInsets.symmetric(horizontal: 22),
    decoration: const BoxDecoration(
      color: Color(0xFFFFFCF7),
      border: Border(bottom: BorderSide(color: Color(0xFFE8DED1))),
    ),
    child: Row(
      children: [
        const CoveMark(size: 34),
        const SizedBox(width: 38),
        Icon(Icons.folder_outlined, size: 17, color: Colors.grey.shade600),
        const SizedBox(width: 8),
        Text(
          controller.workspace?.name ?? 'Workspace',
          style: const TextStyle(color: Color(0xFF81766C)),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(horizontal: 10),
          child: Text('/'),
        ),
        Expanded(
          child: Text(
            controller.board?.name ?? 'Boards',
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
        ),
        if (controller.busy)
          const Padding(
            padding: EdgeInsets.only(right: 12),
            child: SizedBox.square(
              dimension: 17,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
          ),
        IconButton(
          tooltip: 'Refresh',
          onPressed: controller.busy ? null : controller.refresh,
          icon: const Icon(Icons.refresh),
        ),
        IconButton(
          tooltip: controller.trayOpen ? 'Hide tray' : 'Show tray',
          isSelected: controller.trayOpen,
          onPressed: controller.toggleTray,
          icon: Badge(
            isLabelVisible: controller.workspaceTray.isNotEmpty,
            label: Text('${controller.workspaceTray.length}'),
            child: const Icon(Icons.inbox_outlined),
          ),
        ),
        IconButton(
          tooltip: controller.calendarOpen ? 'Hide calendar' : 'Show calendar',
          isSelected: controller.calendarOpen,
          onPressed: controller.toggleCalendar,
          icon: const Icon(Icons.calendar_month_outlined),
        ),
      ],
    ),
  );
}

class _MessageBar extends StatelessWidget {
  const _MessageBar({required this.controller});
  final CoveController controller;
  @override
  Widget build(BuildContext context) {
    final text = controller.error ?? controller.notice;
    if (text == null) return const SizedBox.shrink();
    final bad = controller.error != null;
    return Material(
      color: bad ? const Color(0xFFFFE9E5) : const Color(0xFFEAF2E7),
      child: InkWell(
        onTap: controller.clearMessage,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
          child: Row(
            children: [
              Icon(
                bad ? Icons.error_outline : Icons.check_circle_outline,
                size: 18,
                color: bad ? const Color(0xFF9B4C45) : const Color(0xFF52734F),
              ),
              const SizedBox(width: 9),
              Expanded(
                child: Text(
                  text,
                  style: TextStyle(
                    fontSize: 12,
                    color: bad
                        ? const Color(0xFF873F39)
                        : const Color(0xFF4B6748),
                  ),
                ),
              ),
              const Icon(Icons.close, size: 15),
            ],
          ),
        ),
      ),
    );
  }
}

class _Sidebar extends StatelessWidget {
  const _Sidebar({required this.controller, this.mobile = false});
  final CoveController controller;
  final bool mobile;

  @override
  Widget build(BuildContext context) {
    final workspace = controller.workspace;
    return Container(
      color: const Color(0xFFFFFCF7),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (mobile)
            const Padding(
              padding: EdgeInsets.fromLTRB(18, 16, 18, 24),
              child: Align(
                alignment: Alignment.centerLeft,
                child: CoveMark(size: 38),
              ),
            ),
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
            child: DropdownButtonFormField<String>(
              initialValue: workspace?.id,
              isExpanded: true,
              decoration: const InputDecoration(
                labelText: 'Workspace',
                prefixIcon: Icon(Icons.workspaces_outline),
                contentPadding: EdgeInsets.symmetric(horizontal: 10),
              ),
              items: controller.state.workspaces
                  .map(
                    (item) => DropdownMenuItem(
                      value: item.id,
                      child: Text(item.name, overflow: TextOverflow.ellipsis),
                    ),
                  )
                  .toList(),
              onChanged: (value) {
                if (value != null) controller.selectWorkspace(value);
              },
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: TextButton.icon(
              onPressed: controller.isAdmin
                  ? () => createWorkspace(context, controller)
                  : null,
              icon: const Icon(Icons.add, size: 17),
              label: const Text('New workspace'),
            ),
          ),
          const Padding(
            padding: EdgeInsets.fromLTRB(20, 16, 20, 8),
            child: Text(
              'YOUR BOARDS',
              style: TextStyle(
                fontSize: 10,
                letterSpacing: 1.2,
                color: Color(0xFF948A80),
              ),
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                for (final board in controller.workspaceBoards)
                  ListTile(
                    selected: board.id == controller.activeBoardId,
                    leading: const Icon(Icons.view_kanban_outlined, size: 19),
                    title: Text(board.name, overflow: TextOverflow.ellipsis),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(9),
                    ),
                    onTap: () {
                      controller.selectBoard(board.id);
                      if (mobile) Navigator.pop(context);
                    },
                  ),
                if (controller.can('createBoard'))
                  ListTile(
                    leading: const Icon(Icons.add, size: 19),
                    title: const Text('Create a board'),
                    onTap: () => createBoard(context, controller),
                  ),
              ],
            ),
          ),
          const Divider(height: 1),
          if (controller.can('manageWorkspace'))
            ListTile(
              dense: true,
              leading: const Icon(Icons.hub_outlined, size: 18),
              title: const Text('Integrations & AI'),
              subtitle: const Text('GitHub and coding agent'),
              onTap: () => showIntegrationSettings(context, controller),
            ),
          if (Platform.isAndroid && controller.state.boards.isNotEmpty)
            ListTile(
              dense: true,
              leading: const Icon(Icons.widgets_outlined, size: 18),
              title: const Text('Home-screen widget'),
              subtitle: const Text('Choose a board column'),
              onTap: () => showWidgetSettings(context, controller),
            ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.account_circle_outlined, size: 18),
            title: Text(
              controller.state.currentUser?.name ?? controller.serverUrl,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            subtitle: Text(
              controller.state.currentUser?.email ?? 'Connected server',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          ListTile(
            dense: true,
            leading: const Icon(Icons.logout, size: 18),
            title: const Text('Disconnect'),
            onTap: () async {
              if (await confirm(
                context,
                'Disconnect this server?',
                'You can reconnect from the login screen.',
              )) {
                await controller.logout();
              }
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _PanelFrame extends StatelessWidget {
  const _PanelFrame({
    required this.title,
    required this.icon,
    required this.onClose,
    required this.child,
  });
  final String title;
  final IconData icon;
  final VoidCallback onClose;
  final Widget child;
  @override
  Widget build(BuildContext context) => Container(
    decoration: const BoxDecoration(
      color: Color(0xFFFFFAF4),
      border: Border(left: BorderSide(color: Color(0xFFE4D8CB))),
    ),
    child: Column(
      children: [
        SizedBox(
          height: 53,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Row(
              children: [
                Icon(icon, size: 17),
                const SizedBox(width: 7),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                IconButton(
                  onPressed: onClose,
                  icon: const Icon(Icons.close, size: 18),
                ),
              ],
            ),
          ),
        ),
        const Divider(height: 1),
        Expanded(child: child),
      ],
    ),
  );
}

Future<String?> promptText(
  BuildContext context, {
  required String title,
  String label = 'Name',
  String value = '',
  int maxLines = 1,
}) async {
  final controller = TextEditingController(text: value);
  final result = await showDialog<String>(
    context: context,
    builder: (context) => AlertDialog(
      title: Text(title),
      content: TextField(
        controller: controller,
        autofocus: true,
        maxLines: maxLines,
        decoration: InputDecoration(labelText: label),
        onSubmitted: maxLines == 1
            ? (_) => Navigator.pop(context, controller.text.trim())
            : null,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(context, controller.text.trim()),
          child: const Text('Save'),
        ),
      ],
    ),
  );
  controller.dispose();
  return result?.trim().isEmpty == true ? null : result;
}

Future<bool> confirm(
  BuildContext context,
  String title,
  String message,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Continue'),
          ),
        ],
      ),
    ) ??
    false;

Future<void> createWorkspace(
  BuildContext context,
  CoveController controller,
) async {
  final name = await promptText(
    context,
    title: 'Create workspace',
    label: 'Workspace name',
  );
  if (name == null) return;
  final result = await controller.mutate('createWorkspace', {
    'name': name,
  }, success: 'Workspace created');
  if (result?['id'] is String) {
    controller.selectWorkspace(result!['id'] as String);
  }
}

Future<void> createBoard(
  BuildContext context,
  CoveController controller,
) async {
  if (controller.activeWorkspaceId.isEmpty) {
    await createWorkspace(context, controller);
    if (controller.activeWorkspaceId.isEmpty) return;
    if (!context.mounted) return;
  }
  final name = await promptText(
    context,
    title: 'Create board',
    label: 'Board name',
  );
  if (name == null) return;
  final result = await controller.mutate('createBoard', {
    'workspaceId': controller.activeWorkspaceId,
    'name': name,
  }, success: 'Board created');
  if (result?['id'] is String) controller.selectBoard(result!['id'] as String);
}

Future<void> createCard(
  BuildContext context,
  CoveController controller, {
  String? columnId,
}) async {
  final column = columnId ?? controller.boardColumns.firstOrNull?.id;
  if (column == null) return;
  final title = await promptText(
    context,
    title: 'Create card',
    label: 'What needs doing?',
  );
  if (title == null) return;
  await controller.mutate('createCard', {
    'columnId': column,
    'title': title,
  }, success: 'Card created');
}
