using Noesis.Parser.Model;

namespace Noesis.Parser.CSharp.Loading;

/// <summary>A workspace diagnostic and the project file its message names, when it names one; MSBuildWorkspace attaches no project id to its failures.</summary>
internal sealed record WorkspaceProblem(Diagnostic Diagnostic, string? ProjectFile);