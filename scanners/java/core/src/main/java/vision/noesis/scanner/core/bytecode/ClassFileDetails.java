package vision.noesis.scanner.core.bytecode;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import org.objectweb.asm.ClassReader;
import org.objectweb.asm.ClassVisitor;
import org.objectweb.asm.FieldVisitor;
import org.objectweb.asm.MethodVisitor;
import org.objectweb.asm.Opcodes;

/** What ArchUnit does not expose and the class files hold: parameter names, the varargs flag, field constant values. */
final class ClassFileDetails {

    /** @param parameterNames null when the class file was compiled without {@code -parameters}. */
    record MethodDetails(List<String> parameterNames, boolean varargs) {}

    private final Map<String, MethodDetails> methods = new HashMap<>();
    private final Map<String, Object> constants = new HashMap<>();
    private boolean parameterNamesMissing;

    static ClassFileDetails read(Path classDirectory) throws IOException {
        ClassFileDetails details = new ClassFileDetails();
        if (!Files.isDirectory(classDirectory)) return details;
        try (Stream<Path> files = Files.walk(classDirectory)) {
            for (Path file : files.filter(path -> path.toString().endsWith(".class")).sorted().toList()) {
                try (InputStream in = Files.newInputStream(file)) {
                    new ClassReader(in).accept(details.visitor(), ClassReader.SKIP_CODE | ClassReader.SKIP_FRAMES);
                }
            }
        }
        return details;
    }

    /** By the binary class name, member name and descriptor, the way ArchUnit names them. */
    MethodDetails method(String className, String name, String descriptor) {
        return methods.get(className + "#" + name + descriptor);
    }

    Object constant(String className, String fieldName) {
        return constants.get(className + "." + fieldName);
    }

    boolean parameterNamesMissing() {
        return parameterNamesMissing;
    }

    private ClassVisitor visitor() {
        return new ClassVisitor(Opcodes.ASM9) {
            private String className;

            @Override
            public void visit(int version, int access, String name, String signature, String superName, String[] interfaces) {
                className = name.replace('/', '.');
            }

            @Override
            public FieldVisitor visitField(int access, String name, String descriptor, String signature, Object value) {
                if (value != null) constants.put(className + "." + name, value);
                return null;
            }

            @Override
            public MethodVisitor visitMethod(int access, String name, String descriptor, String signature, String[] exceptions) {
                boolean varargs = (access & Opcodes.ACC_VARARGS) != 0;
                boolean synthetic = (access & (Opcodes.ACC_SYNTHETIC | Opcodes.ACC_BRIDGE)) != 0;
                int parameterCount = org.objectweb.asm.Type.getArgumentTypes(descriptor).length;
                List<String> names = new ArrayList<>();
                String key = className + "#" + name + descriptor;
                return new MethodVisitor(Opcodes.ASM9) {
                    @Override
                    public void visitParameter(String parameterName, int parameterAccess) {
                        names.add(parameterName);
                    }

                    @Override
                    public void visitEnd() {
                        boolean named = names.size() == parameterCount && parameterCount > 0;
                        if (parameterCount > 0 && !named && !synthetic && !name.equals("<clinit>")) parameterNamesMissing = true;
                        methods.put(key, new MethodDetails(named ? List.copyOf(names) : null, varargs));
                    }
                };
            }
        };
    }
}
