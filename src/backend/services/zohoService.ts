import { getData, saveData } from "../models/estateData.js";

export async function getZohoTokens() {
  const data = await getData();
  const tokens = data.integrations?.zohoTokens;
  if (!tokens?.accessToken) {
    throw new Error("Zoho Desk is not connected. Please connect in the Admin Dashboard Integrations tab first.");
  }

  // Check if token is expired or will expire in 2 minutes
  if (tokens.refreshToken && (tokens.expiresAt < Date.now() + 120000)) {
    console.log("[ZohoService] Access token expired, refreshing...");
    try {
      const CLIENT_ID = process.env.ZOHO_CLIENT_ID || "";
      const CLIENT_SECRET = process.env.ZOHO_CLIENT_SECRET || "";
      
      // Determine regional accounts domain
      let accountsDomain = "https://accounts.zoho.com";
      if (tokens.apiDomain?.includes(".eu")) accountsDomain = "https://accounts.zoho.eu";
      else if (tokens.apiDomain?.includes(".in")) accountsDomain = "https://accounts.zoho.in";
      else if (tokens.apiDomain?.includes(".com.au")) accountsDomain = "https://accounts.zoho.com.au";
      else if (tokens.apiDomain?.includes(".com.cn")) accountsDomain = "https://accounts.zoho.cn";
      else if (tokens.apiDomain?.includes(".jp")) accountsDomain = "https://accounts.zoho.jp";

      const res = await fetch(`${accountsDomain}/oauth/v2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          refresh_token: tokens.refreshToken,
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          grant_type: "refresh_token",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[ZohoService] Refresh error:", err);
        throw new Error("Failed to refresh Zoho token: " + err);
      }

      const fresh = await res.json();
      
      const rawApiDomain = fresh.api_domain || tokens.apiDomain || 'https://desk.zoho.com';
      let deskDomain = rawApiDomain.endsWith('/') ? rawApiDomain.slice(0, -1) : rawApiDomain;
      
      // Ensure it's a desk domain
      if (!deskDomain.includes('desk.')) {
        if (deskDomain.includes('zoho.eu')) deskDomain = 'https://desk.zoho.eu';
        else if (deskDomain.includes('zoho.in')) deskDomain = 'https://desk.zoho.in';
        else if (deskDomain.includes('zoho.com.au')) deskDomain = 'https://desk.zoho.com.au';
        else if (deskDomain.includes('zoho.com.cn')) deskDomain = 'https://desk.zoho.com.cn';
        else if (deskDomain.includes('zoho.jp')) deskDomain = 'https://desk.zoho.jp';
        else deskDomain = 'https://desk.zoho.com';
      }

      const updatedTokens = {
        ...tokens,
        accessToken: fresh.access_token,
        apiDomain: deskDomain,
        expiresAt: Date.now() + (fresh.expires_in * 1000)
      };

      // Try to fetch orgId and default departmentId if missing
      if (!updatedTokens.orgId || !updatedTokens.departmentId) {
        try {
          const orgRes = await fetch(`${updatedTokens.apiDomain.replace(/\/+$/, "")}/api/v1/organizations`, {
            headers: { "Authorization": `Zoho-oauthtoken ${updatedTokens.accessToken}` }
          });
          if (orgRes.ok) {
            const orgData = await orgRes.json();
            const orgs = orgData.organizations || orgData.data || (Array.isArray(orgData) ? orgData : null);
            if (orgs && orgs[0]?.id) {
              updatedTokens.orgId = orgs[0].id.toString();
              console.log("[ZohoService] Autodiscovered OrgId:", updatedTokens.orgId);
              
              // Now fetch departments for this org
              const deptRes = await fetch(`${updatedTokens.apiDomain.replace(/\/+$/, "")}/api/v1/departments`, {
                headers: { 
                  "Authorization": `Zoho-oauthtoken ${updatedTokens.accessToken}`,
                  "orgId": updatedTokens.orgId
                }
              });
              if (deptRes.ok) {
                const deptData = await deptRes.json();
                const depts = deptData.data || (Array.isArray(deptData) ? deptData : null);
                if (depts && depts.length > 0) {
                  // Preference for nexus-estate if it exists
                  const nexusDept = depts.find((d: any) => d.name?.toLowerCase().includes("nexus-estate"));
                  updatedTokens.departmentId = (nexusDept || depts[0]).id.toString();
                  console.log("[ZohoService] Autodiscovered DepartmentId:", updatedTokens.departmentId);
                }
              } else {
                console.warn("[ZohoService] Departments fetch failed:", await deptRes.text());
              }
            } else {
               console.warn("[ZohoService] Organizations fetched but no ID found in:", JSON.stringify(orgData));
            }
          } else {
            console.warn("[ZohoService] Organizations fetch failed:", await orgRes.text());
          }
        } catch (e) {
          console.warn("[ZohoService] Failed to autodiscover Org/Dept", e);
        }
      }

      // Save updated tokens
      data.integrations.zohoTokens = updatedTokens;
      await saveData(data);
      
      return updatedTokens;
    } catch (e) {
      console.error("[ZohoService] Error during refresh:", e);
      throw e;
    }
  }

  // Also try to fetch orgId if missing even if not refreshing
  if (!tokens.orgId && !process.env.ZOHO_ORG_ID) {
    try {
      const orgRes = await fetch(`${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/organizations`, {
        headers: { "Authorization": `Zoho-oauthtoken ${tokens.accessToken}` }
      });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const orgs = orgData.organizations || orgData.data || (Array.isArray(orgData) ? orgData : null);
        if (orgs && orgs[0]?.id) {
          tokens.orgId = orgs[0].id;
          data.integrations.zohoTokens.orgId = tokens.orgId;
          await saveData(data);
          console.log("[ZohoService] Autodiscovered OrgId during status check:", tokens.orgId);
        }
      }
    } catch (e) {
       // silently fail
    }
  }

  // Sanitize and provide fallback for apiDomain before returning
  if (!tokens.apiDomain) {
    tokens.apiDomain = 'https://desk.zoho.com';
  } else if (tokens.apiDomain.endsWith('/')) {
    tokens.apiDomain = tokens.apiDomain.slice(0, -1);
  }

  // Ensure it's a desk domain (fallback for legacy tokens)
  if (!tokens.apiDomain.includes('desk.')) {
      if (tokens.apiDomain.includes('zoho.eu')) tokens.apiDomain = 'https://desk.zoho.eu';
      else if (tokens.apiDomain.includes('zoho.in')) tokens.apiDomain = 'https://desk.zoho.in';
      else if (tokens.apiDomain.includes('zoho.com.au')) tokens.apiDomain = 'https://desk.zoho.com.au';
      else if (tokens.apiDomain.includes('zoho.com.cn')) tokens.apiDomain = 'https://desk.zoho.com.cn';
      else if (tokens.apiDomain.includes('zoho.jp')) tokens.apiDomain = 'https://desk.zoho.jp';
      else tokens.apiDomain = 'https://desk.zoho.com';
  }

  return tokens;
}
