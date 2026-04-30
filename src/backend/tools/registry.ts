import { z } from "zod";

export type UserRole = "admin" | "developer" | "viewer";

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any, context: ToolContext) => Promise<any>;
  requiresApproval?: boolean;
  requiredRole?: UserRole;
  category?: "file" | "system" | "external" | "agent";
  platform?: "nexus" | "estate" | "shared";
}

export interface ToolContext {
  userId: string;
  workspacePath: string;
  socket: any;
  role: UserRole;
  tokens?: Record<string, string>;
}

export class ToolRegistry {
  private tools: Map<string, ToolDefinition> = new Map();

  register(tool: ToolDefinition) {
    this.tools.set(tool.name, tool);
  }

  getTool(name: string) {
    return this.tools.get(name);
  }

  getAllTools() {
    return Array.from(this.tools.values());
  }

  getToolDeclarations(platform?: "nexus" | "estate") {
    return this.getAllTools()
      .filter(tool => !platform || tool.platform === "shared" || tool.platform === platform)
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters, // Return the raw Zod object
      }));
  }

  private zodToGeminiSchema(schema: z.ZodObject<any>): any {
    // Simplified conversion from Zod to Gemini Function Calling schema
    const properties: any = {};
    const required: string[] = [];

    for (const [key, value] of Object.entries(schema.shape)) {
      const zodType = value as z.ZodTypeAny;
      const description = zodType.description || "";
      
      let type = "string";
      if (zodType instanceof z.ZodNumber) type = "number";
      if (zodType instanceof z.ZodBoolean) type = "boolean";
      if (zodType instanceof z.ZodArray) type = "array";
      if (zodType instanceof z.ZodObject) type = "object";

      properties[key] = {
        type,
        description,
      };

      if (!zodType.isOptional()) {
        required.push(key);
      }
    }

    return {
      type: "object",
      properties,
      required,
    };
  }
}

export const toolRegistry = new ToolRegistry();
