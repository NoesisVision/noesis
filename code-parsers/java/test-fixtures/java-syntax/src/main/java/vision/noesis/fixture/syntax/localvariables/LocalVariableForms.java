package vision.noesis.fixture.syntax.localvariables;

import static java.nio.charset.StandardCharsets.UTF_8;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import vision.noesis.fixture.syntax.types.EnumKinds;

/** Every way a local variable is declared, initialized, assigned or introduced by a statement. */
public class LocalVariableForms {

    private int field = 1;
    private final int[] array = {1, 2, 3};
    private final Object lock = new Object();

    public void allLocalVariableForms() throws Exception {
        int explicitlyTyped = 1;
        var implicitlyTyped = 1;
        int declaredWithoutInitializer;
        declaredWithoutInitializer = 2;
        int firstDeclarator = 1, secondDeclarator = 2, thirdDeclaratorWithoutInitializer;
        thirdDeclaratorWithoutInitializer = 3;
        final int constLocal = 10;
        final String constStringLocal = "constant";
        Integer nullableValue = null;
        String nullableReference = null;
        Object boxed = 1;
        java.lang.Integer viaSystemName = 1;
        java.lang.String viaFullyQualifiedName = "";
        EnumKinds.PlainEnum enumLocal = EnumKinds.PlainEnum.FIRST;
        Class<?> fromTypeof = int.class;
        int fromSizeof = Integer.BYTES;
        int fromChecked = Math.addExact(explicitlyTyped, 1);
        int fromUnchecked = Integer.MAX_VALUE + 1;
        int fromConditional = explicitlyTyped > 0 ? 1 : 2;
        int fromNullCoalescing = Objects.requireNonNullElse(nullableValue, 0);
        String fromThrowExpression = Optional.ofNullable(boxed.toString()).orElseThrow(IllegalStateException::new);
        int fromCast = (int) 3.5;
        boolean fromIs = boxed instanceof Integer;
        int fromIndex = array[array.length - 1];
        int[] fromRange = Arrays.copyOfRange(array, 1, array.length);
        int fromCompoundInterpolation = String.format("%d", explicitlyTyped).length();
        long fromImplicitWideningConversion = explicitlyTyped;
        double fromImplicitNumericConversion = explicitlyTyped;
        Object fromBoxingConversion = explicitlyTyped;
        String fromConcatenation = "a" + "b" + explicitlyTyped;
        boolean fromLogicalExpression = explicitlyTyped > 0 && !boolFromMethod() || explicitlyTyped == 0;
        int fromBitwiseExpression = (explicitlyTyped & 1) | (explicitlyTyped ^ 2) << 1 >> 1 >>> 1 | ~0;

        int decimalLiteral = 1_000;
        int hexLiteral = 0xFF;
        int octalLiteral = 017;
        int binaryLiteral = 0b1010;
        long longLiteral = 1L;
        float floatLiteral = 1.5f;
        double doubleLiteral = 1.5d;
        double exponentLiteral = 1.5e3;
        double hexFloatLiteral = 0x1p3;
        BigDecimal decimalTypeLiteral = new BigDecimal("1.5");
        char charLiteral = 'c';
        char escapedCharLiteral = '\n';
        char unicodeCharLiteral = 'A';
        String stringLiteral = "text";
        String textBlockLiteral = """
            raw "string" literal
            """;
        byte[] utf8Literal = "utf8".getBytes(UTF_8);
        boolean boolLiteral = true;
        Object nullLiteral = null;

        List<Integer> diamondNew = new ArrayList<>();
        List<Integer> diamondNewWithArguments = new ArrayList<>(10);
        var explicitNew = new ArrayList<Integer>();
        var explicitNewWithArguments = new ArrayList<Integer>(10);
        // Double-brace initialization: an anonymous subclass whose instance initializer assigns the fields.
        var objectInitializer = new ClassWithFieldsForLocals() {{ first = 1; second = ""; }};
        var objectInitializerViaSetters = new ClassWithFieldsForLocals();
        objectInitializerViaSetters.setFirst(1);
        objectInitializerViaSetters.getNested().first = 1;
        List<Integer> collectionInitializer = List.of(1, 2, 3);
        Map<String, Integer> dictionaryInitializer = Map.of("a", 1, "b", 2);
        List<Integer> mutableCollectionInitializer = new ArrayList<>(List.of(1, 2, 3));
        List<Integer> collectionWithSpread = Stream.concat(collectionInitializer.stream(), Arrays.stream(array).boxed())
            .collect(Collectors.toList());
        ImmutableArrayLike customIterable = ImmutableArrayLike.of(1, 2);
        int[] implicitlyTypedArray = new int[]{1, 2, 3};
        int[] arrayWithSize = new int[3];
        int[] arrayWithInitializerOnly = {1, 2, 3};
        int[][] multiDimensionalArray = {{1, 2}, {3, 4}};
        int[][] multiDimensionalArrayWithSize = new int[2][2];
        int[][] jaggedArray = {{1}, {2, 3}};
        int[][] jaggedArrayExplicit = new int[2][];
        var anonymousObject = new Object() { int count = 1; };
        int anonymousObjectMember = anonymousObject.count;
        Function<Integer, Integer> lambdaLocal = value -> value;
        Function<Integer, Integer> methodGroupLocal = LocalVariableForms::staticIdentity;
        Runnable actionLocal = () -> { };

        if (boxed instanceof Integer patternVariable) {
            fromIndex = patternVariable;
        }
        if (!(boxed instanceof String notPatternVariable)) {
            fromIs = false;
        } else {
            fromIs = notPatternVariable.isEmpty();
        }
        Object fieldsHolder = objectInitializerViaSetters;
        if (fieldsHolder instanceof ClassWithFieldsForLocals propertyPatternVariable && propertyPatternVariable.first == 1) {
            fromIndex = propertyPatternVariable.first;
        }
        String switchStatementResult;
        switch (explicitlyTyped) {
            case 0:
            case 1:
                switchStatementResult = "small";
                break;
            default:
                switchStatementResult = "other";
                break;
        }
        switch (constStringLocal) {
            case "constant" -> switchStatementResult = "constant";
            default -> switchStatementResult = constStringLocal;
        }
        String switchExpressionResult = switch (explicitlyTyped) {
            case 0, 1 -> "small";
            case 2 -> {
                String yielded = "two";
                yield yielded;
            }
            default -> "other";
        };
        int switchExpressionOnEnum = switch (enumLocal) {
            case FIRST -> 1;
            case SECOND -> 2;
        };

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
        int assignedFromAssignment = explicitlyTyped = 3;

        try (var tryWithResourcesVar = new DisposableForLocals()) {
        }
        try (DisposableForLocals tryWithResourcesExplicit = new DisposableForLocals();
             var secondResource = new DisposableForLocals()) {
        }
        DisposableForLocals existingResource = new DisposableForLocals();
        try (existingResource) {
        }
        try (var resourceWithCatch = new DisposableForLocals()) {
        } catch (Exception resourceException) {
        } finally {
            field++;
        }
        for (var foreachVar : array) {
        }
        for (int foreachExplicit : array) {
        }
        for (final int foreachFinal : array) {
        }
        for (Map.Entry<String, Integer> foreachEntry : dictionaryInitializer.entrySet()) {
        }
        for (Integer foreachCustomIterable : customIterable) {
        }
        for (int forCounter = 0; forCounter < 1; forCounter++) {
        }
        for (int forFirst = 0, forSecond = 1; forFirst < forSecond; forFirst++, forSecond--) {
        }
        for (var forVar = 0; forVar < 1; ++forVar) {
        }
        for (;;) {
            break;
        }
        int whileCounter = 0;
        while (whileCounter < 1) {
            whileCounter++;
        }
        do {
            whileCounter--;
        } while (whileCounter > 0);
        try {
            throw new IllegalStateException();
        } catch (IllegalStateException catchVariable) {
            if (catchVariable.getMessage() == null) {
                field--;
            }
        } catch (IllegalArgumentException | UnsupportedOperationException multiCatchVariable) {
        } catch (Exception exceptionVariable) {
        } finally {
        }
        try {
            field++;
        } catch (Throwable throwableVariable) {
        }
        synchronized (lock) {
            int declaredInsideLock = 1;
        }
        synchronized (array) {
        }
        {
            int declaredInNestedBlock = 1;
        }
        Map<Integer, List<Integer>> query = Arrays.stream(array).boxed()
            .map(queryRangeVariable -> queryRangeVariable * 2)
            .filter(queryLetVariable -> queryLetVariable > 0)
            .sorted(Comparator.reverseOrder())
            .collect(Collectors.groupingBy(queryGroupKey -> queryGroupKey % 2));
        int declaredAfterLabel;
        outer:
        for (int labeledCounter = 0; labeledCounter < 2; labeledCounter++) {
            for (int innerCounter = 0; innerCounter < 2; innerCounter++) {
                if (innerCounter == 0) {
                    continue outer;
                }
                break outer;
            }
        }
        declaredAfterLabel = 1;
        block:
        {
            if (declaredAfterLabel == 1) {
                break block;
            }
        }

        int capturedLocal = implicitlyTyped;
        Runnable lambdaCapturingLocal = () -> System.out.println(capturedLocal);
        class LocalClassCapturingLocal {
            int read() {
                return capturedLocal;
            }
        }
        int fromLocalClass = new LocalClassCapturingLocal().read();
        Function<Integer, Integer> varParameterLambda = (var varLambdaParameter) -> varLambdaParameter;
        lambdaCapturingLocal.run();
        actionLocal.run();
        System.out.println(lambdaLocal.apply(1) + methodGroupLocal.apply(2) + varParameterLambda.apply(3) + fromLocalClass);
    }

