import groovy.json.JsonSlurper

// Eight independent modules parsed in parallel: the manifest the last one writes lists all of them, in reactor
// order, every file it names is complete, and no temporary file is left behind.
def json = new JsonSlurper()
def out = new File(basedir, 'target/noesis/code-model/java')
def manifest = json.parse(new File(out, 'manifest.json'))
def modules = (1..8).collect { "m${it}" }
assert manifest.artifacts*.id == modules.collect { "A:${it}" } : "every module in reactor order expected, got ${manifest.artifacts*.id}"
assert manifest.artifacts*.file == modules.collect { "code-model/java/${it}.code-model.json" }
manifest.artifacts.each { artifact ->
    def model = json.parse(new File(basedir, 'target/noesis/' + artifact.file))
    assert model.artifact.id == artifact.id
}
assert out.list().findAll { it.endsWith('.tmp') } == [] : "temporary files left in ${out}"
return true
