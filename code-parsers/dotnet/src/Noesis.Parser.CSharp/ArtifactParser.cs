using System.Collections.Concurrent;
using Microsoft.CodeAnalysis;
using Noesis.Parser.CSharp.Caching;
using Noesis.Parser.CSharp.Bodies;
using Noesis.Parser.CSharp.Declarations;
using Noesis.Parser.CSharp.Loading;
using Noesis.Parser.CSharp.Mapping;
using Noesis.Parser.Model;
using Diagnostic = Noesis.Parser.Model.Diagnostic;
using DiagnosticSource = Noesis.Parser.Model.DiagnosticSource;
using DiagnosticSeverity = Noesis.Parser.Model.DiagnosticSeverity;

namespace Noesis.Parser.CSharp;

/// <summary>What parsing one project produced: the model, whether the project loaded, whether the model came from the cache.</summary>
internal sealed record ArtifactParse(CodeModelFile Model, bool Loaded, bool Cached);

/// <summary>One project into one model file: declaration pass, body pass per tree in parallel, external closure; or the cached model when the inputs are unchanged.</summary>
internal sealed class ArtifactParser(Generator generator, string repositoryRoot, IReadOnlySet<string> sourceAssemblyNames, ModelCache cache, CacheKeys keys, ParseLog log)
{
    private readonly Locations _locations = new(repositoryRoot);

    /// <param name="fileStem">The artifact's file name without directory and extension, which names its cache directory too.</param>
    public async Task<ArtifactParse> ParseAsync(Project project, string fileStem, IReadOnlyList<Diagnostic> loadProblems, CancellationToken cancellationToken)
    {
        var key = cache.Enabled ? await keys.KeyOf(project, cancellationToken) : null;
        if (key is not null && cache.TryRead(fileStem, key) is { } cached)
        {
            log.Info($"{project.Name}: cached");
            return new ArtifactParse(cached, Loaded: true, Cached: true);
        }
        var parsed = await CompileAndWalkAsync(project, loadProblems, cancellationToken);
        if (key is not null && parsed.Loaded) cache.Write(fileStem, key, parsed.Model);
        return parsed;
    }

    private async Task<ArtifactParse> CompileAndWalkAsync(Project project, IReadOnlyList<Diagnostic> loadProblems, CancellationToken cancellationToken)
    {
        var compilation = await project.GetCompilationAsync(cancellationToken);
        if (compilation is null || FailedToLoad(project, loadProblems))
            return new ArtifactParse(EmptyModel(project, loadProblems), Loaded: false, Cached: false);

        var context = new ParseContext(compilation, repositoryRoot, sourceAssemblyNames);
        var artifact = ArtifactOf(project, compilation, context);
        var declarations = new DeclarationWalker(context);
        declarations.Walk(artifact.Id);
        var (bodyEdges, bodyDiagnostics) = WalkBodies(compilation, context, cancellationToken);
        var stubs = context.Stubs.Build();

        var model = CodeModelFile.Sorted(
            generator,
            artifact with { Dependencies = DependenciesOf(project, compilation, context, stubs.Stubs) },
            declarations.Nodes,
            declarations.Edges.Concat(bodyEdges).Concat(stubs.Edges),
            stubs.Stubs,
            loadProblems.Concat(CompilerDiagnostics(compilation, cancellationToken)).Concat(bodyDiagnostics));
        log.Info($"{project.Name}: {model.Nodes.Count} nodes, {model.Edges.Count} edges, {model.Stubs.Count} stubs, {model.Diagnostics.Count} diagnostics");
        return new ArtifactParse(model, Loaded: true, Cached: false);
    }

    /// <summary>A project MSBuild could not evaluate still yields a <see cref="Project"/>, but one without a single source file and with a load error.</summary>
    private static bool FailedToLoad(Project project, IReadOnlyList<Diagnostic> loadProblems) =>
        project.Documents.All(document => document.FilePath is null) && loadProblems.Any(problem => problem.Severity == DiagnosticSeverity.Error);

    private (IReadOnlyList<Edge> Edges, IReadOnlyList<Diagnostic> Diagnostics) WalkBodies(Compilation compilation, ParseContext context, CancellationToken cancellationToken)
    {
        var entryPoint = compilation.GetEntryPoint(cancellationToken);
        var edgesPerTree = new ConcurrentBag<List<Edge>>();
        var diagnosticsPerTree = new ConcurrentBag<List<Diagnostic>>();
        Parallel.ForEach(compilation.SyntaxTrees, new ParallelOptions { CancellationToken = cancellationToken }, tree =>
        {
            var edges = new List<Edge>();
            var diagnostics = new List<Diagnostic>();
            var model = compilation.GetSemanticModel(tree);
            foreach (var root in BodyRoots.Of(tree, model, entryPoint, cancellationToken))
                BodyWalker.Walk(context, root, edges, diagnostics);
            edgesPerTree.Add(edges);
            diagnosticsPerTree.Add(diagnostics);
        });
        return (edgesPerTree.SelectMany(list => list).ToArray(), diagnosticsPerTree.SelectMany(list => list).ToArray());
    }

