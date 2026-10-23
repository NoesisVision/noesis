package vision.noesis.scanner.core.java;

import java.util.Locale;

/** Constants as Java source would spell them, from their values rather than their text, so both engines agree. */
public final class Literals {

    private Literals() {}

    public static String format(Object value) {
        if (value == null) return "null";
        if (value instanceof String text) return quote(text, '"');
        if (value instanceof Character character) return quote(character.toString(), '\'');
        if (value instanceof Boolean flag) return flag.toString();
        if (value instanceof Long number) return number + "L";
        if (value instanceof Float number) return floatText(number) + "f";
        if (value instanceof Double number) return floatText(number);
        if (value instanceof Number number) return number.toString();
        return value.toString();
    }

    private static String floatText(Number number) {
        double value = number.doubleValue();
        if (Double.isNaN(value)) return "0.0/0.0";
        if (Double.isInfinite(value)) return value > 0 ? "1.0/0.0" : "-1.0/0.0";
        return number instanceof Float f ? Float.toString(f) : Double.toString(value);
    }

    private static String quote(String text, char quote) {
        StringBuilder out = new StringBuilder(text.length() + 2).append(quote);
        for (int i = 0; i < text.length(); i++) {
            char c = text.charAt(i);
            switch (c) {
                case '\b': out.append("\\b"); break;
                case '\t': out.append("\\t"); break;
                case '\n': out.append("\\n"); break;
                case '\f': out.append("\\f"); break;
                case '\r': out.append("\\r"); break;
                case '\\': out.append("\\\\"); break;
                default:
                    if (c == quote) out.append('\\').append(c);
                    else if (c < 0x20 || c == 0x7f) out.append(String.format(Locale.ROOT, "\\u%04x", (int) c));
                    else out.append(c);
            }
        }
        return out.append(quote).toString();
    }
}
