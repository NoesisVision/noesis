using System.Runtime.CompilerServices;
using CSharpSyntax.Types;

namespace CSharpSyntax.LocalVariables;

public class LocalVariableForms
{
    private int _field = 1;
    private readonly int[] _array = [1, 2, 3];
    private readonly Lock _lock = new();
    private LocalVariableForms? _child;

    public unsafe void AllLocalVariableForms()
    {
        // Declarations.
        int explicitlyTyped = 1;
        var implicitlyTyped = 1;
        int declaredWithoutInitializer;
        declaredWithoutInitializer = 2;
        int firstDeclarator = 1, secondDeclarator = 2, thirdDeclaratorWithoutInitializer;
        thirdDeclaratorWithoutInitializer = 3;
        const int constLocal = 10;
        const string constStringLocal = "constant";
        int? nullableValue = null;
        string? nullableReference = null;
        object boxed = 1;
        dynamic dynamicLocal = 1;
        nint nativeInt = 1;
        var @class = 1;
        System.Int32 viaSystemName = 1;
        global::System.Int32 viaGlobalQualifiedName = 1;
        PlainEnum enumLocal = PlainEnum.First;
        int defaultLiteral = default;
        int defaultExpression = default(int);
        string? defaultReference = default;
        int fromNameof = nameof(explicitlyTyped).Length;
        Type fromTypeof = typeof(int);
        int fromSizeof = sizeof(int);
        int fromChecked = checked(explicitlyTyped + 1);
        int fromUnchecked = unchecked(int.MaxValue + 1);
        int fromConditional = explicitlyTyped > 0 ? 1 : 2;
        int fromNullCoalescing = nullableValue ?? 0;
        string fromThrowExpression = boxed.ToString() ?? throw new InvalidOperationException();
        int fromCast = (int)3.5;
        object? fromAs = boxed as string;
        bool fromIs = boxed is int;
        int fromIndex = _array[^1];
        int[] fromRange = _array[1..];
        int fromCompoundInterpolation = $"{explicitlyTyped}".Length;
        long fromImplicitWideningConversion = explicitlyTyped;
        double fromImplicitNumericConversion = explicitlyTyped;
        object fromBoxingConversion = explicitlyTyped;
        string fromConcatenation = "a" + "b" + explicitlyTyped;
        bool fromLogicalExpression = explicitlyTyped > 0 && !boolFromMethod() || explicitlyTyped == 0;
        int fromBitwiseExpression = (explicitlyTyped & 1) | (explicitlyTyped ^ 2) << 1 >> 1 >>> 1 | ~0;
        if (boxed is var anythingPattern) { _ = anythingPattern; }
        static bool boolFromMethod() => false;

        // Literals.
        int decimalLiteral = 1_000;
        int hexLiteral = 0xFF;
        int binaryLiteral = 0b1010;
        long longLiteral = 1L;
        ulong unsignedLongLiteral = 1UL;
        uint unsignedLiteral = 1U;
        float floatLiteral = 1.5f;
        double doubleLiteral = 1.5d;
        double exponentLiteral = 1.5e3;
        decimal decimalTypeLiteral = 1.5m;
        char charLiteral = 'c';
        char escapedCharLiteral = '\n';
        char unicodeCharLiteral = '\u0041';
        string stringLiteral = "text";
        string verbatimStringLiteral = @"C:\path";
        string interpolatedStringLiteral = $"{explicitlyTyped}";
        string verbatimInterpolatedStringLiteral = $@"{explicitlyTyped}\path";
        string rawStringLiteral = """
            raw "string" literal
            """;
        string rawInterpolatedStringLiteral = $$"""
            {{explicitlyTyped}} with {braces}
            """;
        ReadOnlySpan<byte> utf8Literal = "utf8"u8;
        bool boolLiteral = true;
        object? nullLiteral = null;

        // Target-typed and object creation.
        List<int> targetTypedNew = new();
        List<int> targetTypedNewWithArguments = new(10);
        var explicitNew = new List<int>();
        var explicitNewWithArguments = new List<int>(10);
        PlainStructForLocals objectInitializer = new() { FieldInStruct = 1 };
        var objectInitializerWithExplicitType = new ClassWithPropertiesForLocals { First = 1, Second = "" };
        var objectInitializerNested = new ClassWithPropertiesForLocals { Nested = { First = 1 } };
        var collectionInitializer = new List<int> { 1, 2, 3 };
        var dictionaryCollectionInitializer = new Dictionary<string, int> { { "a", 1 }, { "b", 2 } };
        var dictionaryIndexInitializer = new Dictionary<string, int> { ["a"] = 1, ["b"] = 2 };
        int[] collectionExpression = [1, 2, 3];
        int[] collectionExpressionWithSpread = [.. collectionExpression, 4, .. _array];
        List<int> collectionExpressionAsList = [];
        Span<int> collectionExpressionAsSpan = [1, 2];
        ReadOnlySpan<int> collectionExpressionAsReadOnlySpan = [1, 2];
        IEnumerable<int> collectionExpressionAsInterface = [1];
        ImmutableArrayLike collectionExpressionAsCustomBuilder = [1, 2];
        var implicitlyTypedArray = new[] { 1, 2, 3 };
        int[] arrayWithSize = new int[3];
        int[] arrayWithSizeAndInitializer = new int[3] { 1, 2, 3 };
        int[] arrayWithInitializerOnly = { 1, 2, 3 };
        int[,] multiDimensionalArray = { { 1, 2 }, { 3, 4 } };
        int[,] multiDimensionalArrayWithSize = new int[2, 2];
        int[][] jaggedArray = [[1], [2, 3]];
        int[][] jaggedArrayExplicit = new int[2][];
        var anonymousObject = new { Name = "", Count = 1 };
        var anonymousObjectWithProjection = new { explicitlyTyped, boxed };
        var anonymousArray = new[] { new { Key = 1 }, new { Key = 2 } };
        Func<int, int> lambdaLocal = value => value;
        var lambdaWithNaturalType = (int value) => value;
        Func<int, int> methodGroupLocal = StaticIdentity;
        var methodGroupWithNaturalType = StaticIdentity;
        Action actionLocal = () => { };
        Delegate delegateLocal = StaticIdentity;

        // Tuples and deconstruction.
        (int, string) unnamedTuple = (1, "");
        (int Count, string Name) namedTuple = (1, "");
        var tupleWithInferredNames = (explicitlyTyped, stringLiteral);
        var tupleWithExplicitNames = (Count: 1, Name: "");
        var (deconstructedFirst, deconstructedSecond) = namedTuple;
        (int typedDeconstructedFirst, string typedDeconstructedSecond) = namedTuple;
        (var mixedDeconstructedFirst, string mixedDeconstructedSecond) = namedTuple;
        int existingFirst;
        string existingSecond;
        (existingFirst, existingSecond) = namedTuple;
        var (_, discardedDeconstruction) = namedTuple;
        (int nestedDeconstructedFirst, (string nestedDeconstructedSecond, bool nestedDeconstructedThird)) = (1, ("", true));
        var (recordFirst, recordSecond) = new PositionalRecord(1, "");
        var (customDeconstructFirst, customDeconstructSecond) = new ClassWithDeconstruct();
        _ = (1, "") is (int, string);

        // Out, pattern and inline declarations.
        int.TryParse("1", out int outExplicit);
        int.TryParse("1", out var outVar);
        int.TryParse("1", out _);
        if (boxed is int patternVariable) { _ = patternVariable; }
        if (boxed is not string notPatternVariable) { }
        if (boxed is int { } propertyPatternVariable) { _ = propertyPatternVariable; }
        if (namedTuple is (int positionalPatternFirst, string positionalPatternSecond)) { _ = positionalPatternFirst; }
        if (boxed is int and > 0) { }
        if (objectInitializerWithExplicitType is { First: var propertyPatternExtracted }) { _ = propertyPatternExtracted; }
        if (_array is [var firstElement, .. var restElements]) { _ = firstElement; }
        if (_array is [.., var lastElement]) { _ = lastElement; }
        string switchStatementResult;
        switch (boxed)
        {
            case int switchCaseVariable when switchCaseVariable > 0:
                switchStatementResult = "positive int";
                break;
            case string switchCaseString:
                switchStatementResult = switchCaseString;
                break;
            case null:
                switchStatementResult = "null";
                break;
            default:
                switchStatementResult = "other";
                break;
        }
        string switchExpressionResult = boxed switch
        {
            int switchArmVariable when switchArmVariable > 0 => "positive",
            int => "int",
            string { Length: > 0 } nonEmptyString => nonEmptyString,
            _ => "other",
        };
        var withExpressionResult = new PositionalRecord(1, "") with { First = 2 };

        // Assignments.
        explicitlyTyped = 2;
        explicitlyTyped += 1;
        explicitlyTyped -= 1;
        explicitlyTyped *= 2;
        explicitlyTyped /= 2;
        explicitlyTyped %= 2;
        explicitlyTyped &= 1;
        explicitlyTyped |= 1;
        explicitlyTyped ^= 1;
        explicitlyTyped <<= 1;
        explicitlyTyped >>= 1;
        explicitlyTyped >>>= 1;
        explicitlyTyped++;
        explicitlyTyped--;
        ++explicitlyTyped;
        --explicitlyTyped;
        int chainedFirst, chainedSecond;
        chainedFirst = chainedSecond = 1;
        nullableReference ??= "";
        nullableValue ??= 0;
        int assignedFromAssignment = explicitlyTyped = 3;
        _child?.PublicField = 1;
        _child?.PublicProperty = 1;
        _ = explicitlyTyped;
        (explicitlyTyped, implicitlyTyped) = (implicitlyTyped, explicitlyTyped);

        // Ref, scoped, pointers and stackalloc.
        ref int refLocal = ref _array[0];
        ref readonly int refReadonlyLocal = ref _array[1];
        ref var refVarLocal = ref _array[0];
        ref int refFromMethod = ref RefReturningMethod();
        ref int refLocalReassigned = ref refLocal;
        refLocalReassigned = ref _array[2];
        refLocal = 5;
        scoped Span<int> scopedSpan = stackalloc int[2];
        scoped ref int scopedRef = ref refLocal;
        Span<int> stackAllocatedSpan = stackalloc int[4];
        Span<int> stackAllocatedWithInitializer = stackalloc int[] { 1, 2 };
        Span<int> stackAllocatedCollectionExpression = stackalloc[] { 1, 2 };
        int* stackAllocatedPointer = stackalloc int[4];
        int* pointerToLocal = &explicitlyTyped;
        int** pointerToPointer = &pointerToLocal;
        int dereferenced = *pointerToLocal;
        delegate*<int, int> functionPointer = &StaticIdentity;
        int viaFunctionPointer = functionPointer(1);
        fixed (int* fixedPointer = _array)
        {
            _ = fixedPointer[0];
        }
        fixed (char* fixedStringPointer = stringLiteral)
        {
            _ = *fixedStringPointer;
        }

        // Variables declared by statements.
        using var usingVarDeclaration = new DisposableForLocals();
        using (var usingStatementDeclaration = new DisposableForLocals())
        {
        }
        using (new DisposableForLocals())
        {
        }
        using DisposableForLocals usingVarExplicitType = new();
        foreach (var foreachVar in _array) { }
        foreach (int foreachExplicit in _array) { }
        foreach (var (foreachDeconstructedKey, foreachDeconstructedValue) in dictionaryIndexInitializer) { }
        foreach ((string foreachTypedKey, int foreachTypedValue) in dictionaryIndexInitializer) { }
        foreach (ref int foreachRef in _array.AsSpan()) { foreachRef++; }
        foreach (ref readonly int foreachRefReadonly in _array.AsSpan()) { }
        for (int forCounter = 0; forCounter < 1; forCounter++) { }
        for (int forFirst = 0, forSecond = 1; forFirst < forSecond; forFirst++, forSecond--) { }
        for (var forVar = 0; forVar < 1; ++forVar) { }
        for (;;) { break; }
        int whileCounter = 0;
        while (whileCounter < 1) { whileCounter++; }
        do { whileCounter--; } while (whileCounter > 0);
        try
        {
            throw new InvalidOperationException();
        }
        catch (InvalidOperationException catchVariable) when (catchVariable.Message.Length >= 0)
        {
        }
        catch (Exception)
        {
        }
        finally
        {
        }
        try
        {
        }
        catch
        {
        }
        lock (_lock)
        {
            int declaredInsideLock = 1;
        }
        lock (_array)
        {
        }
        {
            int declaredInNestedBlock = 1;
        }
        checked
        {
            int declaredInCheckedBlock = explicitlyTyped + 1;
        }
        unchecked
        {
            int declaredInUncheckedBlock = int.MaxValue + 1;
        }
        unsafe
        {
            int declaredInUnsafeBlock = 1;
        }
        var query =
            from queryRangeVariable in _array
            let queryLetVariable = queryRangeVariable * 2
            join queryJoinVariable in _array on queryRangeVariable equals queryJoinVariable
            where queryLetVariable > 0
            orderby queryLetVariable descending
            group queryLetVariable by queryRangeVariable % 2 into queryGroup
            select queryGroup.Key;
        var queryWithInto =
            from queryIntoSource in _array
            select queryIntoSource * 2 into queryIntoVariable
            where queryIntoVariable > 0
            select queryIntoVariable;
        int declaredAfterGoto;
        goto Label;
    Label:
        declaredAfterGoto = 1;

        _ = (explicitlyTyped, implicitlyTyped, declaredWithoutInitializer, firstDeclarator, secondDeclarator,
            thirdDeclaratorWithoutInitializer, constLocal, constStringLocal, nullableValue, nullableReference,
            boxed, nativeInt, @class, viaSystemName, viaGlobalQualifiedName, enumLocal, defaultLiteral,
            defaultExpression, defaultReference, fromNameof, fromTypeof, fromSizeof, fromChecked, fromUnchecked,
            fromConditional, fromNullCoalescing, fromThrowExpression, fromCast, fromAs, fromIs, fromIndex, fromRange,
            fromCompoundInterpolation, decimalLiteral, hexLiteral, binaryLiteral, longLiteral, unsignedLongLiteral,
            unsignedLiteral, floatLiteral, doubleLiteral, exponentLiteral, decimalTypeLiteral, charLiteral,
            escapedCharLiteral, unicodeCharLiteral, stringLiteral, verbatimStringLiteral, interpolatedStringLiteral,
            verbatimInterpolatedStringLiteral, rawStringLiteral, rawInterpolatedStringLiteral, boolLiteral,
            nullLiteral, targetTypedNew, targetTypedNewWithArguments, explicitNew, explicitNewWithArguments,
            objectInitializer, objectInitializerWithExplicitType, objectInitializerNested, collectionInitializer,
            dictionaryCollectionInitializer, collectionExpressionWithSpread, collectionExpressionAsList,
            collectionExpressionAsInterface, collectionExpressionAsCustomBuilder, implicitlyTypedArray,
            arrayWithSize, arrayWithSizeAndInitializer, arrayWithInitializerOnly, multiDimensionalArray,
            multiDimensionalArrayWithSize, jaggedArray, jaggedArrayExplicit, anonymousObject,
            anonymousObjectWithProjection, anonymousArray, lambdaLocal, lambdaWithNaturalType, methodGroupLocal,
            methodGroupWithNaturalType, actionLocal, delegateLocal, unnamedTuple, tupleWithInferredNames,
            tupleWithExplicitNames, deconstructedFirst, deconstructedSecond, typedDeconstructedFirst,
            typedDeconstructedSecond, mixedDeconstructedFirst, mixedDeconstructedSecond, existingFirst,
            existingSecond, discardedDeconstruction, nestedDeconstructedFirst, nestedDeconstructedSecond,
            nestedDeconstructedThird, recordFirst, recordSecond, customDeconstructFirst, customDeconstructSecond,
            outExplicit, outVar, switchStatementResult, switchExpressionResult, withExpressionResult,
            chainedFirst, chainedSecond, assignedFromAssignment, refLocal, refReadonlyLocal, scopedRef,
            dereferenced, viaFunctionPointer, fromImplicitWideningConversion, fromImplicitNumericConversion,
            fromBoxingConversion, fromConcatenation, fromLogicalExpression, fromBitwiseExpression, refVarLocal, refFromMethod, usingVarDeclaration, usingVarExplicitType, query, queryWithInto,
            declaredAfterGoto);
        _ = (int)dynamicLocal + utf8Literal.Length + collectionExpressionAsSpan.Length
            + collectionExpressionAsReadOnlySpan.Length + scopedSpan.Length + stackAllocatedSpan.Length
            + stackAllocatedWithInitializer.Length + stackAllocatedCollectionExpression.Length
            + stackAllocatedPointer[0] + **pointerToPointer + refLocalReassigned;
    }

