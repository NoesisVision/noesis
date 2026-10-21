using Microsoft.CodeAnalysis;
using Noesis.Scanner.Model;

namespace Noesis.Scanner.CSharp.Mapping;

/// <summary>Everything the mappers of one artifact share: the compilation, which assemblies are scanned, the id and reference builders.</summary>
internal sealed class ScanContext
{
    public ScanContext(Compilation compilation, string repositoryRoot, IReadOnlySet<string> sourceAssemblyNames)
    {
        Compilation = compilation;
        RepositoryRoot = repositoryRoot;
        SourceAssemblyNames = sourceAssemblyNames;
        Extensions = new ExtensionMembers();
        Ids = new SymbolIds(this);
        Types = new TypeRefs(this);
        Locations = new Locations(repositoryRoot);
        Annotations = new AnnotationMapper(this);
        Signatures = new SignatureMapper(this);
        Stubs = new StubCollector(this);
    }

    public Compilation Compilation { get; }
    public string RepositoryRoot { get; }
    public IReadOnlySet<string> SourceAssemblyNames { get; }
    public ExtensionMembers Extensions { get; }
    public StubCollector Stubs { get; }
    public SymbolIds Ids { get; }
    public TypeRefs Types { get; }
    public Locations Locations { get; }
    public AnnotationMapper Annotations { get; }
    public SignatureMapper Signatures { get; }

    public IAssemblySymbol OwnAssembly => Compilation.Assembly;

    /// <summary>The scanned project itself or another project of the solution: its symbols have a model file of their own.</summary>
    public bool IsSourceAssembly(IAssemblySymbol assembly) =>
        SymbolEqualityComparer.Default.Equals(assembly, OwnAssembly) || SourceAssemblyNames.Contains(assembly.Name);

    /// <summary>A symbol declared outside every scanned project: it is referenced through a stub.</summary>
    public bool IsExternal(ISymbol symbol) =>
        symbol.ContainingAssembly is { } assembly && !IsSourceAssembly(assembly);
}
