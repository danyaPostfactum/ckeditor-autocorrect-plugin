/**
 * @license TODO
 */

/**
 * @fileOverview TODO
 */

(function() {
	CKEDITOR.plugins.add( 'autocorrect', {
		init: function( editor ) {
			var config = editor.config;

			var horizontalRuleMarkers = ['-', '_'];
			var bulletedListMarkers = ['\\*', '\\+', '•'];
			var numberedListMarkers = ['[0-9]+', '[ivxlcdm]+', '[IVXLCDM]+', '[a-z]', '[A-Z]'];

			var listItemContentPattern = '(?:.*?)[^\\.!,\\s]';

			function autoCorrectOnSpaceKey() {
				var range = editor.getSelection().getRanges().shift();
				if (!range)
					return;

				var prefix = retreivePrefix(range);
				if (prefix) {
					// Format hyperlink
					if (config.autocorrect_recognizeUrls && formatHyperlink(range, prefix))
						return;

					// Autoreplace using replacement table
					if (config.autocorrect_useReplacementTable && replaceSequence(range, prefix))
						return;

					// Format ordinals
					if (config.autocorrect_formatOrdinals && formatOrdinals(range, prefix))
						return;
				}

				var leftChar = range.startContainer.getText().substring(range.startOffset-1, range.startOffset);

				// Replace hypen
				// TODO improve it
				if (config.autocorrect_replaceHyphens && leftChar == '-') {
					var index = range.startOffset;
					var dash = config.autocorrect_dash;
					setTimeout(function(){
						editor.fire( 'saveSnapshot' );
						var text = range.startContainer.getText();
						var ranges = editor.getSelection().getRanges();
						range.startContainer.setText(text.substring(0, index - 1) + dash + text.substring(index));
						if (ranges[0].startContainer.$ === range.startContainer.$) {
							ranges[0].setStart(range.startContainer, index - 1 + dash.length + 1);
							ranges[0].setEnd(range.startContainer, index - 1 + dash.length + 1);
						}
						editor.getSelection().selectRanges(ranges);
						editor.fire( 'saveSnapshot' );
					});
					return;
				}
			}

			function autoCorrectOnEnterKey() {
				var range = editor.getSelection().getRanges().shift();
				var parent = getBlockParent(range.startContainer);
				if (parent.getName() !== 'p')
					return;
				var content = parent.getText();

				if (config.autocorrect_createHorizontalRules && insertHorizontalRule(parent, content))
					return;
				// Call this after rule replacement to prevent conflicts
				autoCorrectOnSpaceKey();

				if (config.autocorrect_formatBulletedLists && formatBulletedList(parent, content))
					return;

				if (config.autocorrect_formatNumberedLists && formatNumberedList(parent, content))
					return;
			}

			function retreivePrefix(range) {
				if (range && range.startContainer && range.startContainer.$.data) {
					var chars = '';
					var startOffset = range.startOffset - 1;
					var ch = range.startContainer.$.data.substring(startOffset, startOffset + 1);
					while (ch && ch != ' ' && ch != ' ' && startOffset >= 0) {
						chars = ch + chars;
						ch = range.startContainer.$.data.substring(--startOffset, startOffset + 1);
					}
					return chars;
				}
				return '';
			}

			var replacementTable = config.autocorrect_replacementTable;
			function replaceSequence(range, prefix) {
				var replacement = replacementTable[prefix];
				if (!replacement)
					return false;

				var index = range.startOffset;
				setTimeout(function(){
					editor.fire( 'saveSnapshot' );
					var text = range.startContainer.getText();
					var bookmark = editor.getSelection().getRanges().shift().createBookmark();
					range.startContainer.setText(text.substring(0, index - prefix.length) + replacement + text.substring(index));
					editor.getSelection().selectBookmarks([bookmark]);
					editor.fire( 'saveSnapshot' );
				});

				return true;
			}

			var urlRe = /(http:|https:|ftp:|mailto:|tel:|skype:|www\.)([^\s\.,?!#]|[.?!#](?=[^\s\.,?!#]))+/i;
			function formatHyperlink(range, prefix) {
				var match = prefix.match(urlRe);
				if (!match)
					return false;

				var url = match[0];
				var href = match[1] === 'www.' ? 'http://' + url : url;
				setTimeout(function() {
					editor.fire( 'saveSnapshot' );
					var attributes = {'data-cke-saved-href': href, href: href};
					var style = new CKEDITOR.style({ element: 'a', attributes: attributes } );
					style.type = CKEDITOR.STYLE_INLINE; // need to override... dunno why.
					range.setStart(range.startContainer, range.startOffset - prefix.length);
					range.setEnd(range.startContainer, range.startOffset + url.length);
					style.applyToRange( range );
				});

				return true;
			}

			var suffixes = {st: true, nd: true, rd: true, th: true};
			function formatOrdinals(range, prefix) {
				var suffix = prefix.slice(-2);
				if (!(suffix in suffixes))
					return false;

				var number = prefix.slice(0, -2);
				var numberRe = /^\d+$/;
				if (!numberRe.test(number))
					return false;

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
				setTimeout(function() {
					editor.fire( 'saveSnapshot' );
					var style = new CKEDITOR.style({ element: 'sup' } );
					range.setStart(range.startContainer, range.startOffset - suffix.length);
					range.setEnd(range.startContainer, range.startOffset + suffix.length);
					style.applyToRange( range );
				});

				return true;
			}

			var horizontalRuleRe = new RegExp('^' + '(' + horizontalRuleMarkers.map(function(marker){ return marker + '{3,}';}).join('|') + ')' + '$');
			function insertHorizontalRule(parent, content) {
				var match = content.match(horizontalRuleRe);
				if (!match)
					return false;

				setTimeout(function() {
					var hr = editor.document.createElement( 'hr' );
					hr.replace(parent);
				});

				return true;
			}

			var bulletedListItemRe = new RegExp('^' + '(' + bulletedListMarkers.join('|') + ')' + ' ' + listItemContentPattern + '$');
			function formatBulletedList(parent, content) {
				var match = content.match(bulletedListItemRe);
				if (!match)
					return false;

				var marker = match[1];
				var firstChild = parent.getFirst();
				setTimeout(function() {
					editor.fire( 'saveSnapshot' );
					var bookmark = editor.getSelection().getRanges().shift().createBookmark();
					firstChild.setText(firstChild.getText().substring(marker.length + 1));
					replaceContentsWithList([parent, parent.getNext()], 'ul', null);
					editor.getSelection().selectBookmarks([bookmark]);
					editor.fire( 'saveSnapshot' );
				});

				return true;
			}

			var numberedListItemRe = new RegExp('^' + '(' + numberedListMarkers.join('|') + ')' + '[\\.\\)] ' + listItemContentPattern + '$');
			function formatNumberedList(parent, content) {
				var match = content.match(numberedListItemRe);
				if (!match)
					return false;

				var start = match[1];
				var type;
				if (start.match(/\d/))
					type = '1';
				else if (start.match(/[ivxlcdm]+/))
					type = 'i';
				else if (start.match(/[IVXLCDM]+/))
					type = 'I';
				else if (start.match(/[a-z]/))
					type = 'a';
				else if (start.match(/[A-Z]/))
					type = 'A';
				var slice = start.length + 2;
				start = toNumber(start, type);
				var firstChild = parent.getFirst();
				setTimeout(function() {
					editor.fire( 'saveSnapshot' );
					var bookmark = editor.getSelection().getRanges().shift().createBookmark();
					firstChild.setText(firstChild.getText().substring(slice));
					replaceContentsWithList([parent, parent.getNext()], 'ol', {type: type, start: start});
					editor.getSelection().selectBookmarks([bookmark]);
					editor.fire( 'saveSnapshot' );
				});

				return true;
			}

			var doubleQuotes = config.autocorrect_doubleQuotes;
			function replaceDoubleQuote(inputChar, leftChar) {
				if (inputChar !== '"')
					return false;

				replaceQuote(leftChar, doubleQuotes);
				return true;
			}

			var singleQuotes = config.autocorrect_singleQuotes;
			function replaceSingleQuote(inputChar, leftChar) {
				if (inputChar !== '\'')
					return false;

				replaceQuote(leftChar, singleQuotes);
				return true;
			}

			function replaceQuote(leftChar, quotes) {
				var isClosingQuote = leftChar && '  -'.indexOf(leftChar) < 0;
				var replacement = quotes[isClosingQuote ? 1 : 0];
				setTimeout(function() {
					editor.fire( 'saveSnapshot' );
					var range = editor.getSelection().getRanges().shift();
					var text = range.startContainer.getText();
					range.startContainer.setText(text.substring(0, range.endOffset - 1) + replacement + text.substring(range.endOffset));
					range.setStart(range.startContainer, range.endOffset);
					range.setStart(range.startContainer, range.endOffset);
					editor.getSelection().selectRanges([range]);
					editor.fire( 'saveSnapshot' );
				});
			}

			function getBlockParent(node) {
				while (node && (node.type !== CKEDITOR.NODE_ELEMENT || (node.getName() in CKEDITOR.dtd.$inline || node.getName() in CKEDITOR.dtd.$empty ))) {
					node = node.getParent();
				}
				return node;
			}

			function replaceContentsWithList(listContents, type, attributes) {
				// Insert the list to the DOM tree.
				var insertAnchor = listContents[ listContents.length - 1 ].getNext(),
					listNode = editor.document.createElement( type );

				var commonParent = listContents[0].getParent();

				var contentBlock, listItem;

				while ( listContents.length ) {
					contentBlock = listContents.shift();
					listItem = editor.document.createElement( 'li' );

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
				if (event.data.keyCode != 13)
					return;
				autoCorrectOnEnterKey();
			});

			editor.on( 'contentDom', function() {
				editor.editable().on( 'keypress', function( event ) {
					if ( event.data.$.ctrlKey || event.data.$.metaKey )
						return;

					var range = editor.getSelection().getRanges().shift();
					var leftChar = range ? range.startContainer.getText().substring(range.startOffset-1, range.startOffset) : '';
					var inputChar = String.fromCharCode(event.data.$.charCode);

					if (config.autocorrect_replaceDoubleQuotes && replaceDoubleQuote(inputChar, leftChar))
						return;

					if (config.autocorrect_replaceSingleQuotes && replaceSingleQuote(inputChar, leftChar))
						return;

					if (config.autocorrect_ignoreDoubleSpaces && (leftChar == ' ' || leftChar == ' '))
						return event.data.$.preventDefault();

					if (inputChar == ' ' || inputChar == ' ')
						autoCorrectOnSpaceKey();
				});
			});
		}
	});

	CKEDITOR.plugins.autoreplace = {};

})();

/**
 * 
 *
 * @cfg
 * @member CKEDITOR.config
 */
// language specific
CKEDITOR.config.autocorrect_replacementTable = {"--": "–", "-->": "→", "-+": "±", "->": "→", "...": "…", "(c)": "©", "(r)": "®", "(tm)": "™", "(o)": "˚", "+-": "±", "<-": "←", "<--": "←", "<-->": "↔", "<->": "↔", "<<": "«", ">>": "»", "~=": "≈", "1/": "½", "1/4": "¼", "3/4": "¾"};

CKEDITOR.config.autocorrect_useReplacementTable = true;

CKEDITOR.config.autocorrect_recognizeUrls = true;
// language specific
CKEDITOR.config.autocorrect_dash = '–';

CKEDITOR.config.autocorrect_replaceHyphens = true;

CKEDITOR.config.autocorrect_formatOrdinals = true;

CKEDITOR.config.autocorrect_ignoreDoubleSpaces = false;

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