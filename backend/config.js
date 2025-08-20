require("dotenv").config();

module.exports = {
  PORT: process.env.PORT || 5000,
  PI_API_KEY: process.env.PI_API_KEY,  // From Pi Developer Portal
  PI_API_URL: "https://api.minepi.com/v2"
};
