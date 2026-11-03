# Java projection fixture

A small annotated Maven build the Java parser's unit tests project onto the
system model (`test/unit/java-parser.spec.ts`). Every type and member
is there to show one rule of `docs/plans/code-model-to-system-model.md` in
Java: the nested `Order.Repository`, the `@Event` record, record components
as properties (R5.7) beside a public field, `OrderLine`'s private `product`
behind its fluent getter (R5.8), the `Map` field no word in the
model has, the overloaded `addLine`, `@QueryHandler` marking a behavior,
the chain `handle → logTotal → total`, the `internal` package
`.noesis/settings.json` drops, the unannotated `SqlOrderRepository` whose calls
count for the interface's behaviors, and in the tests the Cucumber step
definitions `OrderSteps` with the feature file
`shop-domain/src/test/resources/features/placing-orders.feature` whose `When`
steps bind to them (the parser reads the test sources too). `Order`'s
`currency`, behind its getter, is a `javax.money.CurrencyUnit` of the money
API (`javax.money:money-api`), a dependency no scan parses: the library
manifest `.noesis/libraries/money-api.json` lists it, so the stub resolves to
a block of the model (R14). `@Layer("domain")` on
`com.acme.shop`'s `package-info.java` puts every block below it in the domain
layer; the infrastructure package's `@Layer("infrastructure")` holds no block,
so the model drops it (R15). `PlaceOrderHandler.handle` carries `@Actor`
twice, which Java writes as one `@Actor.Actors` container, and takes the
`@TechnicalService` `Clock` in its constructor, a collaborator (R5.9).

`code-model/` is the Java parser's output over these sources and is
committed, so the server's tests need no JDK. Regenerate it after changing
the sources (from this directory, with the plugin installed once by
`mvn -q install -DskipTests` in `code-parsers/java`):

```sh
rm -rf code-model
mvn -B -q -ntp -Dnoesis.out=. -Dnoesis.repository=shop -Dnoesis.revision=fixture \
  process-test-classes noesis:parse
```
