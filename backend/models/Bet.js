const mongoose = require("mongoose");
const { Schema } = mongoose;

const betSchema = new Schema(
  {
    user: { type: String, required: true }, // pi_uid or user id
    betAmount: { type: Number, required: true, min: 0 },
    multiplier: { type: Number, required: true, min: 0 },
    winnings: { type: Number, default: 0 },
    txid: { type: String, required: true },
    paymentId: { type: String, required: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Bet", betSchema);
