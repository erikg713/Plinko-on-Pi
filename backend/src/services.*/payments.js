// backend/payments.js
const axios = require("axios");
const { PI_API_KEY, PI_API_URL } = require("./config");

// Ensure required config is set
if (!PI_API_KEY || !PI_API_URL) {
  throw new Error("❌ Missing Pi API configuration (check .env)");
}

// Create Pi API client
const api = axios.create({
  baseURL: PI_API_URL,
  headers: { Authorization: `Key ${PI_API_KEY}` },
  timeout: 10000 // 10s timeout to avoid hanging requests
});

// ✅ Verify payment with Pi API
async function verifyPayment(paymentId) {
  try {
    const res = await api.get(`/payments/${paymentId}`);
    return res.data;
  } catch (err) {
    console.error("❌ Payment verification failed:", err.response?.data || err.message);
    return null; // Return null so caller can handle gracefully
  }
}

// ✅ Complete a payment (approve & release funds)
async function completePayment(paymentId, txid) {
  try {
    const res = await api.post(`/payments/${paymentId}/complete`, { txid });
    return res.data;
  } catch (err) {
    console.error("❌ Payment completion failed:", err.response?.data || err.message);
    return null;
  }
}

module.exports = { verifyPayment, completePayment };
