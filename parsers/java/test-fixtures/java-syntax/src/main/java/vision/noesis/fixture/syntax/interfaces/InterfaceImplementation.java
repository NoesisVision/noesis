package vision.noesis.fixture.syntax.interfaces;

import java.util.Iterator;
import java.util.List;
import vision.noesis.fixture.other.OtherInterface;
import vision.noesis.fixture.other.OtherPlainInterface;
import vision.noesis.fixture.syntax.generics.GenericTypes;
import vision.noesis.fixture.syntax.inheritance.InterfaceInheritance;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** How classes fill interface slots: implicitly, through a base class, across generic, derived, conflicting, other-module and framework interfaces. */
public final class InterfaceImplementation {

    private InterfaceImplementation() {
    }

    public interface InterfaceWithAllMemberKinds {
        int CONSTANT = 1;

        void method();

        int getOnlyProperty();

        <T> T genericMethod(T value);

        default void defaultMethod() {
            method();
        }

        static void staticMethod() {
        }
    }

    public static class ImplicitImplementation implements InterfaceWithAllMemberKinds {
        @Override
        public void method() {
        }

        @Override
        public int getOnlyProperty() {
            return CONSTANT;
        }

        @Override
        public <T> T genericMethod(T value) {
            return value;
        }
    }

    public static class VirtualImplementation implements InterfaceKinds.PlainInterface {
        @Override
        public void abstractMethod() {
        }
    }

    public static class OverriddenInterfaceImplementation extends VirtualImplementation {
        @Override
        public void abstractMethod() {
        }
    }

    public abstract static class AbstractImplementation implements InterfaceKinds.PlainInterface {
        @Override
        public abstract void abstractMethod();
    }

    public static class ConcreteFromAbstractImplementation extends AbstractImplementation {
        @Override
        public void abstractMethod() {
        }
    }

    public abstract static class AbstractImplementationOmittingMember implements InterfaceKinds.PlainInterface {
    }

    public static class ConcreteFromAbstractImplementationOmittingMember extends AbstractImplementationOmittingMember {
        @Override
        public void abstractMethod() {
        }
    }

    public static class ReImplementationInDerivedClass extends ImplicitImplementation implements InterfaceWithAllMemberKinds {
        @Override
        public void method() {
        }
    }

    public static class MultipleInterfacesImplementation implements InterfaceKinds.PlainInterface, InterfaceInheritance.First, InterfaceInheritance.SecondBaseInterface, InterfaceKinds.GenericInterface<String> {
        private String content;

        @Override
        public void abstractMethod() {
        }

        @Override
        public void first() {
        }

        @Override
        public void secondBaseInterfaceMethod() {
        }

        @Override
        public String get() {
            return content;
        }

        @Override
        public void put(String value) {
            content = value;
        }
    }

    public interface FirstConflictingInterface {
        String conflictingName();
    }

    public interface SecondConflictingInterface {
        String conflictingName();
    }

    public static class ConflictResolvedWithSharedImplementation implements FirstConflictingInterface, SecondConflictingInterface {
        @Override
        public String conflictingName() {
            return "shared";
        }
    }

    public interface FirstDefaultInterface {
        default String conflictingDefault() {
            return "first";
        }
    }

    public interface SecondDefaultInterface {
        default String conflictingDefault() {
            return "second";
        }
    }

    public static class ConflictingDefaultsResolvedByOverride implements FirstDefaultInterface, SecondDefaultInterface {
        @Override
        public String conflictingDefault() {
            return FirstDefaultInterface.super.conflictingDefault() + SecondDefaultInterface.super.conflictingDefault();
        }
    }

    public static class TwoParameterGenericInterfaceImplementation<K, V> implements GenericTypes.GenericInterfaceWithTwoParameters<K, V> {
        @Override
        public V map(K value) {
            return null;
        }
    }

    public static class PartiallyClosedGenericInterfaceImplementation<T> implements GenericTypes.GenericInterfaceWithTwoParameters<String, T> {
        @Override
        public T map(String value) {
            return null;
        }
    }

    public record GenericRecordImplementation<T>(T value) implements InterfaceKinds.GenericInterface<T> {
        @Override
        public T get() {
            return value;
        }

        @Override
        public void put(T value) {
        }
    }

    public interface InterfaceWithGenericMethod {
        <T> T genericMethodInInterface(T value);
    }

    public static class GenericMethodImplementation implements InterfaceWithGenericMethod {
        @Override
        public <T> T genericMethodInInterface(T value) {
            return value;
        }
    }

    public static class ImplementationViaFullyQualifiedInterfaceName implements vision.noesis.fixture.syntax.types.InterfaceKinds.PlainInterface {
        @Override
        public void abstractMethod() {
        }
    }

    public static class OtherProjectInterfaceImplementation implements OtherPlainInterface {
        @Override
        public void plainMethodFromOtherModule() {
        }
    }

    public static class OtherProjectGenericInterfaceImplementation implements OtherInterface<String> {
        private String content;

        @Override
        public String get() {
            return content;
        }

        @Override
        public void put(String value) {
            content = value;
        }
    }

    public static class DerivedInterfaceImplementation implements InterfaceInheritance.ThirdLevelInterface {
        @Override
        public void baseInterfaceMethod() {
        }

        @Override
        public void secondBaseInterfaceMethod() {
        }

        @Override
        public void derivedInterfaceMethod() {
        }

        @Override
        public void thirdLevelMethod() {
        }
    }

    public static class HidingInterfaceMemberImplementation implements InterfaceInheritance.DerivedInterfaceHidingMember {
        @Override
        public void first() {
        }

        @Override
        public void second() {
        }
    }

    public static class NestedTypeImplementation {
        public static class NestedImplementingInterface implements InterfaceKinds.PlainInterface {
            @Override
            public void abstractMethod() {
            }
        }

        private static class PrivateNestedImplementingInterface implements InterfaceKinds.PlainInterface {
            @Override
            public void abstractMethod() {
            }
        }

        public InterfaceKinds.PlainInterface createPrivateNested() {
            return new PrivateNestedImplementingInterface();
        }
    }

    public static class FrameworkInterfacesImplementation implements AutoCloseable, Comparable<FrameworkInterfacesImplementation>, Iterable<Integer> {
        @Override
        public void close() {
        }

        @Override
        public int compareTo(FrameworkInterfacesImplementation other) {
            return 0;
        }

        @Override
        public Iterator<Integer> iterator() {
            return List.of(1).iterator();
        }

        @Override
        public boolean equals(Object obj) {
            return this == obj;
        }

        @Override
        public int hashCode() {
            return 0;
        }
    }

    public static class InterfaceImplementationUsedThroughGenericConstraint {
        public <T extends InterfaceKinds.GenericInterface<String>> String read(T target) {
            return target.get();
        }
    }

    public static class VarianceImplementation {
        public String produce(InterfaceKinds.GenericInterface<? extends String> source) {
            return source.get();
        }

        public void consume(InterfaceKinds.GenericInterface<? super String> target) {
            target.put("");
        }
    }
}
