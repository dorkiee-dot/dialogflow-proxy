import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  // ✅ Allow CORS (needed for Adalo)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight (OPTIONS) request
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { sessionId, queryInput, text } = req.body || {};
    // Allow either queryInput object or simple text input
    if (!sessionId || (!queryInput && !text)) {
      return res.status(400).json({ error: 'Missing sessionId and either queryInput or text.' });
    }

    const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.SERVICE_ACCOUNT_JSON;
    if (!jsonKey) {
      return res.status(500).json({ error: 'Missing Google service account JSON.' });
    }

    const credentials = typeof jsonKey === 'string' ? JSON.parse(jsonKey) : jsonKey;
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const at = await client.getAccessToken();
    const accessToken = at?.token || at;

    const projectId = credentials.project_id;
    const url = `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${encodeURIComponent(sessionId)}:detectIntent`;

    // Support both direct queryInput object and simple text input
    const body = queryInput || {
      queryInput: {
        text: {
          text: text,
          languageCode: 'en'
        }
      }
    };

    const dialogflowResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await dialogflowResponse.json();
    return res.status(dialogflowResponse.status || 200).json(data);
  } catch (err) {
    console.error('Dialogflow proxy error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
