using System.Reflection;
using CSharpSyntax.Methods;
using CSharpSyntax.OtherProject;
using CSharpSyntax.Types;
using static CSharpSyntax.Invocations.InvocationTarget;
using static CSharpSyntax.Invocations.InvocationExtensions;
using TargetAlias = CSharpSyntax.Invocations.InvocationTarget;

namespace CSharpSyntax.Invocations;

public class InvocationForms : InvocationBase
{
    private readonly InvocationTarget _field = new();
    private readonly InvocationTarget[] _arrayField = [new()];
    private readonly List<InvocationTarget> _listField = [new()];
    private readonly Dictionary<string, InvocationTarget> _dictionaryField = new() { ["key"] = new() };
    private readonly Func<int> _delegateField = StaticMethod;
    private static readonly InvocationTarget s_staticField = new();
    private int _counter;

    public InvocationTarget Property { get; } = new();

    public static InvocationTarget StaticPropertyOnForms { get; } = new();

    public int InstanceMethodOnThisClass() => 1;

    public static int StaticMethodOnThisClass() => 1;

    public int MethodWithOverloads(int value) => value;

    public int MethodWithOverloads(string value) => value.Length;

    public int MethodWithOverloads(int first, int second) => first + second;

    public unsafe void AllInvocationForms()
    {
        var local = new InvocationTarget();
        InvocationTarget? nullableLocal = _counter > 0 ? local : null;
        dynamic dynamicLocal = new InvocationTarget();
        IInvocationInterface interfaceReference = new InvocationDerived();
        InvocationBase baseReference = new InvocationDerived();
        object objectReference = new InvocationTarget();
        int valueTypeLocal = 1;
        InvocationTarget? nullableAssigned = local;

        // Static invocations.
        _ = InvocationTarget.StaticMethod();
        _ = InvocationTarget.StaticGenericMethod(1);
        _ = InvocationTarget.StaticGenericMethod<string>("");
        _ = StaticMethod();                                                  // via using static
        _ = TargetAlias.StaticMethod();                                      // via type alias
        _ = CSharpSyntax.Invocations.InvocationTarget.StaticMethod();        // fully qualified
        _ = global::CSharpSyntax.Invocations.InvocationTarget.StaticMethod(); // global-qualified
        _ = InvocationTarget.NestedStaticHolder.NestedStaticMethod();        // static on nested type
        _ = InvocationTarget.NestedStaticHolder.DoublyNested.DoublyNestedStaticMethod();
        _ = StaticMethodOnThisClass();                                       // static on own class
        _ = InvocationForms.StaticMethodOnThisClass();
        _ = StaticBaseMethod();                                              // static inherited from base
        _ = InvocationBase.StaticBaseMethod();
        _ = IInvocationInterface.StaticInterfaceMethod();                    // static on interface
        _ = InvocationDerived.StaticAbstractInterfaceMethod();
        _ = CallStaticAbstractViaTypeParameter<InvocationDerived>();         // static abstract via T
        _ = GenericStaticClassForInvocations<int>.StaticOnGenericClass();    // static on generic class
        _ = StaticClassFromOtherProject.StaticMethodFromOtherProject();      // static from other project
        _ = PublicClassFromOtherProject.PublicStaticMethodFromOtherProject();
        _ = Math.Max(1, 2);                                                  // static from framework
        _ = int.Parse("1");                                                  // static on keyword type
        _ = string.Join(",", [1, 2]);
        _ = ExtensionMemberStaticMethod();                                   // static extension member via using static

        // Instance invocations on various receivers.
        _ = InstanceMethodOnThisClass();                                     // implicit this
        _ = this.InstanceMethodOnThisClass();                                // explicit this
        _ = base.VirtualMethod();                                            // base
        _ = VirtualMethod();                                                 // virtual via this
        _ = BaseOnlyMethod();                                                // inherited
        _ = ProtectedBaseMethod();                                           // protected inherited
        _ = local.InstanceMethod();                                          // local variable
        _ = _field.InstanceMethod();                                         // field
        _ = this._field.InstanceMethod();
        _ = s_staticField.InstanceMethod();                                  // static field
        _ = Property.InstanceMethod();                                       // property
        _ = this.Property.InstanceMethod();
        _ = StaticPropertyOnForms.InstanceMethod();                          // static property
        _ = InvocationTarget.StaticProperty.InstanceMethod();
        _ = InvocationTarget.StaticField.InstanceMethod();
        _ = StaticProperty.InstanceMethod();                                 // static property via using static
        _ = local.PropertyReturningSelf.InstanceMethod();                    // property of local
        _ = local.FieldHoldingSelf.InstanceMethod();                         // field of local
        _ = local.PropertyReturningSelf.FieldHoldingSelf.PropertyReturningSelf.InstanceMethod();
        _ = new InvocationTarget().InstanceMethod();                         // object creation expression
        _ = new InvocationTarget(1).InstanceMethod();
        _ = InvocationTarget.StaticFactory().InstanceMethod();               // returned value
        _ = local.ReturnsSelf().InstanceMethod();
        _ = local.ReturnsSelf().ReturnsSelf().ReturnsSelf().InstanceMethod(); // chained
        _ = local.ReturnsArray()[0].ToString();                              // element of returned array
        _ = local.ReturnsTuple().Target.InstanceMethod();                    // tuple element of returned value
        _ = local.ReturnsTuple().Item1.InstanceMethod();
        _ = _arrayField[0].InstanceMethod();                                 // array element
        _ = _listField[0].InstanceMethod();                                  // indexer result
        _ = _dictionaryField["key"].InstanceMethod();
        _ = local[0].InstanceMethod();                                       // custom indexer result
        _ = ((InvocationTarget)objectReference).InstanceMethod();            // cast
        _ = (objectReference as InvocationTarget)?.InstanceMethod();         // as + null-conditional
        _ = ((IInvocationInterface)new InvocationDerived()).DefaultInterfaceMethod(); // explicit interface impl via cast
        _ = interfaceReference.InterfaceMethod();                            // via interface reference
        _ = interfaceReference.DefaultInterfaceMethod();                     // default interface method
        _ = baseReference.VirtualMethod();                                   // via base-class reference, dispatches virtually
        _ = nullableLocal?.InstanceMethod();                                 // null-conditional
        _ = nullableLocal?.ReturnsSelf()?.ReturnsNullableSelf()?.InstanceMethod();
        _ = nullableLocal?.ReturnsArray()?[0];
        _ = nullableAssigned!.InstanceMethod();                              // null-forgiving
        _ = dynamicLocal.InstanceMethod();                                   // dynamic dispatch
        _ = valueTypeLocal.ToString();                                       // on value type local
        _ = 1.ToString();                                                    // on literal
        _ = "literal".ToUpper();
        _ = 'c'.ToString();
        _ = PlainEnum.First.ToString();                                      // on enum member
        _ = default(int).ToString();                                         // on default expression
        _ = typeof(int).Name.ToLower();                                      // on typeof member
        _ = nameof(local).Length;
        _ = (1 + 2).ToString();                                              // on parenthesized expression
        _ = (valueTypeLocal > 0 ? local : local).InstanceMethod();           // on conditional expression
        _ = (nullableLocal ?? local).InstanceMethod();                       // on null-coalescing expression
        _ = new int[] { 1 }.Length.ToString();
        _ = $"{local.InstanceMethod()}".Length;                              // inside interpolation
        _ = new { Nested = local }.Nested.InstanceMethod();                  // on anonymous type property
        _ = new InvocationTarget { }.ReturnsSelf().InstanceMethod();         // object initializer then chain
        _ = new PositionalRecord(1, "").Second.ToUpper();                    // on record property
        _ = (new PositionalRecord(1, "") with { First = 2 }).ToString();     // on with-expression
        _ = objectReference.ToString();                                      // on object
        _ = this.ToString();                                                 // inherited object method
        _ = ToString();
        _ = GetType().Name;
        _ = local.ToString()!.Length;
        _ = new InvocationTarget().ToString().Length;

        // Invocations with argument forms.
        _ = local.InstanceMethodWithArguments(1);                            // optional omitted
        _ = local.InstanceMethodWithArguments(1, "");
        _ = local.InstanceMethodWithArguments(1, "", 2, 3);                  // params inline
        _ = local.InstanceMethodWithArguments(1, "", [2, 3]);                // params as collection expression
        _ = local.InstanceMethodWithArguments(1, rest: [2], second: "");     // named arguments, reordered
        _ = local.InstanceMethodWithArguments(first: 1);                     // named only
        _ = local.InstanceMethodWithArguments(1, second: "");                // positional then named
        int byRef = 1;
        local.InstanceMethodWithRefKinds(ref byRef, out int outDeclared, in byRef);
        local.InstanceMethodWithRefKinds(ref byRef, out var outVar, byRef);  // `in` argument without modifier
        local.InstanceMethodWithRefKinds(ref byRef, out _, in byRef);        // discard
        _ = local.GenericInstanceMethod(1);                                  // inferred type argument
        _ = new[] { local }.Select(target => new { Target = target, Value = target.InstanceMethod() }).First().Value; // lambda returning an anonymous object as an argument
        _ = local.InstanceMethodWithArguments(_field.InstanceMethod(), nameof(local), byRef, StaticMethodOnThisClass(), local.DelegateProperty()); // argument sources: call result, constant, local, static call, delegate property call
        _ = local.GenericInstanceMethod<int>(1);                             // explicit type argument
        _ = MethodWithOverloads(1);                                          // overload by type
        _ = MethodWithOverloads("");
        _ = MethodWithOverloads(1, 2);                                       // overload by arity
        _ = local.InstanceMethodWithArguments(local.InstanceMethod());       // invocation as argument
        _ = local.InstanceMethodWithArguments(StaticMethod());
        _ = local.GenericInstanceMethod(local.ReturnsSelf()).InstanceMethod();
        _ = _listField.Select(static target => target.InstanceMethod()).Sum(); // method group / lambda as argument
        _ = _listField.Select(InvocationExtensions.ClassicExtensionMethod).Sum();
        _ = Array.ConvertAll(_arrayField, static target => target.InstanceMethod());
        _ = local.InstanceMethodWithArguments(valueTypeLocal++);             // side-effecting argument
        _ = local.InstanceMethodWithArguments((int)1.5);                     // cast argument
        _ = local.InstanceMethodWithArguments(default);                      // default literal argument
        _ = local.InstanceMethodWithArguments(checked(1 + 1));

        // Extension invocations.
        _ = local.ClassicExtensionMethod();                                  // classic extension, instance syntax
        _ = InvocationExtensions.ClassicExtensionMethod(local);              // classic extension, static syntax
        _ = local.ClassicExtensionMethodWithArguments(1);
        _ = local.ClassicGenericExtensionMethod().InstanceMethod();         // generic extension chained
        _ = interfaceReference.ClassicExtensionOnInterface();
        _ = nullableLocal.ClassicExtensionOnNullable();                      // extension on null receiver
        _ = valueTypeLocal.ClassicExtensionOnValueType();
        _ = valueTypeLocal.ClassicExtensionOnRefStruct();                    // `this ref` extension
        _ = local.ExtensionMemberMethod();                                   // extension member method
        _ = local.ExtensionMemberProperty;                                   // extension member property
        _ = InvocationTarget.ExtensionMemberStaticMethod();                  // static extension member
        _ = InvocationTarget.ExtensionMemberStaticProperty;
        _ = "".ExtensionMemberOnString();
        _ = local.ExtensionMemberGeneric();                                  // generic extension member
        _ = local.ReturnsSelf().ExtensionMemberMethod().ToString();
        _ = "".ClassicExtensionMethodFromOtherProject();                     // extension from other project
        _ = 1.ExtensionMemberPropertyFromOtherProject;
        _ = _listField.Where(static target => target.InstanceMethod() > 0).ToList(); // LINQ extension methods
        _ = (from target in _listField select target.InstanceMethod()).Sum();        // invocation inside query

        // Delegate, lambda, event and function-pointer invocations.
        _ = _delegateField();                                                // delegate field
        _ = _delegateField.Invoke();                                         // explicit Invoke
        _ = local.DelegateProperty();                                        // delegate property
        _ = local.DelegateField(1);
        local.NullableDelegateField?.Invoke();                               // null-conditional delegate
        _ = local.ReturnsDelegate()();                                       // returned delegate invoked immediately
        _ = local.ReturnsCurriedDelegate()(1)(2);                            // curried
        Func<int> localDelegate = local.InstanceMethod;
        _ = localDelegate();
        _ = ((Func<int>)(() => 1))();                                        // immediately invoked lambda
        _ = new Func<int>(local.InstanceMethod)();                           // delegate creation expression
        _ = _delegateField.DynamicInvoke();                                  // DynamicInvoke
        Action chained = local.RaiseEvent;
        chained += local.RaiseEvent;
        chained();
        local.Event += static (_, _) => { };
        local.Event += OnEvent;
        local.Event -= OnEvent;
        local.RaiseEvent();
        _ = new FunctionPointerHolder().FunctionPointer(1);                  // function pointer
        delegate*<int, int> functionPointerLocal = &FunctionPointerHolder.Identity;
        _ = functionPointerLocal(1);

        // User-defined operator and conversion invocations.
        OperatorDeclarations viaImplicitConversionOperator = 1;                // implicit conversion operator
        int viaExplicitConversionOperator = (int)viaImplicitConversionOperator; // explicit conversion operator
        OperatorDeclarations viaBinaryOperator = viaImplicitConversionOperator + viaImplicitConversionOperator;
        OperatorDeclarations viaUnaryOperator = -viaBinaryOperator;
        OperatorDeclarations viaCheckedOperator = checked(viaBinaryOperator + viaUnaryOperator);
        bool viaComparisonOperator = viaBinaryOperator == viaUnaryOperator;
        viaBinaryOperator++;
        var viaCompoundAssignmentOperator = new CompoundAssignmentOperatorDeclarations();
        viaCompoundAssignmentOperator += 1;                                   // user-defined compound assignment
        viaCompoundAssignmentOperator++;                                      // user-defined instance increment
        _ = (viaExplicitConversionOperator, viaCheckedOperator, viaComparisonOperator);

        // Invocations in other expression contexts.
        Func<int> viaThisInLambda = () => this.InstanceMethodOnThisClass();
        _ = viaThisInLambda();
        int[] viaCollectionExpressionElement = [local.InstanceMethod(), StaticMethod()];
        _ = valueTypeLocal > 0 ? local.InstanceMethod() : StaticMethod();   // in conditional expression
        _ = this[local];                                                      // own indexer
        _ = viaCollectionExpressionElement;

        // Reflection and dynamic.
        _ = typeof(InvocationTarget).GetMethod(nameof(InvocationTarget.InstanceMethod))!.Invoke(local, null);
        MethodInfo methodInfo = typeof(InvocationTarget).GetMethod(nameof(InvocationTarget.StaticMethod))!;
        _ = methodInfo.Invoke(null, []);
        _ = Activator.CreateInstance<InvocationTarget>().InstanceMethod();
        _ = dynamicLocal.ReturnsSelf().InstanceMethod();

        // Local function invocations.
        _ = LocalFunction();
        _ = LocalFunctionWithParameter(1);
        _ = StaticLocalFunction();
        _ = LocalFunctionDeclaredLater();
        _ = GenericLocalFunction(1);
        _ = GenericLocalFunction<string>("");
        Func<int> localFunctionAsDelegate = LocalFunction;
        _ = localFunctionAsDelegate();
        _ = RecursiveLocalFunction(2);

        // Constructor invocations.
        _ = new InvocationTarget();
        _ = new InvocationTarget(1);
        InvocationTarget targetTyped = new();
        InvocationTarget targetTypedWithArguments = new(1);
        _ = new InvocationTarget { NullableDelegateField = null };
        _ = new GenericStaticClassForInvocations<int>.NestedInstantiable();
        _ = new List<InvocationTarget>(capacity: 1);
        _ = CreateViaNewConstraint<InvocationTarget>();

        // Invocation as statement, in conditions, loops and expression contexts.
        local.RaiseEvent();
        if (local.InstanceMethod() > 0 && ReferenceEquals(local, local)) { }
        while (local.InstanceMethod() < 0) { local = local.ReturnsSelf(); }
        for (int i = local.InstanceMethod(); i < local.InstanceMethod(); i += local.InstanceMethod()) { }
        foreach (var item in local.ReturnsArray().Select(static value => value.ToString())) { }
        switch (local.InstanceMethod()) { case 1: break; }
        _ = local.InstanceMethod() switch { 1 => local.InstanceMethod(), _ => StaticMethod() };
        _ = local.InstanceMethod() is > 0;
        var (deconstructedFirst, deconstructedSecond) = local;               // Deconstruct invoked implicitly
        _ = deconstructedFirst + deconstructedSecond;
        using (CreateDisposable()) { }
        lock (local) { local.InstanceMethod(); }
        try { ThrowingMethod(); } catch (Exception exception) when (exception.GetType().IsClass) { _ = exception.ToString(); }
        try { throw CreateException(); } catch (InvalidOperationException) { }  // invocation in throw statement
        _counter += local.InstanceMethod();
        _ = (outDeclared, outVar, targetTyped, targetTypedWithArguments, byRef);
        return;

        int LocalFunction() => 1;
        int LocalFunctionWithParameter(int value) => value;
        static int StaticLocalFunction() => StaticMethod();
        T GenericLocalFunction<T>(T value) => value;
        int RecursiveLocalFunction(int depth) => depth <= 0 ? 0 : RecursiveLocalFunction(depth - 1);
    }

