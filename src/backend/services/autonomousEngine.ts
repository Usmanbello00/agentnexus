import { getData, saveData, TicketInteraction, LiveOpsLog } from "../models/estateData.js";
import { getZohoTokens } from "./zohoService.js";
import { getReasoning } from "./llm.js";
import { toolRegistry } from "../tools/registry.js";
import { v4 as uuidv4 } from "uuid";
import { Server } from "socket.io";
import path from "path";
import fs from "fs-extra";

export class AutonomousEngine {
  private io: Server;
  private interval: NodeJS.Timeout | null = null;
  private processing: boolean = false;

  constructor(io: Server) {
    this.io = io;
  }

  async start() {
    if (this.interval) return;
    console.log("[AutonomousEngine] Initializing...");
    
    // Check every 60 seconds to be safe with rate limits
    this.interval = setInterval(() => this.processTickets(), 60000); 
    this.processTickets();
  }

  async log(message: string, type: "info" | "warning" | "error" | "success" = "info", ticketId?: string) {
    try {
      const logResource: LiveOpsLog = {
        id: uuidv4(),
        ticket_id: ticketId,
        message,
        type,
        timestamp: new Date().toISOString()
      };
      
      const data = await getData();
      if (!data.live_ops) data.live_ops = [];
      data.live_ops.unshift(logResource);
      if (data.live_ops.length > 100) data.live_ops.pop();
      await saveData(data);
      
      this.io.emit("live_ops:log", logResource);
      console.log(`[AutonomousEngine] ${type.toUpperCase()}: ${message}`);
    } catch (e) {
      console.error("Failed to log live op:", e);
    }
  }

  async saveInteraction(ticket: any, action: string, details: string, status: string) {
    try {
      const data = await getData();
      const tenant = data.tenants.find((t: any) => t.contact?.email === ticket.email);
      const property = tenant ? data.properties.find((p: any) => p.id === tenant.property_id) : null;

      const interaction: TicketInteraction = {
        id: uuidv4(),
        ticket_id: ticket.id,
        external_id: ticket.ticketNumber,
        tenant_name: tenant?.name || "Unknown Tenant",
        property_name: property?.name || "Unknown Property",
        action,
        details,
        status,
        timestamp: new Date().toISOString()
      };
      
      if (!data.ticket_interactions) data.ticket_interactions = [];
      data.ticket_interactions.unshift(interaction);
      await saveData(data);
      
      this.io.emit("interaction:saved", interaction);
    } catch (e) {
      console.error("Failed to save interaction:", e);
    }
  }

  async processTickets() {
    if (this.processing) return;
    this.processing = true;
    
    try {
      const tokens = await getZohoTokens();
      if (!tokens.accessToken) {
          // Silent skip if not auth'd yet
          return;
      }

      await this.log("Starting autonomous support scan...", "info");
      
      const getTicketsTool = toolRegistry.getTool("get_zoho_tickets");
      if (!getTicketsTool) {
          await this.log("Zoho tools not found in registry.", "error");
          return;
      }

      const engineContext = {
        userId: "autonomous-engine",
        workspacePath: process.cwd(),
        socket: this.io,
        role: "admin" as const
      };

      const ticketsRes = await getTicketsTool.execute({ status: "Open", limit: 10 }, engineContext);

      if (ticketsRes.status === "error") {
          await this.log(`Scan failed: ${ticketsRes.message}`, "error");
          return;
      }

      const tickets = ticketsRes.tickets || [];
      if (tickets.length === 0) {
          await this.log("No open tickets found. System idling.", "info");
      } else {
          await this.log(`Found ${tickets.length} open tickets. Analyzing...`, "info");
          for (const ticket of tickets) {
              await this.processSingleTicket(ticket);
          }
      }

      await this.log("Cycle complete. System monitoring active.", "success");
    } catch (e: any) {
        this.log(`Engine runtime error: ${e.message}`, "error");
    } finally {
        this.processing = false;
    }
  }

