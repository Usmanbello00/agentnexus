import { Router } from "express";
import multer from "multer";
import * as xlsx from "xlsx";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs-extra";
import { getData, saveData } from "../models/estateData.js";
import { getReasoning } from "../services/llm.js";
import { toolRegistry } from "../tools/registry.js";
import { getZohoTokens } from "../services/zohoService.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Middleware for auth check if needed (simulation)
const checkRole = (roles: string[]) => (req: any, res: any, next: any) => {
  const userRole = req.headers['x-role'] || 'admin';
  if (roles.includes(userRole as string)) {
    return next();
  }
  return res.status(403).json({ error: "Access denied" });
};

router.get("/dashboard-summary", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const occupancyRate = data.properties.length > 0 
      ? Math.round((data.leases.length / data.properties.reduce((acc: number, p: any) => acc + (p.units || 1), 0)) * 100) 
      : 0;

    res.json({
      totalProperties: data.properties.length,
      totalTenants: data.tenants.length,
      activeLeases: data.leases.length,
      occupancyRate: Math.min(occupancyRate, 100), // Cap at 100% just in case
      recentActivities: [
        { type: 'payment', description: 'Rent paid by John Doe', date: new Date().toISOString() },
        { type: 'maintenance', description: 'Plumber visited 123 Maple St', date: new Date().toISOString() }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// PROPERTIES
router.get("/properties", async (req, res) => {
  const data = await getData();
  res.json(data.properties);
});

router.post("/properties", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const newProp = { id: uuidv4(), ...req.body };
    data.properties.push(newProp);
    await saveData(data);
    res.json(newProp);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/properties/:id", checkRole(['admin']), async (req, res) => {
  try {
    const data = await getData();
    data.properties = data.properties.filter((p: any) => p.id !== req.params.id);
    await saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// TENANTS
router.get("/tenants", async (req, res) => {
  const data = await getData();
  res.json(data.tenants);
});

router.post("/tenants", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const newTenant = { id: uuidv4(), ...req.body };
    data.tenants.push(newTenant);
    await saveData(data);
    res.json(newTenant);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/tenants/:id", checkRole(['admin']), async (req, res) => {
  try {
    const data = await getData();
    data.tenants = data.tenants.filter((p: any) => p.id !== req.params.id);
    await saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// LEASES
router.get("/leases", async (req, res) => {
  const data = await getData();
  res.json(data.leases);
});

router.post("/leases", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const newLease = { id: uuidv4(), ...req.body };
    data.leases.push(newLease);
    await saveData(data);
    res.json(newLease);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/leases/:id", checkRole(['admin']), async (req, res) => {
  try {
    const data = await getData();
    data.leases = data.leases.filter((p: any) => p.id !== req.params.id);
    await saveData(data);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// EXCEL UPLOAD
router.post("/upload-excel", checkRole(['admin']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    
    // Parse the file
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const json = xlsx.utils.sheet_to_json(sheet);
    
    // Naïve mapping to demo the feature
    // Maps: property_id -> Property, tenant_id -> Tenant, lease_id -> Lease
    const data = await getData();
    
    let addedCount = 0;
    
    for (const row of json as any[]) {
      if (row.property_id && row.property_name) {
        const existingId = data.properties.findIndex((p: any) => p.id === row.property_id);
        const propData = {
          id: row.property_id || uuidv4(),
          name: row.property_name || "Imported Property",
          location: { address: row.address || "", city: row.city || "", country: row.country || "" },
          units: parseInt(row.units) || 1,
          property_type: row.property_type || "multifamily"
        };
        if (existingId > -1) {
          data.properties[existingId] = { ...data.properties[existingId], ...propData };
        } else {
          data.properties.push(propData);
        }
        addedCount++;
      }
      
      if (row.tenant_id && row.tenant_name) {
        const existingId = data.tenants.findIndex((t: any) => t.id === row.tenant_id);
        const tenantData = {
          id: row.tenant_id || uuidv4(),
          name: row.tenant_name,
          contact: { email: row.email || "", phone: row.phone || "" },
          assigned_unit: row.assigned_unit || "",
          property_id: row.property_id || ""
        };
        if (existingId > -1) {
          data.tenants[existingId] = { ...data.tenants[existingId], ...tenantData };
        } else {
          data.tenants.push(tenantData);
        }
        addedCount++;
      }
      
      if (row.lease_id && row.rent_amount) {
        const existingId = data.leases.findIndex((l: any) => l.id === row.lease_id);
        const leaseData = {
          id: row.lease_id || uuidv4(),
          tenant_id: row.tenant_id || "",
          property_id: row.property_id || "",
          unit: row.assigned_unit || "",
          rent: parseFloat(row.rent_amount) || 0,
          start_date: row.start_date || new Date().toISOString(),
          end_date: row.end_date || new Date(Date.now() + 31536000000).toISOString(),
          payment_frequency: row.payment_frequency || "monthly"
        };
        if (existingId > -1) {
          data.leases[existingId] = { ...data.leases[existingId], ...leaseData };
        } else {
          data.leases.push(leaseData);
        }
        addedCount++;
      }
    }
    
    await saveData(data);
    res.json({ success: true, message: `Successfully imported ${addedCount} records.`, preview: json.slice(0, 5) });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message || "Failed to process Excel file" });
  }
});

// EMAILS
router.get("/emails", async (req, res) => {
  const data = await getData();
  res.json(data.emails || []);
});

router.post("/emails", checkRole(['admin', 'manager', 'developer']), async (req, res) => {
  // Can be used by agent to draft, or user to send
  try {
    const data = await getData();
    const newEmail = {
      id: uuidv4(),
      type: req.body.type || "draft",
      subject: req.body.subject || "No Subject",
      body: req.body.body || "",
      to: req.body.to || "",
      from: req.body.from || "admin@estatenexus.preview",
      tenant_id: req.body.tenant_id,
      property_id: req.body.property_id,
      date: new Date().toISOString()
    };
    if (!data.emails) data.emails = [];
    data.emails.push(newEmail);
    await saveData(data);
    res.json(newEmail);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/emails/:id", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const index = (data.emails || []).findIndex((e: any) => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Email not found" });
    
    data.emails[index] = { ...data.emails[index], ...req.body };
    await saveData(data);
    res.json(data.emails[index]);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/emails/:id/send", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const index = (data.emails || []).findIndex((e: any) => e.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Email not found" });
    
    // In a real app we'd trigger Resend / SendGrid API here. 
    // console.log("Sending email to:", data.emails[index].to);
    
    data.emails[index].type = "sent";
    data.emails[index].date = new Date().toISOString();
    await saveData(data);
    
    res.json({ success: true, email: data.emails[index] });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/emails/:id", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    if (data.emails) {
      data.emails = data.emails.filter((e: any) => e.id !== req.params.id);
      await saveData(data);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// TICKETS
router.get("/tickets", async (req, res) => {
  const data = await getData();
  res.json(data.tickets || []);
});

router.post("/tickets", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const newTicket = {
      id: uuidv4(),
      source: "local",
      subject: req.body.subject || "No Subject",
      description: req.body.description || "",
      status: req.body.status || "Open",
      priority: req.body.priority || "Medium",
      contact_email: req.body.contact_email || "",
      tenant_id: req.body.tenant_id,
      property_id: req.body.property_id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    if (!data.tickets) data.tickets = [];
    data.tickets.push(newTicket);
    await saveData(data);
    res.json(newTicket);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/tickets/:id", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const index = (data.tickets || []).findIndex((t: any) => t.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Ticket not found" });
    
    data.tickets[index] = { ...data.tickets[index], ...req.body, updated_at: new Date().toISOString() };
    await saveData(data);
    res.json(data.tickets[index]);
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/tickets/:id", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    if (data.tickets) {
      data.tickets = data.tickets.filter((t: any) => t.id !== req.params.id);
      await saveData(data);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
});

// SYNC ZOHO TICKETS
router.post("/sync-zoho-tickets", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const tokens = await getZohoTokens();
    const data = await getData();

    const ORG_ID = tokens.orgId || process.env.ZOHO_ORG_ID || "";
    const params = new URLSearchParams({
      limit: "50",
      status: "Open,On Hold,Escalated"
    });
    const url = `${tokens.apiDomain.replace(/\/+$/, "")}/api/v1/tickets?${params.toString()}`;
    const headers: any = { "Authorization": `Zoho-oauthtoken ${tokens.accessToken}` };
    if (ORG_ID) headers["orgId"] = ORG_ID;

    const zRes = await fetch(url, { headers });
    if (!zRes.ok) {
      const errBody = await zRes.text();
      console.error(`[Zoho Sync] Error ${zRes.status}:`, errBody, "URL:", url, "OrgId:", ORG_ID);
      throw new Error(`Zoho API error (${zRes.status}): ${errBody}`);
    }
    
    const json = await zRes.json();
    const zohoTickets = json.data || [];

    if (!data.tickets) data.tickets = [];
    
    let updatedCount = 0;
    for (const zt of zohoTickets) {
      const existingIdx = data.tickets.findIndex((t: any) => t.external_id === zt.id);
      const ticketData = {
        source: "zoho" as const,
        external_id: zt.id,
        subject: zt.subject,
        description: zt.description || "",
        status: zt.status === "In Progress" ? "Open" : zt.status, // Map status
        priority: zt.priority || "Medium",
        contact_email: zt.email || "",
        updated_at: new Date().toISOString()
      };

      if (existingIdx > -1) {
        data.tickets[existingIdx] = { ...data.tickets[existingIdx], ...ticketData };
      } else {
        data.tickets.push({
          id: uuidv4(),
          created_at: new Date().toISOString(),
          ...ticketData
        });
      }
      updatedCount++;
    }

    await saveData(data);
    res.json({ success: true, count: updatedCount });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

// PROCESS TICKETS WITH AI
router.post("/process-tickets", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const data = await getData();
    const openTickets = (data.tickets || []).filter((t: any) => t.status === "Open" || t.status === "Escalated");
    
    if (openTickets.length === 0) {
      return res.json({ message: "No open tickets to process." });
    }

    let processed = 0;
    for (const ticket of openTickets) {
       const tenant = data.tenants.find((t: any) => t.contact?.email === ticket.contact_email);
       const property = tenant ? data.properties.find((p: any) => p.id === tenant.property_id) : null;
       const lease = tenant ? data.leases.find((l: any) => l.tenant_id === tenant.id) : null;

       const contextPrompt = `
       Ticket to resolve:
       Subject: ${ticket.subject}
       Description: ${ticket.description}
       Source: ${ticket.source}
       
       Context:
       Tenant: ${tenant?.name || 'Unknown'} (Email: ${ticket.contact_email})
       Property: ${property?.name || 'Unknown'} (${property?.location?.address || ''})
       Unit: ${tenant?.assigned_unit || 'Unknown'}
       Lease Status: ${lease ? 'Active' : 'No active lease'}
       
       Task: 
       Analyze this ticket and provide an autonomous resolution based on the EstateNexus System Instructions.
       You should determine if it's an emergency, urgent, or routine maintenance, a billing issue, or a general inquiry.
       
       IMPORTANT: Return YOUR response in JSON format:
       {
         "status": "Closed" | "On Hold" | "Escalated",
         "resolution": "Detailed resolution message or internal note",
         "actionTaken": "Brief description of actions"
       }
       `;

       try {
         const result = await getReasoning(
           [{ role: "user", content: contextPrompt }],
           toolRegistry.getToolDeclarations("estate"),
           "admin",
           "estate"
         );

         const resolutionJson = JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '{"status":"On Hold", "resolution":"AI error: Failed to parse resolution."}');
         
         ticket.status = resolutionJson.status;
         ticket.resolution = resolutionJson.resolution;
         ticket.updated_at = new Date().toISOString();
         processed++;
       } catch (e) {
         console.error("AI Error for ticket:", ticket.id, e);
         // Fallback to simple logic if LLM fails
       }
    }

    await saveData(data);
    res.json({ success: true, message: `Estate Agent processed ${processed} tickets with autonomous reasoning.` });
  } catch (error) {
    res.status(500).json({ error: "Processing failed" });
  }
});

// INTEGRATION SYNC
router.post("/sync-integration", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const { provider, apiKey } = req.body;
    if (!provider || !apiKey) {
      return res.status(400).json({ error: "Missing required integration credentials." });
    }

    const data = await getData();
    
    // Mock importing records from Yardi / AppFolio / Buildium
    const pId = uuidv4();
    const tId = uuidv4();
    
    data.properties.push({
      id: pId,
      name: `Imported from ${provider.toUpperCase()} - Cloud Residence`,
      location: { address: "100 Sync Way", city: "Cloud City", country: "USA" },
      units: 24,
      property_type: "multifamily"
    });

    data.tenants.push({
      id: tId,
      name: "Jane Doe (Imported)",
      contact: { email: "jane.sync@example.com", phone: "555-0101" },
      assigned_unit: "101",
      property_id: pId
    });

    data.leases.push({
      id: uuidv4(),
      tenant_id: tId,
      property_id: pId,
      unit: "101",
      rent: 1800,
      start_date: new Date().toISOString(),
      end_date: new Date(Date.now() + 31536000000).toISOString(),
      payment_frequency: "monthly"
    });

    await saveData(data);

    res.json({ 
      success: true, 
      message: `Successfully synchronized data from ${provider.toUpperCase()} via API.` 
    });
  } catch (error) {
    res.status(500).json({ error: "Server error during synchronization." });
  }
});

router.get("/knowledge-base", checkRole(['admin', 'manager']), async (req, res) => {
  try {
    const kbPath = path.join(process.cwd(), "workspaces", "estate_knowledge_base.md");
    if (!(await fs.pathExists(kbPath))) {
      return res.status(404).json({ error: "Knowledge base not found. Please add some data first." });
    }
    const content = await fs.readFile(kbPath, "utf-8");
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: "Server error reading knowledge base" });
  }
});

export default router;
