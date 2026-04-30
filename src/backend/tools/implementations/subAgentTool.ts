import { z } from "zod";
import { ToolDefinition } from "../registry.js";
import { v4 as uuidv4 } from "uuid";

export const subAgentTool: ToolDefinition = {
  name: "spawn_sub_agent",
  description: "Spawn a specialized sub-agent to handle a sub-task. Returns the sub-agent's final output.",
  parameters: z.object({
    task: z.string().describe("The specific sub-task for the sub-agent."),
    specialization: z.string().describe("The persona or specialization (e.g., 'Researcher', 'Coder')."),
  }),
  platform: "nexus",
  execute: async ({ task, specialization }, context) => {
    const subAgentId = uuidv4();
    context.socket.emit("agent:log", { 
      message: `Spawning sub-agent [${specialization}] for task: ${task}`,
      type: "info" 
    });

    // In a real system, this would call the AgentManager recursively or a separate service.
    // For this demo, we simulate a sub-agent execution.
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return `[SUB-AGENT: ${specialization}] Task "${task}" completed. Result: Analysis of ${task} is ready.`;
  },
};
