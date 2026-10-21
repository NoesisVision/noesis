package vision.noesis.fixture.syntax.typeusage;

import java.util.List;
import com.google.common.util.concurrent.AtomicDouble;

/** The same uses of a type declared in a library; differs from its siblings only in the ids referenced. */
public class LibraryTypeUsage {

    public AtomicDouble field = new AtomicDouble();

    public List<AtomicDouble> listField;

    public AtomicDouble[] arrayField;

    public AtomicDouble pass(AtomicDouble parameter) {
        AtomicDouble local = new AtomicDouble(1.0);
        Object erased = local;
        if (erased instanceof AtomicDouble) {
            AtomicDouble cast = (AtomicDouble) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }
}
