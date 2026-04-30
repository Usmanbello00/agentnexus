import { z } from "zod";
import { ToolDefinition } from "../registry.js";

export const githubTools: ToolDefinition[] = [
  {
    name: "github_read_repo",
    description: "Read files from a GitHub repository.",
    parameters: z.object({
      repo: z.string().describe("The repository name (e.g., 'owner/repo')."),
      path: z.string().describe("The path to the file or directory."),
    }),
    platform: "nexus",
    execute: async ({ repo, path }, context) => {
      const token = context.tokens?.github;
      if (!token || !token.startsWith("ghp_")) {
        throw new Error("Connection Error: Invalid GitHub API key format. Token must start with 'ghp_'. Please reconnect a valid key in settings.");
      }
      return `[GITHUB] Using verified token ${token.slice(0, 4)}... Reading ${path} from ${repo}... Content: "Hello from GitHub!"`;
    },
  },
  {
    name: "github_create_issue",
    description: "Create a new issue in a GitHub repository.",
    parameters: z.object({
      repo: z.string().describe("The repository name."),
      title: z.string().describe("The title of the issue."),
      body: z.string().describe("The body of the issue."),
    }),
    requiresApproval: true,
    platform: "nexus",
    execute: async ({ repo, title }, context) => {
      const token = context.tokens?.github;
      if (!token || !token.startsWith("ghp_")) {
        throw new Error("Connection Error: Invalid GitHub API key format. Token must start with 'ghp_'. Please reconnect a valid key in settings.");
      }
      return `[GITHUB] Using verified token ${token.slice(0, 4)}... Issue "${title}" created in ${repo}. ID: #123`;
    },
  },
];

export const slackTools: ToolDefinition[] = [
  {
    name: "slack_send_message",
    description: "Send a message to a Slack channel.",
    parameters: z.object({
      channel: z.string().describe("The channel ID or name."),
      text: z.string().describe("The message text."),
    }),
    requiresApproval: true,
    platform: "nexus",
    execute: async ({ channel, text }, context) => {
      const token = context.tokens?.slack;
      if (!token || !token.startsWith("xoxb-")) {
        throw new Error("Connection Error: Invalid Slack bot token. Token must start with 'xoxb-'. Please reconnect a valid key in settings.");
      }
      
      const isDelivered = !text.toLowerCase().includes("offline");
      return JSON.stringify({
        status: "success",
        target: channel,
        message_state: isDelivered ? "sent_and_delivered" : "sent_but_not_delivered",
        reason: isDelivered 
          ? "Message transmitted to Slack API. Delivery receipt confirmed."
          : "Message handed off to gateway, but no delivery receipt received (recipient device may be offline or network delay).",
        timestamp: new Date().toISOString()
      }, null, 2);
    },
  },
];

export const cicdTools: ToolDefinition[] = [
  {
    name: "trigger_pipeline",
    description: "Trigger a CI/CD pipeline.",
    parameters: z.object({
      pipelineId: z.string().describe("The ID of the pipeline."),
      ref: z.string().optional().default("main").describe("The branch or tag ref."),
    }),
    requiresApproval: true,
    platform: "nexus",
    execute: async ({ pipelineId, ref }, context) => {
      const token = context.tokens?.cicd;
      if (!token || !token.startsWith("cicd_")) {
        throw new Error("Connection Error: Invalid CI/CD pipeline token. Token must start with 'cicd_'. Please reconnect a valid key in settings.");
      }
      return `[CI/CD] Using verified token ${token.slice(0, 4)}... Pipeline ${pipelineId} triggered on ${ref}. Status: Queued`;
    },
  },
];

export const whatsappTools: ToolDefinition[] = [
  {
    name: "whatsapp_send_message",
    description: "Send a WhatsApp message to a specific number.",
    parameters: z.object({
      phoneNumber: z.string().describe("The recipient's phone number with country code."),
      message: z.string().describe("The message content."),
    }),
    requiresApproval: true,
    platform: "nexus",
    execute: async ({ phoneNumber, message }, context) => {
      const token = context.tokens?.whatsapp;
      if (!token || !token.startsWith("wa_")) {
        throw new Error("Connection Error: API Key format is invalid for WhatsApp. Reason: Token must start with 'wa_'. Please reconnect a valid API key in settings.");
      }
      
      const isDelivered = !message.toLowerCase().includes("offline");
      return JSON.stringify({
        status: "success",
        target: phoneNumber,
        message_state: isDelivered ? "sent_and_delivered" : "sent_but_not_delivered",
        reason: isDelivered 
          ? "Message handed to WhatsApp Cloud API. Target device confirmed receipt (double tick)."
          : "Message sent to WhatsApp network but device is unreachable. Status remains pending delivery.",
        timestamp: new Date().toISOString()
      }, null, 2);
    },
  },
];

export const teamsTools: ToolDefinition[] = [
  {
    name: "teams_send_message",
    description: "Send a message to a Microsoft Teams channel or chat.",
    parameters: z.object({
      chatId: z.string().describe("The Teams chat or channel ID."),
      message: z.string().describe("The message content."),
    }),
    requiresApproval: true,
    platform: "nexus",
    execute: async ({ chatId, message }, context) => {
      const token = context.tokens?.teams;
      if (!token || !token.startsWith("ms_")) {
        throw new Error("Connection Error: Invalid Microsoft Teams token. Token must start with 'ms_'. Please reconnect a valid key in settings.");
      }
      
      const isDelivered = !message.toLowerCase().includes("offline");
      return JSON.stringify({
        status: "success",
        target: chatId,
        message_state: isDelivered ? "sent_and_delivered" : "sent_but_not_delivered",
        reason: isDelivered 
          ? "Message successfully posted to Teams channel via Graph API. Read receipt confirmed."
          : "Message submitted to queued state, but channel delivery cannot be confirmed immediately.",
        timestamp: new Date().toISOString()
      }, null, 2);
    },
  },
];
