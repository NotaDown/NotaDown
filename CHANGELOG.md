# Changelog

English is canonical; entries are generated from conventional commits by `pnpm changelog`.

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
