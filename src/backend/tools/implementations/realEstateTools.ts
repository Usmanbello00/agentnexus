import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import fs from "fs-extra";
import nodePath from "path";
import { v4 as uuidv4 } from "uuid";
import { getData, saveData } from "../../models/estateData.js";

export const realEstateTools: ToolDefinition[] = [
  {
    name: "draft_tenant_email",
    description: "Draft an email to a tenant or property owner. The draft will be saved to the system and await admin review in the dashboard.",
    parameters: z.object({
      tenantId: z.string().describe("The ID or name of the tenant"),
      propertyId: z.string().nullable().optional().describe("The ID or name of the property"),
      toEmail: z.string().describe("The email address of the recipient"),
      subject: z.string().describe("Subject of the email"),
      body: z.string().describe("Body of the email. Keep it professional and concise."),
      attachment: z.string().nullable().optional().describe("Optional filename of a file in the workspace to attach to the email."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ tenantId, propertyId, toEmail, subject, body, attachment }) => {
      try {
        const data = await getData();
        const newEmail = {
          id: uuidv4(),
          type: "draft",
          subject: subject,
          body: body,
          to: toEmail,
          from: "agent@estatenexus.preview",
          tenant_id: tenantId,
          property_id: propertyId || "",
          attachment: attachment || null,
          date: new Date().toISOString()
        };
        if (!data.emails) data.emails = [];
        data.emails.push(newEmail);
        await saveData(data);

        return {
          status: "success",
          message: `Draft email created successfully. Case ID: ${newEmail.id}. It is now awaiting admin review.`,
          emailId: newEmail.id
        };
      } catch (error: any) {
        return {
          status: "error",
          message: `Failed to draft email: ${error.message}`
        };
      }
    },
  },
  {
    name: "sync_pms_data",
    description: "Sync property, tenant, and lease data from third-party Property Management Systems (PMS) like Yardi, AppFolio, or Buildium.",
    parameters: z.object({
      provider: z.enum(["yardi", "appfolio", "buildium"]).describe("The PMS provider to sync from."),
      apiKey: z.string().describe("The API key or auth token for the integration."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ provider, apiKey }) => {
      try {
        const data = await getData();
        
        // Mock import
        const pId = uuidv4();
        const tId = uuidv4();
        
        if(!data.properties) data.properties = [];
        if(!data.tenants) data.tenants = [];
        if(!data.leases) data.leases = [];

        data.properties.push({
          id: pId,
          name: `Imported from ${provider.toUpperCase()} (Agent)`,
          location: { address: "Agent Sync St", city: "Cloud", country: "USA" },
          units: 10,
          property_type: "multifamily"
        });

        data.tenants.push({
          id: tId,
          name: "Agent Synced Tenant",
          contact: { email: "tenant@example.com", phone: "555-0000" },
          assigned_unit: "A1",
          property_id: pId
        });

        data.leases.push({
          id: uuidv4(),
          tenant_id: tId,
          property_id: pId,
          unit: "A1",
          rent: 1500,
          start_date: new Date().toISOString(),
          end_date: new Date(Date.now() + 31536000000).toISOString(),
          payment_frequency: "monthly"
        });

        await saveData(data);

        return {
          status: "success",
          message: `Successfully synchronized 1 property, 1 tenant, and 1 lease from ${provider} via API key.`
        };
      } catch (error: any) {
        return {
          status: "error",
          message: `Failed to sync from ${provider}: ${error.message}`
        };
      }
    },
  },
  {
    name: "import_workspace_file_data",
    description: "Process any uploaded file format like Excel or CSV from the workspace, and import Properties, Tenants, and Leases in one go. Give it the filename of the uploaded file inside the workspace.",
    parameters: z.object({
      filename: z.string().describe("The name of the uploaded Excel/CSV file in the workspace context."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ filename }, context) => {
      try {
        const filePath = nodePath.join(context.workspacePath, filename);
        if (!(await fs.pathExists(filePath))) {
          return { status: "error", message: `File ${filename} not found in workspace.` };
        }
        
        // Dynamically import xlsx since it may be large
        const xlsx = await import("xlsx");
        
        const fileBuffer = await fs.readFile(filePath);
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet);
        
        const data = await getData();
        let propertiesAdded = 0;
        let tenantsAdded = 0;
        let leasesAdded = 0;
        
        for (const row of json as any[]) {
          if (row.property_id || row.property_name) {
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
            propertiesAdded++;
          }
          
          if (row.tenant_id || row.tenant_name) {
            const existingId = data.tenants.findIndex((t: any) => t.id === row.tenant_id);
            const tenantData = {
              id: row.tenant_id || uuidv4(),
              name: row.tenant_name || "Imported Tenant",
              contact: { email: row.email || "", phone: row.phone || "" },
              assigned_unit: row.assigned_unit || "",
              property_id: row.property_id || ""
            };
            if (existingId > -1) {
              data.tenants[existingId] = { ...data.tenants[existingId], ...tenantData };
            } else {
              data.tenants.push(tenantData);
            }
            tenantsAdded++;
          }
          
          if (row.lease_id || row.rent_amount) {
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
            leasesAdded++;
          }
        }
        
        await saveData(data);

        return {
          status: "success",
          message: `Successfully processed ${filename} and imported ${propertiesAdded} properties, ${tenantsAdded} tenants, and ${leasesAdded} leases.`
        };
      } catch (error: any) {
        return {
          status: "error",
          message: `Failed to process ${filename}: ${error.message}`
        };
      }
    },
  },
  {
    name: "get_property_details",
    description: "Get detailed information about a specific property by its Name or ID.",
    parameters: z.object({
      query: z.string().describe("The unique ID or name/address of the property."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ query }) => {
      try {
        const data = await getData();
        const property = data.properties.find((p: any) => 
          p.id === query || 
          p.name.toLowerCase().includes(query.toLowerCase()) ||
          p.location?.address.toLowerCase().includes(query.toLowerCase())
        );

        if (!property) {
          return { status: "error", message: `Property not found for query: ${query}` };
        }

        // Include related tenants and leases for full context
        const tenants = data.tenants.filter((t: any) => t.property_id === property.id);
        const leases = data.leases.filter((l: any) => l.property_id === property.id);

        return {
          status: "success",
          data: {
            ...property,
            relatedTenants: tenants.map((t: any) => ({ id: t.id, name: t.name, unit: t.assigned_unit })),
            relatedLeases: leases.map((l: any) => ({ id: l.id, unit: l.unit, rent: l.rent, status: new Date(l.end_date) > new Date() ? 'active' : 'expired' }))
          },
          timestamp: new Date().toISOString()
        };
      } catch (error: any) {
        return { status: "error", message: error.message };
      }
    },
  },
  {
    name: "get_tenant_details",
    description: "Get detailed information about a specific tenant by their Name, Email, or ID.",
    parameters: z.object({
      query: z.string().describe("The name, email, or ID of the tenant."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ query }) => {
      try {
        const data = await getData();
        const tenant = data.tenants.find((t: any) => 
          t.id === query || 
          t.name.toLowerCase().includes(query.toLowerCase()) ||
          t.contact?.email.toLowerCase() === query.toLowerCase()
        );

        if (!tenant) {
          return { status: "error", message: `Tenant not found for query: ${query}` };
        }

        const property = data.properties.find((p: any) => p.id === tenant.property_id);
        const lease = data.leases.find((l: any) => l.tenant_id === tenant.id);

        return {
          status: "success",
          data: {
            ...tenant,
            property: property ? { name: property.name, address: property.location?.address } : null,
            lease: lease || null
          },
          timestamp: new Date().toISOString()
        };
      } catch (error: any) {
        return { status: "error", message: error.message };
      }
    },
  },
  {
    name: "get_all_estate_data",
    description: "Fetch a complete summary of all Properties, Tenants, and Leases. Useful for building a full mental model of the estate.",
    parameters: z.object({}),
    category: "external",
    platform: "estate",
    execute: async () => {
      try {
        const data = await getData();
        return {
          status: "success",
          summary: {
            propertiesCount: data.properties.length,
            tenantsCount: data.tenants.length,
            leasesCount: data.leases.length,
            properties: data.properties.map((p: any) => ({ id: p.id, name: p.name })),
            tenants: data.tenants.map((t: any) => ({ id: t.id, name: t.name, email: t.contact?.email })),
            leases: data.leases.map((l: any) => ({ id: l.id, tenant_id: l.tenant_id, rent: l.rent }))
          },
          timestamp: new Date().toISOString()
        };
      } catch (error: any) {
        return { status: "error", message: error.message };
      }
    },
  },
  {
    name: "search_estate_records",
    description: "Search across all properties, tenants, and leases using a keyword. Returns matching records from all categories.",
    parameters: z.object({
      keyword: z.string().describe("The term to search for (e.g., 'Tenant_1', 'Maple St', 'jane@example.com')."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ keyword }) => {
      try {
        const data = await getData();
        const kw = keyword.toLowerCase();
        
        const matchingProperties = data.properties.filter((p: any) => 
          p.id.toLowerCase().includes(kw) || 
          p.name.toLowerCase().includes(kw) || 
          p.location?.address?.toLowerCase().includes(kw)
        );

        const matchingTenants = data.tenants.filter((t: any) => 
          t.id.toLowerCase().includes(kw) || 
          t.name.toLowerCase().includes(kw) || 
          t.contact?.email?.toLowerCase().includes(kw)
        );

        const matchingLeases = data.leases.filter((l: any) => 
          l.id.toLowerCase().includes(kw) || 
          l.unit?.toLowerCase().includes(kw)
        );

        return {
          status: "success",
          results: {
            properties: matchingProperties,
            tenants: matchingTenants,
            leases: matchingLeases
          },
          query: keyword,
          timestamp: new Date().toISOString()
        };
      } catch (error: any) {
        return { status: "error", message: error.message };
      }
    },
  },
  {
    name: "schedule_maintenance",
    description: "Schedule a maintenance request for a property.",
    parameters: z.object({
      propertyId: z.string().describe("The ID or address of the property."),
      issueType: z.string().describe("Type of issue (e.g., Plumbing, Electrical, HVAC)."),
      urgency: z.enum(["low", "medium", "high"]).describe("Urgency of the request."),
      preferredDate: z.string().describe("ISO date for the maintenance visit."),
    }),
    category: "external",
    requiresApproval: true,
    platform: "estate",
    execute: async ({ propertyId, issueType, urgency, preferredDate }) => {
      return {
        status: "success",
        message: `Maintenance scheduled for ${propertyId}`,
        details: {
          issueType,
          urgency,
          preferredDate,
          requestId: `MTN-${Math.floor(Math.random() * 10000)}`,
        },
        timestamp: new Date().toISOString()
      };
    },
  },
  {
    name: "record_tenant_interaction",
    description: "Record a tenant complaint, request, or general inquiry in the system.",
    parameters: z.object({
      tenantName: z.string().describe("Name of the tenant."),
      propertyId: z.string().describe("Property ID or address."),
      subject: z.string().describe("Short summary of the interaction."),
      details: z.string().describe("Full details of the inquiry or complaint."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ tenantName, propertyId, subject, details }, context) => {
      const interaction = {
        tenantName,
        propertyId,
        subject,
        details,
        timestamp: new Date().toISOString()
      };

      try {
        const logPath = nodePath.join(context.workspacePath, "tenant_interactions.json");
        let logs = [];
        if (await fs.pathExists(logPath)) {
          const content = await fs.readFile(logPath, "utf-8");
          try {
            logs = JSON.parse(content);
          } catch (e) {
            logs = [];
          }
        }
        logs.push(interaction);
        await fs.writeFile(logPath, JSON.stringify(logs, null, 2));

        return {
          status: "success",
          message: `Interaction recorded for ${tenantName} at ${propertyId} and logged to workspace.`,
          caseId: `CASE-${Math.floor(Math.random() * 50000)}`,
          summary: subject,
          timestamp: interaction.timestamp,
          archived: true
        };
      } catch (error) {
        console.error("Failed to log interaction to file:", error);
        return {
          status: "success",
          message: `Interaction recorded for ${tenantName} at ${propertyId} (Workspace log failed)`,
          caseId: `CASE-${Math.floor(Math.random() * 50000)}`,
          summary: subject,
          timestamp: new Date().toISOString(),
          archived: false
        };
      }
    },
  },
  {
    name: "get_market_insights",
    description: "Get real estate market trends and analytics for a specific zip code or city.",
    parameters: z.object({
      location: z.string().describe("City or Zip code to analyze."),
    }),
    category: "external",
    platform: "estate",
    execute: async ({ location }) => {
      return {
        location,
        marketState: "Bullish",
        averagePriceChange: "+4.5% YoY",
        inventoryLevel: "Low",
        hotSectors: ["Luxury Condos", "Suburban Family Homes"],
        recommendation: "Hold for long-term appreciation or consider suburban multi-family units.",
        timestamp: new Date().toISOString()
      };
    },
  },
];
