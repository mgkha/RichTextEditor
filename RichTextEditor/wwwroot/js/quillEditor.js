// ES module bridging Blazor <-> Quill.
// The Quill global comes from the <script> tag in index.html.

// Bubble theme = Medium-style floating toolbar that appears on text selection.
const DEFAULT_TOOLBAR = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image', 'spoiler'],
    ['clean']
];

// Register a block-level "spoiler" format once. Selected lines are grouped
// into a single <div class="spoiler-block"> (mirrors how Quill groups
// multi-line code blocks), so a whole passage becomes one hidden block that
// the reader reveals with a single click.
let spoilerRegistered = false;
function registerSpoiler() {
    if (spoilerRegistered || typeof Quill === 'undefined') return;

    const Block = Quill.import('blots/block');
    const Container = Quill.import('blots/container');

    // The wrapping box that contains one or more spoiler lines.
    class SpoilerContainer extends Container { }
    SpoilerContainer.blotName = 'spoiler-container';
    SpoilerContainer.tagName = 'DIV';
    SpoilerContainer.className = 'spoiler-block';

    // Each formatted line. requiredContainer makes Quill wrap it, and the
    // container's optimize pass merges adjacent lines into one block.
    class SpoilerBlock extends Block {
        static formats() {
            return true;
        }
        format(name, value) {
            if (name === SpoilerBlock.blotName && !value) {
                this.replaceWith(Block.blotName); // toggle off -> plain paragraph
            } else {
                super.format(name, value);
            }
        }
    }
    SpoilerBlock.blotName = 'spoiler';
    SpoilerBlock.tagName = 'DIV';
    SpoilerBlock.className = 'spoiler-line';

    SpoilerContainer.allowedChildren = [SpoilerBlock];
    SpoilerBlock.requiredContainer = SpoilerContainer;

    Quill.register(SpoilerContainer, true);
    Quill.register(SpoilerBlock, true);

    // Eye-with-a-slash icon for the toolbar button (ql-spoiler).
    const Icons = Quill.import('ui/icons');
    Icons['spoiler'] =
        '<svg viewBox="0 0 18 18">' +
        '<path class="ql-stroke" d="M2,9 C4,5.5 6.5,4 9,4 C11.5,4 14,5.5 16,9 C14,12.5 11.5,14 9,14 C6.5,14 4,12.5 2,9 Z"></path>' +
        '<circle class="ql-fill" cx="9" cy="9" r="2"></circle>' +
        '<line class="ql-stroke" x1="3.5" y1="14.5" x2="14.5" y2="3.5"></line>' +
        '</svg>';

    spoilerRegistered = true;
}

function isSpoilerLine(line) {
    return !!(line && line.parent && line.parent.statics &&
              line.parent.statics.blotName === 'spoiler-container');
}

// Insert a normal empty paragraph after the spoiler block and move into it.
// Only fires when the block is the last thing in the document (otherwise the
// caret can just move down naturally).
function exitSpoilerBelow(quill, line) {
    const container = line.parent;
    if (line !== container.children.tail || container.next != null) return false;
    const Delta = Quill.import('delta');
    const at = quill.getLength();
    quill.updateContents(new Delta().retain(at).insert('\n'), 'user');
    quill.setSelection(at, 0, 'user');
    return true;
}

// Same, but above a spoiler block that sits at the very top of the document.
function exitSpoilerAbove(quill, line) {
    const container = line.parent;
    if (line !== container.children.head || container.prev != null) return false;
    const Delta = Quill.import('delta');
    const at = quill.getIndex(container);
    quill.updateContents(new Delta().retain(at).insert('\n'), 'user');
    quill.setSelection(at, 0, 'user');
    return true;
}

// Register keyboard bindings that let writers leave a spoiler block.
function bindSpoilerEscapes(quill) {
    quill.keyboard.addBinding({ key: 'ArrowDown' }, function (range) {
        if (range && range.length === 0) {
            const [line] = this.quill.getLine(range.index);
            if (isSpoilerLine(line) && exitSpoilerBelow(this.quill, line)) return false;
        }
        return true;
    });

    quill.keyboard.addBinding({ key: 'ArrowUp' }, function (range) {
        if (range && range.length === 0) {
            const [line] = this.quill.getLine(range.index);
            if (isSpoilerLine(line) && exitSpoilerAbove(this.quill, line)) return false;
        }
        return true;
    });

    // Enter on an empty last line leaves the block (turns that line normal).
    quill.keyboard.addBinding({ key: 'Enter' }, function (range) {
        if (range && range.length === 0) {
            const [line] = this.quill.getLine(range.index);
            if (isSpoilerLine(line) && line === line.parent.children.tail && line.length() === 1) {
                this.quill.formatLine(range.index, 1, 'spoiler', false, 'user');
                return false;
            }
        }
        return true;
    });

    // Quill's default Enter handler was registered first and would run before
    // ours (bindings are tried in order until one handles the key). Move ours
    // to the front so it can intercept before the default inserts a newline.
    const enterBindings = quill.keyboard.bindings['Enter'];
    if (enterBindings && enterBindings.length > 1) {
        enterBindings.unshift(enterBindings.pop());
    }
}

