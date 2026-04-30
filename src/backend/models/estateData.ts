import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export interface Property {
  id: string;
  name: string;
  location: { address: string; city: string; country: string };
  units: number;
  property_type: string;
}

export interface Tenant {
  id: string;
  name: string;
  contact: { email: string; phone: string };
  assigned_unit: string;
  property_id: string;
}

export interface Lease {
  id: string;
  tenant_id: string;
  property_id: string;
  unit: string;
  rent: number;
  start_date: string;
  end_date: string;
  payment_frequency: string;
}

export interface EstateEmail {
  id: string;
  type: "sent" | "received" | "draft";
  subject: string;
  body: string;
  to: string;
  from: string;
  tenant_id?: string;
  property_id?: string;
  date: string;
}

export interface Ticket {
  id: string;
  source: "local" | "zoho";
  external_id?: string;
  subject: string;
  description: string;
  status: "Open" | "On Hold" | "Escalated" | "Closed";
  priority: "Low" | "Medium" | "High" | "Urgent";
  tenant_id?: string;
  property_id?: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
  resolution?: string;
}

export interface TicketInteraction {
  id: string;
  ticket_id: string;
  external_id?: string;
  tenant_name: string;
  property_name: string;
  action: string; 
  details: string;
  status: string;
  timestamp: string;
}

export interface LiveOpsLog {
  id: string;
  ticket_id?: string;
  message: string;
  type: "info" | "warning" | "error" | "success";
  timestamp: string;
}

const DATA_FILE = path.join(process.cwd(), "workspaces", "estate_db.json");

export async function ensureDataFile() {
  if (!(await fs.pathExists(DATA_FILE))) {
    await fs.ensureDir(path.parse(DATA_FILE).dir);
    await fs.writeJson(DATA_FILE, {
      properties: [],
      tenants: [],
      leases: [],
      emails: [],
      tickets: [],
      live_ops: [],
      ticket_interactions: []
    }, { spaces: 2 });
  } else {
    // ensure new arrays exist on existing dbs
    const data = await fs.readJson(DATA_FILE);
    let changed = false;
    if (!data.emails) {
      data.emails = [];
      changed = true;
    }
    if (!data.tickets) {
      data.tickets = [];
      changed = true;
    }
    if (!data.live_ops) {
      data.live_ops = [];
      changed = true;
    }
    if (!data.ticket_interactions) {
      data.ticket_interactions = [];
      changed = true;
    }
    if (changed) {
      await fs.writeJson(DATA_FILE, data, { spaces: 2 });
    }
  }
}

export async function getData() {
  await ensureDataFile();
  return fs.readJson(DATA_FILE);
}

export async function saveData(data: any) {
  await ensureDataFile();
  await fs.writeJson(DATA_FILE, data, { spaces: 2 });
  await updateKnowledgeBaseFile(data);
}

async function updateKnowledgeBaseFile(data: any) {
  try {
    const kbPath = path.join(process.cwd(), "workspaces", "estate_knowledge_base.md");
    let content = "# EstateNexus Knowledge Base\n\n";
    content += `Last Updated: ${new Date().toLocaleString()}\n\n`;
    
    content += "## Properties\n";
    if (data.properties.length === 0) content += "*No properties found.*\n";
    data.properties.forEach((p: any) => {
      content += `### ${p.name}\n`;
      content += `- **ID**: ${p.id}\n`;
      content += `- **Address**: ${p.location?.address || 'N/A'}, ${p.location?.city || 'N/A'}, ${p.location?.country || 'N/A'}\n`;
      content += `- **Units**: ${p.units || 0}\n`;
      content += `- **Type**: ${p.property_type || 'N/A'}\n\n`;
    });

    content += "## Tenants\n";
    if (data.tenants.length === 0) content += "*No tenants found.*\n";
    data.tenants.forEach((t: any) => {
      const prop = data.properties.find((p: any) => p.id === t.property_id);
      content += `### ${t.name}\n`;
      content += `- **ID**: ${t.id}\n`;
      content += `- **Email**: ${t.contact?.email || 'N/A'}\n`;
      content += `- **Phone**: ${t.contact?.phone || 'N/A'}\n`;
      content += `- **Unit**: ${t.assigned_unit || 'N/A'}\n`;
      content += `- **Property**: ${prop?.name || 'Unknown'} (${prop?.id || 'N/A'})\n\n`;
    });

    content += "## Leases\n";
    if (data.leases.length === 0) content += "*No active leases found.*\n";
    data.leases.forEach((l: any) => {
      const tenant = data.tenants.find((t: any) => t.id === l.tenant_id);
      content += `### Lease for ${tenant?.name || 'Unknown'}\n`;
      content += `- **ID**: ${l.id}\n`;
      content += `- **Rent**: $${l.rent} / ${l.payment_frequency || 'monthly'}\n`;
      content += `- **Duration**: ${l.start_date || 'N/A'} to ${l.end_date || 'N/A'}\n`;
      content += `- **Unit**: ${l.unit || 'N/A'}\n\n`;
    });

    await fs.writeFile(kbPath, content);
  } catch (error) {
    console.error("Failed to update knowledge base file:", error);
  }
}
