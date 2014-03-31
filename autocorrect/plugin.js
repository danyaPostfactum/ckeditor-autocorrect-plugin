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
			var bulletedListMarkers = ['\\*'];
			var numberedListMarkers = ['1','a','A','i','I'];

			var urlRe = /(http:|https:|ftp:|mailto:|tel:|skype:|www\.)([^\s\.,?!#]|[.?!#](?=[^\s\.,?!#]|$))+/i;

			var horizontalRuleRe = new RegExp('^' + '(' + horizontalRuleMarkers.map(function(marker){ return marker + '{3,}';}).join('|') + ')' + '$');
			var listItemContentPattern = '(?:.*?)[^\\.!,\\s]';
			var bulletedListItemRe = new RegExp('^' + '(' + bulletedListMarkers.join('|') + ')' + ' ' + listItemContentPattern + '$');
			var numberedListItemRe = new RegExp('^' + '(' + numberedListMarkers.join('|') + ')' + '[\\.\\)] ' + listItemContentPattern + '$');

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
			function replace(text) {
				var replacements = config.autocorrect_replacementTable;
				return replacements[text];
			}
			function parseUrl(string) {
				var match = string.match(urlRe);
				return match ? match[0] : null;
			}
			// Registering keydown on every document recreation.(#3844)


			function getBlockParent(node) {
				while (node && (node.type !== CKEDITOR.NODE_ELEMENT || (node.getName() in CKEDITOR.dtd.$inline || node.getName() in CKEDITOR.dtd.$empty ))) {
					node = node.getParent();
				}
				return node;
			}

			function getListElement( editor, listTag ) {
				var range;
				try {
					range = editor.getSelection().getRanges()[ 0 ];
				} catch ( e ) {
					return null;
				}

				range.shrink( CKEDITOR.SHRINK_TEXT );
				return editor.elementPath( range.getCommonAncestor() ).contains( listTag, 1 );
			}

			function characterPosition(character) {
				var alfa = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
				return alfa.indexOf(character);
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
				if (!(config.autocorrect_createHorizontalRules || config.autocorrect_formatNumberedLists || config.autocorrect_formatBulletedLists))
					return;
				var range = editor.getSelection().getRanges().shift();
				var parent = getBlockParent(range.startContainer);
				if (parent.getName() !== 'p')
					return;
				var content = parent.getText();
				var match;
				if (config.autocorrect_formatBulletedLists && (match = content.match(bulletedListItemRe))) {
					var marker = match[1];
					var firstChild = parent.getFirst();
					setTimeout(function() {
						editor.fire( 'saveSnapshot' );
						var range = editor.getSelection().getRanges().shift();
						firstChild.setText(firstChild.getText().substring(marker.length + 1));
						editor.getSelection().selectElement(parent);
						editor.execCommand('bulletedlist');
						editor.getSelection().selectRanges([range]);
						editor.execCommand('bulletedlist');
						editor.fire( 'saveSnapshot' );
					});
				} else if (config.autocorrect_formatNumberedLists && (match = content.match(numberedListItemRe))) {
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
						var range = editor.getSelection().getRanges().shift();
						firstChild.setText(firstChild.getText().substring(slice));
						editor.getSelection().selectElement(parent);
						editor.execCommand('numberedlist');
						var ol = getListElement(editor, 'ol');
						ol.setAttribute('type', type);
						//ol.setAttribute('start', start);
						editor.getSelection().selectRanges([range]);
						editor.execCommand('numberedlist');
						editor.fire( 'saveSnapshot' );
					});
				} else if (config.autocorrect_createHorizontalRules && (match = content.match(horizontalRuleRe))) {
					parent.setText('');
					var hr = editor.document.createElement( 'hr' );
					editor.insertElement( hr );
				}
			});
			editor.on( 'contentDom', function() {

				editor.editable().on( 'keypress', function( event ) {
					if ( !event.data.$.ctrlKey && !event.data.$.metaKey ) {
						var character = String.fromCharCode(event.data.$.charCode);

						// Modify quotes
						var quotes;
						if (config.autocorrect_replaceDoubleQuotes && character == '"') {
							quotes = config.autocorrect_doubleQuotes;
						} else if (config.autocorrect_replaceDoubleQuotes && character == '\'') {
							quotes = config.autocorrect_singleQuotes;
						}
						if (quotes) {
							var replacement = quotes[0];
							var range = editor.getSelection().getRanges().shift();
							if (range && range.startContainer && range.startContainer.$.data) {
								var leftChar = range.startContainer.$.data.substring(range.startOffset-1, range.startOffset);
								if (leftChar && '  -'.indexOf(leftChar) < 0){
									replacement = quotes[1];
								}
							}
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
							return;
						}

						if (character == ' ' || character == ' ') {
							var range = editor.getSelection().getRanges().shift();

							if (range && range.startContainer) {
								var prefix = retreivePrefix(range);
								if (prefix) {
									// Format hyperlink
									var url;
									if (config.autocorrect_recognizeUrls && (url = parseUrl(prefix))) {
										setTimeout(function() {
											editor.fire( 'saveSnapshot' );
											var href = url.indexOf('www.') === 0 ? 'http://' + url : url;
											var attributes = {'data-cke-saved-href': href, href: href};
											var style = new CKEDITOR.style({ element: 'a', attributes: attributes } );
											style.type = CKEDITOR.STYLE_INLINE; // need to override... dunno why.
											range.setStart(range.startContainer, range.startOffset - prefix.length);
											range.setEnd(range.startContainer, range.startOffset + url.length)
											style.applyToRange( range );
										});
										return;
									}
									// Autoreplace using replacement table
									var replacement;
									if (config.autocorrect_useReplacementTable && (replacement = replace(prefix))) {
										var index = range.startOffset;
										setTimeout(function(){
											editor.fire( 'saveSnapshot' );
											var text = range.startContainer.getText();
											var ranges = editor.getSelection().getRanges();
											range.startContainer.setText(text.substring(0, index - prefix.length) + replacement + text.substring(index));
											if (ranges[0].startContainer.$ === range.startContainer.$) {
												ranges[0].setStart(range.startContainer, index - prefix.length + replacement.length + 1);
												ranges[0].setEnd(range.startContainer, index - prefix.length + replacement.length + 1);
											}
											editor.getSelection().selectRanges(ranges);
											editor.fire( 'saveSnapshot' );
										});
										return;
									}
									// Format ordinals
									var suffix;
									if (config.autocorrect_formatOrdinals && (suffix = prefix.slice(-2)) in {st: true, nd: true, rd: true, th: true}) {
										var number = prefix.slice(0, -2);
										var numberRe = /^\d+$/;
										if (!numberRe.test(number))
											return;
										number = +number;
										var x = number % 100;
										if (x > 9 && x < 20) {
											if (suffix !== 'th')
												return;
										} else {
											x = number % 10;
											if (x == 1) {
												if (suffix !== 'st')
													return;
											} else if (x == 2) {
												if (suffix !== 'nd')
													return;
											} else if (x == 3) {
												if (suffix !== 'rd')
													return;
											} else if (suffix !== 'th')
												return;
										}
										setTimeout(function() {
											editor.fire( 'saveSnapshot' );
											var style = new CKEDITOR.style({ element: 'sup' } );
											style.type = CKEDITOR.STYLE_INLINE; // need to override... dunno why.
											range.setStart(range.startContainer, range.startOffset - suffix.length);
											range.setEnd(range.startContainer, range.startOffset + suffix.length)
											style.applyToRange( range );
										});
									}
								}

								var leftChar = range.startContainer.getText().substring(range.startOffset-1, range.startOffset);

								// Ignore double space
								if (config.autocorrect_ignoreDoubleSpaces && (leftChar == ' ' || leftChar == ' ')) {
									return event.data.$.preventDefault();
								}

								// Replace hypen
								// TODO improve it
								if (config.autocorrect_replaceHyphens && leftChar == '-') {
									var index = range.startOffset;
									var dash = config.autocorrect_dash;
									setTimeout(function(){
										editor.fire( 'saveSnapshot' )
										var text = range.startContainer.getText();
										var ranges = editor.getSelection().getRanges();
										range.startContainer.setText(text.substring(0, index - 1) + dash + text.substring(index));
										if (ranges[0].startContainer.$ === range.startContainer.$) {
											ranges[0].setStart(range.startContainer, index - 1 + dash.length + 1);
											ranges[0].setEnd(range.startContainer, index - 1 + dash.length + 1);
										}
										editor.getSelection().selectRanges(ranges);
										editor.fire( 'saveSnapshot' )
									});
									return;
								}
							}
						}
					}
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
CKEDITOR.config.autocorrect_replacementTable = {"--": "–", "-->": "→", "-+": "±", "->": "→", "...": "…", "(c)": "©", "(r)": "®", "(tm)": "™", "(о)": "˚", "+-": "±", "<-": "←", "<--": "←", "<-->": "↔", "<->": "↔", "<<": "«", ">>": "»", "~=": "≈", "1/": "½", "1/4": "¼", "3/4": "¾"};

CKEDITOR.config.autocorrect_useReplacementTable = true;

CKEDITOR.config.autocorrect_recognizeUrls = true;
// language specific
CKEDITOR.config.autocorrect_dash = '—';

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