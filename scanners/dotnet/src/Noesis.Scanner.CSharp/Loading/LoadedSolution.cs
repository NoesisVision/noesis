using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.MSBuild;
using Diagnostic = Noesis.Scanner.Model.Diagnostic;

namespace Noesis.Scanner.CSharp.Loading;

/// <summary>What one load produced: the workspace, the projects to scan in dependency order and the load problems.</summary>
internal sealed record LoadedSolution(MSBuildWorkspace Workspace, IReadOnlyList<Project> Projects, IReadOnlyList<WorkspaceProblem> Problems) : IDisposable
{
    /// <summary>Problems that name no project file: they belong to the manifest.</summary>
    public IEnumerable<Diagnostic> SolutionProblems =>
        Problems.Where(problem => problem.ProjectFile is null).Select(problem => problem.Diagnostic);

    /// <summary>Problems MSBuild reported for this project's file: they belong to its model.</summary>
    public IReadOnlyList<Diagnostic> ProblemsOf(Project project) =>
        Problems.Where(problem => problem.ProjectFile is not null && project.FilePath is not null && SamePath(problem.ProjectFile, project.FilePath))
            .Select(problem => problem.Diagnostic)
            .ToArray();

    private static bool SamePath(string left, string right) =>
        string.Equals(Path.GetFullPath(left), Path.GetFullPath(right), StringComparison.OrdinalIgnoreCase);

    public void Dispose() => Workspace.Dispose();
}