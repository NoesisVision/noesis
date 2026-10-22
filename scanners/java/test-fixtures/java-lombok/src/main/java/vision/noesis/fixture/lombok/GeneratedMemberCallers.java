package vision.noesis.fixture.lombok;

import java.util.List;
import java.util.stream.Collectors;
import vision.noesis.fixture.lombok.GeneratedMembers.GetterSetter;
import vision.noesis.fixture.lombok.GeneratedMembers.Built;
import vision.noesis.fixture.lombok.GeneratedMembers.Compared;
import vision.noesis.fixture.lombok.GeneratedMembers.Constructed;
import vision.noesis.fixture.lombok.GeneratedMembers.DataHolder;
import vision.noesis.fixture.lombok.GeneratedMembers.Delegating;
import vision.noesis.fixture.lombok.GeneratedMembers.FluentAccessors;
import vision.noesis.fixture.lombok.GeneratedMembers.Plain;
import vision.noesis.fixture.lombok.GeneratedMembers.ValueHolder;
import vision.noesis.fixture.lombok.GeneratedMembers.Withers;

/** Calls to every generated member: unbound sites for the source engine, calls for the bytecode engine, and the hybrid engine's reason to exist. */
public class GeneratedMemberCallers {

    private final GetterSetter accessors = new GetterSetter();

    /** A static field built by a generated builder: bytecode runs it in the static initializer, the source engine's field holds it. */
    private static final Built DEFAULT = Built.builder().name("default").count(0).build();

    /** An instance field initialized through a generated getter: bytecode runs it in every constructor. */
    private final int initialCount = new GetterSetter().getCount();

    /** A field of a type only the processor declares: the source engine cannot resolve it. */
    private Built.BuiltBuilder pending = Built.builder();

    /** A getter, a setter, and a call chained after a getter: the chained call is unbound too in the source engine. */
    public int accessorCalls() {
        accessors.setName("name");
        accessors.setCount(1);
        return accessors.getName().length() + accessors.getCount();
    }

    /** The constructor {@code @Data} generates, the accessors, {@code equals}, {@code hashCode}, {@code toString}. */
    public String dataCalls() {
        DataHolder holder = new DataHolder("name");
        holder.setCount(2);
        boolean same = holder.equals(new DataHolder("name"));
        return holder.toString() + holder.hashCode() + same + holder.getName() + holder.getCount();
    }

    /** The all-arguments constructor and a getter of a {@code @Value} class. */
    public String valueCalls() {
        ValueHolder value = new ValueHolder("name", 3);
        return value.getName() + value.getCount();
    }

    /** The builder chain: a static factory, a method per field, {@code build()}, and {@code toBuilder()} on the result. */
    public Built builderCalls() {
        Built built = Built.builder().name("name").count(4).build();
        return built.toBuilder().count(5).build();
    }

    /** The three generated constructors. */
    public int constructorCalls() {
        Constructed none = new Constructed();
        Constructed required = new Constructed("name");
        Constructed all = new Constructed("name", 6);
        return none.getCount() + required.getCount() + all.getCount();
    }

    /** A generated constructor called on a continued line: javac attributes the call to the statement's line, the diagnostic to its own. */
    public Constructed multiLineConstructorCall() {
        Constructed constructed =
                new Constructed(
                        "name", 12);
        return constructed;
    }

    /** A wither returning a copy, chained. */
    public Withers witherCalls() {
        return new Withers("name", 7).withName("other").withCount(8);
    }

    /** Fluent accessors chained through {@code this} returns. */
    public String fluentCalls() {
        FluentAccessors fluent = new FluentAccessors().name("name").count(9);
        return fluent.name() + fluent.count();
    }

    /** Generated {@code equals}, {@code hashCode}, {@code toString} with exclusions. */
    public boolean comparedCalls() {
        Compared first = new Compared("name", 10);
        Compared second = new Compared("name", 11);
        return first.equals(second) && first.hashCode() == second.hashCode() && first.toString().equals(second.toString());
    }

    /** Delegated interface members called on the delegating class. */
    public int delegateCalls() {
        Delegating delegating = new Delegating(List.of("a", "b"));
        delegating.add("c");
        return delegating.size() + delegating.get(0).length();
    }

    /** A generated getter as a method reference inside a stream pipeline: a site inside a closure. */
    public List<String> closureCalls(List<GetterSetter> all) {
        return all.stream().map(GetterSetter::getName).filter(name -> !name.isEmpty()).collect(Collectors.toList());
    }

    /** A primitive class literal on a line the source engine cannot bind: bytecode reads {@code Integer.TYPE}, a field only bytecode stubs. */
    public Class<?> primitiveClassOnAnUnboundLine() {
        return accessors.getName() == null ? int.class : String.class;
    }

    /** Calls chained after a generated getter, one per line: bytecode puts each on its own line, the source engine all on the first. */
    public long multiLineChain() {
        return accessors.getName()
                .chars()
                .filter(Character::isLetter)
                .count();
    }

    /** A parameter of a type only the processor declares: the source engine's id for the method cannot name it. */
    public String describeBuilder(Built.BuiltBuilder builder) {
        return builder.build().getName();
    }

    /** A call to that method. */
    public String callDescribeBuilder() {
        return describeBuilder(pending);
    }

    /** A written member on a class without Lombok: bound by every engine. */
    public String plainCalls() {
        Plain plain = new Plain();
        plain.setName("name");
        return plain.getName();
    }
}
