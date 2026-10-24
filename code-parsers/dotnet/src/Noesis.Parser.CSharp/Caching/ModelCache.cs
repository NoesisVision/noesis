using System.IO.Compression;
using System.Text;
using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Caching;

/// <summary>
/// The model files of earlier parses, by artifact and key: `&lt;directory&gt;/&lt;artifact&gt;/&lt;key&gt;.code-model.json.gz`,
/// at most <see cref="RingSize"/> entries per artifact, the least recently used evicted. Entries are added, never
/// replaced: the same key always holds the same bytes, so concurrent parses need no lock. Without a directory every
/// call is a no-op. Layout in docs/plans/code-model-cache.md, section 3.
/// </summary>
internal sealed class ModelCache(string? directory, ParseLog log)
{
    public const int RingSize = 3;
    private const string EntrySuffix = ".code-model.json.gz";

    public bool Enabled => directory is not null;

    /// <summary>The cached model for this artifact and key, or null; a hit counts as a use.</summary>
    public CodeModelFile? TryRead(string artifact, string key)
    {
        if (directory is null) return null;
        var path = EntryPath(artifact, key);
        if (!File.Exists(path)) return null;
        try
        {
            using var file = File.OpenRead(path);
            using var inflated = new GZipStream(file, CompressionMode.Decompress);
            using var reader = new StreamReader(inflated, Encoding.UTF8);
            var model = CodeModelJson.Deserialize<CodeModelFile>(reader.ReadToEnd());
            File.SetLastWriteTimeUtc(path, DateTime.UtcNow);
            return model;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or System.Text.Json.JsonException)
        {
            log.Warn($"Cache entry {path} is unreadable and is dropped: {exception.Message}");
            TryDelete(path);
            return null;
        }
    }

    /// <summary>Writes the entry through a temp file and a rename, then evicts the oldest entries beyond the ring.</summary>
    public void Write(string artifact, string key, CodeModelFile model)
    {
        if (directory is null) return;
        var path = EntryPath(artifact, key);
        var artifactDirectory = Path.GetDirectoryName(path)!;
        Directory.CreateDirectory(artifactDirectory);
        var temp = $"{path}.{Guid.NewGuid():N}.tmp";
        try
        {
            using (var file = File.Create(temp))
            using (var deflated = new GZipStream(file, CompressionLevel.Optimal))
            using (var writer = new StreamWriter(deflated, new UTF8Encoding(false)))
                writer.Write(CodeModelJson.Serialize(model));
            File.Move(temp, path, overwrite: true);
        }
        finally
        {
            TryDelete(temp);
        }
        Evict(artifactDirectory);
    }

    /// <summary>Removes the directories of artifacts not in <paramref name="keep"/>: projects that left the solution.</summary>
    public void Sweep(IReadOnlySet<string> keep)
    {
        if (directory is null || !Directory.Exists(directory)) return;
        foreach (var artifactDirectory in Directory.EnumerateDirectories(directory))
        {
            if (keep.Contains(Path.GetFileName(artifactDirectory))) continue;
            try
            {
                Directory.Delete(artifactDirectory, recursive: true);
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                log.Detail($"Cache directory {artifactDirectory} could not be removed: {exception.Message}");
            }
        }
    }

    private static void Evict(string artifactDirectory)
    {
        var entries = new DirectoryInfo(artifactDirectory)
            .EnumerateFiles($"*{EntrySuffix}")
            .OrderByDescending(entry => entry.LastWriteTimeUtc)
            .ThenBy(entry => entry.Name, StringComparer.Ordinal)
            .Skip(RingSize);
        foreach (var entry in entries) TryDelete(entry.FullName);
    }

    private string EntryPath(string artifact, string key) => Path.Combine(directory!, artifact, key + EntrySuffix);

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // Another parse may have removed it already; the next eviction will see it.
        }
    }
}