    public CompletableFuture<Integer> asyncLocalVariableForms() throws Exception {
        int awaited = CompletableFuture.completedFuture(1).join();
        var awaitedVar = CompletableFuture.completedFuture(1).join();
        int awaitedWithGet = CompletableFuture.completedFuture(1).get();
        CompletableFuture<Integer> unawaitedTask = CompletableFuture.completedFuture(1);
        int awaitedLater = unawaitedTask.join();
        return CompletableFuture.supplyAsync(() -> awaited + awaitedVar + awaitedWithGet + awaitedLater);
    }

    private static int staticIdentity(int value) {
        return value;
    }

    private static boolean boolFromMethod() {
        return false;
    }
}

/** Fields to assign from a local initializer, with a nested holder for a nested initializer. */
class ClassWithFieldsForLocals {

    int first;
    String second = "";
    private final NestedClassForInitializer nested = new NestedClassForInitializer();

    void setFirst(int value) {
        first = value;
    }

    NestedClassForInitializer getNested() {
        return nested;
    }
}

/** The nested target of a nested initializer. */
class NestedClassForInitializer {

    int first;
}

/** An AutoCloseable to declare as a try-with-resources resource. */
final class DisposableForLocals implements AutoCloseable {

    @Override
    public void close() {
    }
}

/** An own Iterable to drive a for-each loop. */
final class ImmutableArrayLike implements Iterable<Integer> {

    private final int[] items;

    private ImmutableArrayLike(int[] items) {
        this.items = items;
    }

    static ImmutableArrayLike of(int... items) {
        return new ImmutableArrayLike(items);
    }

    @Override
    public Iterator<Integer> iterator() {
        return Arrays.stream(items).iterator();
    }
}
