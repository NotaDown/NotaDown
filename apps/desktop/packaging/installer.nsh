!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!define NOTADOWN_ASSOC_PROGID "Markdown Document"
!define NOTADOWN_ASSOC_BACKUP "Software\NotaDown\AssociationBackup"
!define NOTADOWN_CAPABILITIES "Software\NotaDown\Capabilities"
!define NOTADOWN_SHELLNEW "Software\NotaDown\ShellNew"

!ifndef BUILD_UNINSTALLER
Var AssocDialog
Var AssocMdCheck
Var AssocMarkdownCheck
Var AssocMdownCheck
Var AssocMkdCheck
Var AssocTitle
Var AssocSubtitle
Var AssocHint
Var AssocMdLabel
Var AssocMarkdownLabel
Var AssocMdownLabel
Var AssocMkdLabel
Var ShellNewCheck
Var ShellNewLabelText
Var ShellNewChoice
Var ShellNewForeign
!endif
Var AssocBackupHas
Var AssocBackupValue
Var NotaDownPrompt

# The built-in check only matches instances whose image path is under $INSTDIR,
# and it treats a failed PowerShell/CIM probe as "not running". Match the
# executable name of the current user instead: no probe can fail silently, and
# an instance started from another copy of the app is closed as well.
!ifdef INSTALL_MODE_PER_ALL_USERS
  !define NOTADOWN_PROCESS_FILTER ""
!else
  !define NOTADOWN_PROCESS_FILTER ' /FI "USERNAME eq %USERNAME%"'
!endif

# tasklist runs through cmd so that %USERNAME% expands; findstr exits with 0
# only when a matching row exists.
!macro NotaDownFindApp RUNNING
  nsExec::Exec `"$SYSDIR\cmd.exe" /C tasklist${NOTADOWN_PROCESS_FILTER} /FI "IMAGENAME eq ${APP_EXECUTABLE_FILENAME}" /FO CSV /NH | "$SYSDIR\findstr.exe" /B /I /C:"\"${APP_EXECUTABLE_FILENAME}\""`
  Pop ${RUNNING}
!macroend

