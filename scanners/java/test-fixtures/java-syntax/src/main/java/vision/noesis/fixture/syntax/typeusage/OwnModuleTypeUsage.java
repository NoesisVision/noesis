package vision.noesis.fixture.syntax.typeusage;

import java.util.List;


/** The same uses of a type declared in this module; differs from its siblings only in the ids referenced. */
public class OwnModuleTypeUsage {

    public UsedType field = new UsedType();

    public List<UsedType> listField;

    public UsedType[] arrayField;

    public UsedType pass(UsedType parameter) {
        UsedType local = new UsedType(1.0);
        Object erased = local;
        if (erased instanceof UsedType) {
            UsedType cast = (UsedType) erased;
            return cast;
        }
        return parameter;
    }

    public double use() {
        return field.get() + pass(field).get();
    }
}
