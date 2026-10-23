package broken;

import com.missing.Unknown;

public class MissingReference {

    private final Unknown unknown = new Unknown();

    public String uses() {
        return unknown.describe() + works();
    }

    public int works() {
        return 3;
    }
}