    private int LocalFunctionDeclaredLater() => 1;

    private static int CallStaticAbstractViaTypeParameter<T>() where T : IInvocationInterface => T.StaticAbstractInterfaceMethod();

    private static T CreateViaNewConstraint<T>() where T : new() => new();

    private static IDisposable CreateDisposable() => new DisposableForInvocations();

    private static void ThrowingMethod() => throw new InvalidOperationException();

    private static Exception CreateException() => new InvalidOperationException();

    private void OnEvent(object? sender, EventArgs arguments) { }

    public int ExpressionBodiedMemberInvokingOthers() => _field.InstanceMethod() + StaticMethod() + InstanceMethodOnThisClass();

    public int PropertyInvokingMethod => _field.InstanceMethod();

    public int PropertySetterInvokingOnValue
    {
        set => _counter = value.ToString().Length;
    }

    public int this[InvocationTarget target] => target.InstanceMethod();

    public int PropertyInvokingOnFieldKeyword
    {
        get => field;
        set => field = value.ToString().Length;                               // invocation on `value`
    }

    public string PropertyInvokingOnFieldKeywordInGetter => field ??= StaticMethod().ToString(); // invocation on `field`

    public InvocationForms() : this(StaticMethod()) { }                      // invocation in constructor initializer

    public InvocationForms(int value) => _counter = value;

