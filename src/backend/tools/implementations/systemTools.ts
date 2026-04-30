import { z as val } from "zod";
import { ToolDefinition } from "../registry.js";
import fs from "fs-extra";
import nodePath from "path";

export const getSystemReportTool: ToolDefinition = {
  name: "get_system_report",
  description: "Generate a report of all tasks and activities happening in the system for the current user.",
  parameters: val.object({
    timeframe: val.string().optional().default("all").describe("The timeframe for the report (e.g., 'all', 'today', 'last_hour')."),
  }),
  platform: "shared",
  execute: async ({ timeframe }, context) => {
    const statePath = nodePath.join(context.workspacePath, ".nexus_state.json");
    if (!await fs.pathExists(statePath)) {
      return "No system activity recorded yet.";
    }

    const history = await fs.readJson(statePath);
    const toolExecutions = history.filter((m: any) => m.role === "tool");
    const userRequests = history.filter((m: any) => m.role === "user" && !m.content.startsWith("[SYSTEM]"));

    let report = `## System Activity Report (${timeframe})\n\n`;
    report += `### Summary\n`;
    report += `- Total User Requests: ${userRequests.length}\n`;
    report += `- Total Tool Executions: ${toolExecutions.length}\n\n`;

    report += `### Recent Tasks\n`;
    userRequests.slice(-5).forEach((req: any, i: number) => {
      report += `${i + 1}. ${req.content}\n`;
    });

    report += `\n### Tools Used\n`;
    const toolCounts: Record<string, number> = {};
    toolExecutions.forEach((exec: any) => {
      toolCounts[exec.toolName] = (toolCounts[exec.toolName] || 0) + 1;
    });

    Object.entries(toolCounts).forEach(([name, count]) => {
      report += `- ${name}: ${count} times\n`;
    });

    return report;
  },
};
