import 'package:flutter/material.dart';

import 'app_controller.dart';
import 'home_screen.dart';
import 'login_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CoveBootstrap());
}

class CoveBootstrap extends StatefulWidget {
  const CoveBootstrap({super.key});
  @override
  State<CoveBootstrap> createState() => _CoveBootstrapState();
}

class _CoveBootstrapState extends State<CoveBootstrap> {
  final controller = CoveController();
  @override
  void initState() {
    super.initState();
    controller.initialize();
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: controller,
    builder: (context, _) => MaterialApp(
      title: 'Cove',
      debugShowCheckedModeBanner: false,
      theme: coveTheme(),
      home: controller.booting
          ? const _Startup()
          : controller.connected
          ? HomeScreen(controller: controller)
          : LoginScreen(controller: controller),
    ),
  );
}

ThemeData coveTheme() {
  const green = Color(0xFF3E6348);
  const paper = Color(0xFFFBF7F0);
  final scheme = ColorScheme.fromSeed(
    seedColor: green,
    brightness: Brightness.light,
    surface: paper,
    primary: green,
    secondary: const Color(0xFF9B7456),
  );
  return ThemeData(
    colorScheme: scheme,
    scaffoldBackgroundColor: paper,
    useMaterial3: true,
    fontFamily: 'sans-serif',
    dividerColor: const Color(0xFFE4D9CC),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white.withValues(alpha: .82),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE1D5C8)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFE1D5C8)),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: Colors.white.withValues(alpha: .94),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: Color(0xFFE5D9CC)),
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    ),
  );
}

class _Startup extends StatelessWidget {
  const _Startup();
  @override
  Widget build(BuildContext context) => const Scaffold(
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          CoveMark(size: 58),
          SizedBox(height: 20),
          Text('Making room for your ideas…'),
          SizedBox(height: 18),
          SizedBox(width: 120, child: LinearProgressIndicator()),
        ],
      ),
    ),
  );
}

class CoveMark extends StatelessWidget {
  const CoveMark({super.key, this.size = 38, this.withWord = true});
  final double size;
  final bool withWord;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      Container(
        width: size * .72,
        height: size * .72,
        decoration: const BoxDecoration(
          color: Color(0xFF3E6348),
          shape: BoxShape.circle,
        ),
        child: Icon(
          Icons.nightlight_round,
          color: const Color(0xFFFBF7F0),
          size: size * .5,
        ),
      ),
      if (withWord) ...[
        SizedBox(width: size * .14),
        Text(
          'cove.',
          style: TextStyle(
            fontSize: size * .7,
            fontWeight: FontWeight.w800,
            letterSpacing: -1.4,
            color: const Color(0xFF365B43),
          ),
        ),
      ],
    ],
  );
}