    public async Task AsyncInvocationFormsAsync()
    {
        var local = new InvocationTarget();
        _ = await local.ReturnsTaskOfSelf();                                  // awaited invocation
        _ = (await local.ReturnsTaskOfSelf()).InstanceMethod();              // invocation on awaited value
        _ = await local.ReturnsTaskOfSelf().ConfigureAwait(false);
        _ = (await Task.WhenAll(local.ReturnsTaskOfSelf(), local.ReturnsTaskOfSelf()))[0].InstanceMethod();
        await Task.Run(local.InstanceMethod);                                // method group to Task.Run
        await Task.Run(() => local.InstanceMethod());
        await foreach (var item in AsyncSequence()) { _ = item.InstanceMethod(); }
        await using var asyncDisposable = new AsyncDisposableForInvocations();
        await asyncDisposable.DisposeAsync();
    }

    private static async IAsyncEnumerable<InvocationTarget> AsyncSequence()
    {
        await Task.Yield();
        yield return new InvocationTarget();
    }
}

public static class GenericStaticClassForInvocations<T>
{
    public static int StaticOnGenericClass() => 1;

    public class NestedInstantiable;
}

public sealed class DisposableForInvocations : IDisposable
{
    public void Dispose() { }
}

public sealed class AsyncDisposableForInvocations : IAsyncDisposable
{
    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}

// Invocations from a primary-constructor parameter, a field initializer and a property initializer.
public class InvocationsFromInitializers(InvocationTarget primaryConstructorParameter)
{
    private readonly int _fromFieldInitializer = InvocationTarget.StaticMethod();

    public int FromPropertyInitializer { get; } = primaryConstructorParameter.InstanceMethod();

    public int FromPrimaryConstructorParameter() => primaryConstructorParameter.ReturnsSelf().InstanceMethod();

    public int FromField() => _fromFieldInitializer;
}
