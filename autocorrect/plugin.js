/**
 * @license TODO
 */

/**
 * @fileOverview TODO
 */

(function() {

	var isBookmark = CKEDITOR.dom.walker.bookmark();

	function CharacterIterator(range) {
		var walker = new CKEDITOR.dom.walker( range );
		walker.evaluator = function( node ) { return (node.type === CKEDITOR.NODE_TEXT && !isBookmark(node)) || (node.type === CKEDITOR.NODE_ELEMENT && node.getName() == 'br'); };
		walker.current = range.startContainer;
		this.walker = walker;
		this.referenceNode = range.startContainer;
		this.referenceCharacter = null;
		this.referenceCharacterOffset = range.startOffset;
	}

	CharacterIterator.prototype.nextCharacter = function() {
		// TODO
		return null;
	};

	CharacterIterator.prototype.previousCharacter = function() {
		while (this.referenceCharacterOffset === 0) {
			this.walker.current = this.referenceNode;
			this.referenceNode = this.walker.previous();
			if (!this.referenceNode)
				return null;
			if (this.referenceNode.type === CKEDITOR.NODE_ELEMENT && this.referenceNode.getName() == 'br')
				return null;
			this.referenceCharacterOffset = this.referenceNode.getText().length;
		}
		if (this.referenceCharacterOffset === 0)
			return null;
		this.referenceCharacter = this.referenceNode.getText()[--this.referenceCharacterOffset];
		return this.referenceCharacter;
	};

	CKEDITOR.plugins.add( 'autocorrect', {
		requires: 'menubutton',
		lang: 'en,ru',
		icons: 'autocorrect', // %REMOVE_LINE_CORE%
		hidpi: true, // %REMOVE_LINE_CORE%
		init: function( editor ) {
			var config = editor.config;
			var lang = editor.lang.autocorrect;

			editor.addCommand( 'autocorrect', {
				exec: function(editor) {
					editor.fire( 'saveSnapshot' );
					var selectedRange = editor.getSelection().getRanges().shift();
					var bookmark = selectedRange.createBookmark();

					var walkerRange;
					if (selectedRange.collapsed) {
						walkerRange = new CKEDITOR.dom.range(editor.editable());
						walkerRange.selectNodeContents(editor.editable());
					} else {
						walkerRange = selectedRange.clone();
					}

					var walker = new CKEDITOR.dom.walker( walkerRange );
					editor.editable().$.normalize();
					walker.evaluator = function( node ) { return node.type === CKEDITOR.NODE_TEXT && !isBookmark(node) };
					var node;
					while (node = walker.next()) {
						var next = getNext(node);
						var parent = getBlockParent(node);
						correctTextNode(node, (parent.isBlockBoundary() && !next) || next && next.type === CKEDITOR.NODE_ELEMENT && next.getName() === 'br');
						if (parent.getName() === 'p' && !skipBreaks(next)) {
							correctParagraph(parent);
						}
					}

					editor.getSelection().selectBookmarks([bookmark]);
					editor.fire( 'saveSnapshot' );
				}
			} );

			var command = editor.addCommand('toggleAutocorrect', {
				preserveState: true,
				canUndo: false,

				exec: function( editor ) {
					this.setState(isEnabled() ? CKEDITOR.TRISTATE_OFF : CKEDITOR.TRISTATE_ON);
				}
			});

			var isEnabled = function() {
				return command.state === CKEDITOR.TRISTATE_ON;
			};


			var menuGroup = 'autocorrectButton';
			editor.addMenuGroup( menuGroup );

			// combine menu items to render
			var uiMenuItems = {};

			// always added
			uiMenuItems.autoCorrectWhileTyping = {
				label: lang.disable,
				group: menuGroup,
				command: 'toggleAutocorrect'
			};

			uiMenuItems.autoCorrectNow = {
				label: lang.apply,
				command: 'autocorrect',
				group: menuGroup
			};

			editor.addMenuItems( uiMenuItems );

			editor.ui.add( 'AutoCorrect', CKEDITOR.UI_MENUBUTTON, {
				label: lang.toolbar,
				modes: { wysiwyg: 1 },
				toolbar: 'spellchecker,20',
				onRender: function() {
					command.on( 'state', function() {
						this.setState( command.state );
					}, this );
				},
				onMenu: function() {
					editor.getMenuItem( 'autoCorrectWhileTyping' ).label = isEnabled() ? lang.disable : lang.enable;

					return {
						autoCorrectWhileTyping: CKEDITOR.TRISTATE_OFF,
						autoCorrectNow: CKEDITOR.TRISTATE_OFF
					};
				}
			});

			var showInitialState = function( evt ) {
				evt.removeListener();
				command.setState( config.autocorrect_enabled ? CKEDITOR.TRISTATE_ON : CKEDITOR.TRISTATE_OFF );
			};

			editor.on( 'instanceReady', showInitialState );

			var isTyping = false;

			function skipBreaks(node, isBackwards) {
				while (node && node.type == CKEDITOR.NODE_ELEMENT && node.getName() == 'br') {
					node = isBackwards ? node.getPrevious() : node.getNext();
				}
				return node;
			}

			function isWhitespace(ch) {
				return ch === ' ' || ch === ' ';
			}

			function isPunctuation(ch) {
				return ch === '.' || ch === ',' || ch === '!' || ch === '?' || ch === '/';
			}

			function isWordPart(ch) {
				return ch >= 'A' && ch <= 'Z'
					|| ch >= 'a' && ch <= 'z'
					|| ch >= 'а' && ch <= 'я'
					|| ch >= 'А' && ch <= 'Я'
					|| ch == 'ё' || ch == 'Ё'
					|| ch >= '0' && ch <= '9';
			}

			function moveCursorIntoTextNode(cursor) {
				if (cursor.startContainer.type == CKEDITOR.NODE_ELEMENT) {
					var startNode = cursor.startContainer.getChild(cursor.startOffset - 1);
					// Firefox in some cases sets cursor after ending <br>
					startNode = skipBreaks(startNode, true);
					if (!startNode)
						return;
					cursor.setStart(startNode, startNode.getText().length);
					cursor.collapse(true);
				}
			}

			function correctAtCursor(cursor, isEnter) {
				moveCursorIntoTextNode(cursor);

				var input;
				if (isEnter) {
					input = '';
				} else {
					input = cursor.startContainer.getText().substring(cursor.startOffset-1, cursor.startOffset);
				}

				if (config.autocorrect_replaceDoubleQuotes && replaceDoubleQuote(cursor, input))
					return;

				if (config.autocorrect_replaceSingleQuotes && replaceSingleQuote(cursor, input))
					return;

				// bulleted and numbered lists
				if (isWhitespace(input))
					autoCorrectOnWhitespace(cursor, input);

				if (isEnter || isPunctuation(input) || isWhitespace(input))
					autoCorrectOnDelimiter(cursor, input);
			}

			function correctTextNode(node, isBlockEnding) {
				var cursor = new CKEDITOR.dom.range(editor.editable());
				cursor.setStart(node, 0);
				cursor.collapse(true);
				while (cursor.startOffset < cursor.startContainer.getText().length) {
					cursor.setStart(cursor.startContainer, cursor.startOffset + 1);
					cursor.setEnd(cursor.startContainer, cursor.startOffset);
					correctAtCursor(cursor, false);
					if (isBlockEnding && cursor.endOffset == cursor.startContainer.getText().length) {
						// "Emulate" Enter key
						correctAtCursor(cursor, true);
					}
				}

			}

			function correctParagraph(p) {
				if (!p)
					return;

				// FIXME this way is wrong
				var content = p.getText();

				if (config.autocorrect_createHorizontalRules && insertHorizontalRule(p, content))
					return;
			}

			function getNext(node) {
				var next = node.getNext();
				while (next && isBookmark(next)) {
					next = next.getNext();
				}
				return next;
			}

			function replaceRangeContent(range, data) {
				var walker = new CKEDITOR.dom.walker( range );
				walker.evaluator = function( node ) { return node.type === CKEDITOR.NODE_ELEMENT && isBookmark(node); };
				var bm;
				var bookmarks = [];
				while (bm = walker.next()) {
					bookmarks.push(bm);
				}
				range.deleteContents();
				for (var i = 0; i < bookmarks.length; i++) {
					range.insertNode(bookmarks[i]);
				}
				range.insertNode(new CKEDITOR.dom.text(data));
			}

			function find(needle, startNode, startCharacterOffset, delimiters) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(startNode));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = startNode;
				iterator.referenceCharacterOffset = startCharacterOffset;
				var ch;
				var i = needle.length - 1;
				var range = new CKEDITOR.dom.range(editor.editable());
				while ((ch = iterator.previousCharacter()) && !(ch in delimiters)) {
					if (ch == needle[i]) {
						if (i == needle.length - 1)
							range.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset + 1);
						i--;
						if (i < 0)
							break;
					} else {
						i = needle.length - 1;
					}
				}
				if (i >= 0)
					return null;
				range.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
				return range;
			}

			function replaceHyphenPairInWord(cursor, delimiter) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				for (var i = 0; i < delimiter.length; i++)
					iterator.previousCharacter();

				var hypenPairRange = find('--', iterator.referenceNode, iterator.referenceCharacterOffset, {' ': true, ' ': true});
				if (!hypenPairRange)
					return false;


				var charBeforeHypens = iterator.previousCharacter();

				if (!charBeforeHypens || !isWordPart(charBeforeHypens))
					return false;

				iterator.referenceNode = hypenPairRange.endContainer;
				iterator.referenceCharacterOffset = hypenPairRange.endOffset;

				var charAfterHypens = iterator.nextCharacter();

				if (charAfterHypens && !isWordPart(charAfterHypens))
					return false;

				beforeReplace();
				var bookmark = cursor.createBookmark();
				replaceRangeContent(hypenPairRange, '—');
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();
			}

			function replaceHyphens(cursor, input) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				for (var i = 0; i < input.length; i++)
					iterator.previousCharacter();

				var hypensRange = new CKEDITOR.dom.range(editor.editable());
				hypensRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);

				var leftChar = iterator.previousCharacter();
				if (leftChar !== '-')
					return false;

				hypensRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
				var charBeforeHyphen = iterator.previousCharacter();
				if (charBeforeHyphen == '-') {
					hypensRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
					charBeforeHyphen = iterator.previousCharacter();
				}

				if (!isWhitespace(charBeforeHyphen))
					return false;

				var dash = config.autocorrect_dash;
				beforeReplace();
				var bookmark = cursor.createBookmark();
				replaceRangeContent(hypensRange, dash);
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();
			}

			function autoCorrectOnWhitespace(cursor, inputChar) {
				if (config.autocorrect_formatBulletedLists && formatBulletedList(cursor, inputChar))
					return;

				if (config.autocorrect_formatNumberedLists && formatNumberedList(cursor, inputChar))
					return;

				if (config.autocorrect_replaceHyphens)
					replaceHyphens(cursor, inputChar);
			}

			function autoCorrectOnDelimiter(cursor, delimiter) {
				if (config.autocorrect_recognizeUrls && formatHyperlink(cursor, delimiter))
					return;

				if (config.autocorrect_useReplacementTable)
					replaceSequence(cursor, delimiter);

				if (config.autocorrect_formatOrdinals)
					formatOrdinals(cursor, delimiter);

				if (config.autocorrect_replaceHyphens)
					replaceHyphenPairInWord(cursor, delimiter);
			}

			var bookmark;
			function beforeReplace() {
				if (!isTyping)
					return;
				editor.fire( 'saveSnapshot' );
				bookmark = editor.getSelection().getRanges().shift().createBookmark();
			}

			function afterReplace() {
				if (!isTyping)
					return;
				editor.getSelection().selectBookmarks([bookmark]);
				editor.fire( 'saveSnapshot' );
			}

			var replacementTable = config.autocorrect_replacementTable;
			function replaceSequence(cursor, delimiter) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				for (var i = 0; i < delimiter.length; i++)
					iterator.previousCharacter();

				var replacement;
				var match;
				var matchRange = new CKEDITOR.dom.range(editor.editable());
				matchRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				var sequence = '';
				var ch;
				while ((ch = iterator.previousCharacter()) && !isWhitespace(ch)) {
					sequence = ch + sequence;
					if (sequence in replacementTable) {
						match = sequence;
						replacement = replacementTable[match];
						matchRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
					}
				}

				if (!replacement)
					return false;

				beforeReplace();
				var bookmark = cursor.createBookmark();
				replaceRangeContent(matchRange, replacement);
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();

				return true;
			}

			var urlRe = /^(http:|https:|ftp:|mailto:|tel:|skype:|www\.).+$/i;
			function formatHyperlink(cursor, delimiter) {
				if (isPunctuation(delimiter))
					return;
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				for (var i = 0; i < delimiter.length; i++)
					iterator.previousCharacter();

				var matchRange = new CKEDITOR.dom.range(editor.editable());
				matchRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				var tail = true;
				var match = '';
				var ch;
				while ((ch = iterator.previousCharacter()) && ch != ' ' && ch != ' ') {
					// skip trailing punctuation
					if (tail && ch.match(/[\.,?!#]/)) {
						matchRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
						continue;
					}
					match = ch + match;
					tail = false;
					matchRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
				}

				match = match.match(urlRe);

				if (!match)
					return false;

				var url = match[0];
				var href = match[1].toLowerCase() === 'www.' ? 'http://' + url : url;

				beforeReplace();
				var bookmark = cursor.createBookmark();
				var attributes = {'data-cke-saved-href': href, href: href};
				var style = new CKEDITOR.style({ element: 'a', attributes: attributes } );
				style.type = CKEDITOR.STYLE_INLINE; // need to override... dunno why.
				style.applyToRange( matchRange );
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();

				return true;
			}

			var suffixes = {'st': true, 'nd': true, 'rd': true, 'th': true};
			function formatOrdinals(cursor, delimiter) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				for (var i = 0; i < delimiter.length; i++)
					iterator.previousCharacter();

				var suffixRange = new CKEDITOR.dom.range(editor.editable());
				suffixRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				var suffix = '';
				var ch;
				for (var i = 0; i < 2; i++) {
					ch = iterator.previousCharacter();
					if (!ch)
						break;
					suffix = ch + suffix;
				}
				if (!(suffix in suffixes))
					return false;
				suffixRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);

				var number = '';
				while (ch = iterator.previousCharacter()) {
					if (ch >= '0' && ch <= '9')
						number = ch + number;
					else if (isWordPart(ch))
						return false;
					else
						break;
				}

				var n = number % 100;
				if (n > 9 && n < 20) {
					if (suffix !== 'th')
						return false;
				} else {
					n = number % 10;
					if (n == 1) {
						if (suffix !== 'st')
							return false;
					} else if (n == 2) {
						if (suffix !== 'nd')
							return false;
					} else if (n == 3) {
						if (suffix !== 'rd')
							return false;
					} else if (suffix !== 'th')
						return false;
				}

				beforeReplace();
				var bookmark = cursor.createBookmark();
				var style = new CKEDITOR.style({ element: 'sup' } );
				style.applyToRange( suffixRange );
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();

				return true;
			}

			var horizontalRuleMarkers = ['-', '_'];
			var horizontalRuleRe = new RegExp('^' + '(' + horizontalRuleMarkers.map(function(marker){ return marker + '{3,}';}).join('|') + ')' + '$');
			function insertHorizontalRule(parent, content) {
				var match = content.match(horizontalRuleRe);
				if (!match)
					return false;

				var hr = editor.document.createElement( 'hr' );
				hr.replace(parent);

				return true;
			}

			var bulletedListMarkers = ['*', '+', '•'];
			function formatBulletedList(cursor, input) {
				var parent = getBlockParent(cursor.startContainer);

				if (parent.getName() !== 'p')
					return;

				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				var markerRange = new CKEDITOR.dom.range(editor.editable());
				markerRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				for (var i = 0; i < input.length; i++)
					iterator.previousCharacter();

				var marker = iterator.previousCharacter();

				if (!marker || bulletedListMarkers.indexOf(marker) < 0)
					return false;

				markerRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);

				if (iterator.previousCharacter())
					return false;

				var previous = parent.getPrevious();

				beforeReplace();
				var bookmark = cursor.createBookmark();
				markerRange.deleteContents();
				if (!isTyping && previous && previous.type == CKEDITOR.NODE_ELEMENT && previous.getName() == 'ul') {
					appendContentsToList(parent, previous);
				} else {
					replaceContentsWithList([parent], 'ul', null);
				}
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();

				return true;
			}

			function formatNumberedList(cursor, input) {
				var parent = getBlockParent(cursor.startContainer);

				if (parent.getName() !== 'p')
					return;

				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				var markerRange = new CKEDITOR.dom.range(editor.editable());
				markerRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				for (var i = 0; i < input.length; i++)
					iterator.previousCharacter();

				var delimiter = iterator.previousCharacter();
				if (!(delimiter in {'.': true, ')': true}))
					return false;

				var start = '';
				var ch;
				while ((ch = iterator.previousCharacter()) && ch != ' ' && ch != ' ') {
					start = ch + start;
					markerRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);
				}

				var type;
				if (start.match(/^[0-9]+$/))
					type = '1';
				else if (start.match(/^[ivxlcdm]+$/))
					type = 'i';
				else if (start.match(/^[IVXLCDM]+$/))
					type = 'I';
				else if (start.match(/^[a-z]$/))
					type = 'a';
				else if (start.match(/^[A-Z]$/))
					type = 'A';
				else
					return false;

				if (iterator.previousCharacter())
					return false;

				var startNumber = toNumber(start, type);

				var parent = getBlockParent(cursor.startContainer);
				var previous = parent.getPrevious();

				beforeReplace();
				var bookmark = cursor.createBookmark();
				markerRange.deleteContents();
				if (!isTyping && previous && previous.type == CKEDITOR.NODE_ELEMENT && previous.getName() == 'ol' && previous.getAttribute('type') == type && getLastNumber(previous) == startNumber - 1) {
					appendContentsToList(parent, previous);
				} else {
					var attributes = startNumber === 1 ? {type: type} : {type: type, start: startNumber};
					replaceContentsWithList([parent], 'ol', attributes);
				}
				cursor.moveToBookmark(bookmark);
				moveCursorIntoTextNode(cursor);
				afterReplace();

				return true;
			}

			var doubleQuotes = config.autocorrect_doubleQuotes;
			function replaceDoubleQuote(cursor, input) {
				if (input !== '"')
					return false;

				replaceQuote(cursor, doubleQuotes);
				return true;
			}

			var singleQuotes = config.autocorrect_singleQuotes;
			function replaceSingleQuote(cursor, input) {
				if (input !== '\'')
					return false;

				replaceQuote(cursor, singleQuotes);
				return true;
			}

			function replaceQuote(cursor, quotes) {
				var iteratorRange = new CKEDITOR.dom.range(editor.editable());
				iteratorRange.selectNodeContents(getBlockParent(cursor.startContainer));
				var iterator = new CharacterIterator(iteratorRange);
				iterator.referenceNode = cursor.startContainer;
				iterator.referenceCharacterOffset = cursor.startOffset;

				var quoteRange = new CKEDITOR.dom.range(editor.editable());
				quoteRange.setEnd(iterator.referenceNode, iterator.referenceCharacterOffset);
				iterator.previousCharacter();
				quoteRange.setStart(iterator.referenceNode, iterator.referenceCharacterOffset);

				var leftChar = iterator.previousCharacter();

				var isClosingQuote = leftChar ? '  –—([{'.indexOf(leftChar) < 0 : false;
				var replacement = quotes[Number(isClosingQuote)];

				beforeReplace();
				replaceRangeContent(quoteRange, replacement);
				afterReplace();
			}

			function getBlockParent(node) {
				while (node && (node.type !== CKEDITOR.NODE_ELEMENT || (node.getName() in CKEDITOR.dtd.$inline || node.getName() in CKEDITOR.dtd.$empty ))) {
					node = node.getParent();
				}
				return node;
			}

			function getLastNumber(list) {
				return list.$.start + list.getChildCount() - 1;
			}

			function replaceContentsWithList(listContents, type, attributes) {
				// Insert the list to the DOM tree.
				var insertAnchor = listContents[ listContents.length - 1 ].getNext(),
					listNode = editor.document.createElement( type );

				var commonParent = listContents[0].getParent();

				var contentBlock;

				while ( listContents.length ) {
					contentBlock = listContents.shift();
					appendContentsToList(contentBlock, listNode);
				}

				// Apply list root dir only if it has been explicitly declared.
				// if ( listDir && explicitDirection )
				// 	listNode.setAttribute( 'dir', listDir );

				if (attributes)
					listNode.setAttributes(attributes);

				if ( insertAnchor )
					listNode.insertBefore( insertAnchor );
				else
					listNode.appendTo( commonParent );
			}

			function appendContentsToList(contentBlock, listNode) {
				var listItem = editor.document.createElement( 'li' );

				// If current block should be preserved, append it to list item instead of
				// transforming it to <li> element.
				if ( false /*shouldPreserveBlock( contentBlock )*/ )
					contentBlock.appendTo( listItem );
				else {
					contentBlock.copyAttributes( listItem );
					// Remove direction attribute after it was merged into list root. (#7657)
					/*if ( listDir && contentBlock.getDirection() ) {
						listItem.removeStyle( 'direction' );
						listItem.removeAttribute( 'dir' );
					}*/
					contentBlock.moveChildren( listItem );
					contentBlock.remove();
				}

				listItem.appendTo( listNode );
			}

			function characterPosition(character) {
				var alfa = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
				return alfa.indexOf(character) + 1;
			}

			function toArabic(number) {
				if (!number) return 0;
				if (number.substring(0, 1) == "M") return 1000 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "CM") return 900 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "D") return 500 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "CD") return 400 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "C") return 100 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "XC") return 90 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "L") return 50 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "XL") return 40 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "X") return 10 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "IX") return 9 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "V") return 5 + toArabic(number.substring(1));
				if (number.substring(0, 2) == "IV") return 4 + toArabic(number.substring(2));
				if (number.substring(0, 1) == "I") return 1 + toArabic(number.substring(1));
			}

			function toNumber(start, type) {
				switch (type) {
					case '1':
						return start|0;
					case 'i':
						return toArabic(start.toUpperCase());
					case 'I':
						return toArabic(start);
					case 'a':
						return characterPosition(start.toUpperCase());
					case 'A':
						return characterPosition(start);
				}
			}

			editor.on( 'key', function( event ) {
				if (!isEnabled())
					return;
				if (editor.mode !== 'wysiwyg')
					return;
				if (event.data.keyCode != 2228237 && event.data.keyCode != 13)
					return;

				var cursor = editor.getSelection().getRanges().shift();
				var paragraph = null;

				if (event.data.keyCode === 13) {
					var parent = getBlockParent(cursor.startContainer);
					if (parent.getName() === 'p') {
						paragraph = parent;
					}
				}

				setTimeout(function() {
					isTyping = true;
					correctAtCursor(cursor, true);
					correctParagraph(paragraph);
					isTyping = false;
				});
			});

			editor.on( 'contentDom', function() {
				editor.editable().on( 'keypress', function( event ) {
					if (!isEnabled())
						return;
					if ( event.data.$.ctrlKey || event.data.$.metaKey )
						return;

					setTimeout(function() {
						isTyping = true;
						var cursor = editor.getSelection().getRanges().shift();
						correctAtCursor(cursor);
						isTyping = false;
					});
				});
			});
		}
	});

	CKEDITOR.plugins.autoreplace = {};

})();


