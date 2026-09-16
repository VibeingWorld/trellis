import 'dart:convert';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:uuid/uuid.dart';

import 'models.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;
  @override
  String toString() => message;
}

class CoveApi {
  CoveApi({required this.baseUrl, this.sessionCookie = '', http.Client? client})
    : _client = client ?? http.Client();

  final String baseUrl;
  String sessionCookie;
  final http.Client _client;
  static const _timeout = Duration(seconds: 15);
  static const _uuid = Uuid();

  Uri uri(String path) => Uri.parse(
    '${baseUrl.replaceFirst(RegExp(r'/+$'), '')}${path.startsWith('/') ? path : '/$path'}',
  );

  Map<String, String> get _headers {
    final result = <String, String>{'Accept': 'application/json'};
    if (sessionCookie.isNotEmpty) result['Cookie'] = sessionCookie;
    return result;
  }

  Future<Json> authStatus() async {
    final response = await _client
        .get(uri('/api/auth/status'), headers: _headers)
        .timeout(_timeout);
    return _decode(response);
  }

  Future<void> login(String email, String password) async {
    final response = await _client
        .post(
          uri('/api/auth/login'),
          headers: {..._headers, 'Content-Type': 'application/json'},
          body: jsonEncode({'email': email.trim(), 'password': password}),
        )
        .timeout(_timeout);
    _decode(response);
    final cookie = RegExp(
      r'(?:^|[,\s])cove_session=([^;]+)',
    ).firstMatch(response.headers['set-cookie'] ?? '');
    if (cookie == null) {
      throw const ApiException('The server did not create a sign-in session.');
    }
    sessionCookie = 'cove_session=${cookie.group(1)}';
  }

  Future<void> logout() async {
    try {
      await _client
          .post(uri('/api/auth/logout'), headers: _headers)
          .timeout(_timeout);
    } finally {
      sessionCookie = '';
    }
  }

  Future<AppState> state() async {
    final response = await _client
        .get(uri('/api/state'), headers: _headers)
        .timeout(_timeout);
    final json = _decode(response);
    return AppState.fromJson(json);
  }

  Future<Json> action(String action, [Json values = const {}]) async {
    final response = await _client
        .post(
          uri('/api/actions'),
          headers: {..._headers, 'Content-Type': 'application/json'},
          body: jsonEncode({
            'action': action,
            'operationId': _uuid.v4(),
            ...values,
          }),
        )
        .timeout(_timeout);
    return _decode(response);
  }

  Future<Json> upload({
    required Uint8List bytes,
    required String filename,
    String? cardId,
    String? boardId,
  }) async {
    final request = http.MultipartRequest('POST', uri('/api/uploads'))
      ..headers.addAll(_headers);
    if (cardId != null) request.fields['cardId'] = cardId;
    if (boardId != null) request.fields['boardId'] = boardId;
    request.files.add(
      http.MultipartFile.fromBytes('file', bytes, filename: filename),
    );
    final streamed = await _client
        .send(request)
        .timeout(const Duration(seconds: 45));
    final response = await http.Response.fromStream(streamed);
    return _decode(response);
  }

  Future<GoogleStatus> googleStatus(String workspaceId) async {
    final response = await _client
        .get(
          uri(
            '/api/calendar/google/status?workspaceId=${Uri.encodeQueryComponent(workspaceId)}',
          ),
          headers: _headers,
        )
        .timeout(_timeout);
    return GoogleStatus.fromJson(_decode(response));
  }

  Json _decode(http.Response response) {
    Json json;
    try {
      final value = jsonDecode(utf8.decode(response.bodyBytes));
      json = value is Map<String, dynamic> ? value : <String, dynamic>{};
    } catch (_) {
      throw ApiException(
        response.statusCode == 401
            ? 'The server rejected the sign-in details.'
            : 'The server returned an invalid response.',
        statusCode: response.statusCode,
      );
    }
    if (response.statusCode < 200 ||
        response.statusCode >= 300 ||
        json['error'] != null) {
      throw ApiException(
        json['error']?.toString() ??
            'Server request failed (${response.statusCode}).',
        statusCode: response.statusCode,
      );
    }
    return json;
  }

  void close() => _client.close();
}

String normalizeServerUrl(String input) {
  var value = input.trim();
  if (value.isEmpty) {
    throw const FormatException('Enter your Cove server address.');
  }
  if (!value.contains('://')) {
    final host = value.split('/').first.split(':').first;
    final local =
        host == 'localhost' ||
        host == '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.');
    value = '${local ? 'http' : 'https'}://$value';
  }
  final uri = Uri.tryParse(value);
  if (uri == null ||
      !uri.hasScheme ||
      uri.host.isEmpty ||
      !{'http', 'https'}.contains(uri.scheme)) {
    throw const FormatException('Use a valid http or https server address.');
  }
  return value.replaceFirst(RegExp(r'/+$'), '');
}

List<String> serverCandidates(String input) {
  final normalized = normalizeServerUrl(input);
  final uri = Uri.parse(normalized);
  if (uri.path.isNotEmpty && uri.path != '/') return [normalized];
  return [normalized, '$normalized/cove'];
}
