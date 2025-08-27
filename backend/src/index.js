const mongoose = require("mongoose");
const app = require("./app");
const { PORT, DATABASE_URL } = require("./config");

// Connect to the database
mongoose.connect(DATABASE_URL)
  .then(() => {
    console.log("✅ MongoDB connected successfully!");
    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Backend running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });

