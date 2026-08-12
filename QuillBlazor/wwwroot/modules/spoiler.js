// Spoiler module — a block that hides its contents from the reader until
// they click it.
//
// Selected lines are grouped into a single <div class="spoiler-block">,
// mirroring how Quill groups multi-line code blocks, so a whole passage
// becomes one hidden box rather than one box per line:
//
//   <div class="spoiler-block">
//     <div class="spoiler-line">…</div>
//     <div class="spoiler-line">…</div>
//   </div>
//
// On the reader side, call enableSpoilerReveal() once and put
// class="quill-spoiler-reveal" on the container showing the document.

const ICON =
    '<svg viewBox="0 0 18 18">' +
    '<path class="ql-stroke" d="M2,9 C4,5.5 6.5,4 9,4 C11.5,4 14,5.5 16,9 C14,12.5 11.5,14 9,14 C6.5,14 4,12.5 2,9 Z"></path>' +
    '<circle class="ql-fill" cx="9" cy="9" r="2"></circle>' +
    '<line class="ql-stroke" x1="3.5" y1="14.5" x2="14.5" y2="3.5"></line>' +
    '</svg>';

// Quill's blot registry is global, so a second editor must not redo this.
let registered = false;

/** Define the spoiler blots and its toolbar icon. Safe to call repeatedly. */
export function registerSpoiler(Quill) {
    if (registered) return;
    registered = true;

    const Block = Quill.import('blots/block');
    const Container = Quill.import('blots/container');

    // The box that holds one or more spoiler lines.
    class SpoilerContainer extends Container { }
    SpoilerContainer.blotName = 'spoiler-container';
    SpoilerContainer.tagName = 'DIV';
    SpoilerContainer.className = 'spoiler-block';

    // Each formatted line. requiredContainer makes Quill wrap it, and the
    // container's optimize pass then merges adjacent lines into one box.
    class SpoilerBlock extends Block {
        static formats() {
            return true;
        }
        format(name, value) {
            if (name === SpoilerBlock.blotName && !value) {
                this.replaceWith(Block.blotName);   // toggled off → plain paragraph
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
    Quill.import('ui/icons')['spoiler'] = ICON;
}

/** Toolbar handler: toggle the spoiler block over the selected line(s). */
export function spoilerHandler() {
    // `this` is Quill's toolbar module.
    const range = this.quill.getSelection();
    if (!range) return;
    this.quill.format('spoiler', !this.quill.getFormat(range).spoiler, 'user');
}

function isSpoilerLine(line) {
    return !!(line && line.parent && line.parent.statics &&
              line.parent.statics.blotName === 'spoiler-container');
}

// Insert a normal empty paragraph after the spoiler block and move into it.
// Only needed when the block is the last thing in the document; anywhere
// else the caret can just move down into what follows.
function exitBelow(Quill, quill, line) {
    const container = line.parent;
    if (line !== container.children.tail || container.next != null) return false;

    const Delta = Quill.import('delta');
    const at = quill.getLength();
    quill.updateContents(new Delta().retain(at).insert('\n'), 'user');
    quill.setSelection(at, 0, 'user');
    return true;
}

// The same, above a spoiler block sitting at the very top of the document.
function exitAbove(Quill, quill, line) {
    const container = line.parent;
    if (line !== container.children.head || container.prev != null) return false;

    const Delta = Quill.import('delta');
    const at = quill.getIndex(container);
    quill.updateContents(new Delta().retain(at).insert('\n'), 'user');
    quill.setSelection(at, 0, 'user');
    return true;
}

/**
 * Per-editor keyboard wiring. Without this, a spoiler block at the start or
 * end of the document is a trap: there is no line to arrow into, so the
 * writer cannot get out of it.
 */
export function initSpoiler(quill, Quill) {
    quill.keyboard.addBinding({ key: 'ArrowDown' }, function (range) {
        if (range && range.length === 0) {
            const [line] = this.quill.getLine(range.index);
            if (isSpoilerLine(line) && exitBelow(Quill, this.quill, line)) return false;
        }
        return true;
    });

    quill.keyboard.addBinding({ key: 'ArrowUp' }, function (range) {
        if (range && range.length === 0) {
            const [line] = this.quill.getLine(range.index);
            if (isSpoilerLine(line) && exitAbove(Quill, this.quill, line)) return false;
        }
        return true;
    });

    // Enter on an empty last line leaves the block, the way it does in a list.
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

    // Bindings are tried in registration order until one handles the key, and
    // Quill's own Enter handler was registered first. Move ours to the front
    // so it can intercept before the default inserts a newline.
    const enter = quill.keyboard.bindings['Enter'];
    if (enter && enter.length > 1) enter.unshift(enter.pop());
}

/**
 * Reader-side click-to-reveal. Binds one delegated listener for the whole
 * page and is safe to call repeatedly; only spoilers inside an element with
 * class "quill-spoiler-reveal" respond, so an editor on the same page is
 * unaffected.
 */
export function enableSpoilerReveal() {
    if (window.__quillSpoilerRevealBound) return;
    window.__quillSpoilerRevealBound = true;

    document.addEventListener('click', e => {
        const target = e.target instanceof Element ? e.target : null;
        const spoiler = target && target.closest('.spoiler-block');
        if (spoiler && spoiler.closest('.quill-spoiler-reveal')) {
            spoiler.classList.toggle('spoiler-block--revealed');
        }
    });
}
