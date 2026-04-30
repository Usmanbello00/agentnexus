import { v4 as uuidv4 } from "uuid";
import { ToolRegistry, UserRole } from "../tools/registry.js";
import { getReasoning } from "../services/llm.js";
import path from "path";
import fs from "fs-extra";

export type PlatformMode = "nexus" | "estate";

export interface AgentState {
  id: string;
  userId: string;
  role: UserRole;
  mode: PlatformMode;
  status: "idle" | "thinking" | "executing" | "awaiting_approval" | "completed" | "error";
  history: any[];
  currentTask?: string;
  workspacePath: string;
  tokens: Record<string, string>;
  simulationMode: boolean;
  pendingApproval?: {
    id: string;
    toolName: string;
    args: any;
  };
}

export class AgentManager {
  private states: Map<string, AgentState> = new Map();
  private toolRegistry: ToolRegistry;
  private baseWorkspacePath: string;

  constructor(toolRegistry: ToolRegistry) {
    this.toolRegistry = toolRegistry;
    this.baseWorkspacePath = path.join(process.cwd(), "workspaces");
    fs.ensureDirSync(this.baseWorkspacePath);
  }

  private async getAllFiles(dir: string, basePath: string = ''): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    let files: string[] = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.nexus')) continue; // Skip state files
      const relPath = path.join(basePath, entry.name);
      if (entry.isDirectory()) {
        files = files.concat(await this.getAllFiles(path.join(dir, entry.name), relPath));
      } else {
        files.push(relPath);
      }
    }
    return files;
  }

  async createAgent(userId: string, socket: any, role: UserRole = "developer"): Promise<AgentState> {
    const id = uuidv4();
    const workspacePath = path.join(this.baseWorkspacePath, userId);
    await fs.ensureDir(workspacePath);

    const state: AgentState = {
      id,
      userId,
      role,
      mode: "nexus",
      status: "idle",
      history: [],
      workspacePath,
      tokens: {
        github: "ghp_mock_token_123",
        slack: "xoxb-mock-token-456",
        cicd: "cicd_mock_token_789",
        whatsapp: "mock_whatsapp_key_000",
        teams: "mock_teams_token_111"
      },
      simulationMode: false,
    };
    this.states.set(id, state);
    
    // Initial workspace scan
    const files = await this.getAllFiles(workspacePath);
    socket.emit("workspace:files", { agentId: id, files });

    return state;
  }

  getState(agentId: string) {
    return this.states.get(agentId);
  }

  async handleUserMessage(agentId: string, message: string, socket: any) {
    console.log(`[AgentManager] Handling message for ${agentId}: ${message}`);
    const state = this.states.get(agentId);
    if (!state) {
      console.error(`[AgentManager] Agent ${agentId} not found`);
      throw new Error("Agent session expired. Please refresh the page to reconnect.");
    }

    state.currentTask = message;
    state.status = "thinking";
    state.history.push({ role: "user", content: message });

    await this.runReasoningLoop(state, socket);
  }

  async handleFilesUpload(agentId: string, files: { path: string, base64Content: string }[], socket: any) {
    const state = this.states.get(agentId);
    if (!state) {
      throw new Error("Agent session expired. Please refresh the page to reconnect.");
    }
    
    for (const file of files) {
      const fullPath = path.join(state.workspacePath, file.path);
      await fs.ensureDir(path.dirname(fullPath));
      await fs.writeFile(fullPath, Buffer.from(file.base64Content, 'base64'));
    }
    
    const workspaceFiles = await this.getAllFiles(state.workspacePath);
    socket.emit("workspace:files", { agentId, files: workspaceFiles });
    
    await this.handleUserMessage(agentId, `[SYSTEM] User uploaded ${files.length} file(s).`, socket);
  }

  async resetAgent(agentId: string, socket: any) {
    const state = this.states.get(agentId);
    if (!state) return;

    state.history = [];
    state.status = "idle";
    state.currentTask = undefined;
    state.pendingApproval = undefined;
    
    socket.emit("agent:status", { agentId: state.id, status: state.status });
    socket.emit("agent:ready", { agentId: state.id });
  }

  async toggleSimulation(agentId: string, enabled: boolean) {
    const state = this.states.get(agentId);
    if (state) {
      state.simulationMode = enabled;
    }
  }

  private async runReasoningLoop(state: AgentState, socket: any) {
    try {
      console.log(`[AgentManager] Starting reasoning loop for ${state.id} (Simulation: ${state.simulationMode})`);
      state.status = "thinking";
      socket.emit("agent:status", { agentId: state.id, status: state.status });

      let result;
      if (state.simulationMode) {
        result = await this.getSimulatedReasoning(state);
      } else {
        result = await getReasoning(
          state.history,
          this.toolRegistry.getToolDeclarations(state.mode),
          state.role,
          state.mode
        );
      }

      console.log(`[AgentManager] Reasoning result for ${state.id}:`, JSON.stringify(result).substring(0, 100) + "...");
      await this.handleReasoningResult(state, result, socket);
    } catch (error: any) {
      console.error(`[AgentManager] Error in reasoning loop for ${state.id}:`, error);
      state.status = "error";
      socket.emit("agent:error", { agentId: state.id, error: error.message });
      // Ensure the UI doesn't hang in thinking state
      state.status = "idle";
      socket.emit("agent:status", { agentId: state.id, status: state.status });
    }
  }

  private async getSimulatedReasoning(state: AgentState) {
    // Artificial delay to simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lastMessage = state.history[state.history.length - 1];
    
    // If the last message was a tool result, we should finish the task
    if (lastMessage.role === "tool") {
      return {
        text: "I've completed the task for you in simulation mode.",
        toolCalls: []
      };
    }

    const text = lastMessage.content?.toLowerCase() || "";

    // Simple keyword-based simulation
    if (text.includes("weather")) {
      return {
        toolCalls: [{ name: "get_weather", args: { location: "London" } }],
        text: "I'll check the weather for you."
      };
    }
    if (text.includes("list") || text.includes("files")) {
      return {
        toolCalls: [{ name: "list_files", args: { pattern: "**/*" } }],
        text: "Listing files in your workspace..."
      };
    }
    if (text.includes("python") || (text.includes("create") && text.includes("file"))) {
      const isPython = text.includes("python");
      return {
        toolCalls: [{ 
          name: "write_file", 
          args: { 
            filePath: isPython ? "word_count.py" : "simulated.md", 
            content: isPython ? "import sys\n\ndef count_words(filename):\n    with open(filename, 'r') as f:\n        return len(f.read().split())\n\nif __name__ == '__main__':\n    print(count_words(sys.argv[1]))" : "This is a simulated file." 
          } 
        }],
        text: isPython ? "I've drafted a Python script to count words. I'll save it to word_count.py." : "Creating a simulated file for you."
      };
    }
    if (text.includes("github")) {
      return {
        toolCalls: [{ name: "github_create_issue", args: { repo: "nexus/core", title: "Simulated Issue", body: "This is a simulation." } }],
        text: "Creating a GitHub issue..."
      };
    }

    return {
      text: "I am currently in Simulation Mode. I can help you with weather, files, and GitHub tasks using mock data.",
      toolCalls: []
    };
  }

  private async handleReasoningResult(state: AgentState, result: any, socket: any) {
    if (!result) {
      console.error(`[AgentManager] No result from reasoning for ${state.id}`);
      throw new Error("No response from AI service");
    }

    if (result.toolCalls && result.toolCalls.length > 0) {
      state.status = "executing";
      socket.emit("agent:status", { agentId: state.id, status: state.status });

      // Add the assistant's tool call request to history
      this.addHistory(state, {
        role: "assistant",
        content: result.text || "",
        toolCalls: result.toolCalls
      });

      for (const call of result.toolCalls) {
        const tool = this.toolRegistry.getTool(call.name);
        if (!tool) {
          this.addHistory(state, { role: "tool", toolName: call.name, content: `Error: Tool ${call.name} not found` });
          continue;
        }

        // RBAC Check
        if (tool.requiredRole && !this.hasPermission(state.role, tool.requiredRole)) {
          this.addHistory(state, { role: "tool", toolName: call.name, content: `Error: Permission denied. Required role: ${tool.requiredRole}` });
          continue;
        }

        if (tool.requiresApproval && !state.simulationMode) {
          state.status = "awaiting_approval";
          state.pendingApproval = {
            id: uuidv4(),
            toolName: call.name,
            args: call.args,
          };
          socket.emit("agent:status", { agentId: state.id, status: state.status });
          socket.emit("agent:approval_required", {
            agentId: state.id,
            approval: state.pendingApproval,
          });
          return; // Stop execution until approved
        }

        await this.executeTool(state, tool, call.args, socket);
      }
      
      // After tools are executed, request next reasoning step
      await this.runReasoningLoop(state, socket);
    } else {
      state.status = "completed";
      this.addHistory(state, { role: "assistant", content: result.text });
      socket.emit("agent:status", { agentId: state.id, status: state.status });
      socket.emit("agent:completed", { agentId: state.id, result: result.text });
    }
  }

  private hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    const roles: UserRole[] = ["viewer", "developer", "admin"];
    return roles.indexOf(userRole) >= roles.indexOf(requiredRole);
  }

  async handleApproval(agentId: string, approved: boolean, socket: any) {
    const state = this.states.get(agentId);
    if (!state || !state.pendingApproval) return;

    const { toolName, args } = state.pendingApproval;
    state.pendingApproval = undefined;

    if (approved) {
      state.status = "executing";
      const tool = this.toolRegistry.getTool(toolName);
      if (tool) {
        await this.executeTool(state, tool, args, socket);
      }
      await this.runReasoningLoop(state, socket);
    } else {
      this.addHistory(state, { role: "tool", toolName, content: "Error: User rejected tool execution." });
      await this.runReasoningLoop(state, socket);
    }
  }

  private async executeTool(state: AgentState, tool: any, args: any, socket: any) {
    try {
      socket.emit("agent:tool_start", { agentId: state.id, toolName: tool.name, args });
      const result = await tool.execute(args, {
        userId: state.userId,
        workspacePath: state.workspacePath,
        socket,
        role: state.role,
        tokens: state.tokens,
      });
      this.addHistory(state, { role: "tool", toolName: tool.name, content: JSON.stringify(result) });
      socket.emit("agent:tool_end", { agentId: state.id, toolName: tool.name, result });
      
      // If it was a file tool, refresh workspace files
      if (tool.category === "file" || tool.name.includes("file")) {
        const files = await this.getAllFiles(state.workspacePath);
        socket.emit("workspace:files", { agentId: state.id, files });
      }
    } catch (error: any) {
      this.addHistory(state, { role: "tool", toolName: tool.name, content: `Error: ${error.message}` });
      socket.emit("agent:tool_error", { agentId: state.id, toolName: tool.name, error: error.message });
    }
  }

  private addHistory(state: AgentState, message: any) {
    state.history.push(message);
    this.autoSaveState(state);
  }

  private autoSaveState(state: AgentState) {
    try {
      const statePath = path.join(state.workspacePath, ".nexus_state.json");
      fs.writeFileSync(statePath, JSON.stringify(state.history, null, 2));
    } catch (e) {
      console.error(`[AgentManager] Failed to auto-save state for ${state.id}:`, e);
    }
  }

  async updateTokens(agentId: string, tokens: Record<string, string>) {
    const state = this.states.get(agentId);
    if (state) {
      console.log(`[AgentManager] Updated integration tokens for ${agentId}`);
      state.tokens = tokens;
    }
  }

  async setMode(agentId: string, mode: PlatformMode) {
    const state = this.states.get(agentId);
    if (state) {
      console.log(`[AgentManager] Switching mode for ${agentId} to ${mode}`);
      state.mode = mode;
      // We don't clear history here so the agent knows what just happened, 
      // but the next reasoning step will use the new system instructions.
    }
  }
}
