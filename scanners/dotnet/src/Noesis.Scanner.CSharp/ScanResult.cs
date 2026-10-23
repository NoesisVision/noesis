using Noesis.Scanner.Model;

namespace Noesis.Scanner.CSharp;

/// <summary>The manifest and models of one scan, as written, with the exit code the command line reports and which artifacts came from the cache.</summary>
public sealed record ScanResult(ScanManifest Manifest, IReadOnlyList<CodeModelFile> Models, string OutputDirectory, ScanExitCode ExitCode, IReadOnlyList<NodeId> CachedArtifacts)
{
    public string ManifestPath => Path.Combine(OutputDirectory, CodeModelWriter.ManifestFile(Manifest.Language));

    public CodeModelFile Model(string artifactName) =>
        Models.Single(model => model.Artifact.Name == artifactName);
}