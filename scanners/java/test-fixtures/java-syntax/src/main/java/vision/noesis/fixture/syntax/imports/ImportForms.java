package vision.noesis.fixture.syntax.imports;

import java.io.*;
import java.util.*;
import java.util.List;
import static java.lang.Math.*;
import static java.util.stream.Collectors.toList;
import static java.util.stream.IntStream.range;
import static vision.noesis.fixture.syntax.types.EnumKinds.PlainEnum.FIRST;
import static vision.noesis.fixture.syntax.types.ClassKinds.OuterClassWithNestedTypes.*;
import vision.noesis.fixture.syntax.types.ClassKinds.OuterClassWithNestedTypes.NestedRecord;
import vision.noesis.fixture.syntax.types.EnumKinds.PlainEnum;
import vision.noesis.fixture.syntax.members.MethodDeclarations;
import vision.noesis.fixture.other.OtherClass;
import vision.noesis.fixture.other.OtherConstants;
import vision.noesis.fixture.other.nested.NestedNamespaceInOtherModule;
import com.google.common.annotations.VisibleForTesting;

/** Every import form: on-demand, static, nested types, other module, library, shadowing, and fully qualified names. */
public class ImportForms {

    public static final int VIA_OTHER_MODULE_CONSTANT_EXPRESSION = OtherConstants.CONSTANT * 2;

    public List<Object> useImportedTypes() throws IOException {
        Reader viaOnDemandImport = new StringReader("");
        double viaStaticImport = abs(-1.0) + PI;
        List<Integer> viaStaticImportOfCollector = range(0, 1).boxed().collect(toList());
        PlainEnum viaStaticImportOfEnum = FIRST;
        int viaEnumCaseLabel = switch (viaStaticImportOfEnum) {
            case FIRST -> 1;
            case SECOND -> 2;
        };
        NestedEnum viaStaticImportOfNestedType = NestedEnum.ONE;
        NestedRecord viaNestedTypeImport = new NestedRecord(1);
        List<String> viaSingleTypeImportShadowingOnDemand = new ArrayList<>();
        Iterable nonGenericInterfaceViaOnDemandImport = viaSingleTypeImportShadowingOnDemand;
        Collection rawCollectionViaOnDemandImport = viaSingleTypeImportShadowingOnDemand;
        Types viaSamePackage = new Types();
        MethodDeclarations viaOwnModuleImport = new MethodDeclarations();
        java.nio.charset.Charset viaFullyQualifiedName = java.nio.charset.StandardCharsets.UTF_8;
        java.util.concurrent.ConcurrentHashMap<Integer, Integer> viaFullyQualifiedGenericName = new java.util.concurrent.ConcurrentHashMap<>();
        vision.noesis.fixture.syntax.types.ClassKinds.PlainClass viaFullyQualifiedOwnModuleName = new vision.noesis.fixture.syntax.types.ClassKinds.PlainClass();
        OtherClass viaOtherModuleImport = new OtherClass();
        NestedNamespaceInOtherModule viaOtherModuleNestedPackageImport = new NestedNamespaceInOtherModule();
        OtherClass.Nested viaOtherModuleNestedType = new OtherClass.Nested();
        int viaOtherModuleConstant = OtherConstants.CONSTANT;
        vision.noesis.fixture.other.OtherEnum viaOtherModuleFullyQualifiedName = vision.noesis.fixture.other.OtherEnum.ALPHA;
        viaOnDemandImport.close();
        return List.of(viaOnDemandImport, viaStaticImport, viaStaticImportOfCollector, viaStaticImportOfEnum, viaEnumCaseLabel,
            viaStaticImportOfNestedType, viaNestedTypeImport, viaSingleTypeImportShadowingOnDemand,
            nonGenericInterfaceViaOnDemandImport, rawCollectionViaOnDemandImport, viaSamePackage, viaOwnModuleImport,
            viaFullyQualifiedName, viaFullyQualifiedGenericName, viaFullyQualifiedOwnModuleName, viaOtherModuleImport,
            viaOtherModuleNestedPackageImport, viaOtherModuleNestedType, viaOtherModuleConstant, viaOtherModuleFullyQualifiedName);
    }

    @VisibleForTesting
    public int methodWithLibraryAnnotation() {
        return 1;
    }
}
