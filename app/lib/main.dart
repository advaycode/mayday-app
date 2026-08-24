import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'src/data/protocol_repository.dart';
import 'src/design/tokens.dart';
import 'src/features/home/home_screen.dart';
import 'src/features/incident/incident_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Landscape is not a supported orientation during an incident. The layout is
  // built around one enormous instruction read top-down by someone kneeling.
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: MColor.bg,
  ));

  // The corpus is loaded before the first frame so that reaching an instruction
  // is never gated on I/O. It is a few hundred KB of bundled JSON.
  final repository = await ProtocolRepository.load();

  runApp(MaydayApp(repository: repository));
}

class MaydayApp extends StatelessWidget {
  const MaydayApp({super.key, required this.repository});

  final ProtocolRepository repository;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Mayday',
      debugShowCheckedModeBanner: false,
      theme: maydayTheme(),
      builder: (context, child) {
        // Respect the user's dynamic type setting, but clamp the bottom so the
        // instruction never shrinks below arm's-length legibility, and clamp the
        // top so a 200% setting cannot push the single action off screen.
        final media = MediaQuery.of(context);
        return MediaQuery(
          data: media.copyWith(
            textScaler: media.textScaler.clamp(
              minScaleFactor: 1.0,
              maxScaleFactor: 1.3,
            ),
          ),
          child: child!,
        );
      },
      home: _startScreen(),
    );
  }

  /// Normally the app opens on the home screen. Passing
  /// `--dart-define=START_PROTOCOL=cpr_adult --dart-define=START_STEP=compressions`
  /// jumps straight into a protocol instead.
  ///
  /// This exists for repeatable screenshots and for filming the demo video
  /// without walking the whole tree on every take. It is inert unless the
  /// define is supplied, so it cannot affect a normal build.
  Widget _startScreen() {
    const startProtocol = String.fromEnvironment('START_PROTOCOL');
    if (startProtocol.isEmpty) return HomeScreen(repository: repository);

    final protocol = repository.byId(startProtocol);
    if (protocol == null) return HomeScreen(repository: repository);

    const startStep = String.fromEnvironment('START_STEP');
    return IncidentScreen(
      repository: repository,
      protocol: protocol,
      startStepId: startStep.isEmpty ? null : startStep,
    );
  }
}
