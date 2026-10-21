import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import db from "../config/db.js";

const saltRounds = Number(process.env.SALT_ROUNDS) || 12;

const accessSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

const validRoles = ["customer", "restaurant", "delivery","admin"];
const adminUsername=process.env.ADMIN_USERNAME;
const adminPasswordHash=process.env.ADMIN_PASSWORD_HASH;
function isValidRole(role) {
    return validRoles.includes(role);
}

function tokenHash(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

function createAccessToken(id, role) {
    return jwt.sign(
        { id, role },
        accessSecret,
        { expiresIn: "15m" }
    );
}

function createRefreshToken(id, role) {
    return jwt.sign(
        { id, role, jti: crypto.randomUUID() },
        refreshSecret,
        { expiresIn: "1d" }
    );
}


// ---------------- CREATE ACCOUNT ----------------

export function CreateAccountController(req, res) {

    const { username, password, role } = req.body || {};

    if (!isValidRole(role)) {
        return res.status(422).json({
            message: "Invalid role!"
        });
    }

    if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string" ||
        password.length < 8
    ) {
        return res.status(422).json({
            message: "Valid username and password of at least 8 characters are required!"
        });
    }
    if (username === process.env.ADMIN_USERNAME) {
        return res.status(409).json({
            message: "Username unavailable!"
        });
    }
    const name = username.trim();

    db.query(
        "SELECT id FROM ?? WHERE name = ?",
        [role, name],
        (err1, users) => {

            if (err1) {
                console.error(err1);

                return res.status(500).json({
                    message: "Could not create account!"
                });
            }

            if (users.length > 0) {
                return res.status(409).json({
                    message: "User already exists!"
                });
            }

            bcrypt.hash(password, saltRounds, (err2, passwordHash) => {

                if (err2) {
                    console.error(err2);

                    return res.status(500).json({
                        message: "Could not hash password!"
                    });
                }

                db.query(
                    "INSERT INTO ?? (name, passwordhash,createdon) VALUES (?, ?,NOW())",
                    [role, name, passwordHash],
                    (err3) => {

                        if (err3) {
                            console.error(err3);

                            if (err3.code === "ER_DUP_ENTRY") {
                                return res.status(409).json({
                                    message: "User already exists!"
                                });
                            }

                            return res.status(500).json({
                                message: "Could not create account!"
                            });
                        }

                        return res.status(201).json({
                            message: "Account successfully created!"
                        });
                    }
                );
            });
        }
    );
}


// ---------------- LOGIN ----------------


export function LoginController(req, res) {

    const { username, password, role } = req.body || {};

    if (!isValidRole(role)) {
        return res.status(422).json({
            message: "Invalid role!"
        });
    }

    if (
        typeof username !== "string" ||
        !username.trim() ||
        typeof password !== "string"
    ) {
        return res.status(422).json({
            message: "Username and password are required!"
        });
    }

    // Store the token hash and its actual JWT expiration.
    function saveRefreshToken(refreshToken, callback) {
        const decoded = jwt.decode(refreshToken);

        if (!decoded || typeof decoded.exp !== "number") {
            return callback(new Error("Invalid refresh token expiry"));
        }

        db.query(
            `INSERT INTO refreshtokens
             (refreshtokenhash, expiresat)
             VALUES (?, FROM_UNIXTIME(?))`,
            [tokenHash(refreshToken), decoded.exp],
            callback
        );
    }

    if (username.trim() === adminUsername) {

        if (role !== "admin") {
            return res.status(401).json({
                message: "Invalid username or password!"
            });
        }

        return bcrypt.compare(password, adminPasswordHash, (err, same) => {

            if (err) {
                console.error(err);
                return res.status(500).json({
                    message: "Could not login!"
                });
            }

            if (!same) {
                return res.status(401).json({
                    message: "Invalid username or password!"
                });
            }

            const accessToken = createAccessToken(0, "admin");
            const refreshToken = createRefreshToken(0, "admin");

            saveRefreshToken(refreshToken, (err3) => {

                if (err3) {
                    console.error(err3);
                    return res.status(500).json({
                        message: "Could not complete login!"
                    });
                }

                return res.status(200).json({
                    message: "Successfully logged in!",
                    accessToken,
                    refreshToken,
                    role: "admin"
                });
            });
        });
    }

    db.query(
        "SELECT * FROM ?? WHERE name = ?",
        [role, username.trim()],
        (err1, users) => {

            if (err1) {
                console.error(err1);
                return res.status(500).json({
                    message: "Could not login!"
                });
            }

            if (users.length === 0) {
                return res.status(401).json({
                    message: "Invalid username or password!"
                });
            }

            const user = users[0];

            if (user.isactive !== undefined && !Boolean(user.isactive)) {
                return res.status(403).json({
                    message: "Account is deactivated!"
                });
            }

            bcrypt.compare(
                password,
                user.passwordhash,
                (err2, isMatch) => {

                    if (err2) {
                        console.error(err2);
                        return res.status(500).json({
                            message: "Could not verify password!"
                        });
                    }

                    if (!isMatch) {
                        return res.status(401).json({
                            message: "Invalid username or password!"
                        });
                    }

                    const accessToken = createAccessToken(user.id, role);
                    const refreshToken = createRefreshToken(user.id, role);

                    saveRefreshToken(refreshToken, (err3) => {

                        if (err3) {
                            console.error(err3);
                            return res.status(500).json({
                                message: "Could not complete login!"
                            });
                        }

                        return res.status(200).json({
                            message: "Successfully logged in!",
                            accessToken,
                            refreshToken,
                            role
                        });
                    });
                }
            );
        }
    );
}


