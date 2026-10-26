# Changelog

English is canonical; entries are generated from conventional commits by `pnpm changelog`.

## v0.1.0


### 🚀 Features

- Open a folder as the workspace when it is dropped on the window (15f56ae)
- Close the open folder from the toolbar, menu and palette (9ce31b4)
- List recent folders alongside recent files on the welcome view (65ce075)
- Add rename and close-side actions to the tab menu (0d51f22)
- Duplicate files from the tree and add a rename shortcut (200cc73)

### 🩹 Bug Fixes

- Align appearance settings controls and shrink color-mode segmented bar (98f1a79)

### 📦 Build

- Inject the root version into the desktop package at packaging time (58adb84)
- Drop tracked versions from web and internal packages (506a4d0)
- Verify the release tag matches the root version before packaging (ebd9f87)
- Validate the release tag against the root version before building (6d8d664)
- Align the release tag check and document the release process (ed08d20)
