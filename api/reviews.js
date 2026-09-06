// /api/reviews.js
// Vercel serverless function — GET returns the latest reviews, POST adds a new one.
// Backed by Supabase so every visitor sees the same list (unlike localStorage).
// Requires env vars SUPABASE_URL and SUPABASE_SERVICE_KEY (set in Vercel project settings).
// Use the SERVICE ROLE key here, not the anon key — this function is the only thing
// allowed to write to the table, since RLS has no public policies.

const { createClient } = require('@supabase/supabase-js');

// Build the client lazily, inside the handler, wrapped in try/catch — so a missing
// or malformed env var returns a clear JSON error instead of crashing the whole
// function before it can respond (which is what produces an HTML error page).
function getSupabaseClient() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_KEY is not set in this deployment');
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

module.exports = async (req, res) => {
  let supabase;

  try {
    supabase = getSupabaseClient();
  } catch (configErr) {
    console.error('Reviews API misconfigured:', configErr.message);
    return res.status(500).json({ error: 'Reviews are not configured on the server yet' });
  }

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select('name, service, rating, message, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return res.status(200).json({ reviews: data });
    } catch (err) {
      console.error('Fetching reviews failed:', err);
      return res.status(500).json({ error: 'Could not load reviews' });
    }
  }

  if (req.method === 'POST') {
    const { name, service, rating, message } = req.body || {};
    const ratingNum = Number(rating);

    if (!name || !message || !ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: 'Name, a 1-5 rating and a message are required' });
    }

    try {
      const { error } = await supabase.from('reviews').insert([{
        name: String(name).slice(0, 80),
        service: String(service || '').slice(0, 60),
        rating: ratingNum,
        message: String(message).slice(0, 600),
      }]);

      if (error) throw error;

      return res.status(200).json({ success: true });
    } catch (err) {
      console.error('Saving review failed:', err);
      return res.status(500).json({ error: 'Could not save review' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
