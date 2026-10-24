# Broken C# fixtures

A project that does not compile: `MissingReference.cs` uses a type that no
reference declares and the project references an assembly that does not
exist; `SyntaxError.cs` has a syntax error next to an intact member. The
parser must still write a model for it, with the compiler diagnostics,
and exit with 0.

It is deliberately not part of any solution file; the parser's tests
point at this directory and let discovery find the project.