  private async processSingleTicket(ticket: any) {
      await this.log(`Analyzing Ticket #${ticket.ticketNumber}: ${ticket.subject}`, "info", ticket.id);
      
      const data = await getData();
      
      // Step 1: Enrichment & Conversation Fetch
      const tenant = data.tenants.find((t: any) => t.contact?.email === ticket.email);
      const property = tenant ? data.properties.find((p: any) => p.id === tenant.property_id) : null;
      const history = (data.ticket_interactions || []).filter((i: any) => i.ticket_id === ticket.id);

      const engineContext = {
        userId: "autonomous-engine",
        workspacePath: process.cwd(),
        socket: this.io,
        role: "admin" as const
      };

      let conversations: any = { threads: [], comments: [] };
      const getConvTool = toolRegistry.getTool("get_zoho_ticket_conversations");
      if (getConvTool) {
        const convRes = await getConvTool.execute({ ticketId: ticket.id }, engineContext);
        if (convRes.status === "success") {
          conversations = convRes.conversations;
          
          // Log incoming tenant replies to the feed if they are new
          const existingLogs = data.live_ops || [];
          for (const thread of conversations.threads) {
            const msgId = thread.id;
            const alreadyLogged = existingLogs.some((l: any) => l.message.includes(msgId));
            
            if (!alreadyLogged && thread.direction === "in" ) {
               await this.log(`[Incoming] From Tenant: "${thread.summary || "New Message"}" (ID: ${msgId})`, "info", ticket.id);
            }
          }

          for (const comm of conversations.comments) {
            const commId = comm.id;
            const alreadyLogged = existingLogs.some((l: any) => l.message.includes(commId));
            if (!alreadyLogged) {
               const label = comm.isPublic ? "[Public Note]" : "[Internal Note]";
               const author = comm.commenter?.name || "User";
               await this.log(`${label} by ${author}: "${comm.content.substring(0, 150)}${comm.content.length > 150 ? '...' : ''}" (ID: ${commId})`, "info", ticket.id);
            }
          }
        }
      }
      
      // Step 2, 3, 4: AI Decision Logic
      const kbContent = await this.getKnowledgeBaseContent();
      
      const context = `
        CURRENT TICKET:
        ID: ${ticket.id}
        Number: ${ticket.ticketNumber}
        Subject: ${ticket.subject}
        Description: ${ticket.description}
        Created At: ${ticket.createdTime}
        
        CONVERSATION HISTORY:
        THREADS (Replies):
        ${JSON.stringify(conversations.threads.map((t: any) => ({ 
          from: t.fromEmailAddress, 
          to: t.toEmailAddress, 
          direction: t.direction,
          content: t.content,
          time: t.createdTime 
        })), null, 2)}
        
        COMMENTS (Notes):
        ${JSON.stringify(conversations.comments.map((c: any) => ({ 
          isPublic: c.isPublic, 
          commenter: c.commenter?.name, 
          content: c.content, 
          time: c.createdTime 
        })), null, 2)}

        TENANT PROFILE:
        ${tenant ? JSON.stringify(tenant, null, 2) : "Unknown Tenant"}
        
        PROPERTY PROFILE:
        ${property ? JSON.stringify(property, null, 2) : "Unknown Property"}
        
        INTERACTION HISTORY (Actions taken by this engine):
        ${JSON.stringify(history, null, 2)}
        
        ESTATENEXUS KNOWLEDGE BASE:
        ${kbContent}
      `;

      const prompt = `
        You are the Autonomous Ticket Resolution Engine for EstateNexus.
        Your goal is to resolve property management tickets immediately and professionally.
        
        STRICT RULES:
        1. Classify the issue (MAINTENANCE, BILLING, LEASE, OTHER).
        2. If you find a solution in the Knowledge Base, USE THE TOOLS to reply/act.
        3. Use "create_zoho_comment" for internal notes about your reasoning.
        4. Use "send_zoho_reply" to communicate with the tenant.
        5. Use "update_zoho_ticket" to change status if the issue is resolved or needs escalation.
        6. If the request involves spend over $500 or significant legal risk, only ADD A COMMENT explaining why you are NOT acting automatically and update status to "Escalated".
        
        Be concise and professional.
      `;

      try {
        const reasoning = await getReasoning([
            { role: "system", content: prompt },
            { role: "user", content: `Here is the ticket context:\n\n${context}` }
        ], toolRegistry.getAllTools().filter(t => t.name.includes("zoho") || t.name === "create_zoho_comment" || t.name === "send_zoho_reply"), "admin", "estate");

        if (reasoning.toolCalls && reasoning.toolCalls.length > 0) {
            for (const call of reasoning.toolCalls) {
                const tool = toolRegistry.getTool(call.name);
                if (tool) {
                    await this.log(`Action: ${call.name} for Ticket #${ticket.ticketNumber}`, "info", ticket.id);
                    const result = await tool.execute(call.args, engineContext);
                    
                    if (result.status === "success") {
                        await this.log(`Success: ${call.name}`, "success", ticket.id);
                        await this.saveInteraction(ticket, call.name, `Args: ${JSON.stringify(call.args)}. Result: ${result.message}`, "Completed");
                    } else {
                        await this.log(`Failed: ${call.name} - ${result.message}`, "error", ticket.id);
                    }
                }
            }
        } else {
            await this.log(`No automatic action determined for #${ticket.ticketNumber}. Reasoning: ${reasoning.text || "None provided"}`, "warning", ticket.id);
        }
      } catch (e: any) {
          await this.log(`Error processing #${ticket.ticketNumber}: ${e.message}`, "error", ticket.id);
      }
  }

  private async getKnowledgeBaseContent(): Promise<string> {
      try {
          const kbDir = path.join(process.cwd(), "workspaces", "knowledge_base");
          if (!(await fs.pathExists(kbDir))) return "General residential property management rules apply.";
          
          let content = "";
          const readRecursive = async (dir: string) => {
              const items = await fs.readdir(dir);
              for (const item of items) {
                  const fullPath = path.join(dir, item);
                  const stats = await fs.stat(fullPath);
                  if (stats.isDirectory()) {
                      await readRecursive(fullPath);
                  } else if (item.endsWith(".md") || item.endsWith(".txt")) {
                      const text = await fs.readFile(fullPath, "utf-8");
                      content += `\nFILE: ${item}\n${text}\n---\n`;
                  }
              }
          };
          
          await readRecursive(kbDir);
          return content || "General residential property management rules apply.";
      } catch (e) {
          console.error("Error reading Knowledge Base:", e);
      }
      return "General residential property management rules apply.";
  }
}
