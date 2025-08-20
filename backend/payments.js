const axios = require("axios");
const { PI_API_KEY, PI_API_URL } = require("./config");

const api = axios.create({
  baseURL: PI_API_URL,
  headers: { Authorization: `Key ${PI_API_KEY}` }
});

// Verify payment with Pi API
async function verifyPayment(paymentId) {
  try {
    const res = await api.get(`/payments/${paymentId}`);
    return res.data;
  } catch (err) {
    console.error("Payment verification failed:", err);
    throw err;
  }
}

// Complete a payment (approve & release funds)
async function completePayment(paymentId, txid) {
  try {
    const res = await api.post(`/payments/${paymentId}/complete`, {
      txid
    });
    return res.data;
  } catch (err) {
    console.error("Payment completion failed:", err);
    throw err;
  }
}

module.exports = { verifyPayment, completePayment };
