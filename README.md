AutoCorrect plugin for CKEditor
============================

AutoCorrect recognizes hyperlinks, replace defined sequences of characters with specific characters.
It improves your typography by replacing quotation marks with typographic quotes, three dots with "three dots" character, hyphens with dashes.
It autoformats numbered and bulleted lists as you type, recognizes and formats ordinal numbers, such as `1st`, `2nd` etc.
AutoCorrect inserts horizontal rule if you put three or more `-` characters in a paragraph.

Optional feature: you can disable typing of double spaces.

Useful replacement character sequences:

Typed            | Replaced
---------------- | -------------
`<-- and -->`    | ← and →
`<-->`           | ↔
`-+ or +-`       | ±
`~=`             | ≈
`(c), (r), (tm)` | ©, ®, ™
`(о)`            | ˚
`...`            | …
`<< and >>`      | « and »
`1/2, 1/4, 3/4`  | ½, ¼, ¾

Installation
------------

Place it in plugins/autocorrect directory where CKEditor is installed and don't forget to add 'autocorrect' to config.extraPlugins

Config
------

*CKEDITOR.config.autocorrect_replacementTable* - characters to replace as you type (key/value map)

*CKEDITOR.config.autocorrect_useReplacementTable* - use the characters table to replace as you type

*CKEDITOR.config.autocorrect_recognizeUrls* - recognize hyperlinks as you type

*CKEDITOR.config.autocorrect_replaceHyphens* - replace hypens with dashes as you type

*CKEDITOR.config.autocorrect_ignoreDoubleSpaces* - ignore double spaces

*CKEDITOR.config.autocorrect_replaceSingleQuotes* - replace single quotes as you type

*CKEDITOR.config.autocorrect_replaceDoubleQuotes* - replace double quotes as you type

*CKEDITOR.config.autocorrect_createHorizontalRules* - replace `---` or `___` (tree or more characters in a row) with horizontal rule

*CKEDITOR.config.autocorrect_formatBulletedLists* - format `* any text` as bulleted list on `Enter` key press

*CKEDITOR.config.autocorrect_formatBulletedLists* - format `1. any text` as numbered list on `Enter` key press (possible formats: `1` , `a` or `I` with dots or right parenthesis)

*input[id=AUTO_SAVE_URL]* - input (usually hidden) with save url (located on the page)

Usage
-----



Author
------

**Danil Kostin**

+ http://twitter.com/DanyaPostfactum
+ http://github.com/danyaPostfactum