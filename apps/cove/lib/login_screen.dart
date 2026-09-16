import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.controller});
  final CoveController controller;
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  late final TextEditingController server;
  late final TextEditingController email;
  final password = TextEditingController();
  final formKey = GlobalKey<FormState>();
  bool remember = true;
  bool obscure = true;

  @override
  void initState() {
    super.initState();
    server = TextEditingController(
      text: widget.controller.serverHint ?? 'https://rabeeqiblawi.com/cove',
    );
    email = TextEditingController(text: widget.controller.emailHint ?? '');
  }

  @override
  void dispose() {
    server.dispose();
    email.dispose();
    password.dispose();
    super.dispose();
  }

  Future<void> submit() async {
    if (!formKey.currentState!.validate()) return;
    try {
      await widget.controller.connect(
        server.text,
        email.text,
        password.text,
        remember: remember,
      );
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.sizeOf(context).width >= 900;
    return Scaffold(
      body: Row(
        children: [
          if (wide)
            Expanded(
              child: Container(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    colors: [Color(0xFFDDE8DF), Color(0xFFF0E7DA)],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
                padding: const EdgeInsets.all(64),
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    CoveMark(size: 48),
                    Spacer(),
                    Text(
                      'Your boards, wherever you are.',
                      style: TextStyle(
                        fontSize: 42,
                        height: 1.08,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -1.8,
                        color: Color(0xFF344F3B),
                      ),
                    ),
                    SizedBox(height: 18),
                    Text(
                      'One calm workspace across Windows, iPhone, iPad, and Android.',
                      style: TextStyle(
                        fontSize: 16,
                        height: 1.5,
                        color: Color(0xFF6F7F71),
                      ),
                    ),
                    Spacer(),
                    Row(
                      children: [
                        Icon(Icons.lock_outline, size: 16),
                        SizedBox(width: 8),
                        Text(
                          'Your password stays in this device’s secure storage.',
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          Expanded(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(28),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 430),
                  child: Form(
                    key: formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (!wide) ...[
                          const Align(
                            alignment: Alignment.centerLeft,
                            child: CoveMark(size: 44),
                          ),
                          const SizedBox(height: 40),
                        ],
                        Text(
                          'Connect to Cove',
                          style: Theme.of(context).textTheme.headlineMedium
                              ?.copyWith(
                                fontWeight: FontWeight.w800,
                                letterSpacing: -.8,
                              ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'Use any self-hosted Cove server. Include its path when needed, such as /cove.',
                          style: TextStyle(
                            height: 1.5,
                            color: Color(0xFF7E746A),
                          ),
                        ),
                        const SizedBox(height: 28),
                        TextFormField(
                          controller: server,
                          keyboardType: TextInputType.url,
                          autocorrect: false,
                          decoration: const InputDecoration(
                            labelText: 'Server address',
                            hintText: 'https://example.com/cove',
                            prefixIcon: Icon(Icons.dns_outlined),
                          ),
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Enter your server address.'
                              : null,
                          onFieldSubmitted: (_) => submit(),
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: email,
                          autocorrect: false,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.next,
                          decoration: const InputDecoration(
                            labelText: 'Cove email',
                            hintText: 'you@example.com',
                            prefixIcon: Icon(Icons.alternate_email),
                          ),
                          validator: (value) =>
                              value == null || !value.contains('@')
                              ? 'Enter your Cove account email.'
                              : null,
                        ),
                        const SizedBox(height: 14),
                        TextFormField(
                          controller: password,
                          obscureText: obscure,
                          onFieldSubmitted: (_) => submit(),
                          decoration: InputDecoration(
                            labelText: 'Cove password',
                            prefixIcon: const Icon(Icons.lock_outline),
                            suffixIcon: IconButton(
                              tooltip: obscure
                                  ? 'Show password'
                                  : 'Hide password',
                              onPressed: () =>
                                  setState(() => obscure = !obscure),
                              icon: Icon(
                                obscure
                                    ? Icons.visibility_outlined
                                    : Icons.visibility_off_outlined,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 10),
                        CheckboxListTile(
                          value: remember,
                          contentPadding: EdgeInsets.zero,
                          controlAffinity: ListTileControlAffinity.leading,
                          title: const Text('Remember this server'),
                          subtitle: const Text(
                            'The password is saved in secure device storage.',
                          ),
                          onChanged: (value) =>
                              setState(() => remember = value ?? true),
                        ),
                        if (widget.controller.error != null) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFFEBE8),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Icon(
                                  Icons.error_outline,
                                  color: Color(0xFFA14E47),
                                ),
                                const SizedBox(width: 9),
                                Expanded(
                                  child: Text(
                                    widget.controller.error!,
                                    style: const TextStyle(
                                      color: Color(0xFF873F39),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 18),
                        FilledButton.icon(
                          onPressed: widget.controller.connecting
                              ? null
                              : submit,
                          icon: widget.controller.connecting
                              ? const SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                )
                              : const Icon(Icons.arrow_forward),
                          label: Text(
                            widget.controller.connecting
                                ? 'Connecting…'
                                : 'Connect to server',
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Text(
                          'For a local server on another device, use that computer’s LAN address—not localhost.',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF8B8177),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
