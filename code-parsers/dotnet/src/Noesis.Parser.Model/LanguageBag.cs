using System.Collections;
using System.Text.Json.Serialization;

namespace Noesis.Parser.Model;

/// <summary>
/// Flat, scalar, language-prefixed facts (`csharp.partial`, `java.throws`): a string, a number, a boolean or a
/// list of strings per key, keys in ordinal order.
/// </summary>
[JsonConverter(typeof(LanguageBagJsonConverter))]
public sealed class LanguageBag : IReadOnlyDictionary<string, object>
{
    public static readonly LanguageBag Empty = new(new SortedDictionary<string, object>(StringComparer.Ordinal));

    private readonly SortedDictionary<string, object> _entries;

    private LanguageBag(SortedDictionary<string, object> entries) => _entries = entries;

    public static LanguageBag Of(IEnumerable<KeyValuePair<string, object>> entries)
    {
        var sorted = new SortedDictionary<string, object>(StringComparer.Ordinal);
        foreach (var (key, value) in entries) sorted[key] = Normalise(key, value);
        return sorted.Count == 0 ? Empty : new LanguageBag(sorted);
    }

    public object this[string key] => _entries[key];
    public IEnumerable<string> Keys => _entries.Keys;
    public IEnumerable<object> Values => _entries.Values;
    public int Count => _entries.Count;
    public bool ContainsKey(string key) => _entries.ContainsKey(key);
    public bool TryGetValue(string key, out object value) => _entries.TryGetValue(key, out value!);
    public IEnumerator<KeyValuePair<string, object>> GetEnumerator() => _entries.GetEnumerator();
    IEnumerator IEnumerable.GetEnumerator() => GetEnumerator();

    private static object Normalise(string key, object value) => value switch
    {
        int number => (long)number,
        string or bool or long or double => value,
        IEnumerable<string> list => list.ToArray(),
        _ => throw new ArgumentException($"A language bag value must be a string, number, boolean or string list; '{key}' is {value.GetType().Name}."),
    };
}