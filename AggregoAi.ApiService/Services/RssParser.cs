using System.Globalization;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace AggregoAi.ApiService.Services;

/// <summary>
/// Implementation of IRssParser that handles RSS 2.0 and Atom feed formats.
/// Gracefully handles malformed entries by skipping them and reporting errors.
/// </summary>
public partial class RssParser : IRssParser
{
    private readonly ILogger<RssParser> _logger;
    
    // Atom namespace
    private static readonly XNamespace AtomNs = "http://www.w3.org/2005/Atom";
    
    // Media RSS namespace
    private static readonly XNamespace MediaNs = "http://search.yahoo.com/mrss/";
    
    // Regex for extracting image from HTML content
    [GeneratedRegex(@"<img[^>]+src=[""']([^""']+)[""']", RegexOptions.IgnoreCase)]
    private static partial Regex ImageSrcRegex();
    
    // Common date formats used in RSS feeds
    private static readonly string[] DateFormats = 
    [
        "ddd, dd MMM yyyy HH:mm:ss zzz",
        "ddd, dd MMM yyyy HH:mm:ss Z",
        "ddd, dd MMM yyyy HH:mm:ss",
        "yyyy-MM-ddTHH:mm:sszzz",
        "yyyy-MM-ddTHH:mm:ssZ",
        "yyyy-MM-ddTHH:mm:ss",
        "yyyy-MM-dd HH:mm:ss",
        "yyyy-MM-dd",
        "dd MMM yyyy HH:mm:ss zzz",
        "dd MMM yyyy HH:mm:ss"
    ];

    public RssParser(ILogger<RssParser> logger)
    {
        _logger = logger;
    }

    public ParseResult Parse(string xmlContent, string sourceFeedId)
    {
        var articles = new List<ParsedArticle>();
        var errors = new List<ParseError>();

        if (string.IsNullOrWhiteSpace(xmlContent))
        {
            errors.Add(new ParseError("XML content is null or empty", null, null));
            return new ParseResult(articles, errors);
        }

        try
        {
            var doc = XDocument.Parse(xmlContent);
            var root = doc.Root;

            if (root == null)
            {
                errors.Add(new ParseError("XML document has no root element", null, null));
                return new ParseResult(articles, errors);
            }

            // Detect feed type and parse accordingly
            if (IsAtomFeed(root))
            {
                _logger.LogDebug("Detected Atom feed format");
                ParseAtomFeed(root, sourceFeedId, articles, errors);
            }
            else if (IsRssFeed(root))
            {
                _logger.LogDebug("Detected RSS 2.0 feed format");
                ParseRssFeed(root, sourceFeedId, articles, errors);
            }
            else
            {
                errors.Add(new ParseError(
                    $"Unknown feed format. Root element: {root.Name.LocalName}", 
                    null, null));
            }

            _logger.LogInformation(
                "Parsed feed {FeedId}: {ArticleCount} articles, {ErrorCount} errors",
                sourceFeedId, articles.Count, errors.Count);
        }
        catch (System.Xml.XmlException ex)
        {
            _logger.LogError(ex, "XML parsing error for feed {FeedId}", sourceFeedId);
            errors.Add(new ParseError($"Invalid XML: {ex.Message}", null, ex));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unexpected error parsing feed {FeedId}", sourceFeedId);
            errors.Add(new ParseError($"Unexpected error: {ex.Message}", null, ex));
        }

        return new ParseResult(articles, errors);
    }

    private static bool IsAtomFeed(XElement root)
    {
        return root.Name.LocalName.Equals("feed", StringComparison.OrdinalIgnoreCase) &&
               (root.Name.Namespace == AtomNs || 
                root.GetDefaultNamespace() == AtomNs ||
                root.Attributes().Any(a => a.Value == AtomNs.NamespaceName));
    }

    private static bool IsRssFeed(XElement root)
    {
        return root.Name.LocalName.Equals("rss", StringComparison.OrdinalIgnoreCase) ||
               root.Name.LocalName.Equals("rdf", StringComparison.OrdinalIgnoreCase);
    }


