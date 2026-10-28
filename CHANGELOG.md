# Changelog

English is canonical; entries are generated from conventional commits by `pnpm changelog`.

## v0.2.0

### 🚀 Features

- **settings:** Move auto update check into its own Updates tab (55bdb5b)
- **editor:** Keep the code block language label always visible (ad15d46)
- **settings:** Show the version history folder and open it from settings (bdf6e83)
- **desktop:** Add mirror downloads and self-hosted update metadata (cf83c1d)
- **history:** Preview and diff saved versions before restoring them (33db69b)
- **ci:** Deploy the web edition to GitHub Pages on stable releases (f500f7e)

### 🩹 Bug Fixes

- Remove the extra blank line under changelog release headings (92daf8b)
- **editor:** Keep code block gutter out of the page stacking order (c222801)
- **history:** Clear the window controls when maximizing the version dialog (c745481)

### 📖 Documentation

- **readme:** Shorten the header entry labels to Online and Download (52a1ee3)


## v0.1.2

### 🚀 Features

- **settings:** Add four text-width modes (14497e2)
- **editor:** Add floating text width control (6138086)
- **desktop:** Check for updates automatically at startup (14c3211)
- **settings:** Add very narrow text width preset (e6773ff)


## v0.1.1

### 🚀 Features

- **desktop:** Add update check button to the About settings tab (a9165a1)
- **settings:** Add open-source repository link to the About tab (86fe6fd)

### 🩹 Bug Fixes

- Let Escape close modals when menus and editor are focused (ea48866)


## v0.1.0

### 🚀 Features

- Let the Windows installer choose Markdown file associations (1a351a3)
- Open a folder as the workspace when it is dropped on the window (15f56ae)
- Close the open folder from the toolbar, menu and palette (9ce31b4)
- List recent folders alongside recent files on the welcome view (65ce075)
- Add rename and close-side actions to the tab menu (0d51f22)
- Duplicate files from the tree and add a rename shortcut (200cc73)
- **web:** Offer to set NotaDown as the default Markdown app (29d78a2)
- **design:** Add Markdown file icon (7f0ac57)
- **desktop:** Use the Markdown file icon for file associations (d4b642b)
- **editor:** Edit block HTML as raw source and space out diagram blocks (a200729)
- **desktop:** Add in-app update checks with download and install (16c96ba)

### 🔥 Performance

- Load workspace folders lazily and scope file watching (2cdcab8)

### 🩹 Bug Fixes

- Lock text selection outside editable fields (46c9cba)
- Align appearance settings controls and shrink color-mode segmented bar (98f1a79)
- Keep Mod-/ for the source-mode toggle in the source editor (c3183fd)
- **desktop:** Register NotaDown in Windows default-app settings (fb5e8eb)
- **desktop:** Recreate the window when the title bar mode changes (4107a7f)
- Align release artifact names and download links (59518c8)
- Stop rewriting untouched documents on open (204364e)
- Keep the mermaid source panel hidden until editing (6ce80bb)
- Report unsupported file types consistently when opening links (4578a40)
- Keep earlier sections when regenerating the changelog (a05fb06)
- **editor:** Make the block handle menu work on HTML and atom blocks (5a1cb51)
- Anchor the changelog on the last stable tag (9c2bb41)

### ♻️ Refactoring

- Drop the open-folder button from the top bar (9151eab)

### 📖 Documentation

- Format the README project structure tables (b4343e5)

### 📦 Build

- Register Markdown associations and ship a deb (4818a8b)
- Inject the root version into the desktop package at packaging time (58adb84)
- Drop tracked versions from web and internal packages (506a4d0)
- Verify the release tag matches the root version before packaging (ebd9f87)
- Validate the release tag against the root version before building (6d8d664)
- Align the release tag check and document the release process (ed08d20)
- Generate the changelog from commits and publish it with the release (8f0e396)
- Add download links with gh-proxy mirrors to release notes (93b55d3)

### 🏡 Chores

- Release v0.1.0-alpha.1 (604f217)
- Release v0.1.0-alpha.2 (3882e44)


## v0.1.0-alpha.2

### 🚀 Features

- **design:** Add Markdown file icon (7f0ac57)
- **desktop:** Use the Markdown file icon for file associations (d4b642b)
- **editor:** Edit block HTML as raw source and space out diagram blocks (a200729)

### 🔥 Performance

- Load workspace folders lazily and scope file watching (2cdcab8)

### 🩹 Bug Fixes

- Align release artifact names and download links (59518c8)
- Stop rewriting untouched documents on open (204364e)
- Keep the mermaid source panel hidden until editing (6ce80bb)
- Report unsupported file types consistently when opening links (4578a40)
- Keep earlier sections when regenerating the changelog (a05fb06)


## v0.1.0-alpha.1

### 🚀 Features

- Open a folder as the workspace when it is dropped on the window (15f56ae)
- Close the open folder from the toolbar, menu and palette (9ce31b4)
- List recent folders alongside recent files on the welcome view (65ce075)
- Add rename and close-side actions to the tab menu (0d51f22)
- Duplicate files from the tree and add a rename shortcut (200cc73)
- **web:** Offer to set NotaDown as the default Markdown app (29d78a2)

### 🩹 Bug Fixes

- Align appearance settings controls and shrink color-mode segmented bar (98f1a79)
- Keep Mod-/ for the source-mode toggle in the source editor (c3183fd)
- **desktop:** Register NotaDown in Windows default-app settings (fb5e8eb)
- **desktop:** Recreate the window when the title bar mode changes (4107a7f)

### 📦 Build

- Inject the root version into the desktop package at packaging time (58adb84)
- Drop tracked versions from web and internal packages (506a4d0)
- Verify the release tag matches the root version before packaging (ebd9f87)
- Validate the release tag against the root version before building (6d8d664)
- Align the release tag check and document the release process (ed08d20)
- Generate the changelog from commits and publish it with the release (8f0e396)
- Add download links with gh-proxy mirrors to release notes (93b55d3)
