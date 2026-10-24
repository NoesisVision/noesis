using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.MSBuild;
using Noesis.Parser.Model;
using Diagnostic = Noesis.Parser.Model.Diagnostic;
using DiagnosticSource = Noesis.Parser.Model.DiagnosticSource;
using DiagnosticSeverity = Noesis.Parser.Model.DiagnosticSeverity;

namespace Noesis.Parser.CSharp.Loading;

/// <summary>Discovers the projects behind the inputs, restores when needed and opens them with MSBuildWorkspace.</summary>
internal sealed partial class SolutionLoader(ParseRequest request, ParseLog log)
{
    public async Task<LoadedSolution> LoadAsync(CancellationToken cancellationToken)
    {
        var inputs = ClassifyInputs();
        if (!request.NoRestore) await RestoreMissingAsync(inputs, cancellationToken);
        var (workspace, problems) = await OpenAsync(inputs, cancellationToken);
        var projects = SelectProjects(workspace.CurrentSolution);
        return new LoadedSolution(workspace, projects, problems);
    }

    private ParseInputs ClassifyInputs()
    {
        var solutions = new List<string>();
        var projects = new List<string>();
        foreach (var input in request.Inputs)
        {
            if (Directory.Exists(input))
            {
                var found = Directory.EnumerateFiles(input).Where(IsSolutionFile).Order(StringComparer.Ordinal).ToList();
                if (found.Count > 0) solutions.Add(found[0]);
                else projects.AddRange(DiscoverProjects(input));
            }
            else if (IsSolutionFile(input)) solutions.Add(input);
            else projects.Add(input);
        }
        return new ParseInputs(solutions, projects);
    }

    private static bool IsSolutionFile(string path) =>
        path.EndsWith(".sln", StringComparison.OrdinalIgnoreCase) || path.EndsWith(".slnx", StringComparison.OrdinalIgnoreCase);

    private static IEnumerable<string> DiscoverProjects(string directory)
    {
        var skipped = new HashSet<string>(["bin", "obj", "node_modules"], StringComparer.OrdinalIgnoreCase);
        var pending = new Stack<string>([directory]);
        var found = new List<string>();
        while (pending.Count > 0)
        {
            var current = pending.Pop();
            found.AddRange(Directory.EnumerateFiles(current, "*.csproj"));
            foreach (var child in Directory.EnumerateDirectories(current))
                if (!skipped.Contains(Path.GetFileName(child))) pending.Push(child);
        }
        return found.Order(StringComparer.Ordinal);
    }

    private async Task RestoreMissingAsync(ParseInputs inputs, CancellationToken cancellationToken)
    {
        var targets = new List<string>();
        targets.AddRange(inputs.Solutions.Where(solution => !SolutionIsRestored(solution)));
        targets.AddRange(inputs.Projects.Where(project => !ProjectAssets.Exists(project)));
        foreach (var target in targets)
        {
            log.Info($"Restoring {target}");
            await RunDotnetRestoreAsync(target, cancellationToken);
        }
    }

    private static bool SolutionIsRestored(string solution)
    {
        var directory = Path.GetDirectoryName(solution)!;
        return DiscoverProjects(directory).All(ProjectAssets.Exists);
    }

    private async Task RunDotnetRestoreAsync(string target, CancellationToken cancellationToken)
    {
        var start = new ProcessStartInfo("dotnet") { RedirectStandardOutput = true, RedirectStandardError = true, WorkingDirectory = Path.GetDirectoryName(target) };
        start.ArgumentList.Add("restore");
        start.ArgumentList.Add(target);
        using var process = Process.Start(start) ?? throw new InvalidOperationException("dotnet could not be started.");
        var output = await process.StandardOutput.ReadToEndAsync(cancellationToken);
        var error = await process.StandardError.ReadToEndAsync(cancellationToken);
        await process.WaitForExitAsync(cancellationToken);
        if (process.ExitCode != 0) log.Warn($"dotnet restore {target} exited with {process.ExitCode}: {output}{error}");
    }

