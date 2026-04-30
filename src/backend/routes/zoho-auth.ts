import { Router } from "express";
import { getData, saveData } from "../models/estateData.js";

const router = Router();

// To be configured by user via AI Studio environment variables
const CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";

const getRedirectUri = (req: any) => {
  if (process.env.APP_URL) {
    // If APP_URL has a trailing slash, remove it or handle cleanly
    const baseUrl = process.env.APP_URL.endsWith('/') ? process.env.APP_URL.slice(0, -1) : process.env.APP_URL;
    return `${baseUrl}/api/auth/zoho/callback`;
  }
  // Fallback for local
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${protocol}://${host}/api/auth/zoho/callback`;
};

router.get("/url", (req, res) => {
  const redirectUri = getRedirectUri(req);
  
  // Scopes required for Zoho Desk.
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    access_type: 'offline', // ensures we get a refresh token
    scope: 'Desk.Tickets.ALL,Desk.Contacts.READ,Desk.Settings.READ,Desk.Basic.READ',
  });

  // Authorize URL for Zoho (accounts.zoho.com, might be accounts.zoho.eu etc based on region)
  const authUrl = `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`;
  res.json({ url: authUrl });
});

router.get("/callback", async (req, res) => {
  const { code, "accounts-server": accountsServer } = req.query; 
  const redirectUri = getRedirectUri(req);

  // Use the accounts-server provided by Zoho, or fallback to US
  const accountsDomain = (accountsServer as string) || "https://accounts.zoho.com";

  try {
    const tokenResponse = await fetch(`${accountsDomain}/oauth/v2/token`, {
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
      console.error("Zoho token error:", err);
      return res.send(`<html><body>Failed to connect to Zoho. ${err}</body></html>`);
    }

    const tokens = await tokenResponse.json();
    const rawApiDomain = tokens.api_domain || 'https://www.zoho.com';
    
    // Normalize apiDomain to desk.zoho.X and strip trailing slashes
    let deskDomain = 'https://desk.zoho.com';
    if (rawApiDomain.includes('.eu')) deskDomain = 'https://desk.zoho.eu';
    else if (rawApiDomain.includes('.in')) deskDomain = 'https://desk.zoho.in';
    else if (rawApiDomain.includes('.com.au')) deskDomain = 'https://desk.zoho.com.au';
    else if (rawApiDomain.includes('.com.cn')) deskDomain = 'https://desk.zoho.com.cn';
    else if (rawApiDomain.includes('.jp')) deskDomain = 'https://desk.zoho.jp';
    
    // Final safety: strip any trailing slash
    deskDomain = deskDomain.endsWith('/') ? deskDomain.slice(0, -1) : deskDomain;

    // Store in DB
    const data = await getData();
    if (!data.integrations) {
      data.integrations = {};
    }
    data.integrations.zohoTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + (tokens.expires_in * 1000),
      apiDomain: deskDomain,
    };
    await saveData(data);

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'ZOHO_AUTH_SUCCESS' }, '*');
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
  const tokens = data.integrations?.zohoTokens;
  if (tokens && tokens.accessToken) {
    res.json({ connected: true });
  } else {
    res.json({ connected: false });
  }
});

router.post("/disconnect", async (req, res) => {
  const data = await getData();
  if (data.integrations && data.integrations.zohoTokens) {
    delete data.integrations.zohoTokens;
    await saveData(data);
  }
  res.json({ success: true });
});

export default router;