    private void ParseRssFeed(XElement root, string sourceFeedId, 
        List<ParsedArticle> articles, List<ParseError> errors)
    {
        var channel = root.Element("channel");
        if (channel == null)
        {
            errors.Add(new ParseError("RSS feed missing channel element", null, null));
            return;
        }

        var items = channel.Elements("item");
        foreach (var item in items)
        {
            try
            {
                var article = ParseRssItem(item, sourceFeedId);
                if (article != null)
                {
                    articles.Add(article);
                }
                else
                {
                    var identifier = GetElementValue(item, "link") ?? 
                                    GetElementValue(item, "guid") ?? 
                                    "unknown";
                    errors.Add(new ParseError(
                        "Item missing required fields (title and link)", 
                        identifier, null));
                }
            }
            catch (Exception ex)
            {
                var identifier = GetElementValue(item, "link") ?? 
                                GetElementValue(item, "guid") ?? 
                                "unknown";
                errors.Add(new ParseError(
                    $"Error parsing item: {ex.Message}", 
                    identifier, ex));
            }
        }
    }

    private ParsedArticle? ParseRssItem(XElement item, string sourceFeedId)
    {
        var title = GetElementValue(item, "title");
        var link = GetElementValue(item, "link");

        // Both title and link are required
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(link))
        {
            return null;
        }

        var description = GetElementValue(item, "description");
        var pubDateStr = GetElementValue(item, "pubDate");
        var pubDate = ParseDate(pubDateStr);
        var imageUrl = ExtractRssImage(item, description);

