import { GoogleAuth } from 'google-auth-library';

export default async function handler(req, res) {
  // Enhanced CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  try {
    const { sessionId, queryInput, text } = req.body || {};
    
    // Support both queryInput object and simple text
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    if (!queryInput && !text) {
      return res.status(400).json({ error: 'Missing queryInput or text' });
    }

    // Support multiple environment variable names
    const jsonKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON || 
                   process.env.SERVICE_ACCOUNT_JSON;
                   
    if (!jsonKey) {
      return res.status(500).json({ error: 'Missing service account configuration' });
    }

    // Safely parse JSON credentials
    let credentials;
    try {
      credentials = typeof jsonKey === 'string' ? JSON.parse(jsonKey) : jsonKey;
    } catch (e) {
      return res.status(500).json({ error: 'Invalid service account configuration' });
    }

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    const client = await auth.getClient();
    const tokenResponse = await client.getAccessToken();
    const accessToken = tokenResponse?.token || tokenResponse;

    if (!accessToken) {
      return res.status(500).json({ error: 'Failed to obtain access token' });
    }

    const projectId = credentials.project_id;
    const url = `https://dialogflow.googleapis.com/v2/projects/${projectId}/agent/sessions/${encodeURIComponent(sessionId)}:detectIntent`;

    // Support both queryInput object and simple text
    const body = queryInput ? { queryInput } : {
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await dialogflowResponse.json();
    return res.status(dialogflowResponse.status || 200).json(data);

  } catch (err) {
    console.error('Dialogflow proxy error:', err);
    return res.status(500).json({ 
      error: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}
