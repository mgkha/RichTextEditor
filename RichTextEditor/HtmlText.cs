using System.Net;
using System.Text.RegularExpressions;

namespace RichTextEditor;

/// <summary>Plain-text helpers shared by the editor pages.</summary>
internal static partial class HtmlText
{
    [GeneratedRegex("<[^>]+>")]
    private static partial Regex TagPattern();

    /// <summary>Counts words in an HTML fragment by stripping tags first.</summary>
    public static int CountWords(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return 0;
        var text = WebUtility.HtmlDecode(TagPattern().Replace(html, " "));
        return text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries).Length;
    }
}
