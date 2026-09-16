import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SavedSession {
  const SavedSession({
    required this.server,
    required this.email,
    required this.sessionCookie,
  });
  final String server;
  final String email;
  final String sessionCookie;
}

class SessionStore {
  static const _secure = FlutterSecureStorage();
  static const _serverKey = 'cove.server';
  static const _emailKey = 'cove.email';
  static const _sessionKey = 'cove.session';

  Future<SavedSession?> read() async {
    final prefs = await SharedPreferences.getInstance();
    final server = prefs.getString(_serverKey);
    if (server == null || server.isEmpty) return null;
    return SavedSession(
      server: server,
      email: prefs.getString(_emailKey) ?? '',
      sessionCookie: await _secure.read(key: _sessionKey) ?? '',
    );
  }

  Future<void> write(SavedSession session) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_serverKey, session.server);
    await prefs.setString(_emailKey, session.email);
    await _secure.write(key: _sessionKey, value: session.sessionCookie);
    await prefs.remove('cove.gatewayUsername');
    await prefs.remove('cove.username');
    await _secure.delete(key: 'cove.gatewayPassword');
    await _secure.delete(key: 'cove.password');
  }

  Future<void> clear() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_serverKey);
    await prefs.remove(_emailKey);
    await prefs.remove('cove.gatewayUsername');
    await prefs.remove('cove.username');
    await _secure.delete(key: 'cove.gatewayPassword');
    await _secure.delete(key: _sessionKey);
    await _secure.delete(key: 'cove.password');
  }
}