    public async Task AsyncLocalVariableFormsAsync()
    {
        int awaited = await Task.FromResult(1);
        var awaitedVar = await Task.FromResult(1);
        var awaitedValueTask = await ValueTask.FromResult(1);
        int awaitedWithConfigureAwait = await Task.FromResult(1).ConfigureAwait(false);
        await using var asyncUsingVar = new AsyncDisposableForLocals();
        await using (var asyncUsingStatement = new AsyncDisposableForLocals())
        {
        }
        await foreach (var asyncForeachVar in AsyncSequence()) { }
        await foreach (int asyncForeachExplicit in AsyncSequence().WithCancellation(CancellationToken.None)) { }
        Task<int> unawaitedTask = Task.FromResult(1);
        int awaitedLater = await unawaitedTask;
        _ = (awaited, awaitedVar, awaitedValueTask, awaitedWithConfigureAwait, awaitedLater);
    }

    public int PublicField;

    public int PublicProperty { get; set; }

    private static int StaticIdentity(int value) => value;

    private ref int RefReturningMethod() => ref _array[0];

    private static async IAsyncEnumerable<int> AsyncSequence()
    {
        await Task.Yield();
        yield return 1;
    }
}

public struct PlainStructForLocals
{
    public int FieldInStruct;
}

public class ClassWithPropertiesForLocals
{
    public int First { get; set; }

    public string Second { get; set; } = "";

    public NestedClassForInitializer Nested { get; } = new();
}

public class NestedClassForInitializer
{
    public int First { get; set; }
}

public class ClassWithDeconstruct
{
    public void Deconstruct(out int first, out string second)
    {
        first = 1;
        second = "";
    }
}

public sealed class DisposableForLocals : IDisposable
{
    public void Dispose() { }
}

public sealed class AsyncDisposableForLocals : IAsyncDisposable
{
    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}

[CollectionBuilder(typeof(ImmutableArrayLike), nameof(Create))]
public sealed class ImmutableArrayLike : IEnumerable<int>
{
    private readonly int[] _items;

    private ImmutableArrayLike(int[] items) => _items = items;

    public static ImmutableArrayLike Create(ReadOnlySpan<int> items) => new(items.ToArray());

    public IEnumerator<int> GetEnumerator() => ((IEnumerable<int>)_items).GetEnumerator();

    System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
}
