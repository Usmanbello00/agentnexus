import { ToolRegistry, ToolDefinition } from "../tools/registry.js";
import { z } from "zod";

export interface MCPConfig {
  tools: {
    name: string;
    description: string;
    endpoint: string;
    method: "GET" | "POST";
    parameters: Record<string, any>;
    requiresApproval?: boolean;
    requiredRole?: "admin" | "developer" | "viewer";
  }[];
}

export class MCPGateway {
  constructor(private toolRegistry: ToolRegistry) {}

  registerFromConfig(config: MCPConfig) {
    for (const toolConfig of config.tools) {
      const tool: ToolDefinition = {
        name: toolConfig.name,
        description: toolConfig.description,
        parameters: this.mapToZod(toolConfig.parameters),
        requiresApproval: toolConfig.requiresApproval,
        requiredRole: toolConfig.requiredRole,
        category: "external",
        execute: async (args, context) => {
          const response = await fetch(toolConfig.endpoint, {
            method: toolConfig.method,
            headers: {
              "Content-Type": "application/json",
            },
            body: toolConfig.method === "POST" ? JSON.stringify(args) : undefined,
          });
          
          if (!response.ok) {
            throw new Error(`MCP Tool ${toolConfig.name} failed: ${response.statusText}`);
          }
          
          return await response.json();
        },
      };
      this.toolRegistry.register(tool);
    }
  }

  private mapToZod(params: Record<string, any>): z.ZodObject<any> {
    const shape: any = {};
    for (const [key, value] of Object.entries(params)) {
      if (value.type === "string") shape[key] = z.string().describe(value.description || "");
      else if (value.type === "number") shape[key] = z.number().describe(value.description || "");
      else if (value.type === "boolean") shape[key] = z.boolean().describe(value.description || "");
      else shape[key] = z.any().describe(value.description || "");
      
      if (value.optional) shape[key] = shape[key].optional();
    }
    return z.object(shape);
  }
}