    private CodeModelFile EmptyModel(Project project, IReadOnlyList<Diagnostic> loadProblems)
    {
        var diagnostics = loadProblems.Count > 0 ? loadProblems : [new Diagnostic(DiagnosticSeverity.Error, "NS1001", $"Project {project.FilePath} could not be loaded.", null, DiagnosticSource.Parser)];
        var artifact = new ArtifactNode(
            SymbolIds.ArtifactFromName(project.AssemblyName),
            ArtifactKind.Source,
            project.AssemblyName,
            null,
            RootDirectoryOf(project),
            TargetFrameworks.Of(project),
            false,
            [],
            [],
            LanguageBag.Of(ProjectBag(project)));
        return CodeModelFile.Sorted(generator, artifact, [], [], [], diagnostics);
    }

    private ArtifactNode ArtifactOf(Project project, Compilation compilation, ParseContext context)
    {
        var assembly = compilation.Assembly;
        var bag = ProjectBag(project);
        bag["csharp.outputKind"] = compilation.Options.OutputKind.ToString();
        return new ArtifactNode(
            context.Ids.Artifact(assembly),
            ArtifactKind.Source,
            assembly.Name,
            assembly.Identity.Version.ToString(),
            RootDirectoryOf(project),
            TargetFrameworks.Of(project),
            compilation.Options.OutputKind is OutputKind.ConsoleApplication or OutputKind.WindowsApplication,
            [],
            context.Annotations.Of(assembly.GetAttributes().Concat(assembly.Modules.SelectMany(module => module.GetAttributes()))),
            LanguageBag.Of(bag));
    }

    private string? RootDirectoryOf(Project project) =>
        project.FilePath is null ? null : _locations.RelativePath(Path.GetDirectoryName(project.FilePath)!);

    private Dictionary<string, object> ProjectBag(Project project)
    {
        var bag = new Dictionary<string, object> { ["csharp.projectName"] = SolutionLoader.ProjectName(project) };
        if (project.FilePath is not null) bag["csharp.projectFile"] = _locations.RelativePath(project.FilePath);
        if (!string.IsNullOrEmpty(project.DefaultNamespace)) bag["csharp.rootNamespace"] = project.DefaultNamespace;
        return bag;
    }

    /// <summary>
    /// Every metadata and project reference, classified: a compilation reference or a parsed assembly is source, a reference
    /// assembly of a framework the project references is platform, everything else is a library with its package when
    /// the restore output names one. Assemblies stubs reached that no reference lists (type forwards) are libraries too.
    /// </summary>
    private static IReadOnlyList<ArtifactDependency> DependenciesOf(Project project, Compilation compilation, ParseContext context, IReadOnlyList<StubNode> stubs)
    {
        var assets = project.FilePath is null ? ProjectAssets.Empty : ProjectAssets.Load(project.FilePath);
        var dependencies = new SortedDictionary<NodeId, ArtifactDependency>();
        foreach (var reference in compilation.References)
        {
            if (compilation.GetAssemblyOrModuleSymbol(reference) is not IAssemblySymbol assembly) continue;
            var id = context.Ids.Artifact(assembly);
            var path = (reference as PortableExecutableReference)?.FilePath;
            var kind = reference is CompilationReference || context.IsSourceAssembly(assembly) ? ArtifactKind.Source
                : assets.IsFrameworkAssembly(path) ? ArtifactKind.Platform
                : ArtifactKind.Library;
            var package = kind == ArtifactKind.Library ? assets.PackageOf(path) : null;
            dependencies[id] = new ArtifactDependency(id, kind, package);
        }
        foreach (var stub in stubs)
            if (stub.Artifact is { } artifact && !dependencies.ContainsKey(artifact))
                dependencies[artifact] = new ArtifactDependency(artifact, ArtifactKind.Library, null);
        return dependencies.Values.ToArray();
    }

    private IEnumerable<Diagnostic> CompilerDiagnostics(Compilation compilation, CancellationToken cancellationToken)
    {
        foreach (var diagnostic in compilation.GetDiagnostics(cancellationToken))
        {
            if (diagnostic.Severity == Microsoft.CodeAnalysis.DiagnosticSeverity.Hidden) continue;
            var severity = diagnostic.Severity switch
            {
                Microsoft.CodeAnalysis.DiagnosticSeverity.Error => DiagnosticSeverity.Error,
                Microsoft.CodeAnalysis.DiagnosticSeverity.Warning => DiagnosticSeverity.Warning,
                _ => DiagnosticSeverity.Info,
            };
            yield return new Diagnostic(severity, diagnostic.Id, diagnostic.GetMessage(), _locations.SpanOf(diagnostic.Location), DiagnosticSource.Compiler);
        }
    }
}
