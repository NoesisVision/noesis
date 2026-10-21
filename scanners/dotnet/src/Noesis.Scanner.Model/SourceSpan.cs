namespace Noesis.Scanner.Model;

public sealed record SourceSpan(string File, int StartLine, int StartColumn, int EndLine, int EndColumn) : IComparable<SourceSpan>
{
    public int CompareTo(SourceSpan? other)
    {
        if (other is null) return 1;
        var byFile = string.CompareOrdinal(File, other.File);
        if (byFile != 0) return byFile;
        if (StartLine != other.StartLine) return StartLine.CompareTo(other.StartLine);
        if (StartColumn != other.StartColumn) return StartColumn.CompareTo(other.StartColumn);
        if (EndLine != other.EndLine) return EndLine.CompareTo(other.EndLine);
        return EndColumn.CompareTo(other.EndColumn);
    }
}