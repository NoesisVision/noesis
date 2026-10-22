# Java projection fixture

A small annotated Maven build the Java scanner's unit tests project onto the
system model (`test/unit/java-maven-scanner.spec.ts`). Every type and member
is there to show one rule of `docs/plans/code-model-to-system-model.md` in
Java: the nested `Order.Repository`, the `@Event` record, record components
as properties (R5.7) beside a public field, `OrderLine`'s private `product`
behind its fluent getter (R5.8), the `Map` field no word in the
model has, the overloaded `addLine`, `@QueryHandler` fixing a type (R9.4),
the chain `handle → logTotal → total`, the `internal` package
`noesis-config.json` drops, the unannotated `SqlOrderRepository` whose calls
count for the interface's behaviours.

`code-model/` is the Java scanner's output over these sources and is
committed, so the server's tests need no JDK. Regenerate it after changing
the sources (from this directory, with the plugin installed once by
`mvn -q install -DskipTests` in `scanners/java`):

```sh
rm -rf code-model
mvn -B -q -ntp -Dnoesis.out=. -Dnoesis.repository=shop -Dnoesis.revision=fixture \
  process-classes vision.noesis:noesis-scanner-maven-plugin:0.1.0-SNAPSHOT:scan
```
