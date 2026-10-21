import jwt from 'jsonwebtoken';
const accessSecret=process.env.ACCESS_TOKEN_SECRET;
export default function authenticate(roles){
    return function auth(req, res, next) {
        const accessToken = req.headers.authorization.split(" ")[1];
        if (!accessToken) {
            return res.status(401).json({ message: "Access token missing" });
        }
        jwt.verify(accessToken, accessSecret, (err, decoded) => {
            if (err) {
                return res.status(403).json({ message: "Invalid or expired token" });
            }
            const userRole = decoded.role; 
            if (roles && !roles.includes(userRole)) {
                return res.status(403).json({ message: "Unauthorized access: insufficient permissions" });
            }
            req.user = decoded;
            next();
        });
    };
};