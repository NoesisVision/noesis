namespace Noesis.Scanner.CSharp;

/// <summary>Progress lines for the operator; the model never goes through here.</summary>
public sealed class ScanLog(Verbosity verbosity, TextWriter writer)
{
    public static readonly ScanLog Silent = new(Verbosity.Quiet, TextWriter.Null);

    public void Info(string message)
    {
        if (verbosity >= Verbosity.Normal) writer.WriteLine(message);
    }

    public void Detail(string message)
    {
        if (verbosity >= Verbosity.Detailed) writer.WriteLine(message);
    }

    public void Warn(string message) => writer.WriteLine(message);
}
