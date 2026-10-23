package vision.noesis.fixture.syntax.imports.nested;

import vision.noesis.fixture.syntax.imports.ImportForms;

/** A subpackage does not see its parent package: the parent's types need an import or a qualified name. */
public class ImportsFromParentPackage {

    public ImportForms viaParentPackageImport = new ImportForms();

    public vision.noesis.fixture.syntax.imports.Types viaParentPackageQualifiedName = new vision.noesis.fixture.syntax.imports.Types();
}
