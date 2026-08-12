// QuillBlazor — loads Quill and bridges it to the Blazor component.
//
// Quill, its two theme stylesheets and this package's CSS are all fetched
// from here the first time an editor is created, which is why a consuming
// app needs nothing in index.html.

import { registerSpoiler, spoilerHandler, initSpoiler } from './modules/spoiler.js';
import { registerYouTube, youtubeHandler, initYouTube } from './modules/youtube.js';

const CDN = 'https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/';

// Wait this long after the last keystroke before telling .NET about an edit,
// so a burst of typing costs one interop call instead of one per character.
const DEBOUNCE_MS = 300;

const TOOLBAR = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline'],
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image', 'spoiler', 'youtube'],
    ['clean']
];


/* ---------------------------------------------------------------- *
 * Loading Quill, once per page
 * ---------------------------------------------------------------- */

let loading = null;

// Both themes are loaded so either can be used without more bookkeeping.
function addStylesheets() {
    const hrefs = [
        CDN + 'quill.bubble.css',
        CDN + 'quill.snow.css',
        new URL('./quill-blazor.css', import.meta.url).href
    ];

    const group = document.createDocumentFragment();
    for (const href of hrefs) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        group.appendChild(link);
    }

    // At the very top of <head>, ahead of the app's own stylesheets, so an
    // app rule that ties with one of these wins on source order.
    document.head.insertBefore(group, document.head.firstChild);
}

function loadQuill() {
    if (!loading) {
        addStylesheets();
        loading = new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = CDN + 'quill.js';
            script.onload = () => resolve(window.Quill);
            script.onerror = () => reject(new Error('QuillBlazor: could not load ' + script.src));
            document.head.appendChild(script);
        });
    }
    return loading;
}


/* ---------------------------------------------------------------- *
 * The editor
 * ---------------------------------------------------------------- */

// Kept on the host element, so every function here finds its editor from
// the same ElementReference Blazor already holds.
function editorOf(element) {
    return element && element.__quillBlazor;
}

// The live DOM rather than getSemanticHTML(), which drops the class names
// the spoiler and video blots are built on. contenteditable is an editing
// concern the published document should not carry.
function exportHtml(quill) {
    const clean = quill.root.cloneNode(true);
    clean.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    return clean.innerHTML;
}

function sendChange(editor, source) {
    editor.dotNetRef.invokeMethodAsync('OnQuillChanged', {
        html: exportHtml(editor.quill),
        delta: JSON.stringify(editor.quill.getContents()),
        source
    }).catch(() => { /* the component or the circuit is gone */ });
}

/** Create an editor on `element`. Awaited by the component, so a failed
 *  load surfaces as a .NET exception rather than a silent no-op. */
export async function create(element, dotNetRef, options) {
    const Quill = await loadQuill();
    registerSpoiler(Quill);
    registerYouTube(Quill);

    const quill = new Quill(element, {
        theme: options.theme,
        placeholder: options.placeholder,
        modules: {
            toolbar: { container: TOOLBAR, handlers: { spoiler: spoilerHandler, youtube: youtubeHandler } }
        }
    });

    initSpoiler(quill, Quill);
    initYouTube(quill);

    const editor = { quill, dotNetRef, timer: 0 };
    element.__quillBlazor = editor;

    // 'silent' so restoring a draft does not read back as an edit, and so it
    // stays out of the undo stack — otherwise ctrl+z on a fresh editor would
    // wipe the restored content.
    if (options.initialDelta) quill.setContents(JSON.parse(options.initialDelta), 'silent');

    quill.on('text-change', (delta, oldDelta, source) => {
        clearTimeout(editor.timer);
        editor.timer = setTimeout(() => sendChange(editor, source), DEBOUNCE_MS);
    });

    // Hand the component the starting document — a restored draft, or
    // nothing — so it can show a word count without waiting for an edit.
    sendChange(editor, 'init');
}

export function destroy(element) {
    const editor = editorOf(element);
    if (!editor) return;

    clearTimeout(editor.timer);
    element.__quillBlazor = null;

    // Quill has no teardown of its own: drop the DOM it built and the classes
    // it stamped on the host.
    element.innerHTML = '';
    element.classList.remove('ql-container', 'ql-bubble', 'ql-snow');
}

/** The document as a Delta JSON string — the form to persist, because unlike
 *  HTML it round-trips back into the editor without loss. */
export function getContents(element) {
    return JSON.stringify(editorOf(element).quill.getContents());
}

export function getHtml(element) {
    return exportHtml(editorOf(element).quill);
}

export function setContents(element, deltaJson) {
    const quill = editorOf(element).quill;
    if (deltaJson) quill.setContents(JSON.parse(deltaJson), 'api');
    else quill.setText('', 'api');
}

export function focus(element) {
    editorOf(element).quill.focus();
}
