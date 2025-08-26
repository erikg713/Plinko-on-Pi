const express = require("express");
const User = require("../models/User");
const router = express.Router();

// Get user profile
router.get("/:pi_uid", async (req, res) => {
  try {
    const user = await User.findOne({ pi_uid: req.params.pi_uid });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// Create or update user
router.post("/", async (req, res) => {
  const { pi_uid, username } = req.body;
  try {
    const user = await User.findOrCreateByPiUid(pi_uid, { username });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
