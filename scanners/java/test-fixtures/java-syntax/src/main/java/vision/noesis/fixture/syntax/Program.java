package vision.noesis.fixture.syntax;

import java.util.concurrent.CompletableFuture;
import vision.noesis.fixture.syntax.invocations.InvocationForms;
import vision.noesis.fixture.syntax.localvariables.LocalVariableForms;
import vision.noesis.fixture.syntax.types.ClassKinds;

/** The entry point: runs the invocation and local-variable forms, joins a future, then exits. */
public final class Program {

    private Program() {
    }

    public static void main(String[] args) throws Exception {
        System.out.println(new ClassKinds.PlainClass().toString() + args.length);
        InvocationForms invocationForms = new InvocationForms();
        invocationForms.allInvocationForms();
        LocalVariableForms localVariableForms = new LocalVariableForms();
        localVariableForms.allLocalVariableForms();
        localVariableForms.asyncLocalVariableForms();
        CompletableFuture.supplyAsync(() -> localFunctionInTopLevelStatements(1)).join();
        System.exit(0);
    }

    private static int localFunctionInTopLevelStatements(int value) {
        return value;
    }
}
