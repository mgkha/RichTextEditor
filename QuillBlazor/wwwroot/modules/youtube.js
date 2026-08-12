// YouTube module — a block embed inserted from a link.
//
// The blot's Delta value is { id, start } rather than a URL, which is what
// makes a saved draft restore without re-parsing an iframe.

import { parse, iframeHtml } from './youtube-url.js';

const ICON =
    '<svg viewBox="0 0 18 18">' +
    '<rect class="ql-stroke" x="1.5" y="4" width="15" height="10" rx="3"></rect>' +
    '<polygon class="ql-fill" points="7.5,6.75 11.75,9 7.5,11.25"></polygon>' +
    '</svg>';

// Quill's blot registry is global, so a second editor must not redo this.
let registered = false;

/** Define the video blot and its toolbar icon. Safe to call repeatedly. */
export function registerYouTube(Quill) {
    if (registered) return;
    registered = true;

    const BlockEmbed = Quill.import('blots/block/embed');

    class YouTubeBlot extends BlockEmbed {
        static create(value) {
            const node = super.create();
            // A URL is accepted as well as a { id, start } pair, so the blot
            // can be fed straight from a toolbar entry.
            const video = typeof value === 'string' ? parse(value) : value;
            if (!video || !video.id) return node;

            const start = video.start || 0;
            node.setAttribute('data-youtube-id', video.id);
            if (start > 0) node.setAttribute('data-start', String(start));
            // Without this the caret can land in the gap beside the frame and
            // type into the middle of the embed. Stripped on export.
            node.setAttribute('contenteditable', 'false');
            node.innerHTML = iframeHtml(video.id, start);
            return node;
        }

        static value(node) {
            return {
                id: node.getAttribute('data-youtube-id'),
                start: parseInt(node.getAttribute('data-start'), 10) || 0
            };
        }
    }
    YouTubeBlot.blotName = 'youtube';
    YouTubeBlot.tagName = 'DIV';
    YouTubeBlot.className = 'video-embed';

    Quill.register(YouTubeBlot, true);
    Quill.import('ui/icons')['youtube'] = ICON;
}

/** Toolbar handler: swap the toolbar for the URL box. The insert itself
 *  happens in the tooltip's save (see initYouTube). */
export function youtubeHandler() {
    // `this` is Quill's toolbar module.
    this.quill.theme.tooltip.edit('youtube');
}

/**
 * Per-editor wiring: ask for the URL through Quill's own tooltip — the pill
 * the link button already uses — instead of a separate dialog. The tooltip's
 * built-in save() only understands link/video/formula, so intercept our mode
 * and delegate everything else.
 */
export function initYouTube(quill) {
    const tooltip = quill.theme.tooltip;

    // edit(mode) takes the input's placeholder from its data-<mode> attribute.
    tooltip.textbox.setAttribute('data-youtube', 'Paste a YouTube link');

    const baseSave = tooltip.save;
    tooltip.save = function () {
        if (this.root.getAttribute('data-mode') !== 'youtube') return baseSave.call(this);

        const video = parse(this.textbox.value);
        if (!video) {
            // Not a YouTube link — keep the box open so it can be corrected.
            this.textbox.select();
            return;
        }

        const range = this.quill.getSelection(true);
        const at = range ? range.index + range.length : this.quill.getLength();
        this.quill.insertEmbed(at, 'youtube', video, 'user');
        this.quill.setSelection(at + 1, 'silent');

        this.textbox.value = '';
        this.hide();
    };
}
