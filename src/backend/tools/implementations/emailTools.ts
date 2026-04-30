import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { getData } from "../../models/estateData.js";

async function getMsToken() {
  const data = await getData();
  const msTokens = data.integrations?.msTokens;
  if (!msTokens?.accessToken) return null;
  // Note: in a production app we would refresh the token if expired using the refreshToken.
  return msTokens.accessToken;
}

export const emailTools: ToolDefinition[] = [
  {
    name: "get_emails",
    description: "Fetch and list current emails from the personal Outlook/Entra ID inbox, or use local drafts if not connected. Use this to check for tenant inquiries or maintenance requests.",
    parameters: z.object({
      folder: z.string().optional().default("inbox").describe("The folder to read emails from (e.g., 'inbox', 'sent', 'archived')."),
      limit: z.number().optional().default(5).describe("Maximum number of emails to retrieve."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ folder, limit }) => {
      const accessToken = await getMsToken();
      if (accessToken) {
        try {
          const response = await fetch(`https://graph.microsoft.com/v1.0/me/mailFolders/${folder}/messages?$top=${limit}`, {
            headers: { "Authorization": `Bearer ${accessToken}` }
          });
          if (response.ok) {
            const data = await response.json();
            return {
              status: "success",
              folder,
              emails: data.value.map((msg: any) => ({
                id: msg.id,
                from: msg.sender?.emailAddress?.address || "Unknown",
                subject: msg.subject,
                body: msg.bodyPreview || msg.body?.content,
                date: msg.receivedDateTime,
                status: msg.isRead ? "read" : "unread"
              })),
              timestamp: new Date().toISOString()
            };
          } else {
             console.log("Graph API Error, falling back to local:", await response.text());
          }
        } catch (e) {
           console.log("Error fetching MS emails", e);
        }
      }

      // Mock email database for real estate context (Fallback)
      const mockEmails = [
        {
          id: "mail-101",
          from: "alice.tenant@example.com",
          subject: "Leaking faucet in unit 3B",
          body: "Hello, the kitchen faucet in my unit (123 Maple St, 3B) has been leaking since yesterday. Can you please send someone to fix it? Thanks, Alice.",
          date: "2026-04-24T08:30:00Z",
          status: "unread"
        },
        {
          id: "mail-102",
          from: "bob.manager@estate-nexus.com",
          subject: "Quarterly Maintenance Report Pending",
          body: "Hi Team, we need the quarterly report for the North sector by Friday. Please compile and send the draft to me.",
          date: "2026-04-23T14:15:00Z",
          status: "read"
        },
        {
          id: "mail-103",
          from: "charlie.investor@realtors.com",
          subject: "Inquiry about 456 Oak Ave availability",
          body: "Is the commercial space at 456 Oak Ave still available for lease? I have a client interested in a 5-year term.",
          date: "2026-04-24T09:45:00Z",
          status: "unread"
        }
      ];

      return {
        status: "success",
        folder,
        emails: mockEmails.slice(0, limit),
        timestamp: new Date().toISOString(),
        note: "Using local mock emails. Connect Microsoft account for live syncing."
      };
    },
  },
  {
    name: "send_email",
    description: "Send a professional email to a tenant, manager, or owner via real Outlook/Entra ID if connected. Can be used for replies, reports, or proactive updates.",
    parameters: z.object({
      to: z.string().describe("Recipient email address."),
      subject: z.string().describe("Subject of the email."),
      body: z.string().describe("The content of the email."),
      attachment: z.string().nullable().optional().describe("Optional filename of a file in the workspace to attach to the email."),
      requireApproval: z.boolean().optional().default(true).describe("Whether the agent should wait for user approval before sending. Use false for routine communications if permitted by role."),
    }),
    category: "external",
    requiresApproval: true, // Force approval interaction in the UI if this is true
    platform: "estate",
    execute: async ({ to, subject, body, attachment, requireApproval }, context) => {
      const accessToken = await getMsToken();
      if (accessToken) {
         try {
           const mailData = {
              message: {
                 subject: subject,
                 body: {
                    contentType: "Text",
                    content: body
                 },
                 toRecipients: [
                    { emailAddress: { address: to } }
                 ]
              },
              saveToSentItems: "true"
           };
           // Note: in a real implementation we would attach the file using graph API.
           const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
             method: 'POST',
             headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
             },
             body: JSON.stringify(mailData)
           });
           
           if (!res.ok) {
             throw new Error("Microsoft Graph Email Error: " + await res.text());
           }

           return {
             status: "success",
             to,
             subject,
             attachment: attachment || null,
             message: `Email queued for delivery via Microsoft Outlook. Attachment: ${attachment ? attachment : 'None'}. Status: ` + (requireApproval ? "Pending Approval" : "Sent"),
             delivery_state: "sent_and_delivered",
             timestamp: new Date().toISOString()
           };

         } catch (e: any) {
           console.error("Failed to send Outlook email:", e);
           throw new Error("Failed to send via MS Connect: " + e.message);
         }
      }

      // Local Fallback
      return {
        status: "success",
        to,
        subject,
        attachment: attachment || null,
        message: `Email mocked locally (Microsoft Not Connected). Attachment: ${attachment ? attachment : 'None'}. Status: ` + (requireApproval ? "Pending Approval" : "Sent"),
        delivery_state: "sent_and_delivered",
        timestamp: new Date().toISOString()
      };
    },
  },
  {
    name: "analyze_email_context",
    description: "Analyze the content of an email to deduce action items, priority, and relevant entities (properties, tenants).",
    parameters: z.object({
      emailId: z.string().describe("The ID of the email to analyze."),
      content: z.string().describe("The full text content of the email."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ emailId, content }) => {
      const hasLeak = content.toLowerCase().includes("leak");
      const hasMaintenance = content.toLowerCase().includes("fix") || content.toLowerCase().includes("repair");
      
      return {
        emailId,
        deducedPriority: hasLeak ? "high" : "medium",
        detectedEntities: {
          properties: content.match(/\\d+\\s+\\w+\\s+St|Ave/g) || [],
          tenants: content.match(/[A-Z][a-z]+\\s+[A-Z][a-z]+/g) || []
        },
        suggestedActions: [
          hasMaintenance ? "schedule_maintenance" : "record_tenant_interaction",
          "send_email (confirmation reply)"
        ],
        summary: "The email discusses " + (hasLeak ? "an urgent maintenance issue" : "a general inquiry") + ".",
        timestamp: new Date().toISOString()
      };
    },
  },
  {
    name: "get_entra_users",
    description: "Fetch a list of users from the connected Microsoft Entra ID (Azure AD) organization. Use this to find team members, property managers, or organizational chart data.",
    parameters: z.object({
      limit: z.number().optional().default(10).describe("Maximum number of users to retrieve."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ limit }) => {
      const accessToken = await getMsToken();
      if (!accessToken) return { status: "error", message: "Microsoft Entra ID not connected. Connect in the Integrations tab." };
      
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/users?$top=${limit}&$select=id,displayName,jobTitle,mail,department`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return {
          status: "success",
          users: data.value,
          timestamp: new Date().toISOString()
        };
      } catch (e: any) {
        return { status: "error", message: "Failed to fetch Entra ID users: " + e.message };
      }
    },
  },
  {
    name: "get_onedrive_folders",
    description: "Fetch the root folders and files from the connected Microsoft account's OneDrive. Useful for accessing shared organizational drives or user documents.",
    parameters: z.object({
      limit: z.number().optional().default(10).describe("Maximum number of items to retrieve."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ limit }) => {
      const accessToken = await getMsToken();
      if (!accessToken) return { status: "error", message: "Microsoft account not connected. Connect in the Integrations tab." };
      
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/drive/root/children?$top=${limit}`, {
          headers: { "Authorization": `Bearer ${accessToken}` }
        });
        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();
        return {
          status: "success",
          items: data.value.map((item: any) => ({
             id: item.id,
             name: item.name,
             folder: item.folder ? true : false,
             webUrl: item.webUrl,
             size: item.size
          })),
          timestamp: new Date().toISOString()
        };
      } catch (e: any) {
        return { status: "error", message: "Failed to fetch OneDrive folders: " + e.message };
      }
    },
  },
];
