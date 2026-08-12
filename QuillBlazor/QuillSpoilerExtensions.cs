using Microsoft.JSInterop;

namespace QuillBlazor;

/// <summary>
/// Reader-side behaviour for the spoiler module — the half that runs where a
/// finished document is displayed rather than edited.
/// </summary>
public static class QuillSpoilerExtensions
{
    private const string ModulePath = "./_content/QuillBlazor/modules/spoiler.js";

    /// <summary>
    /// Make spoiler blocks reveal themselves when clicked. Add
    /// <c>class="quill-spoiler-reveal"</c> to the element displaying the
    /// document; spoilers outside such an element — in an editor, say — are
    /// left visible and inert.
    /// </summary>
    /// <remarks>
    /// Binds a single delegated listener for the whole page, so calling this
    /// from several components, or on every render, is harmless.
    /// </remarks>
    public static async ValueTask EnableSpoilerRevealAsync(this IJSRuntime js)
    {
        // Disposing the reference only releases the .NET handle; the module
        // and its listener stay in the browser, which is the point.
        await using var module = await js.InvokeAsync<IJSObjectReference>("import", ModulePath);
        await module.InvokeVoidAsync("enableSpoilerReveal");
    }
}
