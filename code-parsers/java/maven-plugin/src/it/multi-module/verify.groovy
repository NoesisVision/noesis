import groovy.json.JsonSlurper

def json = new JsonSlurper()
def out = new File(basedir, 'target/noesis/code-model/java')
assert out.isDirectory() : "no output at ${out}"

def manifest = json.parse(new File(out, 'manifest.json'))
assert manifest.schemaVersion == 1
assert manifest.language == 'java'
assert manifest.generator.name == 'noesis-parse-java'
assert manifest.repository.name == 'multi-module'
assert manifest.repository.revision == '0123456789abcdef'
assert manifest.root == 'pom.xml'
// Two modules are named a: their ids say their groups, their files are told apart by ~2; b keeps its short id.
assert manifest.artifacts*.id == ['A:com.example:a', 'A:b', 'A:com.example.extra:a'] : "reactor order expected, got ${manifest.artifacts*.id}"
assert manifest.artifacts*.file == ['code-model/java/a.code-model.json', 'code-model/java/b.code-model.json', 'code-model/java/a~2.code-model.json']
assert manifest.diagnostics == []

def a = json.parse(new File(basedir, 'target/noesis/' + manifest.artifacts[0].file))
assert a.artifact.id == 'A:com.example:a'
assert a.artifact.name == 'a'
assert a.artifact.kind == 'source'
assert a.artifact.rootDirectory == 'a'
assert a.artifact.target == 'jdk-17'
assert !a.artifact.executable : "an unresolved \${start-class} is no main class"
assert a.artifact.languageSpecific['java.mainClass'] == null
assert a.artifact.languageSpecific['java.buildFile'] == 'a/pom.xml'
assert a.artifact.languageSpecific['java.engine'] == 'source'
def guava = a.artifact.dependencies.find { it.id.startsWith('A:com.google.guava:guava@') }
assert guava != null : "guava dependency expected, got ${a.artifact.dependencies*.id}"
assert guava.kind == 'library'
assert guava.package.id == 'com.google.guava:guava'
assert a.artifact.dependencies.any { it.id == 'A:java.base@17' && it.kind == 'platform' }
assert a.nodes.any { it.id == 'T:com.example.a.Greeting' }
assert a.stubs.any { it.id == 'T:com.google.common.base.Strings' && it.artifact == guava.id }
assert a.diagnostics.findAll { it.severity == 'error' } == []

def b = json.parse(new File(basedir, 'target/noesis/' + manifest.artifacts[1].file))
assert b.artifact.executable
assert b.artifact.languageSpecific['java.mainClass'] == 'com.example.b.App'
def onA = b.artifact.dependencies.find { it.id == 'A:com.example:a' }
assert onA != null && onA.kind == 'source' && onA.package == null : "b depends on a as a source artifact, got ${b.artifact.dependencies}"
assert b.nodes.any { it.id == 'M:com.example.b.App#main(java.lang.String[])' }
assert b.edges.any { it.kind == 'INVOKES' && it.to == 'M:com.example.a.Greeting#text()' }
assert !b.stubs.any { it.id.startsWith('T:com.example.a.') } : "a sibling module is never stubbed"
assert b.nodes.find { it.id == 'T:com.example.b.App' }.locations[0].file == 'b/src/main/java/com/example/b/App.java'

def extra = json.parse(new File(basedir, 'target/noesis/' + manifest.artifacts[2].file))
assert extra.artifact.id == 'A:com.example.extra:a'
assert extra.artifact.name == 'a'
def extraOnA = extra.artifact.dependencies.find { it.id == 'A:com.example:a' }
assert extraOnA != null && extraOnA.kind == 'source' : "the extra a depends on com.example:a as a source artifact, got ${extra.artifact.dependencies}"
assert extra.edges.any { it.kind == 'INVOKES' && it.to == 'M:com.example.a.Greeting#text()' }
return true
