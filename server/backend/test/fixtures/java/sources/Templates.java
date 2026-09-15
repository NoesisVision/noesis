package com.acme;

// public class Commented {}
/* public class BlockCommented { public void nope() {} } */
public class Templates {
    private static final String OPEN = "{";
    private static final char CLOSE = '}';
    private static final String SNIPPET = """
        public class InText {
            public void nope() {}
        }
        """;
    public String render() { return OPEN + "\"}" + CLOSE; }
}
