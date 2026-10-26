using CSharpSyntax.OtherProject;

namespace CSharpSyntax.Inheritance;

public class GenericBaseClass<T>
{
    public virtual T? GenericValue { get; set; }

    public virtual T GenericVirtualMethod(T value) => value;
}

public class DerivedFromClosedGenericBase : GenericBaseClass<int>
{
    public override int GenericValue { get; set; }

    public override int GenericVirtualMethod(int value) => value + 1;
}

public class DerivedFromOpenGenericBase<T> : GenericBaseClass<T>
{
    public override T GenericVirtualMethod(T value) => base.GenericVirtualMethod(value);
}

public class DerivedFromOpenGenericBaseWithRenamedParameter<TRenamed> : GenericBaseClass<TRenamed>;

public class DerivedFromGenericBaseWithConstraint<T> : GenericBaseClass<T> where T : class, new();

public class DerivedFromGenericBaseWithExtraParameter<TFirst, TSecond> : GenericBaseClass<TFirst>
{
    public TSecond? SecondValue { get; set; }
}

public class DerivedFromNestedClosedGenericBase : GenericBaseClass<List<Dictionary<string, int[]>>>;

public class DerivedFromGenericBaseWithTupleArgument : GenericBaseClass<(int, string)>;

public class DerivedFromGenericBaseWithNullableArgument : GenericBaseClass<int?>;

public class DerivedFromGenericBaseWithArrayArgument : GenericBaseClass<string[]>;

public class DerivedFromGenericBaseOfOtherProjectType : GenericBaseClass<PublicClassFromOtherProject>;

public class DerivedFromOtherProjectGenericClass : GenericClassFromOtherProject<int>;

public class DerivedFromFrameworkGenericClass : List<int>;

public class DerivedFromFrameworkGenericClassWithOwnParameter<T> : Dictionary<string, T> where T : notnull;

public abstract class GenericAbstractBase<T>
{
    public abstract T Create();
}

public class ConcreteFromGenericAbstract : GenericAbstractBase<string>
{
    public override string Create() => "";
}

public class GenericClassWithNestedDerivedClass<T>
{
    public class NestedDerivedFromGenericOuter : GenericClassWithNestedDerivedClass<T>;

    public class NestedDerivedFromClosedGenericOuter : GenericClassWithNestedDerivedClass<int>;
}
