package vision.noesis.fixture.syntax.imports.dotted.deeply.nested;

import java.util.*;
import java.util.List;
import vision.noesis.fixture.syntax.imports.Types;
import vision.noesis.fixture.syntax.types.ClassKinds;

/** A class in a deeply dotted package, using a type named like a package segment. */
public class ClassInDeeplyNestedPackage {

    public ClassKinds.PlainClass viaPackageNamedLikeType = new ClassKinds.PlainClass();

    public Types viaConflictingTypeName = new Types();

    public Iterable nonGenericInterfaceViaOnDemandImport = new ArrayList();

    public Collection nonGenericCollectionViaOnDemandImport = new ArrayList();

    public List<Integer> genericInterfaceViaSingleTypeImport = new ArrayList<>();
}
