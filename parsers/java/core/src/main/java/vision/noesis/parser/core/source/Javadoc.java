package vision.noesis.parser.core.source;

import com.sun.source.doctree.DocCommentTree;
import com.sun.source.doctree.DocTree;
import com.sun.source.doctree.EntityTree;
import com.sun.source.doctree.LinkTree;
import com.sun.source.doctree.LiteralTree;
import com.sun.source.doctree.TextTree;
import com.sun.source.util.TreePath;
import java.util.List;

/** The doc comment's body as plain text: inline tags unwrapped, HTML tags dropped, whitespace collapsed; null when there is none. */
final class Javadoc {

    private Javadoc() {}

    static String of(SourceContext context, TreePath path) {
        if (path == null) return null;
        DocCommentTree comment = context.javac.docTrees().getDocCommentTree(path);
        if (comment == null) return null;
        StringBuilder text = new StringBuilder();
        render(comment.getFullBody(), text);
        String collapsed = text.toString().replaceAll("\\s+", " ").trim();
        return collapsed.isEmpty() ? null : collapsed;
    }

    private static void render(List<? extends DocTree> trees, StringBuilder out) {
        for (DocTree tree : trees) {
            switch (tree.getKind()) {
                case TEXT:
                    out.append(((TextTree) tree).getBody());
                    break;
                case CODE:
                case LITERAL:
                    out.append(((LiteralTree) tree).getBody().getBody());
                    break;
                case LINK:
                case LINK_PLAIN:
                    LinkTree link = (LinkTree) tree;
                    if (link.getLabel().isEmpty()) out.append(link.getReference().getSignature());
                    else render(link.getLabel(), out);
                    break;
                case ENTITY:
                    out.append(entity(((EntityTree) tree).getName().toString()));
                    break;
                case START_ELEMENT:
                case END_ELEMENT:
                    out.append(' ');
                    break;
                default:
                    out.append(tree);
            }
        }
    }

    private static String entity(String name) {
        switch (name) {
            case "lt": return "<";
            case "gt": return ">";
            case "amp": return "&";
            case "quot": return "\"";
            case "apos": return "'";
            case "nbsp": return " ";
            default: return "&" + name + ";";
        }
    }
}
