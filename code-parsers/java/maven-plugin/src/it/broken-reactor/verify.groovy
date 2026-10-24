import groovy.json.JsonSlurper

// broken does not compile but is parsed, with the compiler's errors in its model; ok, after it in the reactor, is
// parsed too.
def json = new JsonSlurper()
def manifest = json.parse(new File(basedir, 'target/noesis/code-model/java/manifest.json'))
assert manifest.artifacts*.id == ['A:broken', 'A:ok'] : "broken and ok expected, got ${manifest.artifacts*.id}"

def broken = json.parse(new File(basedir, 'target/noesis/code-model/java/broken.code-model.json'))
def ids = broken.nodes*.id
assert ids.contains('T:com.example.broken.Fine') : ids
assert ids.contains('M:com.example.broken.Broken#name()') : ids
assert broken.diagnostics.any { it.source == 'compiler' && it.severity == 'error' } : broken.diagnostics
assert !broken.diagnostics.any { it.code == 'NS1001' } : broken.diagnostics

def ok = json.parse(new File(basedir, 'target/noesis/code-model/java/ok.code-model.json'))
assert ok.nodes*.id.contains('T:com.example.ok.Ok')
return true
