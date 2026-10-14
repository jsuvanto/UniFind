# UniFind

UniFind is a keyboard-first Unicode character picker for Windows, with
best-effort Linux support. Press **Ctrl+,**, search by a Unicode name, alias,
block, literal character, or code point, then press **Enter** to insert it into
the application you were using.

Examples: `right arrow`, `greek pi`, `currency`, `U+2192`, or `→`.

## Current MVP

- Global **Ctrl+,** shortcut with **Ctrl+Shift+Space** as a fallback when the
  preferred shortcut is already owned by another application.
- Fast offline search across the Unicode Character Database.
- Keyboard navigation, recent characters, and favorites.
- Automatic paste on Windows; the selected character also remains on the
  clipboard.
- Clipboard-first fallback on Linux. Automatic paste uses `xdotool` on X11 or
  `wtype` on Wayland when installed.
- Dark and light themes that follow the system preference.
- Tray menu and optional start-at-login on Windows.

## Development

Requirements: Node.js 24 or newer.

```powershell
npm install
npm run data:build
npm test
npm start
```

## Windows downloads

- [`UniFind Setup 0.1.0.exe`](dist/UniFind%20Setup%200.1.0.exe) — Windows
  installer.
- [`UniFind 0.1.0.exe`](dist/UniFind%200.1.0.exe) — portable build; no
  installation required.
- [`SHA256SUMS.txt`](dist/SHA256SUMS.txt) — checksums for both downloads.

The executables are stored with Git LFS. Install Git LFS before cloning if you
want Git to retrieve the binaries automatically.

The checked-in `src/data/characters.json` is generated from Unicode 18.0.0.
To rebuild it from the official source files:

```powershell
$env:UCD_VERSION = '18.0.0'
npm run data:build
```

## Build installers

```powershell
npm run dist:win
```

Linux packages can be built on Linux with `npm run dist:linux`.

## Platform notes

- Windows cannot send keystrokes from a normal process into an elevated
  administrator process. In that case UniFind still copies the character.
- On Linux, global shortcuts and window focus depend on the desktop compositor.
  Modern Electron uses the desktop portal on Wayland; X11 is the most broadly
  compatible path today.
- Some Unicode characters need an appropriate font to display their glyph.

## Search data

The data generator reads `UnicodeData.txt`, `Blocks.txt`, and `NameAliases.txt`
from the Unicode Character Database. Algorithmic ranges such as Hangul syllables
and CJK ideographs are expanded so direct code-point searches work offline.