CKEDITOR.config.autocorrect_enabled = true;
/**
 * 
 *
 * @cfg
 * @member CKEDITOR.config
 */
// language specific

CKEDITOR.config.autocorrect_replacementTable = {"-->": "→", "-+": "∓", "->": "→", "...": "…", "(c)": "©", "(e)": "€", "(r)": "®", "(tm)": "™", "(o)": "˚", "+-": "±", "<-": "←", "<--": "←", "<-->": "↔", "<->": "↔", "<<": "«", ">>": "»", "~=": "≈", "1/2": "½", "1/4": "¼", "3/4": "¾"};

CKEDITOR.config.autocorrect_useReplacementTable = true;

CKEDITOR.config.autocorrect_recognizeUrls = true;
// language specific
CKEDITOR.config.autocorrect_dash = '–';

CKEDITOR.config.autocorrect_replaceHyphens = true;

CKEDITOR.config.autocorrect_formatOrdinals = true;

CKEDITOR.config.autocorrect_replaceSingleQuotes = true;
// language specific
CKEDITOR.config.autocorrect_singleQuotes = "‘’";

CKEDITOR.config.autocorrect_replaceDoubleQuotes = true;
// language specific
CKEDITOR.config.autocorrect_doubleQuotes = "“”";

CKEDITOR.config.autocorrect_createHorizontalRules = true;

CKEDITOR.config.autocorrect_formatBulletedLists = true;

CKEDITOR.config.autocorrect_formatNumberedLists = true;

// XXX table autocreation?
// XXX upper first word of a sentense?