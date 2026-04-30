import { Router } from "express";
import { getData, saveData } from "../models/estateData.js";

const router = Router();

// To be configured by user via AI Studio environment variables
const CLIENT_ID = process.env.MS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.MS_CLIENT_SECRET || "";

const getRedirectUri = (req: any) => {
  if (process.env.APP_URL) {
    const baseUrl = process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL;
    return `${baseUrl}/api/auth/ms/callback`;
  }
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/auth/ms/callback`;
};

router.get("/url", (req, res) => {
  const redirectUri = getRedirectUri(req);
  
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    response_mode: 'query',
    scope: 'offline_access user.read mail.readwrite mail.send files.readwrite.all directory.read.all',
  });

  // Using common tenant for personal + organizational accounts
  const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`;
  res.json({ url: authUrl });
});

router.get("/callback", async (req, res) => {
  const { code } = req.query;
  const redirectUri = getRedirectUri(req);

  try {
    const tokenResponse = await fetch(`https://login.microsoftonline.com/common/oauth2/v2.0/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code: code as string,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenResponse.ok) {
      const err = await tokenResponse.text();
      console.error("MS token error:", err);
      // Fallback
      return res.send(`<html><body>Failed to connect to Microsoft. ${err}</body></html>`);
    }

    const tokens = await tokenResponse.json();

    // Store in DB
    const data = await getData();
    if (!data.integrations) {
      data.integrations = {};
    }
    data.integrations.msTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
    };
    await saveData(data);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'MS_AUTH_SUCCESS' }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful! You can close this window now.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error("Auth callback error:", err);
    res.status(500).send("Internal Server Error");
  }
});

router.get("/status", async (req, res) => {
  const data = await getData();
  const msTokens = data.integrations?.msTokens;
  if (msTokens && msTokens.accessToken) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

router.post("/disconnect", async (req, res) => {
  const data = await getData();
  if (data.integrations && data.integrations.msTokens) {
    delete data.integrations.msTokens;
    await saveData(data);
  }
  res.json({ success: true });
});

export default router;
