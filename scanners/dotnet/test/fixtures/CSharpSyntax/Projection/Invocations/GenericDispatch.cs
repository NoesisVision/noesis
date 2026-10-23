using NoesisVision.Annotations.Domain.DDD;

// Calls through generics: a constrained type parameter (open and constructed), a generic
// block interface implemented closed, open and twice, a static abstract member via T.
namespace CSharpSyntax.Projection.Invocations;

public interface Modifier
{
    void Modify();
}

[DddValueObject]
public record struct ModifierA : Modifier
{
    public void Modify() => Reached.ByModifierA();
}

[DddValueObject]
public record struct ModifierB : Modifier
{
    public void Modify() => Reached.ByModifierB();
}

[DddDomainService]
public class ConstrainedGenericSteps
{
    /// <summary>A step: internal, so no behaviour; the call on its type parameter is what dispatches.</summary>
    internal void ApplyStep<TModifier>(TModifier modifier) where TModifier : Modifier => modifier.Modify();

    public void ApplyInferred() => ApplyStep(new ModifierA());

    public void ApplyExplicit() => ApplyStep<ModifierB>(new ModifierB());

    public void ApplyOpen<TModifier>(TModifier modifier) where TModifier : Modifier => ApplyStep(modifier);

    public void ApplyDirect(ModifierA modifier) => modifier.Modify();
}

[DddRepository]
public interface GenericBlockInterface<T> where T : Modifier
{
    T Load();
}

[DddRepository]
public class ClosedImplementor : GenericBlockInterface<ModifierA>
{
    public ModifierA Load()
    {
        Reached.ByClosedImplementor();
        return default;
    }
}

[DddRepository]
public class OpenImplementor<T> : GenericBlockInterface<T> where T : Modifier
{
    public T Load()
    {
        Reached.ByOpenImplementor();
        return default!;
    }
}

public class ImplementedTwice : GenericBlockInterface<ModifierA>, GenericBlockInterface<ModifierB>
{
    ModifierA GenericBlockInterface<ModifierA>.Load()
    {
        Reached.ByImplementedTwiceA();
        return default;
    }

    ModifierB GenericBlockInterface<ModifierB>.Load()
    {
        Reached.ByImplementedTwiceB();
        return default;
    }
}

[DddApplicationService]
public class CallsThroughGenericInterface
{
    public void ViaClosed(GenericBlockInterface<ModifierA> repository) => repository.Load();

    public void ViaOpen<T>(GenericBlockInterface<T> repository) where T : Modifier => repository.Load();

    public void ViaClosedImplementor(ClosedImplementor repository) => repository.Load();

    public void ViaOpenImplementorClosed(OpenImplementor<ModifierB> repository) => repository.Load();

    public void ViaImplementedTwice(ImplementedTwice repository)
    {
        ((GenericBlockInterface<ModifierA>)repository).Load();
        ((GenericBlockInterface<ModifierB>)repository).Load();
    }
}

[DddFactory]
public interface StaticAbstractBlockInterface<TSelf> where TSelf : StaticAbstractBlockInterface<TSelf>
{
    static abstract TSelf Create();
}

[DddValueObject]
public record CreatedViaStaticAbstract : StaticAbstractBlockInterface<CreatedViaStaticAbstract>
{
    public static CreatedViaStaticAbstract Create()
    {
        Reached.ByStaticAbstractImplementor();
        return new();
    }
}

[DddApplicationService]
public class CallsThroughTypeParameter
{
    public T Create<T>() where T : StaticAbstractBlockInterface<T> => T.Create();

    public CreatedViaStaticAbstract CreateConcrete() => CreatedViaStaticAbstract.Create();
}