    private async Task<(MSBuildWorkspace, List<WorkspaceProblem>)> OpenAsync(ParseInputs inputs, CancellationToken cancellationToken)
    {
        var properties = new Dictionary<string, string> { ["Configuration"] = request.Configuration };
        var workspace = MSBuildWorkspace.Create(properties);
        var problems = new List<WorkspaceProblem>();
        workspace.RegisterWorkspaceFailedHandler(failure =>
        {
            var severity = failure.Diagnostic.Kind == WorkspaceDiagnosticKind.Failure ? DiagnosticSeverity.Error : DiagnosticSeverity.Warning;
            var message = failure.Diagnostic.Message;
            lock (problems)
                problems.Add(new WorkspaceProblem(new Diagnostic(severity, "NS1001", message, null, DiagnosticSource.Parser), ProjectFileIn(message)));
            log.Detail($"workspace: {message}");
        });
        foreach (var solution in inputs.Solutions)
        {
            log.Info($"Opening {solution}");
            await workspace.OpenSolutionAsync(solution, cancellationToken: cancellationToken);
        }
        foreach (var project in inputs.Projects)
        {
            log.Info($"Opening {project}");
            await workspace.OpenProjectAsync(project, cancellationToken: cancellationToken);
        }
        return (workspace, problems);
    }

    private static string? ProjectFileIn(string message)
    {
        var match = ProjectFilePattern().Match(message);
        return match.Success ? match.Value : null;
    }

    private IReadOnlyList<Project> SelectProjects(Solution solution)
    {
        var byFile = solution.Projects
            .Where(project => project.Language == LanguageNames.CSharp && project.FilePath is not null)
            .Where(project => IsRequested(project.FilePath!))
            .GroupBy(project => project.FilePath!, StringComparer.OrdinalIgnoreCase)
            .Select(group => PickTargetFramework(group.ToList()))
            .Where(project => Matches(ProjectName(project)))
            .ToDictionary(project => project.Id);
        var order = solution.GetProjectDependencyGraph().GetTopologicallySortedProjects();
        return order.Where(byFile.ContainsKey).Select(id => byFile[id]).ToArray();
    }

    /// <summary>A project named on the command line, or any project when a directory or solution was given; never a project pulled in only by a reference.</summary>
    private bool IsRequested(string projectFile)
    {
        if (request.Inputs.Any(input => Directory.Exists(input) || IsSolutionFile(input))) return true;
        return request.Inputs.Any(input => string.Equals(Path.GetFullPath(input), Path.GetFullPath(projectFile), StringComparison.OrdinalIgnoreCase));
    }

    private Project PickTargetFramework(List<Project> candidates)
    {
        if (candidates.Count == 1) return candidates[0];
        if (request.TargetFramework is { } wanted)
        {
            var exact = candidates.FirstOrDefault(project => string.Equals(TargetFrameworks.Of(project), wanted, StringComparison.OrdinalIgnoreCase));
            if (exact is not null) return exact;
        }
        return candidates.OrderByDescending(project => TargetFrameworks.Rank(TargetFrameworks.Of(project))).ThenBy(project => project.Name, StringComparer.Ordinal).First();
    }

    private bool Matches(string projectName)
    {
        if (request.Projects.Count > 0 && !request.Projects.Any(glob => GlobMatches(glob, projectName))) return false;
        return !request.ExcludeProjects.Any(glob => GlobMatches(glob, projectName));
    }

    public static string ProjectName(Project project)
    {
        var name = project.Name;
        var parenthesis = name.IndexOf('(');
        return parenthesis > 0 ? name[..parenthesis].Trim() : name;
    }

    private static bool GlobMatches(string glob, string value) =>
        Regex.IsMatch(value, "^" + Regex.Escape(glob).Replace("\\*", ".*").Replace("\\?", ".") + "$", RegexOptions.IgnoreCase);

    [GeneratedRegex("[^\\s'\"]+\\.csproj", RegexOptions.IgnoreCase)]
    private static partial Regex ProjectFilePattern();

    private sealed record ParseInputs(IReadOnlyList<string> Solutions, IReadOnlyList<string> Projects);
}
