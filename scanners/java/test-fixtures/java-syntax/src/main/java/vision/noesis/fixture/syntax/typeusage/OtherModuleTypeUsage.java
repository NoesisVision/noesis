package vision.noesis.fixture.syntax.typeusage;

import java.util.List;
import vision.noesis.fixture.other.OtherUsedType;

/** The same uses of a type declared in the other module; differs from its siblings only in the ids referenced. */
public class OtherModuleTypeUsage {

    public OtherUsedType field = new OtherUsedType();

    public List<OtherUsedType> listField;

    public OtherUsedType[] arrayField;

    public OtherUsedType pass(OtherUsedType parameter) {
        OtherUsedType local = new OtherUsedType(1.0);
        Object erased = local;
        if (erased instanceof OtherUsedType) {
            OtherUsedType cast = (OtherUsedType) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }
}
