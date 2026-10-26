!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!define NOTADOWN_ASSOC_PROGID "Markdown Document"
!define NOTADOWN_ASSOC_BACKUP "Software\NotaDown\AssociationBackup"
!define NOTADOWN_CAPABILITIES "Software\NotaDown\Capabilities"

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
!endif
Var AssocBackupHas
Var AssocBackupValue

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

!macro customInit
  !insertmacro NotaDownBackupAssociation "md" "Md"
  !insertmacro NotaDownBackupAssociation "markdown" "Markdown"
  !insertmacro NotaDownBackupAssociation "mdown" "Mdown"
  !insertmacro NotaDownBackupAssociation "mkd" "Mkd"
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
    ${Else}
      StrCpy $AssocTitle "File associations"
      StrCpy $AssocSubtitle "These Markdown file types are added to the “Open with” menu."
      StrCpy $AssocHint "The program used for double-clicking is decided by Windows and is not changed here. NotaDown offers to set it on first launch."
      StrCpy $AssocMdLabel "Markdown files (.md)"
      StrCpy $AssocMarkdownLabel "Markdown files (.markdown)"
      StrCpy $AssocMdownLabel "Markdown files (.mdown)"
      StrCpy $AssocMkdLabel "Markdown files (.mkd)"
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

    nsDialogs::Show
  FunctionEnd

  Page custom NotaDownAssocPageCreate
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

  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  DeleteRegValue SHELL_CONTEXT "Software\RegisteredApplications" "${PRODUCT_NAME}"
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_CAPABILITIES}"
  !insertmacro NotaDownRestoreAssociation "md" "Md"
  !insertmacro NotaDownRestoreAssociation "markdown" "Markdown"
  !insertmacro NotaDownRestoreAssociation "mdown" "Mdown"
  !insertmacro NotaDownRestoreAssociation "mkd" "Mkd"
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}"
!macroend
