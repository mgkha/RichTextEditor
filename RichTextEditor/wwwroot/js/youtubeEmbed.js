// Turns a YouTube link into the embed markup both editors insert.
//
// Loaded as a plain script from index.html — like the Quill global — so that
// js/quillEditor.js (an ES module) and js/tinymceConf.js (a window-scoped
// config object) can share one parser instead of each carrying its own.
//
// Both editors emit exactly the same markup, so a single set of .rte-content
// rules in css/editor.css styles the video in either editor and in the
// preview:
//
//   <div class="video-embed" data-youtube-id="ID" data-start="90">
//     <iframe src="https://www.youtube-nocookie.com/embed/ID?start=90" …>
//   </div>
//
// The wrapper carries the id so the markup stays round-trippable: the Quill
// blot reads it back out of the DOM, and it survives a save/restore cycle
// without having to re-parse the iframe src.

(function () {
    // Video ids are 11 characters from the URL-safe alphabet.
    const ID = '([A-Za-z0-9_-]{11})';

    const URL_PATTERNS = [
        // youtu.be/ID
        new RegExp('youtu\\.be/' + ID),
        // youtube.com/embed|shorts|live|v/ID
        new RegExp('youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/' + ID),
        // youtube.com/watch?…&v=ID
        new RegExp('youtube(?:-nocookie)?\\.com/watch\\?(?:[^#]*&)?v=' + ID)
    ];

    // Start offsets arrive as either seconds (t=90, start=90) or YouTube's
    // "share at current time" form (t=1h2m3s). Anything else means "from the
    // top", which is also the sane fallback for a malformed value.
    function parseStart(url) {
        const match = /[?&#](?:t|start)=([^&#]+)/.exec(url);
        if (!match) return 0;

        const raw = match[1];
        if (/^\d+s?$/.test(raw)) return parseInt(raw, 10);

        const hms = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(raw);
        if (!hms || !(hms[1] || hms[2] || hms[3])) return 0;
        return Number(hms[1] || 0) * 3600 + Number(hms[2] || 0) * 60 + Number(hms[3] || 0);
    }

    // Returns { id, start } for any recognised YouTube URL, or null. A bare
    // 11-character id is accepted too, so pasting just the id works.
    function parse(url) {
        const text = (url || '').trim();
        if (!text) return null;

        if (new RegExp('^' + ID + '$').test(text)) return { id: text, start: 0 };

        for (const pattern of URL_PATTERNS) {
            const match = pattern.exec(text);
            if (match) return { id: match[1], start: parseStart(text) };
        }
        return null;
    }

    // Deliberately the plain youtube.com host rather than the privacy-enhanced
    // youtube-nocookie.com one: TinyMCE sandboxes every iframe whose host is
    // not in its sandbox_iframes_exclusions list, and that list ships with
    // youtube.com but not youtube-nocookie.com. A sandbox="" attribute kills
    // the player outright, and overriding the option would replace TinyMCE's
    // whole curated provider list rather than add to it.
    function embedSrc(id, start) {
        const base = 'https://www.youtube.com/embed/' + id;
        return start > 0 ? base + '?start=' + start : base;
    }

    // Interpolation is safe without escaping: `id` only ever reaches here
    // after matching the character class above, and `start` is a number.
    function iframeHtml(id, start) {
        return '<iframe src="' + embedSrc(id, start) + '"' +
            ' title="YouTube video player"' +
            ' allow="accelerometer; autoplay; clipboard-write; encrypted-media;' +
            ' gyroscope; picture-in-picture; web-share"' +
            ' referrerpolicy="strict-origin-when-cross-origin"' +
            ' loading="lazy" allowfullscreen></iframe>';
    }

    // Full block markup from a URL. Returns null if the URL is not YouTube,
    // which is how both editors decide to reject the input.
    function blockHtml(url) {
        const video = parse(url);
        if (!video) return null;
        const startAttr = video.start > 0 ? ' data-start="' + video.start + '"' : '';
        return '<div class="video-embed" data-youtube-id="' + video.id + '"' + startAttr + '>' +
            iframeHtml(video.id, video.start) +
            '</div>';
    }

    window.youtubeEmbed = { parse, embedSrc, iframeHtml, blockHtml };
})();
