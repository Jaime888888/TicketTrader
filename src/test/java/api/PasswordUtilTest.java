package api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class PasswordUtilTest {
    @Test
    void hashesAreSaltedAndPasswordsCanBeVerified() {
        String first = PasswordUtil.hash("correct horse battery staple");
        String second = PasswordUtil.hash("correct horse battery staple");

        assertNotEquals(first, second);
        assertTrue(PasswordUtil.verify("correct horse battery staple", first));
        assertFalse(PasswordUtil.verify("wrong password", first));
    }

    @Test
    void malformedHashesAreRejected() {
        assertFalse(PasswordUtil.verify("password", "not-a-password-hash"));
        assertFalse(PasswordUtil.verify(null, null));
    }
}
