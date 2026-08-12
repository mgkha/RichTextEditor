// YouTube link parsing and embed markup.
//
// No Quill dependency, so anything else that renders these documents — a
// preview pane, a server-side renderer — can import it and emit the same
// markup:
//
//   <div class="video-embed" data-youtube-id="ID" data-start="90">
//     <iframe src="https://www.youtube.com/embed/ID?start=90" …></iframe>
//   </div>
//
// The wrapper carries the id so the markup round-trips: the Quill blot reads
// it back out of the DOM, and a saved document restores without having to
// re-parse the iframe src.

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

/** { id, start } for any recognised YouTube URL, or null. A bare 11-character
 *  id is accepted too, so pasting just the id works. */
export function parse(url) {
    const text = (url || '').trim();
    if (!text) return null;

    if (new RegExp('^' + ID + '$').test(text)) return { id: text, start: 0 };

    for (const pattern of URL_PATTERNS) {
        const match = pattern.exec(text);
        if (match) return { id: match[1], start: parseStart(text) };
    }
    return null;
}

// Switch the host to www.youtube-nocookie.com if you would rather the player
// set no tracking cookie until the viewer presses play. Some embedders only
// recognise youtube.com in their iframe allow-lists, which is the reason it
// is not the default here.
//
// Interpolation is safe without escaping: `id` only reaches here after
// matching the character class above, and `start` is a number.
export function iframeHtml(id, start) {
    const src = 'https://www.youtube.com/embed/' + id + (start > 0 ? '?start=' + start : '');
    return '<iframe src="' + src + '"' +
        ' title="YouTube video player"' +
        ' allow="accelerometer; autoplay; clipboard-write; encrypted-media;' +
        ' gyroscope; picture-in-picture; web-share"' +
        ' referrerpolicy="strict-origin-when-cross-origin"' +
        ' loading="lazy" allowfullscreen></iframe>';
}

/** Full block markup from a URL, or null if the URL is not YouTube — which is
 *  how a caller decides to reject the input. */
export function blockHtml(url) {
    const video = parse(url);
    if (!video) return null;

    const startAttr = video.start > 0 ? ' data-start="' + video.start + '"' : '';
    return '<div class="video-embed" data-youtube-id="' + video.id + '"' + startAttr + '>' +
        iframeHtml(video.id, video.start) +
        '</div>';
}
