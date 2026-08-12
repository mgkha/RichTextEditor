# QuillBlazor

A [Quill 2](https://quilljs.com) editor packaged as a Blazor Razor Class
Library, with two extra blocks: **spoiler** (hidden until the reader clicks) and
**YouTube** embeds.

Dropping it into a Blazor project costs one reference and one tag. The component
fetches Quill, its stylesheets and its own CSS the first time it renders, so
there is nothing to add to `index.html`.

## Install

```xml
<ProjectReference Include="..\QuillBlazor\QuillBlazor.csproj" />
```

Add the namespace to `_Imports.razor`:

```razor
@using QuillBlazor
```

Static web assets are served from `_content/QuillBlazor/` automatically. That is
the whole setup.

## Use

```razor
<QuillEditor InitialContent="@_savedDelta" OnChanged="Save" />

@code {
    private async Task Save(QuillChange change)
    {
        // change.Delta — canonical, round-trips back into the editor: persist this
        // change.Html  — rendered output for display
        if (change.FromUser) await Store(change.Delta, change.Html);
    }
}
```

`OnChanged` is debounced 300 ms, and carries the HTML and the Delta together so
reacting to an edit needs no extra interop calls. It also fires once as soon as
the editor exists, with `Source == "init"` — that is what gives a restored draft
its word count without waiting for a keystroke. Gate anything that should only
follow real editing on `change.FromUser`.

Take a `@ref` for the rest:

```csharp
await editor.GetContentsAsync();       // Delta JSON
await editor.GetHtmlAsync();
await editor.SetContentsAsync(delta);  // null clears
await editor.FocusAsync();
```

### Parameters

| Parameter        | Type                         | Default  |
| ---------------- | ---------------------------- | -------- |
| `Theme`          | `string`                     | `bubble` |
| `Placeholder`    | `string`                     | `""`     |
| `InitialContent` | `string?` (Delta JSON)       | `null`   |
| `OnChanged`      | `EventCallback<QuillChange>` | —        |
| `Class`          | `string?`                    | `null`   |

`Theme` is `bubble` (toolbar appears on selection) or `snow` (fixed toolbar).
Both theme stylesheets are loaded, so either works.

## Revealing spoilers outside the editor

The editor shows spoiler blocks plainly — you cannot write into something that
is blurred. Where the *finished* document is displayed, opt in:

```razor
@inject IJSRuntime JS

<div class="quill-spoiler-reveal">@((MarkupString)_html)</div>

@code {
    protected override async Task OnAfterRenderAsync(bool first)
    {
        if (first) await JS.EnableSpoilerRevealAsync();
    }
}
```

One delegated listener covers the page, so calling it more than once is
harmless.

## The markup

Both blocks are plain and stable, so the same CSS styles the editor and the
published page:

```html
<div class="spoiler-block"><div class="spoiler-line">…</div></div>
<div class="video-embed" data-youtube-id="ID" data-start="90"><iframe …></iframe></div>
```

Videos are stored as `{ id, start }` rather than a URL, so a saved document
restores without re-parsing an iframe. Start offsets in the pasted link
(`?t=90`, `?t=1h2m3s`) are honoured.

`wwwroot/modules/youtube-url.js` has no Quill dependency, so anything else that
renders these documents can import it and emit identical markup:

```js
import { blockHtml } from './_content/QuillBlazor/modules/youtube-url.js';
```

## The files

Six of them, and nothing is pluggable — change the code, not a configuration
option.

| File                      | What it does                                          |
| ------------------------- | ----------------------------------------------------- |
| `QuillEditor.razor`       | The component: five parameters, four methods.          |
| `QuillChange.cs`          | What `OnChanged` carries.                              |
| `QuillSpoilerExtensions.cs` | `EnableSpoilerRevealAsync`.                          |
| `wwwroot/quill-blazor.js` | Loads Quill; creates, reads and destroys editors.      |
| `wwwroot/modules/spoiler.js` | Spoiler blots, toolbar handler, keyboard escapes.   |
| `wwwroot/modules/youtube.js` | Video blot, toolbar handler, link tooltip.          |

`quill-blazor.js` calls into each module in three places — register the blots,
supply the toolbar handler, wire the editor. A third block would follow the same
shape. The CDN URL, the toolbar layout and the debounce interval are constants
at the top of that file.