# FORCE is either "graceful" (WM_CLOSE, lets the app persist its session) or
# "force" (terminate). Runs through cmd like the lookup above, so that the
# environment variable in the filter expands.
!macro NotaDownStopApp FORCE
  !if "${FORCE}" == "force"
    nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill /F${NOTADOWN_PROCESS_FILTER} /IM "${APP_EXECUTABLE_FILENAME}"`
  !else
    nsExec::Exec `"$SYSDIR\cmd.exe" /C taskkill${NOTADOWN_PROCESS_FILTER} /IM "${APP_EXECUTABLE_FILENAME}"`
  !endif
  Pop $0
!macroend

!macro NotaDownSetPrompt ZH_TEXT EN_TEXT
  ${If} $LANGUAGE == 2052
    StrCpy $NotaDownPrompt "${ZH_TEXT}"
  ${Else}
    StrCpy $NotaDownPrompt "${EN_TEXT}"
  ${EndIf}
!macroend

!macro customCheckAppRunning
  !insertmacro NotaDownFindApp $R0
  ${If} $R0 == 0
    ${IfNot} ${Silent}
      !insertmacro NotaDownSetPrompt "NotaDown 正在运行，需要先关闭才能继续安装。$\r$\n$\r$\n点击“确定”关闭它并继续，或点击“取消”退出安装。" "NotaDown is running and must be closed before installing.$\r$\n$\r$\nClick OK to close it and continue, or Cancel to exit."
      MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "$NotaDownPrompt" /SD IDOK IDOK notadown_app_stop
      Quit

      notadown_app_stop:
    ${EndIf}

    !insertmacro NotaDownStopApp graceful
    StrCpy $R1 0
    notadown_app_wait:
      Sleep 500
      !insertmacro NotaDownFindApp $R0
      ${If} $R0 != 0
        Goto notadown_app_closed
      ${EndIf}
      IntOp $R1 $R1 + 1
      ${If} $R1 == 6
        !insertmacro NotaDownStopApp force
      ${EndIf}
      ${If} $R1 < 12
        Goto notadown_app_wait
      ${EndIf}
      !insertmacro NotaDownSetPrompt "未能关闭 NotaDown。请手动退出后点击“重试”。" "NotaDown could not be closed. Quit it manually, then click Retry."
      MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$NotaDownPrompt" /SD IDCANCEL IDRETRY notadown_app_wait
      Quit

    notadown_app_closed:
  ${EndIf}
!macroend

# Built-in registration runs before customInstall, so the previous defaults are
# captured in customInit and restored on uninstall.
!macro NotaDownBackupAssociation EXT KEY
  ReadRegDWORD $AssocBackupHas SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Has"
  ${If} $AssocBackupHas == ""
    ReadRegStr $AssocBackupValue SHELL_CONTEXT "Software\Classes\.${EXT}" ""
    ${If} $AssocBackupValue == ""
      WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Has" 0
    ${ElseIf} $AssocBackupValue == "${NOTADOWN_ASSOC_PROGID}"
      WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Has" 0
    ${Else}
      WriteRegStr SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Default" "$AssocBackupValue"
      WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Has" 1
    ${EndIf}
  ${EndIf}
!macroend

!macro NotaDownRestoreAssociation EXT KEY
  ReadRegStr $AssocBackupValue SHELL_CONTEXT "Software\Classes\.${EXT}" ""
  ${If} $AssocBackupValue == "${NOTADOWN_ASSOC_PROGID}"
    ReadRegDWORD $AssocBackupHas SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Has"
    ${If} $AssocBackupHas == 1
      ReadRegStr $AssocBackupValue SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Default"
      WriteRegStr SHELL_CONTEXT "Software\Classes\.${EXT}" "" "$AssocBackupValue"
    ${Else}
      DeleteRegValue SHELL_CONTEXT "Software\Classes\.${EXT}" ""
    ${EndIf}
  ${EndIf}
  DeleteRegValue SHELL_CONTEXT "Software\Classes\.${EXT}\OpenWithProgids" "${NOTADOWN_ASSOC_PROGID}"
!macroend

# Only touch the New-menu entry when no other program already provides one for
# .md, and remember whether we created it so an opt-out or uninstall can remove
# exactly what we added.
!macro NotaDownDetectShellNew
  StrCpy $ShellNewForeign 0
  ReadRegDWORD $R2 SHELL_CONTEXT "${NOTADOWN_SHELLNEW}" "Created"
  ${If} $R2 != 1
    # HKCR is the merged view Explorer uses, so system-wide entries from other
    # programs are detected even for a per-user install.
    ClearErrors
    ReadRegStr $R3 HKCR ".md\ShellNew" "NullFile"
    ${IfNot} ${Errors}
      StrCpy $ShellNewForeign 1
    ${Else}
      ClearErrors
      ReadRegStr $R3 HKCR ".md\ShellNew" "FileName"
      ${IfNot} ${Errors}
        StrCpy $ShellNewForeign 1
      ${Else}
        ClearErrors
        ReadRegStr $R3 HKCR ".md\ShellNew" "Data"
        ${IfNot} ${Errors}
          StrCpy $ShellNewForeign 1
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend

!macro NotaDownRemoveShellNew
  ReadRegDWORD $R2 SHELL_CONTEXT "${NOTADOWN_SHELLNEW}" "Created"
  ${If} $R2 == 1
    DeleteRegValue SHELL_CONTEXT "Software\Classes\.md\ShellNew" "NullFile"
    DeleteRegKey /ifempty SHELL_CONTEXT "Software\Classes\.md\ShellNew"
  ${EndIf}
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_SHELLNEW}"
!macroend

# Explorer takes the New-menu and Type labels from the ProgID display name.
# Follow the Windows UI language so silent installs do not flip an existing
# localized name back to English.
!macro NotaDownSetFileTypeName
  System::Call 'kernel32::GetUserDefaultUILanguage() i .R3'
  IntOp $R3 $R3 & 0x3FF
  ${If} $R3 == 4
    WriteRegStr SHELL_CONTEXT "Software\Classes\${NOTADOWN_ASSOC_PROGID}" "" "Markdown 文件"
  ${Else}
    WriteRegStr SHELL_CONTEXT "Software\Classes\${NOTADOWN_ASSOC_PROGID}" "" "Markdown document"
  ${EndIf}
!macroend

!macro customInit
  !insertmacro NotaDownBackupAssociation "md" "Md"
  !insertmacro NotaDownBackupAssociation "markdown" "Markdown"
  !insertmacro NotaDownBackupAssociation "mdown" "Mdown"
  !insertmacro NotaDownBackupAssociation "mkd" "Mkd"
  # Silent installs skip the options page, so start from the previous choice.
  ReadRegDWORD $R2 SHELL_CONTEXT "${NOTADOWN_SHELLNEW}" "Preferred"
  ${If} $R2 == 0
    StrCpy $ShellNewChoice 0
  ${Else}
    StrCpy $ShellNewChoice 1
  ${EndIf}
  !insertmacro NotaDownDetectShellNew
!macroend

!macro customPageAfterChangeDir
  Function NotaDownAssocPageCreate
    ${If} $LANGUAGE == 2052
      StrCpy $AssocTitle "文件关联"
      StrCpy $AssocSubtitle "以下 Markdown 文件类型会加入右键“打开方式”菜单。"
      StrCpy $AssocHint "双击文件使用的程序由系统决定，本次安装不会改动它。首次启动 NotaDown 时会引导你设置。"
      StrCpy $AssocMdLabel "Markdown 文件（.md）"
      StrCpy $AssocMarkdownLabel "Markdown 文件（.markdown）"
      StrCpy $AssocMdownLabel "Markdown 文件（.mdown）"
      StrCpy $AssocMkdLabel "Markdown 文件（.mkd）"
      StrCpy $ShellNewLabelText "在右键“新建”菜单中添加“Markdown 文件”"
    ${Else}
      StrCpy $AssocTitle "File associations"
      StrCpy $AssocSubtitle "These Markdown file types are added to the “Open with” menu."
      StrCpy $AssocHint "The program used for double-clicking is decided by Windows and is not changed here. NotaDown offers to set it on first launch."
      StrCpy $AssocMdLabel "Markdown files (.md)"
      StrCpy $AssocMarkdownLabel "Markdown files (.markdown)"
      StrCpy $AssocMdownLabel "Markdown files (.mdown)"
      StrCpy $AssocMkdLabel "Markdown files (.mkd)"
      StrCpy $ShellNewLabelText "Add “Markdown file” to the right-click New menu"
    ${EndIf}
    ${If} $ShellNewForeign == 1
      ${If} $LANGUAGE == 2052
        StrCpy $ShellNewLabelText "$ShellNewLabelText（系统已有该新建项，保持不变）"
      ${Else}
        StrCpy $ShellNewLabelText "$ShellNewLabelText (already provided by another app)"
      ${EndIf}
    ${EndIf}

    nsDialogs::Create 1018
    Pop $AssocDialog
    ${If} $AssocDialog == error
      Abort
    ${EndIf}

    GetDlgItem $0 $HWNDPARENT 1037
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$AssocTitle"
    GetDlgItem $0 $HWNDPARENT 1038
    SendMessage $0 ${WM_SETTEXT} 0 "STR:$AssocSubtitle"

    ${NSD_CreateLabel} 0 0 100% 26u "$AssocHint"
    Pop $0

    ${NSD_CreateCheckbox} 0 34u 100% 12u "$AssocMdLabel"
    Pop $AssocMdCheck
    ${NSD_CreateCheckbox} 0 50u 100% 12u "$AssocMarkdownLabel"
    Pop $AssocMarkdownCheck
    ${NSD_CreateCheckbox} 0 66u 100% 12u "$AssocMdownLabel"
    Pop $AssocMdownCheck
    ${NSD_CreateCheckbox} 0 82u 100% 12u "$AssocMkdLabel"
    Pop $AssocMkdCheck

    ${NSD_Check} $AssocMdCheck
    ${NSD_Check} $AssocMarkdownCheck
    ${NSD_Check} $AssocMdownCheck
    ${NSD_Check} $AssocMkdCheck
    EnableWindow $AssocMdCheck 0
    EnableWindow $AssocMarkdownCheck 0
    EnableWindow $AssocMdownCheck 0
    EnableWindow $AssocMkdCheck 0

    ${NSD_CreateCheckbox} 0 100u 100% 12u "$ShellNewLabelText"
    Pop $ShellNewCheck
    ${If} $ShellNewForeign == 1
      ${NSD_Check} $ShellNewCheck
      EnableWindow $ShellNewCheck 0
    ${ElseIf} $ShellNewChoice == 1
      ${NSD_Check} $ShellNewCheck
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function NotaDownAssocPageLeave
    ${NSD_GetState} $ShellNewCheck $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $ShellNewChoice 1
    ${Else}
      StrCpy $ShellNewChoice 0
    ${EndIf}
  FunctionEnd

  Page custom NotaDownAssocPageCreate NotaDownAssocPageLeave
!macroend

# Listing the extensions here is what makes NotaDown appear in the Windows
# "Default apps" page, which the first-launch guide deep-links to.
!macro NotaDownCapabilityFileAssociation EXT
  WriteRegStr SHELL_CONTEXT "${NOTADOWN_CAPABILITIES}\FileAssociations" ".${EXT}" "${NOTADOWN_ASSOC_PROGID}"
!macroend

!macro customInstall
  WriteRegStr SHELL_CONTEXT "${NOTADOWN_CAPABILITIES}" "ApplicationName" "${PRODUCT_NAME}"
  WriteRegStr SHELL_CONTEXT "${NOTADOWN_CAPABILITIES}" "ApplicationDescription" "Markdown editor"
  !insertmacro NotaDownCapabilityFileAssociation "md"
  !insertmacro NotaDownCapabilityFileAssociation "markdown"
  !insertmacro NotaDownCapabilityFileAssociation "mdown"
  !insertmacro NotaDownCapabilityFileAssociation "mkd"
  WriteRegStr SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}" "${NOTADOWN_CAPABILITIES}"

  !insertmacro NotaDownSetFileTypeName

  ${If} $ShellNewChoice == 1
  ${AndIf} $ShellNewForeign == 0
    WriteRegStr SHELL_CONTEXT "Software\Classes\.md\ShellNew" "NullFile" ""
    WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_SHELLNEW}" "Created" 1
  ${Else}
    !insertmacro NotaDownRemoveShellNew
  ${EndIf}
  WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_SHELLNEW}" "Preferred" $ShellNewChoice

  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}"
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_CAPABILITIES}"
  !insertmacro NotaDownRemoveShellNew
  !insertmacro NotaDownRestoreAssociation "md" "Md"
  !insertmacro NotaDownRestoreAssociation "markdown" "Markdown"
  !insertmacro NotaDownRestoreAssociation "mdown" "Mdown"
  !insertmacro NotaDownRestoreAssociation "mkd" "Mkd"
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}"
!macroend
