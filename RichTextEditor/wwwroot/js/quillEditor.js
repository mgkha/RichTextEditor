// ES module bridging Blazor <-> Quill.
// The Quill global comes from the <script> tag in index.html.

// Bubble theme = Medium-style floating toolbar that appears on text selection.
const DEFAULT_TOOLBAR = [
    [{ header: [2, 3, false] }],
    ['bold', 'italic', 'underline'],
    ['blockquote', 'code-block'],
    [{ list: 'ordered' }, { list: 'bullet' }],
    ['link', 'image'],
    ['clean']
];

// Create a Quill instance on the given element. Returns nothing; the instance
// is stashed on the element so later calls can find it via the same ElementReference.
export function create(editorElement, dotNetRef, options) {
    options = options || {};

    const quill = new Quill(editorElement, {
        theme: options.theme || 'bubble',
        placeholder: options.placeholder || 'Tell your story...',
        readOnly: options.readOnly || false,
        modules: {
            toolbar: options.toolbar === false ? false : (options.toolbar || DEFAULT_TOOLBAR)
        }
    });

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

// Semantic HTML (good for storing/rendering elsewhere).
export function getHtml(editorElement) {
    const q = getQuill(editorElement);
    return q ? q.getSemanticHTML() : null;
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

export function destroy(editorElement) {
    if (!editorElement) return;
    const ref = editorElement.__dotNetRef;
    if (ref && typeof ref.dispose === 'function') {
        // DotNetObjectReference is disposed on the .NET side; nothing to do here.
    }
    editorElement.__quill = null;
    editorElement.__dotNetRef = null;
}
