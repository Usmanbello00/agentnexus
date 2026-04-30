import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { getZohoTokens } from "../../services/zohoService.js";

export const zohoTools: ToolDefinition[] = [
  {
    name: "get_zoho_tickets",
    description: "Fetch recent ticketing requests (support tickets or maintenance requests) from Zoho Desk.",
    parameters: z.object({
      limit: z.number().optional().default(5).describe("Maximum number of tickets to retrieve."),
      status: z.string().optional().describe("Filter by status, e.g., 'Open', 'Closed'."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ limit, status }, context) => {
      try {
        const tokens = await getZohoTokens();
        const effectiveOrgId = tokens.orgId || process.env.ZOHO_ORG_ID || "";
        
        const params = new URLSearchParams({ limit: String(limit) });
        if (status) {
           params.set("status", status);
        }
        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets?${params.toString()}`;
        
        const headers: any = {
          "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`
        };
        if (effectiveOrgId) {
           headers["orgId"] = effectiveOrgId;
        }

        const res = await fetch(url, { headers });
        if (!res.ok) {
           const errText = await res.text();
           console.error(`[Zoho GetTickets] Error ${res.status}:`, errText, "URL:", url, "OrgId:", effectiveOrgId);
           throw new Error(`Zoho API error (${res.status}): ${errText}`);
        }
        
        const json = await res.json();
        return {
          status: "success",
          tickets: json.data || [],
          timestamp: new Date().toISOString()
        };
      } catch (err: any) {
         if (err.message.includes("not connected")) throw err;
         
         // Fallback mock
         return {
           status: "error",
           message: err.message,
           note: "Make sure your ZOHO_ORG_ID is in your environment variables, and the app is authenticated."
         };
      }
    }
  },
  {
    name: "create_zoho_ticket",
    description: "Create a new ticket in Zoho Desk.",
    parameters: z.object({
      subject: z.string().describe("The subject or title of the ticket."),
      departmentId: z.string().optional().describe("The ID of the department in Zoho Desk. If not provided, it will use the default department."),
      contactId: z.string().optional().describe("The Zoho Desk contact ID of the customer reporting the issue."),
      email: z.string().optional().describe("The email of the customer (if contactId is not known)."),
      description: z.string().describe("Detailed description of the issue or request."),
      status: z.enum(["Open", "On Hold", "Escalated", "Closed", "In Progress", "Solved"]).optional().describe("Initial status for the ticket.")
    }),
    category: "external",
    platform: "estate",
    execute: async ({ subject, departmentId, contactId, email, description, status }, context) => {
      try {
        const tokens = await getZohoTokens();
        const effectiveOrgId = tokens.orgId || process.env.ZOHO_ORG_ID || "";
        const effectiveDeptId = departmentId || tokens.departmentId || process.env.ZOHO_DEPARTMENT_ID || "";
        
        const payload: any = {
           subject,
           description,
           email: email || "unknown@system.local",
           status: status || "Open"
        };
        if (effectiveDeptId) payload.departmentId = effectiveDeptId;
        if (contactId) payload.contactId = contactId;

        const headers: any = {
          "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`,
          "Content-Type": "application/json"
        };
        if (effectiveOrgId) headers["orgId"] = effectiveOrgId;

        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets`;
        const res = await fetch(url, {
           method: "POST",
           headers,
           body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
           const errBody = await res.text();
           console.error(`[Zoho CreateTicket] Error ${res.status}:`, errBody, "Payload:", JSON.stringify(payload));
           throw new Error(`Zoho API error (${res.status}): ${errBody}`);
        }
        
        const json = await res.json();
        return {
          status: "success",
          ticket: json,
          message: `Successfully created ticket in Zoho Desk.`,
          timestamp: new Date().toISOString()
        };
      } catch (err: any) {
        return {
          status: "error",
          message: err.message
        };
      }
    }
  },
  {
    name: "update_zoho_ticket",
    description: "Update a ticket's status, assignee, or add a comment in Zoho Desk.",
    parameters: z.object({
      ticketId: z.string().describe("The ID of the Zoho ticket (numeric ID), e.g., '123456789'."),
      status: z.enum(["Open", "In Progress", "Solved", "Closed", "On Hold", "Escalated"]).optional().describe("New status for the ticket."),
      comment: z.string().optional().describe("A comment or resolution message to add to the ticket."),
    }),
    category: "external",
    platform: "estate",
    requiresApproval: true,
    execute: async ({ ticketId, status, comment }, context) => {
      if (!ticketId) throw new Error("ticketId is required.");
    try {
      const tokens = await getZohoTokens();
      const effectiveOrgId = tokens.orgId || process.env.ZOHO_ORG_ID || "";
      
      const headers: any = {
        "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`,
        "Content-Type": "application/json"
      };
      if (effectiveOrgId) headers["orgId"] = effectiveOrgId;

      const results: any = { ticketId };

      if (status) {
        const payload = { status };
        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}`;
        const res = await fetch(url, {
           method: "PATCH",
           headers,
           body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error(`[Zoho UpdateTicket Status] Error ${res.status}:`, errBody);
          throw new Error(`Failed to update status (${res.status}): ${errBody}`);
        }
        results.statusUpdated = true;
      }
      
      if (comment) {
        const payload = { content: comment, isPublic: true };
        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}/comments`;
        const res2 = await fetch(url, {
           method: "POST",
           headers,
           body: JSON.stringify(payload)
        });
        if (!res2.ok) {
          const errBody = await res2.text();
          console.error(`[Zoho UpdateTicket Comment] Error ${res2.status}:`, errBody);
          throw new Error(`Failed to add comment (${res2.status}): ${errBody}`);
        }
        results.commentAdded = true;
      }

      return {
        status: "success",
        ...results,
        message: `Successfully updated ticket ${ticketId}.`,
        timestamp: new Date().toISOString()
      };
    } catch (err: any) {
      return {
        status: "error",
        message: err.message
      };
    }
    }
  },
  {
    name: "create_zoho_comment",
    description: "Add an internal note or a public comment to a Zoho ticket.",
    parameters: z.object({
      ticketId: z.string().describe("The Zoho ticket ID."),
      comment: z.string().describe("The content of the comment."),
      isPublic: z.boolean().optional().default(false).describe("Whether the comment should be visible to the customer (public).")
    }),
    category: "external",
    platform: "estate",
    execute: async ({ ticketId, comment, isPublic }, context) => {
      try {
        const tokens = await getZohoTokens();
        const headers = {
          "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`,
          "Content-Type": "application/json",
          "orgId": tokens.orgId || process.env.ZOHO_ORG_ID || ""
        };
        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}/comments`;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ content: comment, isPublic })
        });
        if (!res.ok) throw new Error(await res.text());
        return { status: "success", message: "Comment added successfully." };
      } catch (e: any) {
        return { status: "error", message: e.message };
      }
    }
  },
  {
    name: "send_zoho_reply",
    description: "Send a reply to the customer on a Zoho ticket.",
    parameters: z.object({
      ticketId: z.string().describe("The Zoho ticket ID."),
      content: z.string().describe("The content of the reply message.")
    }),
    category: "external",
    platform: "estate",
    execute: async ({ ticketId, content }, context) => {
      try {
        const tokens = await getZohoTokens();
        const headers = {
          "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`,
          "Content-Type": "application/json",
          "orgId": tokens.orgId || process.env.ZOHO_ORG_ID || ""
        };
        // In Zoho Desk, a "reply" is usually sent via the /sendReply endpoint
        const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}/sendReply`;
        const res = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ content })
        });
        if (!res.ok) throw new Error(await res.text());
        return { status: "success", message: "Reply sent successfully." };
      } catch (e: any) {
        return { status: "error", message: e.message };
      }
    }
  },
  {
    name: "get_zoho_ticket_conversations",
    description: "Fetch the conversation history (replies and comments) for a specific Zoho ticket.",
    parameters: z.object({
      ticketId: z.string().describe("The Zoho ticket ID.")
    }),
    category: "external",
    platform: "estate",
    execute: async ({ ticketId }, context) => {
      try {
        const tokens = await getZohoTokens();
        const headers = {
          "Authorization": `Zoho-oauthtoken ${tokens.accessToken}`,
          "orgId": tokens.orgId || process.env.ZOHO_ORG_ID || ""
        };
        
        // Fetch Threads (Replies)
        const threadUrl = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}/threads`;
        const threadRes = await fetch(threadUrl, { headers });
        const threads = threadRes.ok ? (await threadRes.json()).data : [];

        // Fetch Comments
        const commentUrl = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets/${encodeURIComponent(ticketId)}/comments`;
        const commentRes = await fetch(commentUrl, { headers });
        const comments = commentRes.ok ? (await commentRes.json()).data : [];

        return { 
          status: "success", 
          conversations: {
            threads: threads || [],
            comments: comments || []
          }
        };
      } catch (e: any) {
        return { status: "error", message: e.message };
      }
    }
  }
];
