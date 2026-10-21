namespace Noesis.Scanner.Model;

/// <summary>Lays the manifest and the model files out under the output root: `code-model/&lt;language&gt;/`.</summary>
public static class CodeModelWriter
{
    public const string ManifestFileName = "manifest.json";

    public static string LanguageDirectory(Language language) => Path.Combine("code-model", language.Identifier());

    /// <summary>Path of an artifact's model file relative to the output root, with forward slashes, as the manifest lists it.</summary>
    public static string ArtifactFile(Language language, string artifactName) =>
        $"code-model/{language.Identifier()}/{SafeFileName(artifactName)}.code-model.json";

    public static string ManifestFile(Language language) => $"code-model/{language.Identifier()}/{ManifestFileName}";

    public static async Task WriteAsync(string outputRoot, ScanManifest manifest, IReadOnlyList<CodeModelFile> models, CancellationToken cancellationToken = default)
    {
        var directory = Path.Combine(outputRoot, LanguageDirectory(manifest.Language));
        Directory.CreateDirectory(directory);
        foreach (var (artifact, model) in manifest.Artifacts.Zip(models))
            await File.WriteAllTextAsync(Path.Combine(outputRoot, artifact.File), CodeModelJson.Serialize(model), cancellationToken);
        await File.WriteAllTextAsync(Path.Combine(outputRoot, ManifestFile(manifest.Language)), CodeModelJson.Serialize(manifest), cancellationToken);
    }

    private static string SafeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return new string(name.Select(c => invalid.Contains(c) ? '_' : c).ToArray());
    }
}
