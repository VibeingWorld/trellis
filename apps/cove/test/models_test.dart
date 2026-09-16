import 'package:cove/api.dart';
import 'package:cove/models.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('normalizes self-hosted server addresses', () {
    expect(normalizeServerUrl('example.com/cove/'), 'https://example.com/cove');
    expect(normalizeServerUrl('192.168.1.4:3000'), 'http://192.168.1.4:3000');
    expect(serverCandidates('https://example.com'), [
      'https://example.com',
      'https://example.com/cove',
    ]);
  });

  test('decodes Cove state', () {
    final state = AppState.fromJson({
      'workspaces': [
        {'id': 'w', 'name': 'Personal'},
      ],
      'boards': [
        {
          'id': 'b',
          'workspaceId': 'w',
          'name': 'Roadmap',
          'visibility': 'members',
        },
      ],
      'columns': [
        {'id': 'c', 'boardId': 'b', 'name': 'Todo', 'position': 0},
      ],
      'cards': [
        {
          'id': 'x',
          'workspaceId': 'w',
          'title': 'Ship',
          'version': 3,
          'cardNumber': 42,
        },
      ],
      'currentUser': {
        'id': 'u',
        'name': 'Rabee',
        'email': 'rabee@example.com',
        'role': 'admin',
      },
      'workspaceIntegrations': [
        {
          'workspaceId': 'w',
          'githubOwner': 'vibing-world',
          'githubRepo': 'cove',
          'githubConfigured': true,
          'openaiConfigured': true,
        },
      ],
      'githubLinks': [
        {
          'id': 'g',
          'cardId': 'x',
          'issueNumber': 12,
          'issueUrl': 'https://github.com/vibing-world/cove/issues/12',
          'issueTitle': 'Ship',
        },
      ],
      'placements': [
        {
          'id': 'p',
          'cardId': 'x',
          'boardId': 'b',
          'columnId': 'c',
          'position': 0,
        },
      ],
    });
    expect(state.workspaces.single.name, 'Personal');
    expect(state.card('x')?.title, 'Ship');
    expect(state.card('x')?.cardNumber, 42);
    expect(state.board('b')?.visibility, 'members');
    expect(state.placement('p')?.columnId, 'c');
    expect(state.currentUser?.role, 'admin');
    expect(state.integration('w')?.githubConfigured, isTrue);
    expect(state.githubLink('x')?.issueNumber, 12);
  });
}
