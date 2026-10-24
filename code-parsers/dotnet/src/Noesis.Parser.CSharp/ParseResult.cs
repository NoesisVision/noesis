using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp;

/// <summary>The manifest and models of one parse, as written, with the exit code the command line reports and which artifacts came from the cache.</summary>
public sealed record ParseResult(ParseManifest Manifest, IReadOnlyList<CodeModelFile> Models, string OutputDirectory, ParseExitCode ExitCode, IReadOnlyList<NodeId> CachedArtifacts)
{
    public string ManifestPath => Path.Combine(OutputDirectory, CodeModelWriter.ManifestFile(Manifest.Language));

    public CodeModelFile Model(string artifactName) =>
        Models.Single(model => model.Artifact.Name == artifactName);
}