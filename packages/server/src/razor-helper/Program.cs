// KumiCraft's Razor helper (docs/architecture/03c section 2.3). One JSON request per stdin line:
//   {"id":1,"file":"Pages/Index.cshtml","text":"..."}
// answered by one JSON line on stdout:
//   {"id":1,"code":[[start,end],...]}   or   {"id":1,"error":"..."}
// `code` lists the parts of the text that are not HTML (C#, directives, @ transitions, comments),
// in UTF-16 offsets of `text`, sorted, not overlapping. The Razor compiler of the user's SDK
// decides it, so KumiCraft never guesses where C# starts or ends; KumiCraft reads the HTML itself.
// The intermediate tree is public, the call that gives it (`GetDocumentNode`) is not: it is found by
// reflection, and when an SDK renames it the helper says so instead of guessing (03c section 1.2).
using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.AspNetCore.Razor.Language;
using Microsoft.AspNetCore.Razor.Language.Intermediate;

var engine = RazorProjectEngine.Create(
    RazorConfiguration.Default,
    RazorProjectFileSystem.Create(Directory.GetCurrentDirectory()),
    // The MVC directives (@model, @page, @section, @inject) of Razor Pages and MVC views.
    Microsoft.AspNetCore.Mvc.Razor.Extensions.RazorExtensions.Register);
var documentNode = typeof(RazorCodeDocument).GetMethod(
    "GetDocumentNode",
    BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic,
    Type.EmptyTypes);

string? line;
while ((line = Console.In.ReadLine()) != null)
{
    if (line.Length == 0) continue;
    JsonNode? id = null;
    JsonObject reply;
    try
    {
        var request = JsonNode.Parse(line)!.AsObject();
        id = request["id"]?.DeepClone();
        var file = request["file"]!.GetValue<string>();
        var text = request["text"]!.GetValue<string>();
        reply = new JsonObject { ["id"] = id, ["code"] = CodeRanges(engine, documentNode, file, text) };
    }
    catch (Exception error)
    {
        reply = new JsonObject { ["id"] = id, ["error"] = error.Message };
    }
    Console.Out.WriteLine(reply.ToJsonString());
    Console.Out.Flush();
}

static JsonArray CodeRanges(RazorProjectEngine engine, MethodInfo? documentNode, string file, string text)
{
    if (documentNode == null)
        throw new InvalidOperationException(
            "This .NET SDK's Razor compiler has no RazorCodeDocument.GetDocumentNode()");
    var source = RazorSourceDocument.Create(text, file);
    var document = engine.Process(source, RazorFileKind.Legacy, [], TagHelperCollection.Empty, default);
    if (documentNode.Invoke(document, null) is not DocumentIntermediateNode root)
        throw new InvalidOperationException("The Razor compiler gave no document for " + file);
    var html = new HtmlSpans();
    html.Visit(root);
    var result = new JsonArray();
    var at = 0;
    foreach (var (start, end) in html.Merged())
    {
        if (start > at) result.Add(new JsonArray(at, start));
        at = Math.Max(at, end);
    }
    if (at < text.Length) result.Add(new JsonArray(at, text.Length));
    return result;
}

/// <summary>The HTML pieces of the document, with their place in the file (never C#).</summary>
sealed class HtmlSpans : IntermediateNodeWalker
{
    private readonly List<(int Start, int End)> spans = [];

    public override void VisitDefault(IntermediateNode node)
    {
        if (node is HtmlIntermediateToken { Source: { } at }) Add(at);
        base.VisitDefault(node);
    }

    public override void VisitHtmlAttribute(HtmlAttributeIntermediateNode node)
    {
        // ` class="` and `"` around a value that holds C#: HTML too.
        if (node.Source is { } at)
        {
            var prefixEnd = at.AbsoluteIndex + node.Prefix.Length;
            spans.Add((at.AbsoluteIndex, prefixEnd));
            var suffixStart = at.AbsoluteIndex + at.Length - node.Suffix.Length;
            spans.Add((suffixStart, at.AbsoluteIndex + at.Length));
        }
        base.VisitHtmlAttribute(node);
    }

    public override void VisitHtmlAttributeValue(HtmlAttributeValueIntermediateNode node)
    {
        if (node.Source is { } at) Add(at);
        base.VisitHtmlAttributeValue(node);
    }

    private void Add(SourceSpan at) => spans.Add((at.AbsoluteIndex, at.AbsoluteIndex + at.Length));

    public IEnumerable<(int Start, int End)> Merged() => spans.OrderBy(s => s.Start);
}
