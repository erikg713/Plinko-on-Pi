const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  pi_uid: { type: String, unique: true, required: true },
  username: { type: String, required: true },
  kyc: { type: Boolean, default: false },
  totalWagered: { type: Number, default: 0 },
  totalWinnings: { type: Number, default: 0 }
});

module.exports = mongoose.model("User", userSchema);
