import db from "../config/db.js";
function cleanupExpiredTokens() {
    db.query(
        "DELETE FROM refreshtokens WHERE expiresat <= CURRENT_TIMESTAMP()",
        (err, result) => {
            if (err) {
                console.error("Refresh token cleanup error:", err);
                return;
            }

            console.log(
                `Refresh token cleanup: ${result.affectedRows} expired tokens deleted.`
            );
        }
    );
}

export function startTokenCleanup() {
    // Clean expired tokens immediately on startup
    cleanupExpiredTokens();

    // Clean expired tokens every hour
    const interval = setInterval(
        cleanupExpiredTokens,
        60 * 60 * 1000
    );

    return interval;
}
