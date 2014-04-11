AutoCorrect plugin for CKEditor
============================

Brings some autocorrect features from MS Word / Open Office word processors.
Works as you type only. At present there is no way to autocorrect an existing text.

Features:

* Smart quotes
* Hyperlink autoformat
* Bulleted and numbered lists autoformat (start a paragraph with `*` or `1.` and hit Space)
* Character sequences autoreplace (e.g. (c) → ©)
* Ordinal numbers autoformat (e.g. 1st → 1<sup>st</sup>)
* Hyphen to dash conversion (`-` → `–`)
* Horizontal rule insertion (type `---` or `___` and press Enter)

Different numbered lists are supported: `1. `, `a. `, `I. `. A right parenthesis can be used instead of full stops.
The following markers are recognized as bulleted list markers: `*`, `+`, `•`.

Useful replacement character sequences:

Typed            | Replaced
---------------- | -------------
`<-- and -->`    | ← and →
`<-->`           | ↔
`-+ or +-`       | ±
`~=`             | ≈
`(c), (r), (tm)` | ©, ®, ™
`(o)`            | ˚
`...`            | …
`<< and >>`      | « and »
`1/2, 1/4, 3/4`  | ½, ¼, ¾

Installation
------------

Place it in plugins/autocorrect directory where CKEditor is installed and don't forget to add 'autocorrect' to config.extraPlugins

Config
------

*autocorrect_enabled* (Boolean) - disable autocorrect as you type by default (default: true)

*autocorrect_replacementTable* (Object) - characters to replace as you type (key/value map)

*autocorrect_useReplacementTable* (Boolean) - use the characters table to replace as you type (default: true)

*autocorrect_recognizeUrls* (Boolean) - recognize hyperlinks as you type (default: true)

*autocorrect_replaceHyphens* (Boolean) - replace hypens with dashes as you type (default: true)

*autocorrect_dash* (String) - a character to replace a hyphen with (defalut: '–')

*autocorrect_replaceSingleQuotes* (Boolean) - replace single quotes as you type (default: true)

*autocorrect_singleQuotes* (String) - quote pair to use as replacements (defalut: '‘’')

*autocorrect_replaceDoubleQuotes* (Boolean) - replace double quotes as you type (default: true)

*autocorrect_doubleQuotes* (String) - quote pair to use as single quotes replacements (defalut: '“”')

*autocorrect_createHorizontalRules* (Boolean) - replace `---` or `___` (tree or more characters in a row) with horizontal rule (default: true)

*autocorrect_formatBulletedLists*  (Boolean)- format `* any text` as bulleted list (possible markers: `*`, `+`, `•`) (default: true)

*autocorrect_formatNumberedLists* (Boolean) - format `1. any text` as numbered list (possible formats: `1` , `a` or `I` with dots or right parenthesis) (default: true)


Usage
-----



Author
------

**Danil Kostin**

+ http://twitter.com/DanyaPostfactum
+ http://github.com/danyaPostfactum