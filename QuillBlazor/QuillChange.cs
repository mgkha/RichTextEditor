namespace QuillBlazor;

/// <summary>
/// One notification that the document changed. Carries both forms of the
/// document, so reacting to an edit costs no extra JS interop round-trips.
/// </summary>
public sealed class QuillChange
{
    /// <summary>Rendered HTML, ready to store or display.</summary>
    public string Html { get; init; } = "";

    /// <summary>
    /// The document as a Delta JSON string. This is the form to persist:
    /// unlike HTML it round-trips back into the editor without loss.
    /// </summary>
    public string Delta { get; init; } = "";

    /// <summary>
    /// Where the change came from: <c>user</c> for typing, or <c>init</c> for
    /// the one notification sent when the editor is first created.
    /// </summary>
    public string Source { get; init; } = "";

    /// <summary>True when a person typed the change, rather than code applying it.</summary>
    public bool FromUser => Source == "user";
}
