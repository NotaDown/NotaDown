!include "LogicLib.nsh"
!include "nsDialogs.nsh"

!define NOTADOWN_ASSOC_PROGID "Markdown Document"
!define NOTADOWN_ASSOC_BACKUP "Software\NotaDown\AssociationBackup"

LangString NOTADOWN_ASSOC_TITLE 1033 "File associations"
LangString NOTADOWN_ASSOC_TITLE 2052 "文件关联"

LangString NOTADOWN_ASSOC_SUBTITLE 1033 "Choose which Markdown file types should open with NotaDown."
LangString NOTADOWN_ASSOC_SUBTITLE 2052 "选择要与 NotaDown 关联的 Markdown 文件类型。"

LangString NOTADOWN_ASSOC_HINT 1033 "The selected types are added to the Open with menu. Windows keeps your current default app until you change it in system settings."
LangString NOTADOWN_ASSOC_HINT 2052 "勾选的文件类型会出现在“打开方式”菜单中。Windows 不会自动更改默认应用，可在系统设置中确认。"

LangString NOTADOWN_ASSOC_EXT_MD 1033 "Markdown files (.md)"
LangString NOTADOWN_ASSOC_EXT_MD 2052 "Markdown 文件（.md）"

LangString NOTADOWN_ASSOC_EXT_MARKDOWN 1033 "Markdown files (.markdown)"
LangString NOTADOWN_ASSOC_EXT_MARKDOWN 2052 "Markdown 文件（.markdown）"

LangString NOTADOWN_ASSOC_EXT_MDOWN 1033 "Markdown files (.mdown)"
LangString NOTADOWN_ASSOC_EXT_MDOWN 2052 "Markdown 文件（.mdown）"

LangString NOTADOWN_ASSOC_EXT_MKD 1033 "Markdown files (.mkd)"
LangString NOTADOWN_ASSOC_EXT_MKD 2052 "Markdown 文件（.mkd）"

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
    !insertmacro MUI_HEADER_TEXT "$(NOTADOWN_ASSOC_TITLE)" "$(NOTADOWN_ASSOC_SUBTITLE)"

    nsDialogs::Create 1018
    Pop $AssocDialog
    ${If} $AssocDialog == error
      Abort
    ${EndIf}

    ${NSD_CreateLabel} 0 0 100% 26u "$(NOTADOWN_ASSOC_HINT)"
    Pop $0

    ${NSD_CreateCheckbox} 0 34u 100% 12u "$(NOTADOWN_ASSOC_EXT_MD)"
    Pop $AssocMdCheck
    ${NSD_CreateCheckbox} 0 50u 100% 12u "$(NOTADOWN_ASSOC_EXT_MARKDOWN)"
    Pop $AssocMarkdownCheck
    ${NSD_CreateCheckbox} 0 66u 100% 12u "$(NOTADOWN_ASSOC_EXT_MDOWN)"
    Pop $AssocMdownCheck
    ${NSD_CreateCheckbox} 0 82u 100% 12u "$(NOTADOWN_ASSOC_EXT_MKD)"
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
