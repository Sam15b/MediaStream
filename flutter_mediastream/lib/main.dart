import 'package:flutter/material.dart';
import 'package:flutter_background/flutter_background.dart';
import 'package:flutter_mediastream/main_screen.dart';
import 'package:permission_handler/permission_handler.dart';

Future<void> requestBatteryOptimization() async {
  final status = await Permission.ignoreBatteryOptimizations.request();
  if (status.isGranted) {
    print("Battery optimization ignored.");
  } else {
    print("Battery optimization permission denied.");
  }
}

Future<bool> startForegroundService() async {

   await requestBatteryOptimization();

  final androidConfig = FlutterBackgroundAndroidConfig(
    notificationTitle: 'Title of the notification',
    notificationText: 'Text of the notification',
    notificationImportance: AndroidNotificationImportance.Default,
    notificationIcon: AndroidResource(
        name: 'background_icon',
        defType: 'drawable'), 
  );
  await FlutterBackground.initialize(androidConfig: androidConfig);
  return FlutterBackground.enableBackgroundExecution();
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  startForegroundService();
  runApp(MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home:  Main_page(),
    );
  }
}

