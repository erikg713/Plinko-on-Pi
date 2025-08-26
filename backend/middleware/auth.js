const { ADMIN_SECRET } = require("../config");

function adminAuth(req, res, next) {
  const key = req.headers["x-admin-secret"];
  if (!key || key !== ADMIN_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }
  next();
}

module.exports = { adminAuth };
