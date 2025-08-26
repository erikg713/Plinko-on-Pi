/**
 * backend/models/User.js
 *
 * Improved, production-ready User mongoose model.
 * - Adds timestamps
 * - Sanitizes and validates fields
 * - Adds useful instance & static helpers
 * - Adds virtuals and a cleaner toJSON transform
 *
 * Notes:
 * - Totals are stored as Numbers but are rounded to 2 decimal places on write (typical for currency-like values).
 * - For high-concurrency updates of totals consider using atomic $inc operations / transactions and storing amounts as integer cents.
 */

const mongoose = require('mongoose');

const { Schema } = mongoose;

/**
 * Round to two decimals (helper).
 * Keeps values consistent when written through Mongoose setters.
 * @param {number} value
 * @returns {number}
 */
function round2(value) {
  if (value == null || Number.isNaN(Number(value))) return 0;
  return Math.round(Number(value) * 100) / 100;
}

const userSchema = new Schema(
  {
    // Pi user id (unique identifier from Raspberry Pi / external provider)
    pi_uid: {
      type: String,
      required: [true, 'pi_uid is required'],
      unique: true,
      trim: true,
      index: { unique: true, name: 'uid_unique_idx' }
    },

    // Display username for the user
    username: {
      type: String,
      required: [true, 'username is required'],
      trim: true,
      maxlength: [32, 'username must be at most 32 characters'],
      minlength: [1, 'username must not be empty']
    },

    // KYC flag
    kyc: {
      type: Boolean,
      default: false
    },

    // Totals — keep defaults and sane validation (non-negative).
    totalWagered: {
      type: Number,
      default: 0,
      min: [0, 'totalWagered cannot be negative'],
      set: round2
    },
    totalWinnings: {
      type: Number,
      default: 0,
      min: [0, 'totalWinnings cannot be negative'],
      set: round2
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
    minimize: false
  }
);

/**
 * Virtual: netProfit = totalWinnings - totalWagered
 */
userSchema.virtual('netProfit').get(function () {
  // Use Number(...) in case fields are undefined
  return round2(Number(this.totalWinnings || 0) - Number(this.totalWagered || 0));
});

/**
 * toJSON/toObject transform: remove internal fields and canonicalize id
 */
function cleanOutput(doc, ret) {
  // replace _id with id
  if (ret._id) {
    ret.id = String(ret._id);
  }
  delete ret._id;
  delete ret.__v;
  return ret;
}
userSchema.options.toJSON.transform = cleanOutput;
userSchema.options.toObject.transform = cleanOutput;

/**
 * Pre-save hook: sanitize username (trim + collapse whitespace) and enforce length.
 */
userSchema.pre('save', function (next) {
  if (typeof this.username === 'string') {
    // collapse multiple whitespace to single space and trim
    this.username = this.username.replace(/\s+/g, ' ').trim();

    // Optional: enforce a maximum again (defensive)
    if (this.username.length > 32) {
      this.username = this.username.slice(0, 32);
    }
  }

  // Ensure totals are rounded via setter
  if (this.isModified('totalWagered')) this.totalWagered = round2(this.totalWagered);
  if (this.isModified('totalWinnings')) this.totalWinnings = round2(this.totalWinnings);

  next();
});

/**
 * Instance method: addWager(amount)
 * - Validates amount
 * - Updates totalWagered and saves the document
 * - Returns the updated document (this)
 */
userSchema.methods.addWager = async function (amount) {
  const num = Number(amount);
  if (!isFinite(num) || num <= 0) {
    throw new Error('addWager: amount must be a positive number');
  }

  this.totalWagered = round2((this.totalWagered || 0) + num);
  await this.save();
  return this;
};

/**
 * Instance method: addWinnings(amount)
 * - Validates amount
 * - Updates totalWinnings and saves the document
 * - Returns the updated document (this)
 */
userSchema.methods.addWinnings = async function (amount) {
  const num = Number(amount);
  if (!isFinite(num) || num <= 0) {
    throw new Error('addWinnings: amount must be a positive number');
  }

  this.totalWinnings = round2((this.totalWinnings || 0) + num);
  await this.save();
  return this;
};

/**
 * Static: findOrCreateByPiUid(pi_uid, attrs = {})
 * - Returns existing user or creates one using attrs merged with pi_uid.
 * - Uses an atomic findOneAndUpdate upsert to avoid races.
 */
userSchema.statics.findOrCreateByPiUid = async function (pi_uid, attrs = {}) {
  if (!pi_uid) throw new Error('pi_uid is required');
  const defaults = Object.assign({}, attrs, { pi_uid });
  const updated = await this.findOneAndUpdate(
    { pi_uid },
    { $setOnInsert: defaults },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
      runValidators: true
    }
  ).exec();
  return updated;
};

/**
 * Static: safeIncrementTotals(userId, { wager = 0, winnings = 0 })
 * - Performs an atomic $inc for concurrency safety.
 * - Note: $inc bypasses Mongoose setters (rounding). After increment we round stored values.
 * - Consider storing integer cents for perfect accuracy under heavy concurrency.
 */
userSchema.statics.safeIncrementTotals = async function (userId, { wager = 0, winnings = 0 } = {}) {
  const inc = {};
  if (wager) inc.totalWagered = Number(wager);
  if (winnings) inc.totalWinnings = Number(winnings);

  if (!Object.keys(inc).length) {
    throw new Error('safeIncrementTotals: nothing to increment');
  }

  // Atomic increment
  const updated = await this.findByIdAndUpdate(userId, { $inc: inc }, { new: true }).exec();

  if (!updated) return null;

  // Round totals after increment to keep values consistent
  // (Two-step because $inc bypasses setters)
  const rounded = {
    totalWagered: round2(updated.totalWagered || 0),
    totalWinnings: round2(updated.totalWinnings || 0)
  };

  await this.findByIdAndUpdate(userId, { $set: rounded }, { new: true }).exec();

  return this.findById(userId).exec();
};

module.exports = mongoose.model('User', userSchema);
