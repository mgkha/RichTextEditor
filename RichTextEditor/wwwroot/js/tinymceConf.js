// TinyMCE configuration for the distraction-free (inline) editor, exposed on
// window for the TinyMCE.Blazor <Editor JsConfSrc="tinymceDfreeConf"> component.
//
// This file exists because the component's Conf parameter is a
// Dictionary<string, object> and therefore can only carry JSON-serialisable
// values — the spoiler button needs a `setup` function, which has to be
// defined in JS. The wrapper merges this object with Conf and calls our
// setup after its own.
//
// Reference config: tiny.cloud/docs/tinymce/latest/use-tinymce-distraction-free/
// (powerpaste is omitted — it is a premium plugin and this is the GPL build.)
//
// Inline mode edits the page element directly instead of an iframe, so the
// writing surface is styled by .tinymce-host rules in css/editor.css — there
// is no content_style here.

(function () {
    const SPOILER_ICON =
        '<svg width="24" height="24" focusable="false" viewBox="0 0 24 24">' +
        '<path d="M3 12c2.7-4.7 8.7-6.3 13.4-3.6 1.5.9 2.7 2.1 3.6 3.6-2.7 4.7-8.7 6.3-13.4 3.6A9.9 9.9 0 0 1 3 12z" ' +
        'fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<circle cx="12" cy="12" r="2.5" fill="currentColor"/>' +
        '<path d="M5 19 19 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>' +
        '</svg>';

    const YOUTUBE_ICON =
        '<svg width="24" height="24" focusable="false" viewBox="0 0 24 24">' +
        '<rect x="2" y="5" width="20" height="14" rx="4" ' +
        'fill="none" stroke="currentColor" stroke-width="1.6"/>' +
        '<path d="M10 8.5 16 12l-6 3.5z" fill="currentColor"/>' +
        '</svg>';

    // Quickbar button that wraps the selected block(s) in one
    // <div class="spoiler-block">, matching the markup the Quill editor
    // produces so both feed the same preview CSS.
    function registerSpoiler(editor) {
        editor.ui.registry.addIcon('spoiler', SPOILER_ICON);
        editor.ui.registry.addToggleButton('spoiler', {
            icon: 'spoiler',
            tooltip: 'Spoiler (hidden until the reader clicks)',
            onAction: () => editor.execCommand('mceToggleFormat', false, 'spoiler'),
            onSetup: (api) => editor.formatter.formatChanged('spoiler', api.setActive)
        });
    }

    // Ask for the link in TinyMCE's own dialog, then insert the markup built
    // by js/youtubeEmbed.js — the same block the Quill editor produces.
    //
    // The media plugin takes it from there: inside the editor it swaps the
    // iframe for a live preview wrapped in <span class="mce-preview-object">
    // (styled back into place by css/editor.css) and restores the original
    // markup when the content is read back out.
    function openYouTubeDialog(editor) {
        editor.windowManager.open({
            title: 'Embed a YouTube video',
            body: {
                type: 'panel',
                items: [{
                    type: 'input',
                    name: 'url',
                    label: 'YouTube link',
                    placeholder: 'https://www.youtube.com/watch?v=...'
                }]
            },
            buttons: [
                { type: 'cancel', text: 'Cancel' },
                { type: 'submit', text: 'Embed', primary: true }
            ],
            onSubmit: (api) => {
                const html = window.youtubeEmbed.blockHtml(api.getData().url);
                if (!html) {
                    // Leave the dialog open so the link can be corrected.
                    editor.notificationManager.open({
                        text: 'That does not look like a YouTube link.',
                        type: 'error',
                        timeout: 4000
                    });
                    return;
                }
                editor.insertContent(html);
                api.close();
            }
        });
    }

    function registerYouTube(editor) {
        editor.ui.registry.addIcon('youtube', YOUTUBE_ICON);
        editor.ui.registry.addButton('youtube', {
            icon: 'youtube',
            tooltip: 'Embed a YouTube video',
            onAction: () => openYouTubeDialog(editor)
        });
    }

    window.tinymceDfreeConf = {
        menubar: false,
        toolbar: false,
        plugins: 'autolink codesample link lists media table image quickbars help',
        quickbars_selection_toolbar: 'bold italic underline | blocks | blockquote quicklink | spoiler',
        quickbars_insert_toolbar: 'quicktable image media youtube codesample',
        contextmenu: 'undo redo | inserttable | cell row column deletetable | help',
        placeholder: 'Tell your story...',
        promotion: false,
        branding: false,
        formats: {
            spoiler: { block: 'div', classes: 'spoiler-block', wrapper: true }
        },
        setup: (editor) => {
            registerSpoiler(editor);
            registerYouTube(editor);
        }
    };
})();

// Delegated click-to-reveal for spoilers shown in a reader/preview. Shares the
// window flag with quillEditor.js so the two editor pages never bind two
// listeners (which would toggle twice per click and appear to do nothing).
(function () {
    if (window.__spoilerRevealBound) return;
    window.__spoilerRevealBound = true;
    document.addEventListener('click', (e) => {
        const sp = e.target.closest('.spoiler-block');
        if (sp && sp.closest('.preview-body')) {
            sp.classList.toggle('spoiler-block--revealed');
        }
    });
})();
