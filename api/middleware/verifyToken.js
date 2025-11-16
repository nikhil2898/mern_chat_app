import jwt from "jsonwebtoken";

export function verifyToken(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: "No token provided" });

    const secret = process.env.JWT_SECRET || process.env.jwt_salt;
    const decoded = jwt.verify(token, secret);

    req.userId = decoded.userId || decoded.id || decoded._id;
    if (!req.userId)
      return res.status(401).json({ error: "Invalid token payload" });

    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
