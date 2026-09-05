// /api/create-order.js
// Vercel serverless function — creates a Razorpay order for a chosen service.
// Requires env vars RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (set in Vercel project settings).

const Razorpay = require('razorpay');

// Prices live on the server ONLY — amounts are in paise (₹1 = 100 paise).
// This is what stops someone from editing the page and paying ₹1 for a ₹999 service.
const SERVICE_PRICES = {
  itr_filing: 99900,        // ₹999 — Income Tax Return filing
  gst_registration: 149900, // ₹1,499 — GST Registration
  gst_return: 79900,        // ₹799 — GST Return filing (per filing)
  bookkeeping: 299900,      // ₹2,999 — Accounting & Bookkeeping (starting/month)
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { service } = req.body || {};
  const amount = SERVICE_PRICES[service];

  if (!amount) {
    return res.status(400).json({ error: 'Unknown or unpriced service selected' });
  }

  const instance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });

  try {
    const order = await instance.orders.create({
      amount,
      currency: 'INR',
      receipt: `ledgerwise_${service}_${Date.now()}`,
      notes: { service },
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: process.env.RAZORPAY_KEY_ID, // safe to expose — this is the public key id
    });
  } catch (err) {
    console.error('Razorpay order creation failed:', err);
    return res.status(500).json({ error: 'Unable to create order right now' });
  }
};