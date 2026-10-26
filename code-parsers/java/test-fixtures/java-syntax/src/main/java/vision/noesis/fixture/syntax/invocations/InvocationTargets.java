package vision.noesis.fixture.syntax.invocations;

import com.google.common.collect.ImmutableList;
import vision.noesis.fixture.other.OtherClass;
import vision.noesis.fixture.other.OtherRecord;
import vision.noesis.fixture.syntax.types.InterfaceKinds;

/** Targets in the own module, the other module, a library and the platform. */
public class InvocationTargets implements InterfaceKinds.PlainInterface {

    @Override
    public void abstractMethod() {
    }

    public void ownModule() {
        defaultMethod();
        InterfaceKinds.PlainInterface.staticMethod();
    }

    public int otherModule() {
        OtherClass created = new OtherClass(2);
        OtherClass fromFactory = OtherClass.create();
        OtherRecord record = new OtherRecord("name", 1);
        return created.value() + fromFactory.value + record.count() + record.name().length();
    }

    public int library() {
        ImmutableList<String> list = ImmutableList.of("a", "b");
        return list.size() + ImmutableList.<Integer>builder().add(1).build().size();
    }

    public long platform() {
        return Math.max(1L, 2L) + String.valueOf(3).length() + System.currentTimeMillis();
    }
}
