import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs-extra";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { fileURLToPath } from "url";
import { ToolRegistry, toolRegistry } from "./src/backend/tools/registry.js";
import { readFileTool, writeFileTool, listFilesTool, searchFilesTool, uploadFileTool, createWordCountScriptTool } from "./src/backend/tools/implementations/fileTools.js";
import { githubTools, slackTools, cicdTools, whatsappTools, teamsTools } from "./src/backend/tools/implementations/externalTools.js";
import { subAgentTool } from "./src/backend/tools/implementations/subAgentTool.js";
import { weatherTool } from "./src/backend/tools/implementations/weatherTool.js";
import { getSystemReportTool } from "./src/backend/tools/implementations/systemTools.js";
import { realEstateTools } from "./src/backend/tools/implementations/realEstateTools.js";
import { emailTools } from "./src/backend/tools/implementations/emailTools.js";
import { zohoTools } from "./src/backend/tools/implementations/zohoTools.js";
import { AgentManager } from "./src/backend/agent/manager.js";
import { MCPGateway } from "./src/backend/services/mcp.js";
import estateRoutes from "./src/backend/routes/estate.js";
import { AutonomousEngine } from "./src/backend/services/autonomousEngine.js";
import { getData } from "./src/backend/models/estateData.js";

import msAuthRoutes from "./src/backend/routes/ms-auth.js";
import zohoAuthRoutes from "./src/backend/routes/zoho-auth.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  toolRegistry.register(readFileTool);
  toolRegistry.register(writeFileTool);
  toolRegistry.register(uploadFileTool);
  toolRegistry.register(createWordCountScriptTool);
  toolRegistry.register(listFilesTool);
  toolRegistry.register(searchFilesTool);
  
  // External Tools
  githubTools.forEach(tool => toolRegistry.register(tool));
  slackTools.forEach(tool => toolRegistry.register(tool));
  cicdTools.forEach(tool => toolRegistry.register(tool));
  whatsappTools.forEach(tool => toolRegistry.register(tool));
  teamsTools.forEach(tool => toolRegistry.register(tool));
  
  // Sub-Agent Tool
  toolRegistry.register(subAgentTool);

  // Weather Tool
  toolRegistry.register(weatherTool);

  // System Tools
  toolRegistry.register(getSystemReportTool);

  // Real Estate Tools
  realEstateTools.forEach(tool => toolRegistry.register(tool));

  // Zoho Tools
  zohoTools.forEach(tool => toolRegistry.register(tool));

  // Email Tools
  emailTools.forEach(tool => toolRegistry.register(tool));

  // MCP Gateway
  const mcpGateway = new MCPGateway(toolRegistry);
  mcpGateway.registerFromConfig({
    tools: [
      // Add more MCP tools here as needed
    ]
  });

  const agentManager = new AgentManager(toolRegistry);

  // Start Autonomous Engine
  const autonomousEngine = new AutonomousEngine(io);
  autonomousEngine.start();

  const PORT = 3000;

  app.use(cors());
  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development/iframe compatibility
  }));
  app.use(morgan("dev"));
  app.use(express.json());

  // API Routes
  app.use("/api/estate", estateRoutes);
  app.use("/api/auth/ms", msAuthRoutes);
  app.use("/api/auth/zoho", zohoAuthRoutes);

  app.get("/api/live-ops", async (req, res) => {
    const data = await getData();
    res.json(data.live_ops || []);
  });

  app.get("/api/interactions", async (req, res) => {
    const data = await getData();
    res.json(data.ticket_interactions || []);
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  app.get("/api/workspace/file", async (req, res) => {
    try {
      const { agentId, file } = req.query;
      if (!agentId || !file) return res.status(400).send("Missing parameters");
      const state = agentManager.getState(agentId as string);
      if (!state) return res.status(404).send("Agent not found");
      
      const filePath = path.join(state.workspacePath, file as string);
      // Security check
      if (!filePath.startsWith(state.workspacePath)) return res.status(403).send("Forbidden");
      if (!await fs.pathExists(filePath)) return res.status(404).send("File not found");
      
      res.download(filePath);
    } catch (e) {
      res.status(500).send("Server error");
    }
  });

  // Socket.io logic
  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("agent:init", async ({ userId, role }) => {
      const agent = await agentManager.createAgent(userId || "default-user", socket, role);
      socket.emit("agent:ready", { agentId: agent.id, role: agent.role, mode: agent.mode });
    });

    socket.on("agent:update_role", async ({ agentId, role }) => {
      try {
        const state = agentManager.getState(agentId);
        if (state) {
          state.role = role;
          socket.emit("agent:ready", { agentId: state.id, role: state.role, mode: state.mode });
          console.log(`[Server] Updated role for ${agentId} to ${role}`);
        }
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:message", async ({ agentId, message }) => {
      try {
        await agentManager.handleUserMessage(agentId, message, socket);
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:approval_response", async ({ agentId, approved }) => {
      try {
        await agentManager.handleApproval(agentId, approved, socket);
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:reset", async ({ agentId }) => {
      try {
        await agentManager.resetAgent(agentId, socket);
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:toggle_simulation", async ({ agentId, enabled }) => {
      try {
        await agentManager.toggleSimulation(agentId, enabled);
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:update_tokens", async ({ agentId, tokens }) => {
      try {
        await agentManager.updateTokens(agentId, tokens);
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("agent:set_mode", async ({ agentId, mode }) => {
      try {
        await agentManager.setMode(agentId, mode);
        socket.emit("agent:mode_updated", { agentId, mode });
      } catch (error: any) {
        socket.emit("agent:error", { error: error.message });
      }
    });

    socket.on("workspace:upload_files", async ({ agentId, files }) => {
      try {
        await agentManager.handleFilesUpload(agentId, files, socket);
      } catch (error: any) {
        socket.emit("agent:error", { error: `Failed to upload files: ${error.message}` });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
