// /api/verify-payment.js
// Vercel serverless function — verifies the HMAC signature Razorpay returns after a
// successful payment, then emails the business owner a confirmation. Never trust the
// client's "it worked" — always verify server-side first.

const Razorpay = require('razorpay');
const crypto = require('crypto');

// Same public Web3Forms access key already used by the contact form on the site.
// Fine to hardcode — this key can only be used to submit forms to your inbox, nothing more.
const WEB3FORMS_ACCESS_KEY = '580e42ee-3003-4c68-ba85-881617f5faaa';

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

  // Payment is genuinely confirmed at this point. Pull the order back from Razorpay to
  // get the customer details we stashed in `notes` at create-order time, then email
  // ourselves a confirmation. If this step fails, we still tell the customer the
  // payment succeeded — a missed notification shouldn't undo a real payment.
  try {
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });

    const order = await instance.orders.fetch(razorpay_order_id);
    const notes = order.notes || {};
    const amountRupees = (order.amount / 100).toLocaleString('en-IN');

    await fetch('https://api.web3forms.com/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: `Payment received — ${notes.service || 'Ledgerwise Advisory'}`,
        from_name: 'Ledgerwise Advisory Website',
        name: notes.customer_name || 'Unknown',
        phone: notes.customer_phone || 'Unknown',
        email: notes.customer_email || 'not provided',
        service: notes.service || 'Unknown',
        amount: `₹${amountRupees}`,
        razorpay_order_id,
        razorpay_payment_id,
      }),
    });
  } catch (notifyErr) {
    console.error('Payment confirmed, but owner notification failed:', notifyErr);
  }

  return res.status(200).json({ success: true });
};