// ---------------- REFRESH TOKEN ----------------

export function RefreshTokenController(req, res) {

    const refreshToken = req.headers.authorization.refreshToken.split(" ")[1];

    if (typeof refreshToken !== "string" || !refreshToken) {
        return res.status(401).json({
            message: "Refresh token is required!"
        });
    }

    jwt.verify(refreshToken, refreshSecret, (err, decoded) => {

        if (err || !decoded || !isValidRole(decoded.role)) {
            return res.status(403).json({
                message: "Invalid or expired refresh token!"
            });
        }

        db.query(
            "SELECT * FROM refreshtokens WHERE refreshtokenhash = ?",
            [tokenHash(refreshToken)],
            (err1, tokens) => {

                if (err1) {
                    console.error(err1);

                    return res.status(500).json({
                        message: "Could not verify refresh token!"
                    });
                }

                if (tokens.length === 0) {
                    return res.status(403).json({
                        message: "Refresh token has been revoked!"
                    });
                }

                db.query(
                    "SELECT id, isactive FROM ?? WHERE id = ?",
                    [decoded.role, decoded.id],
                    (err2, users) => {

                        if (err2) {
                            console.error(err2);

                            return res.status(500).json({
                                message: "Could not verify account!"
                            });
                        }

                        if (
                            users.length === 0 ||
                            !Boolean(users[0].isactive)
                        ) {
                            return res.status(403).json({
                                message: "Account is unavailable!"
                            });
                        }

                        const accessToken = createAccessToken(
                            decoded.id,
                            decoded.role
                        );

                        return res.status(200).json({
                            message: "Access token refreshed!",
                            accessToken
                        });
                    }
                );
            }
        );
    });
}


// ---------------- LOGOUT ----------------

export function LogoutController(req, res) {
    const {refreshToken} = req.body;
    if (typeof refreshToken !== "string" || !refreshToken) {
        return res.status(400).json({
            message: "Refresh token is required!"
        });
    }
    db.query(
        "DELETE FROM refreshtokens WHERE refreshtokenhash = ?",
        [tokenHash(refreshToken)],
        (err) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    message: "Could not logout!"
                });
            }

            return res.status(204).send();
        }
    );
}


// ---------------- DELETE ACCOUNT ----------------

export function DeleteAccountController(req, res) {

    // authenticate middleware must populate req.user
    const { id, role } = req.user || {};

    if (!id || !isValidRole(role)) {
        return res.status(401).json({
            message: "Unauthorized!"
        });
    }
    if(role==='admin'){
        return res.status(403).json({
            message: "Cant delete admin account"
        });
    }
    db.query(
        "UPDATE ?? SET isactive = 0 WHERE id = ?",
        [role, id],
        (err, result) => {

            if (err) {
                console.error(err);

                return res.status(500).json({
                    message: "Could not deactivate account!"
                });
            }

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    message: "Account not found!"
                });
            }

            return res.status(200).json({
                message: "Account successfully deactivated!"
            });
        }
    );
}