        return new ParsedArticle(title, link, description, pubDate, sourceFeedId, imageUrl);
    }
    
    private static string? ExtractRssImage(XElement item, string? description)
    {
        // 1. Try <enclosure> element (common for podcasts and media)
        var enclosure = item.Element("enclosure");
        if (enclosure != null)
        {
            var type = enclosure.Attribute("type")?.Value;
            if (type?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true)
            {
                var url = enclosure.Attribute("url")?.Value;
                if (!string.IsNullOrWhiteSpace(url)) return url;
            }
        }
        
        // 2. Try <media:content> or <media:thumbnail> (Media RSS)
        var mediaContent = item.Element(MediaNs + "content");
        if (mediaContent != null)
        {
            var medium = mediaContent.Attribute("medium")?.Value;
            var type = mediaContent.Attribute("type")?.Value;
            if (medium == "image" || type?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true)
            {
                var url = mediaContent.Attribute("url")?.Value;
                if (!string.IsNullOrWhiteSpace(url)) return url;
            }
        }
        
        var mediaThumbnail = item.Element(MediaNs + "thumbnail");
        if (mediaThumbnail != null)
        {
            var url = mediaThumbnail.Attribute("url")?.Value;
            if (!string.IsNullOrWhiteSpace(url)) return url;
        }
        
        // 3. Try <image> element
        var image = item.Element("image");
        if (image != null)
        {
            var url = image.Element("url")?.Value ?? image.Attribute("url")?.Value;
            if (!string.IsNullOrWhiteSpace(url)) return url;
        }
        
        // 4. Extract from description HTML content
        if (!string.IsNullOrWhiteSpace(description))
        {
            var match = ImageSrcRegex().Match(description);
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }
        
        return null;
    }


    private void ParseAtomFeed(XElement root, string sourceFeedId, 
        List<ParsedArticle> articles, List<ParseError> errors)
    {
        // Try both with and without namespace
        var entries = root.Elements(AtomNs + "entry")
            .Concat(root.Elements("entry"));

        foreach (var entry in entries)
        {
            try
            {
                var article = ParseAtomEntry(entry, sourceFeedId);
                if (article != null)
                {
                    articles.Add(article);
                }
                else
                {
                    var identifier = GetAtomLink(entry) ?? 
                                    GetAtomElementValue(entry, "id") ?? 
                                    "unknown";
                    errors.Add(new ParseError(
                        "Entry missing required fields (title and link)", 
                        identifier, null));
                }
            }
            catch (Exception ex)
            {
                var identifier = GetAtomLink(entry) ?? 
                                GetAtomElementValue(entry, "id") ?? 
                                "unknown";
                errors.Add(new ParseError(
                    $"Error parsing entry: {ex.Message}", 
                    identifier, ex));
            }
        }
    }

    private ParsedArticle? ParseAtomEntry(XElement entry, string sourceFeedId)
    {
        var title = GetAtomElementValue(entry, "title");
        var link = GetAtomLink(entry);

        // Both title and link are required
        if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(link))
        {
            return null;
        }

        var description = GetAtomElementValue(entry, "summary") ?? 
                         GetAtomElementValue(entry, "content");
        var updatedStr = GetAtomElementValue(entry, "updated") ?? 
                        GetAtomElementValue(entry, "published");
        var pubDate = ParseDate(updatedStr);
        var imageUrl = ExtractAtomImage(entry, description);

        return new ParsedArticle(title, link, description, pubDate, sourceFeedId, imageUrl);
    }
    
    private static string? ExtractAtomImage(XElement entry, string? description)
    {
        // 1. Try <link rel="enclosure" type="image/*">
        var links = entry.Elements(AtomNs + "link").Concat(entry.Elements("link"));
        foreach (var link in links)
        {
            var rel = link.Attribute("rel")?.Value;
            var type = link.Attribute("type")?.Value;
            if (rel == "enclosure" && type?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true)
            {
                var href = link.Attribute("href")?.Value;
                if (!string.IsNullOrWhiteSpace(href)) return href;
            }
        }
        
        // 2. Try <media:content> or <media:thumbnail>
        var mediaContent = entry.Element(MediaNs + "content");
        if (mediaContent != null)
        {
            var medium = mediaContent.Attribute("medium")?.Value;
            var type = mediaContent.Attribute("type")?.Value;
            if (medium == "image" || type?.StartsWith("image/", StringComparison.OrdinalIgnoreCase) == true)
            {
                var url = mediaContent.Attribute("url")?.Value;
                if (!string.IsNullOrWhiteSpace(url)) return url;
            }
        }
        
        var mediaThumbnail = entry.Element(MediaNs + "thumbnail");
        if (mediaThumbnail != null)
        {
            var url = mediaThumbnail.Attribute("url")?.Value;
            if (!string.IsNullOrWhiteSpace(url)) return url;
        }
        
        // 3. Extract from content HTML
        if (!string.IsNullOrWhiteSpace(description))
        {
            var match = ImageSrcRegex().Match(description);
            if (match.Success)
            {
                return match.Groups[1].Value;
            }
        }
        
        return null;
    }


    private static string? GetAtomLink(XElement entry)
    {
        // Try to find link with rel="alternate" or no rel attribute
        var links = entry.Elements(AtomNs + "link")
            .Concat(entry.Elements("link"));

        foreach (var link in links)
        {
            var rel = link.Attribute("rel")?.Value;
            if (rel == null || rel.Equals("alternate", StringComparison.OrdinalIgnoreCase))
            {
                var href = link.Attribute("href")?.Value;
                if (!string.IsNullOrWhiteSpace(href))
                {
                    return href;
                }
            }
        }

        // Fallback: try any link
        return links.FirstOrDefault()?.Attribute("href")?.Value;
    }

    private static string? GetAtomElementValue(XElement parent, string elementName)
    {
        // Try with namespace first, then without
        var element = parent.Element(AtomNs + elementName) ?? 
                     parent.Element(elementName);
        return element?.Value?.Trim();
    }

    private static string? GetElementValue(XElement parent, string elementName)
    {
        return parent.Element(elementName)?.Value?.Trim();
    }

    private DateTime? ParseDate(string? dateStr)
    {
        if (string.IsNullOrWhiteSpace(dateStr))
        {
            return null;
        }

        // Clean up the date string
        dateStr = dateStr.Trim();

        // Try standard parsing first
        if (DateTimeOffset.TryParse(dateStr, CultureInfo.InvariantCulture, 
            DateTimeStyles.AllowWhiteSpaces, out var dto))
        {
            return dto.UtcDateTime;
        }

        // Try specific formats
        foreach (var format in DateFormats)
        {
            if (DateTimeOffset.TryParseExact(dateStr, format, CultureInfo.InvariantCulture,
                DateTimeStyles.AllowWhiteSpaces, out dto))
            {
                return dto.UtcDateTime;
            }
        }

        // Handle timezone abbreviations like "GMT", "EST", etc.
        var cleanedDate = CleanTimezoneAbbreviation(dateStr);
        if (cleanedDate != dateStr && DateTimeOffset.TryParse(cleanedDate, 
            CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out dto))
        {
            return dto.UtcDateTime;
        }

        return null;
    }

    private static string CleanTimezoneAbbreviation(string dateStr)
    {
        // Common timezone abbreviations to UTC offset mappings
        var tzMappings = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            { "GMT", "+0000" },
            { "UTC", "+0000" },
            { "EST", "-0500" },
            { "EDT", "-0400" },
            { "CST", "-0600" },
            { "CDT", "-0500" },
            { "MST", "-0700" },
            { "MDT", "-0600" },
            { "PST", "-0800" },
            { "PDT", "-0700" }
        };

        foreach (var (abbr, offset) in tzMappings)
        {
            if (dateStr.EndsWith(abbr, StringComparison.OrdinalIgnoreCase))
            {
                return dateStr[..^abbr.Length].TrimEnd() + " " + offset;
            }
        }

        return dateStr;
    }
}
