// Top-level statements: the compiler generates the entry point class and method.
using CSharpSyntax.Invocations;
using CSharpSyntax.LocalVariables;

Console.WriteLine("C# syntax fixture");

var invocationForms = new InvocationForms();
invocationForms.AllInvocationForms();

var localVariableForms = new LocalVariableForms();
localVariableForms.AllLocalVariableForms();
await localVariableForms.AsyncLocalVariableFormsAsync();

return 0;

// A static local function declared after top-level statements.
static int LocalFunctionInTopLevelStatements(int value) => value;
