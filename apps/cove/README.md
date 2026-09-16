# Cove Flutter

Native Cove client for Windows, iOS, and Android. It connects to an existing self-hosted Cove server and uses the same workspaces, boards, cards, permissions, tray, calendar, attachments, tags, links, relations, GitHub/OpenAI integrations, and Google Calendar sync.

## Run

```bash
flutter pub get
flutter run -d windows   # on Windows
flutter run -d ios       # on macOS with Xcode
flutter run -d android
```

On the login screen, enter the full server address (for example `https://rabeeqiblawi.com/cove`) and your Cove account email/password. The app keeps the resulting session in platform secure storage.

For a server running on another computer on the same network, use that computer's LAN address, such as `http://192.168.1.20:3000`. `localhost` always refers to the phone or computer running the Flutter app.

## Checks and builds

```bash
flutter analyze
flutter test
flutter build apk
flutter build ios --no-codesign
flutter build windows
```

Windows builds must be produced on Windows. iOS builds must be produced on macOS with Xcode.

## Android home-screen widget

In the app sidebar, open **Home-screen widget** and choose a board and column. Then add **Cove column** from Android's widget picker. The widget shows the selected column's current card count and first seven cards, and refreshes whenever the app refreshes or saves a change.
