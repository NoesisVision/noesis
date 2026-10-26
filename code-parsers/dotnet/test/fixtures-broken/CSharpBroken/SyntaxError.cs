namespace CSharpBroken;

public class SyntaxErrorClass
{
    public void IntactMethod() => Console.WriteLine("intact");

    public void BrokenMethod( { }
}
