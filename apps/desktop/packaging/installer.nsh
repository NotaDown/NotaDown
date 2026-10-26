!include "LogicLib.nsh"
!include "nsDialogs.nsh"
!include "WinMessages.nsh"

!define NOTADOWN_ASSOC_PROGID "Markdown Document"
!define NOTADOWN_ASSOC_BACKUP "Software\NotaDown\AssociationBackup"

!ifndef BUILD_UNINSTALLER
Var AssocMd
Var AssocMarkdown
Var AssocMdown
Var AssocMkd
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
# captured in customInit and restored when an extension is unchecked or removed.
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

!macro NotaDownReadChoice KEY VAR
  ReadRegDWORD ${VAR} SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "${KEY}Enabled"
  ${If} ${VAR} == ""
    StrCpy ${VAR} "1"
  ${EndIf}
!macroend

!macro customInit
  !insertmacro NotaDownReadChoice "Md" $AssocMd
  !insertmacro NotaDownReadChoice "Markdown" $AssocMarkdown
  !insertmacro NotaDownReadChoice "Mdown" $AssocMdown
  !insertmacro NotaDownReadChoice "Mkd" $AssocMkd

  !insertmacro NotaDownBackupAssociation "md" "Md"
  !insertmacro NotaDownBackupAssociation "markdown" "Markdown"
  !insertmacro NotaDownBackupAssociation "mdown" "Mdown"
  !insertmacro NotaDownBackupAssociation "mkd" "Mkd"
!macroend

!macro customPageAfterChangeDir
  Page custom NotaDownAssocPageCreate NotaDownAssocPageLeave

  Function NotaDownAssocPageCreate
    ${If} $LANGUAGE == 2052
      StrCpy $AssocTitle "文件关联"
      StrCpy $AssocSubtitle "选择要与 NotaDown 关联的 Markdown 文件类型。"
      StrCpy $AssocHint "勾选的文件类型会出现在“打开方式”菜单中。Windows 不会自动更改默认应用，可在系统设置中确认。"
      StrCpy $AssocMdLabel "Markdown 文件（.md）"
      StrCpy $AssocMarkdownLabel "Markdown 文件（.markdown）"
      StrCpy $AssocMdownLabel "Markdown 文件（.mdown）"
      StrCpy $AssocMkdLabel "Markdown 文件（.mkd）"
    ${Else}
      StrCpy $AssocTitle "File associations"
      StrCpy $AssocSubtitle "Choose which Markdown file types should open with NotaDown."
      StrCpy $AssocHint "The selected types are added to the Open with menu. Windows keeps your current default app until you change it in system settings."
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

    ${If} $AssocMd == 1
      ${NSD_Check} $AssocMdCheck
    ${EndIf}
    ${If} $AssocMarkdown == 1
      ${NSD_Check} $AssocMarkdownCheck
    ${EndIf}
    ${If} $AssocMdown == 1
      ${NSD_Check} $AssocMdownCheck
    ${EndIf}
    ${If} $AssocMkd == 1
      ${NSD_Check} $AssocMkdCheck
    ${EndIf}

    nsDialogs::Show
  FunctionEnd

  Function NotaDownAssocPageLeave
    ${NSD_GetState} $AssocMdCheck $AssocMd
    ${NSD_GetState} $AssocMarkdownCheck $AssocMarkdown
    ${NSD_GetState} $AssocMdownCheck $AssocMdown
    ${NSD_GetState} $AssocMkdCheck $AssocMkd
  FunctionEnd
!macroend

!macro customInstall
  ${If} $AssocMd != 1
    !insertmacro NotaDownRestoreAssociation "md" "Md"
  ${EndIf}
  ${If} $AssocMarkdown != 1
    !insertmacro NotaDownRestoreAssociation "markdown" "Markdown"
  ${EndIf}
  ${If} $AssocMdown != 1
    !insertmacro NotaDownRestoreAssociation "mdown" "Mdown"
  ${EndIf}
  ${If} $AssocMkd != 1
    !insertmacro NotaDownRestoreAssociation "mkd" "Mkd"
  ${EndIf}

  WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "MdEnabled" $AssocMd
  WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "MarkdownEnabled" $AssocMarkdown
  WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "MdownEnabled" $AssocMdown
  WriteRegDWORD SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}" "MkdEnabled" $AssocMkd

  !insertmacro UPDATEFILEASSOC
!macroend

!macro customUnInstall
  !insertmacro NotaDownRestoreAssociation "md" "Md"
  !insertmacro NotaDownRestoreAssociation "markdown" "Markdown"
  !insertmacro NotaDownRestoreAssociation "mdown" "Mdown"
  !insertmacro NotaDownRestoreAssociation "mkd" "Mkd"
  DeleteRegKey SHELL_CONTEXT "${NOTADOWN_ASSOC_BACKUP}"
!macroend
