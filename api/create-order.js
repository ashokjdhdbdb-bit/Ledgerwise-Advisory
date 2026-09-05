// /api/create-order.js
// Vercel serverless function — creates a Razorpay order for a chosen service.
// Requires env vars RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (set in Vercel project settings).

const Razorpay = require('razorpay');

// Prices live on the server ONLY — amounts are in paise (₹1 = 100 paise).
// This is what stops someone from editing the page and paying ₹1 for a ₹1,000 service.
const SERVICE_PRICES = {
  gst_return_monthly: 100000,  // ₹1,000 — GST Return (Monthly)
  gst_return_yearly: 1000000,  // ₹10,000 — GST Return (Yearly)
  itr_filing: 100000,          // ₹1,000 — ITR Filing
  dsc_registration: 250000,    // ₹2,500 — DSC Registration
  bookkeeping: 500000,         // ₹5,000 — Bookkeeping (per month)
  balance_sheet: 1000000,      // ₹10,000 — Balance Sheet Preparation
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
