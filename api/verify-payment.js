// /api/verify-payment.js
// Vercel serverless function — verifies the HMAC signature Razorpay returns after a
// successful payment. Never trust the client's "it worked" — always verify server-side.

const crypto = require('crypto');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ success: false, error: 'Missing payment details' });
  }

  const body = `${razorpay_order_id}|${razorpay_payment_id}`;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest('hex');

  const isValid = expectedSignature === razorpay_signature;

  if (!isValid) {
    return res.status(400).json({ success: false, error: 'Signature verification failed' });
  }

  // Payment is genuinely confirmed at this point.
  // TODO (optional, recommended):
  //   1. Log the order/payment id somewhere (a Google Sheet, Airtable, or a small DB)
  //      so you have a record even if the browser closes before showing the receipt.
  //   2. Send yourself + the client a confirmation email (e.g. via Resend, SendGrid,
  //      or by POSTing to the same Web3Forms endpoint already used for the contact form).

  return res.status(200).json({ success: true });
};