// Create a Quill instance on the given element. Returns nothing; the instance
// is stashed on the element so later calls can find it via the same ElementReference.
export function create(editorElement, dotNetRef, options) {
    options = options || {};
    registerSpoiler();

    const container = options.toolbar === false ? false : (options.toolbar || DEFAULT_TOOLBAR);

    const quill = new Quill(editorElement, {
        theme: options.theme || 'bubble',
        placeholder: options.placeholder || 'Tell your story...',
        readOnly: options.readOnly || false,
        modules: {
            toolbar: container === false ? false : {
                container,
                handlers: {
                    // Toggle the spoiler block over the selected line(s).
                    spoiler: function () {
                        const range = this.quill.getSelection();
                        if (!range) return;
                        const active = this.quill.getFormat(range).spoiler;
                        this.quill.format('spoiler', !active, 'user');
                    }
                }
            }
        }
    });

    bindSpoilerEscapes(quill);

    if (dotNetRef) {
        quill.on('text-change', (delta, oldDelta, source) => {
            dotNetRef.invokeMethodAsync('OnTextChanged', source);
        });
        quill.on('selection-change', (range) => {
            dotNetRef.invokeMethodAsync('OnSelectionChanged', range ? true : false);
        });
    }

    editorElement.__quill = quill;
    editorElement.__dotNetRef = dotNetRef;
}

function getQuill(editorElement) {
    return editorElement ? editorElement.__quill : null;
}

// Returns the document as a Delta (Quill's canonical JSON format) string.
export function getContents(editorElement) {
    const q = getQuill(editorElement);
    return q ? JSON.stringify(q.getContents()) : null;
}

// HTML for storing/rendering elsewhere. Use the live DOM (root.innerHTML)
// rather than getSemanticHTML() so custom formats like .spoiler survive.
export function getHtml(editorElement) {
    const q = getQuill(editorElement);
    return q ? q.root.innerHTML : null;
}

export function getText(editorElement) {
    const q = getQuill(editorElement);
    return q ? q.getText() : null;
}

// Replace the whole document from a Delta JSON string.
export function setContents(editorElement, deltaJson) {
    const q = getQuill(editorElement);
    if (!q) return;
    if (deltaJson) {
        q.setContents(JSON.parse(deltaJson), 'api');
    } else {
        q.setText('', 'api');
    }
}

// Paste HTML into the editor (converts to Delta under the hood).
export function setHtml(editorElement, html) {
    const q = getQuill(editorElement);
    if (q) q.clipboard.dangerouslyPasteHTML(html || '', 'api');
}

export function setReadOnly(editorElement, readOnly) {
    const q = getQuill(editorElement);
    if (q) q.enable(!readOnly);
}

export function focus(editorElement) {
    const q = getQuill(editorElement);
    if (q) q.focus();
}

// Plain-text length excluding Quill's trailing newline.
export function getLength(editorElement) {
    const q = getQuill(editorElement);
    return q ? Math.max(0, q.getLength() - 1) : 0;
}

// Delegated click-to-reveal for spoilers shown in a reader/preview
// (elements inside .preview-body). Safe to call many times.
let spoilerRevealBound = false;
export function enableSpoilerReveal() {
    if (spoilerRevealBound) return;
    spoilerRevealBound = true;
    document.addEventListener('click', (e) => {
        const sp = e.target.closest('.spoiler-block');
        if (sp && sp.closest('.preview-body')) {
            sp.classList.toggle('spoiler-block--revealed');
        }
    });
}

export function destroy(editorElement) {
    if (!editorElement) return;
    const ref = editorElement.__dotNetRef;
    if (ref && typeof ref.dispose === 'function') {
        // DotNetObjectReference is disposed on the .NET side; nothing to do here.
    }
    editorElement.__quill = null;
    editorElement.__dotNetRef = null;
}
