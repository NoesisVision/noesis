namespace CSharpBroken;

public class UsesMissingType
{
    public MissingType Field;

    public void CallsMissingType() => MissingType.Call();
}
