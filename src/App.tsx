import React, { useState, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { Send, Bot, User, Settings, Terminal, CheckCircle, AlertCircle, Loader2, FileText, Shield, Play, RefreshCw, Layers, X, Download, Upload, FolderPlus, ChevronDown, Menu, Moon, Sun, Info, Calendar, Home, TrendingUp, Activity, Mail, ShieldCheck, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import ReactMarkdown from "react-markdown";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { AdminDashboard } from './components/AdminDashboard';
import { LiveOpsFeed } from './components/LiveOpsFeed';

interface Message {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  toolName?: string;
  status?: "pending" | "success" | "error";
  toolResult?: any;
}

type PlatformMode = "nexus" | "estate";

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("idle");
  const [role, setRole] = useState<"admin" | "developer" | "viewer">("developer");
  const [mode, setMode] = useState<PlatformMode>("nexus");
  const [files, setFiles] = useState<string[]>([]);
  const [pendingApproval, setPendingApproval] = useState<any>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showArch, setShowArch] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [simulationMode, setSimulationMode] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showPrompts, setShowPrompts] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [notifications, setNotifications] = useState<{ id: string, message: string, type: "info" | "success" | "error" }[]>([]);
  const [tokens, setTokens] = useState({ github: "", slack: "", cicd: "", weather: "", whatsapp: "", teams: "" });
  const [currentWay, setCurrentWay] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const [pendingUpload, setPendingUpload] = useState<{ file: File, base64: string } | null>(null);
  const [processedResults, setProcessedResults] = useState<{ id: number, toolName: string, result: any, timestamp: Date }[]>([]);
  const [showResultsPanel, setShowResultsPanel] = useState(true);
  const [autonomousMode, setAutonomousMode] = useState(true);
  const [autonomousEvents, setAutonomousEvents] = useState<{ id: string, type: 'ticket' | 'email' | 'system', title: string, description: string, status: 'processing' | 'completed' | 'failed', timestamp: Date }[]>([]);
  const autonomousIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const addAutonomousEvent = (type: 'ticket' | 'email' | 'system', title: string, description: string, status: 'processing' | 'completed' | 'failed' = 'processing') => {
    const id = Math.random().toString(36).substring(7);
    setAutonomousEvents(prev => [{ id, type, title, description, status, timestamp: new Date() }, ...prev]);
    return id;
  };

  const updateAutonomousEvent = (id: string, status: 'processing' | 'completed' | 'failed', description?: string) => {
    setAutonomousEvents(prev => prev.map(e => e.id === id ? { ...e, status, description: description || e.description } : e));
  };

  const processNextTicketSequentially = async () => {
    if (!agentId || mode !== 'estate') return;
    
    try {
      // 1. Fetch tickets
      const res = await fetch('/api/estate/tickets');
      if (!res.ok) return;
      const data = await res.json();
      const openTickets = Array.isArray(data) ? data : (data.tickets || []);
      
      // Filter for truly new/open ones that aren't being processed
      const nextTicket = openTickets.find((t: any) => t.status === 'Open' || t.status === 'New');
      
      if (nextTicket) {
        const eventId = addAutonomousEvent('ticket', `Ticket #${nextTicket.id}: ${nextTicket.subject}`, `Autonomously analyzing ticket from ${nextTicket.contact_email}...`);
        
        // 2. Instruct Agent
        const command = `AUTONOMOUS ACTION: Resolve Zoho Ticket #${nextTicket.id} (Subject: ${nextTicket.subject}). 
        1. Link to property/tenant records.
        2. Diagnosis issue.
        3. Draft resolution or reply.
        4. Update ticket status to 'Investigating'.`;
        
        socketRef.current?.emit("agent:message", { agentId, message: command });
        
        // We'll mark it as completed once agent finishes (this is tricky with just socket events)
        // For now we'll rely on the agent completing the task
      }
    } catch (error) {
      console.error("Autonomous processing error:", error);
    }
  };

  useEffect(() => {
    if (autonomousMode && mode === 'estate') {
      addNotification("Autonomous Ticket Resolution Engine activated", "success");
      addAutonomousEvent('system', "System Active", "EstateNexus Autonomous Resolution Engine is now monitoring for new requests.");
      
      autonomousIntervalRef.current = setInterval(() => {
        if (status === 'idle') {
          processNextTicketSequentially();
        }
      }, 30000); // Poll every 30s
    } else {
      if (autonomousIntervalRef.current) clearInterval(autonomousIntervalRef.current);
    }
    return () => { if (autonomousIntervalRef.current) clearInterval(autonomousIntervalRef.current); };
  }, [autonomousMode, agentId, mode, status]);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [resultsFilter, setResultsFilter] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<{ name: string, content: string, isImage: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const addNotification = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).substring(7);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  useEffect(() => {
    const socket = io({
      transports: ["polling", "websocket"]
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Connected to server");
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("Disconnected from server");
      setIsConnected(false);
    });

    socket.on("agent:ready", ({ agentId, role: serverRole, mode: serverMode }) => {
      setAgentId(agentId);
      if (serverRole) setRole(serverRole);
      if (serverMode) setMode(serverMode);
      setMessages([{ role: "system", content: `${serverMode === 'estate' ? 'EstateNexus: Enterprise Help Desk' : 'Nexus Agent Platform'} initialized. Connected as ${serverRole || role}.` }]);
      addNotification("Agent initialized successfully", "success");
    });

    socket.on("agent:status", ({ status }) => {
      setStatus(status);
      if (status === "thinking") setActiveStep(1);
      else if (status === "executing") setActiveStep(3);
      else if (status === "completed") setActiveStep(5);
      else if (status === "idle") setActiveStep(null);
    });

    socket.on("agent:mode_updated", ({ mode: serverMode }) => {
      setMode(serverMode);
      addNotification(`Platform transformed to ${serverMode === 'estate' ? 'EstateNexus' : 'Nexus Platform'} mode`, "success");
    });

    socket.on("agent:error", ({ error }) => {
      setStatus("error");
      setMessages(prev => [...prev, { role: "system", content: `Agent Error: ${error}`, status: "error" }]);
      addNotification(error, "error");
    });

    socket.on("workspace:files", ({ files }) => {
      setFiles(files);
    });

    socket.on("agent:tool_start", ({ toolName, args }) => {
      setActiveStep(3);
      setMessages(prev => [...prev, { role: "tool", content: `Executing ${toolName}...`, toolName, status: "pending" }]);
    });

    socket.on("agent:tool_end", ({ toolName, result }) => {
      setActiveStep(4);
      setProcessedResults(prev => [...prev, { id: Date.now(), toolName, result, timestamp: new Date() }]);
      
      // Update autonomous event if it matches a tool action
      if (toolName === 'send_zoho_reply' || toolName === 'create_zoho_comment') {
        setAutonomousEvents(prevEvents => {
          const lastEvent = prevEvents.find(e => e.status === 'processing');
          if (lastEvent) {
            return prevEvents.map(e => e.id === lastEvent.id ? { ...e, description: `Communication dispatched: ${toolName === 'send_zoho_reply' ? 'Reply sent to customer' : 'Internal note added'}.` } : e);
          }
          return prevEvents;
        });
      }

      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last.role === "tool" && last.toolName === toolName) {
          return [...prev.slice(0, -1), { 
            ...last, 
            content: typeof result === 'string' ? result : JSON.stringify(result, null, 2), 
            toolResult: result,
            status: "success" 
          }];
        }
        return prev;
      });
    });

    socket.on("agent:approval_required", ({ approval }) => {
      setPendingApproval(approval);
    });

    socket.on("agent:completed", ({ result }) => {
      setActiveStep(5);
      
      // Complete current autonomous event
      setAutonomousEvents(prevEvents => {
        const activeEvent = prevEvents.find(e => e.status === 'processing');
        if (activeEvent) {
          return prevEvents.map(e => e.id === activeEvent.id ? { ...e, status: 'completed', description: result.substring(0, 150) + (result.length > 150 ? '...' : '') } : e);
        }
        return prevEvents;
      });

      setMessages(prev => [...prev, { role: "assistant", content: result }]);
      addNotification("Agent completed task", "success");
    });

    return () => {
      socket.disconnect();
    };
  }, [role]);

  const initAgent = (selectedRole: typeof role) => {
    setRole(selectedRole);
    if (agentId) {
      socketRef.current?.emit("agent:update_role", { agentId, role: selectedRole });
      addNotification(`Switching to ${selectedRole} role`, "info");
    } else {
      socketRef.current?.emit("agent:init", { userId: "user-" + socketRef.current.id, role: selectedRole });
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || !agentId) return;
    const msg = input.trim();
    console.log(`[Client] Sending message to agent ${agentId}: ${msg}`);
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    socketRef.current?.emit("agent:message", { agentId, message: msg });
    setInput("");
  };

  const handleApproval = (approved: boolean) => {
    if (!agentId || !pendingApproval) return;
    socketRef.current?.emit("agent:approval_response", { agentId, approved });
    setPendingApproval(null);
  };

  const handleReset = () => {
    if (!agentId) return;
    socketRef.current?.emit("agent:reset", { agentId });
    setActiveStep(null);
    setMessages([{ role: "system", content: `${mode === 'estate' ? 'EstateNexus: Enterprise Help Desk' : 'Nexus Agent Platform'} reset. Connected as ${role}.` }]);
  };

  const switchMode = (newMode: PlatformMode) => {
    if (!agentId || mode === newMode) return;
    setMode(newMode);
    socketRef.current?.emit("agent:set_mode", { agentId, mode: newMode });
    addNotification(`Switching to ${newMode === 'estate' ? 'EstateNexus' : 'Nexus Platform'} mode`, "info");
    setMessages(prev => [...prev, { role: "system", content: `System mode switched to ${newMode.toUpperCase()}. Applying specialized reasoning logic.` }]);
  };

  const saveTokens = () => {
    if (!agentId) return;
    socketRef.current?.emit("agent:update_tokens", { agentId, tokens });
    addNotification("Integration tokens updated", "success");
    setShowSettings(false);
  };

  const openFile = async (fileName: string) => {
    try {
      const res = await fetch(`/api/workspace/file?agentId=${agentId}&file=${encodeURIComponent(fileName)}`);
      if (res.ok) {
        const contentType = res.headers.get('content-type');
        const isImage = contentType?.startsWith('image/') || false;
        
        if (isImage) {
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          setSelectedFile({ name: fileName, content: url, isImage: true });
        } else {
          const text = await res.text();
          setSelectedFile({ name: fileName, content: text, isImage: false });
        }
      } else {
        addNotification("Failed to open file", "error");
      }
    } catch (e) {
      addNotification("Error opening file", "error");
    }
  };

  const toggleSimulation = () => {
    if (!agentId) return;
    const newState = !simulationMode;
    setSimulationMode(newState);
    socketRef.current?.emit("agent:toggle_simulation", { agentId, enabled: newState });
  };

  const modeConfig = {
    nexus: {
      name: "Nexus Agent Platform",
      prompts: [
        { icon: <Bot size={14} />, text: "What can you do?", category: "General" },
        { icon: <Bot size={14} />, text: "Spawn a sub-agent to research AI trends", category: "Sub-Agents" },
        { icon: <Bot size={14} />, text: "What's the weather in London?", category: "Weather" },
        { icon: <FileText size={14} />, text: "List all files in my workspace", category: "Files" },
        { icon: <Terminal size={14} />, text: "Create a file named 'notes.md' with 'Nexus is awesome'", category: "Files" },
        { icon: <Shield size={14} />, text: "Create a GitHub issue for a UI bug", category: "GitHub" },
        { icon: <Send size={14} />, text: "Send a Slack message to #general", category: "Slack" },
        { icon: <Settings size={14} />, text: "Trigger the main deployment pipeline", category: "CI/CD" },
        { icon: <Terminal size={14} />, text: "Create a Python script that counts words in a file", category: "Python" },
        { icon: <Layers size={14} />, text: "Write a plan for building a REST API in Node.js", category: "Architecture" },
        { icon: <FileText size={14} />, text: "Draft a summary report of today's tasks", category: "Reporting" },
      ],
      ways: [
        { title: "Agent Harness", desc: "Advanced planning layer using Deep Agent patterns for complex task scaffolding and reasoning.", icon: <Bot size={14} /> },
        { title: "Tool Runtime", desc: "Secure execution environment for robust tool management and safety.", icon: <Terminal size={14} /> },
        { title: "Identity Scoping", desc: "Multi-user isolation ensuring all external actions are securely scoped to your unique identity.", icon: <Shield size={14} /> },
        { title: "External Fabric", desc: "Unified integration layer connecting GitHub, Slack, and CI/CD with enterprise-grade auth.", icon: <Layers size={14} /> },
      ],
      nodes: [
        { id: "user", title: "User", subtitle: "Client Interface", icon: <User size={16} />, desc: "The end-user interacting with the Nexus platform." },
        { id: "harness", title: "Agent Harness", subtitle: "LangChain / Deep Agents", icon: <Bot size={16} />, desc: "Scaffolding around the LLM. Handles planning, file system tools, and sub-agents." },
        { id: "llm", title: "LLM Core", subtitle: "Azure OpenAI / GPT-4 / Gemini / Claude", icon: <Layers size={16} />, desc: "The reasoning engine. Supports Azure OpenAI (gpt-4.1), GPT-4, Gemini, and Claude with automatic fallback." },
        { id: "fs", title: "File System", subtitle: "Real or Virtual (DB-backed)", icon: <FileText size={16} />, desc: "Secure workspace for the agent to read and write code." },
        { id: "memory", title: "Memory Service", subtitle: "Per-user scoped", icon: <RefreshCw size={16} />, desc: "Long-term and short-term memory layer for conversation context." },
        { id: "runtime", title: "Tool Runtime", subtitle: "Arcade.dev", icon: <Terminal size={16} />, desc: "Secure execution environment for tools and integrations." },
        { id: "external", title: "External Tools", subtitle: "Gmail, GCal, GitHub…", icon: <Shield size={16} />, desc: "Unified integration layer connecting to GitHub, Slack, etc." },
      ]
    },
    estate: {
      name: "EstateNexus: Enterprise Help Desk",
      prompts: [
        { icon: <Bot size={14} />, text: "What can you do?", category: "General" },
        { icon: <Bot size={14} />, text: "Get details for 123 Maple St", category: "Property" },
        { icon: <Shield size={14} />, text: "Schedule plumbing maintenance for Oak Ave", category: "Maintenance" },
        { icon: <User size={14} />, text: "Record a tenant noise complaint at Maple St", category: "Service Desk" },
        { icon: <Layers size={14} />, text: "Analyze market trends for Springfield", category: "Market Analysis" },
        { icon: <Bot size={14} />, text: "Check current vacancy status for all properties", category: "Operations" },
        { icon: <Send size={14} />, text: "Notify tenant about tomorrow's inspection", category: "Communication" },
        { icon: <FileText size={14} />, text: "Check inbox and process new tenant emails", category: "Email Management" },
        { icon: <Settings size={14} />, text: "Draft a quarterly maintenance summary and email to owner", category: "Reporting" },
        { icon: <Bot size={14} />, text: "How can I improve tenant satisfaction scores?", category: "Strategy" },
      ],
      ways: [
        { title: "Specialized Real Estate Reasoning", desc: "Advanced agentic flows specialized in handling property data, tenant relations, and maintenance logic.", icon: <Bot size={14} /> },
        { title: "Managed Maintenance Runtime", desc: "Secure execution environment for scheduling repairs and managing service vendors.", icon: <Terminal size={14} /> },
        { title: "Tenant Identity Scoping", desc: "Strict data isolation ensuring tenant inquiries and sensitive lease data are handled securely.", icon: <Shield size={14} /> },
        { title: "Property Integration Fabric", desc: "Unified layer connecting property databases, IoT sensors, and communication tools.", icon: <Layers size={14} /> },
      ],
      nodes: [
        { id: "user", title: "Tenant/Manager", subtitle: "Help Desk Interface", icon: <User size={16} />, desc: "The end-user (tenant or property manager) interacting with the help desk." },
        { id: "harness", title: "Real Estate Harness", subtitle: "Agentic Logic Layer", icon: <Bot size={16} />, desc: "The brain of the system. Manages maintenance planning, property inquiries, and escalations." },
        { id: "llm", title: "Domain LLM Core", subtitle: "Specialized Reasoning", icon: <Layers size={16} />, desc: "The reasoning engine trained/prompted for real estate domain knowledge and customer service etiquette." },
        { id: "fs", title: "Property Ledger", subtitle: "Digital Workspace", icon: <FileText size={16} />, desc: "Secure workspace where the agent generates reports, drafts notices, and logs maintenance history." },
        { id: "memory", title: "Interaction Memory", subtitle: "Conversation context", icon: <RefreshCw size={16} />, desc: "Contextual memory layer for tracking ongoing tenant issues and property history." },
        { id: "runtime", title: "Service Runtime", subtitle: "Tool Execution", icon: <Terminal size={16} />, desc: "Safe environment for executing actions like alerting contractors or updating property status." },
        { id: "external", title: "Asset Ecosystem", subtitle: "CRMs, IoT, Email, Messaging", icon: <Shield size={16} />, desc: "Connections to Property Management Systems (PMS), IoT sensors, Email Gateways, and notification channels." },
      ]
    }
  };

  const examplePrompts = modeConfig[mode].prompts;

  const handleExampleClick = (promptText: string) => {
    if (!agentId) return;
    setActiveStep(0);
    setMessages(prev => [...prev, { role: "user", content: promptText }]);
    socketRef.current?.emit("agent:message", { agentId, message: promptText });
  };

  const getPropertyDetails = (propertyId: string) => {
    if (!agentId) return;
    setActiveStep(0);
    const msg = `Get property details for ${propertyId}`;
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    socketRef.current?.emit("agent:message", { agentId, message: msg });
  };

  useEffect(() => {
    if (agentId && socketRef.current) {
      socketRef.current.emit("agent:update_tokens", { agentId, tokens });
    }
  }, [tokens, agentId]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentWay(prev => (prev + 1) % 4);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  const architectureWays = modeConfig[mode].ways;

  const agentSteps = [
    { id: 0, label: "Receive Task", desc: "User submits task. Harness sets up workspace." },
    { id: 1, label: "Plan", desc: "LLM reasons about the task and determines strategy." },
    { id: 2, label: "Select Tool", desc: "Agent chooses the most appropriate tool." },
    { id: 3, label: "Execute Tool", desc: "Secure runtime executes the tool in sandbox." },
    { id: 4, label: "Check State", desc: "Agent observes results and updates internal state." },
    { id: 5, label: "Return Result", desc: "Final response is delivered to the user." },
  ];

  const architectureNodes = modeConfig[mode].nodes;

  if (!agentId) {
    return (
      <div className={`h-screen flex items-center justify-center p-6 transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`max-w-md w-full border rounded-3xl p-8 space-y-8 text-center shadow-2xl ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
        >
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/20">
            <Bot size={32} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Nexus Multi-Agent Portal</h1>
            <p className={`text-sm ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>General Purpose & Specialized Help Desk Solutions</p>
          </div>
          <div className="grid gap-3">
            {(["admin", "developer", "viewer"] as const).map((r) => (
              <button
                key={r}
                onClick={() => initAgent(r)}
                className={`w-full py-4 rounded-2xl border transition-all text-sm font-bold uppercase tracking-widest flex items-center justify-center gap-3 ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20' 
                    : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                }`}
              >
                {r === 'admin' && <Shield size={16} className="text-red-500" />}
                {r === 'developer' && <Terminal size={16} className="text-blue-500" />}
                {r === 'viewer' && <FileText size={16} className="text-green-500" />}
                {r}
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen font-sans overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      
      {/* Notifications */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {notifications.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`p-4 rounded-xl shadow-lg border flex items-center gap-3 min-w-[300px] ${
                theme === 'dark' ? 'bg-[#1a1a1a] border-white/10' : 'bg-white border-gray-200'
              }`}
            >
              {n.type === 'success' && <CheckCircle size={18} className="text-green-500" />}
              {n.type === 'error' && <AlertCircle size={18} className="text-red-500" />}
              {n.type === 'info' && <Bot size={18} className="text-blue-500" />}
              <span className="text-sm font-medium">{n.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Sidebar */}
      <div className={`w-64 border-r flex flex-col ${theme === 'dark' ? 'border-white/10 bg-[#0f0f0f]' : 'border-gray-200 bg-white'}`}>
        <div className={`p-6 border-b flex items-center gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Bot size={20} />
          </div>
          <h1 className="font-bold text-lg tracking-tight">{mode === 'estate' ? 'ESTATENEXUS' : 'NEXUS'}</h1>
        </div>
        
          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            <div className="space-y-2">
              <div className={`text-[10px] uppercase tracking-widest font-bold mb-4 flex justify-between items-center ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>
                <span>Workspace</span>
                <div className="flex items-center gap-1">
                  <button 
                    title="Upload Files"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      input.onchange = async (e: any) => {
                        const files = Array.from(e.target.files) as File[];
                        if (files.length > 0) {
                          const fileData = await Promise.all(files.map(file => {
                            return new Promise<{ path: string, base64Content: string }>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = (re) => {
                                const base64 = (re.target?.result as string).split(',')[1];
                                resolve({ path: file.name, base64Content: base64 });
                              };
                              reader.readAsDataURL(file);
                            });
                          }));
                          
                          socketRef.current?.emit("workspace:upload_files", { 
                            agentId, 
                            files: fileData
                          });
                          addNotification(`Uploading ${files.length} file(s)...`, "info");
                        }
                      };
                      input.click();
                    }}
                    className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                  >
                    <Upload size={12} className="text-blue-400" />
                  </button>
                  <button 
                    title="Upload Folder"
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.multiple = true;
                      // @ts-ignore
                      input.webkitdirectory = true;
                      input.onchange = async (e: any) => {
                        const files = Array.from(e.target.files) as File[];
                        if (files.length > 0) {
                          const fileData = await Promise.all(files.map(file => {
                            return new Promise<{ path: string, base64Content: string }>((resolve) => {
                              const reader = new FileReader();
                              reader.onload = (re) => {
                                const base64 = (re.target?.result as string).split(',')[1];
                                // @ts-ignore
                                const path = file.webkitRelativePath || file.name;
                                resolve({ path, base64Content: base64 });
                              };
                              reader.readAsDataURL(file);
                            });
                          }));
                          
                          socketRef.current?.emit("workspace:upload_files", { 
                            agentId, 
                            files: fileData
                          });
                          addNotification(`Uploading folder with ${files.length} files...`, "info");
                        }
                      };
                      input.click();
                    }}
                    className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                  >
                    <FolderPlus size={12} className="text-blue-400" />
                  </button>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${theme === 'dark' ? 'bg-white/5 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>{role}</span>
                </div>
              </div>
              {files.length === 0 ? (
                <div className={`text-xs p-2 italic ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>No files in workspace</div>
              ) : (
                files.map(file => (
                  <div 
                    key={file} 
                    className={`flex items-center justify-between p-2 rounded-md cursor-pointer text-sm group ${theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700'}`}
                    onClick={() => openFile(file)}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText size={16} className="text-blue-400/60 shrink-0" />
                      <span className="truncate" title={file}>{file}</span>
                    </div>
                    <a 
                      href={`/api/workspace/file?agentId=${agentId}&file=${encodeURIComponent(file)}`}
                      download={file.split('/').pop()}
                      onClick={(e) => e.stopPropagation()}
                      className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-200 text-gray-600'}`}
                      title="Download"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                ))
              )}
            </div>

            <div className={`space-y-4 pt-4 border-t ${theme === 'dark' ? 'border-white/5' : 'border-gray-100'}`}>
              <button 
                onClick={() => setShowResultsPanel(!showResultsPanel)}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all border ${
                  showResultsPanel 
                    ? 'bg-blue-600 border-blue-500 text-white shadow-lg' 
                    : (theme === 'dark' ? 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200')
                }`}
              >
                <div className="flex items-center gap-3">
                  <Activity size={16} />
                  <span className="text-xs font-bold uppercase tracking-widest">Live Ops Center</span>
                </div>
                {autonomousMode && <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />}
              </button>
            </div>
              <div className="space-y-3">
                {agentSteps.map((step, i) => (
                  <div key={i} className="relative pl-6">
                    {i !== agentSteps.length - 1 && (
                      <div className={`absolute left-[7px] top-4 bottom-[-12px] w-[1px] ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-200'}`} />
                    )}
                    <div className={`absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2 transition-all duration-500 ${
                      activeStep === i ? 'bg-blue-500 border-blue-500 scale-110 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 
                      (activeStep !== null && activeStep > i) ? 'bg-green-500 border-green-500' : (theme === 'dark' ? 'bg-transparent border-white/10' : 'bg-transparent border-gray-300')
                    }`} />
                    <div className="space-y-0.5">
                      <div className={`text-[11px] font-bold transition-colors ${activeStep === i ? 'text-blue-500' : (theme === 'dark' ? 'text-white/40' : 'text-gray-400')}`}>
                        {i + 1}. {step.label}
                      </div>
                      {activeStep === i && (
                        <motion.div 
                          initial={{ opacity: 0, x: -5 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={`text-[9px] leading-tight ${theme === 'dark' ? 'text-white/30' : 'text-gray-500'}`}
                        >
                          {step.desc}
                        </motion.div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {status === 'idle' && messages.length > 1 && (
                <button 
                  onClick={() => setActiveStep(0)}
                  className={`w-full py-2 rounded-lg border text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                    theme === 'dark' 
                      ? 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white' 
                      : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Play size={10} />
                  Replay Loop
                </button>
              )}
            </div>

        <div className={`p-4 border-t ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3 p-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-100'}`}>
              <User size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium truncate">husmanbell@gmail.com</div>
              <div className={`text-[10px] uppercase tracking-tighter ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{role} Access</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col relative">
        {/* Architecture Banner - Moved to top of main content area */}
        <div className={`border-b px-6 py-1.5 h-8 flex items-center justify-center overflow-hidden transition-colors ${theme === 'dark' ? 'bg-blue-600/10 border-blue-500/20' : 'bg-blue-50 border-blue-100'}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentWay}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className={`${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'} flex items-center gap-2`}>
                {architectureWays[currentWay].icon}
                <span className="text-[9px] font-bold uppercase tracking-widest">{architectureWays[currentWay].title}:</span>
              </div>
              <p className={`text-[10px] font-medium ${theme === 'dark' ? 'text-blue-400/80' : 'text-blue-700'}`}>
                {architectureWays[currentWay].desc}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Header */}
        <div className={`h-16 border-b flex items-center justify-between px-6 backdrop-blur-md z-30 ${theme === 'dark' ? 'border-white/10 bg-[#0a0a0a]/80' : 'border-gray-200 bg-gray-50/80'}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-gray-600'}`}>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div className={`w-[1px] h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-300'}`} />
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${status === 'idle' ? 'bg-blue-500' : 'bg-yellow-500 animate-pulse'}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-gray-600'}`}>{status}</span>
            </div>
            <div className={`w-[1px] h-4 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-300'}`} />
            <button 
              onClick={() => setShowResultsPanel(!showResultsPanel)}
              className={`flex items-center gap-2 group transition-all px-3 py-1.5 rounded-xl border ${
                autonomousMode 
                  ? (theme === 'dark' ? 'bg-green-500/10 border-green-500/30' : 'bg-green-50 border-green-200 shadow-sm shadow-green-500/10') 
                  : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-white border-gray-200 hover:bg-gray-50 shadow-sm')
              }`}
            >
              <div className={`w-2 h-2 rounded-full ${autonomousMode ? 'bg-green-500 animate-ping' : (theme === 'dark' ? 'bg-white/20' : 'bg-gray-300')}`} />
              <div className={`w-2 h-2 rounded-full absolute ${autonomousMode ? 'bg-green-500' : (theme === 'dark' ? 'bg-white/20 group-hover:bg-blue-500' : 'bg-gray-300 group-hover:bg-blue-500')}`} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ml-1 ${
                autonomousMode 
                  ? 'text-green-500' 
                  : (theme === 'dark' ? 'text-white/40 group-hover:text-white' : 'text-gray-500 group-hover:text-gray-900')
              }`}>
                {autonomousMode ? 'Live Monitoring' : (mode === 'estate' ? 'Live Ops Feed' : 'Execution Logs')}
              </span>
            </button>
          </div>
          
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${
                theme === 'dark' 
                  ? 'bg-white/5 border-white/10 hover:bg-white/10 text-white/60 hover:text-white' 
                  : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 shadow-sm'
              }`}
            >
              <Menu size={18} />
              <span className="text-xs font-bold uppercase tracking-widest hidden sm:inline">Platform Menu</span>
              <ChevronDown size={14} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className={`absolute right-0 mt-2 w-64 border rounded-2xl shadow-2xl z-50 overflow-hidden ${
                      theme === 'dark' ? 'bg-[#121212] border-white/10' : 'bg-white border-gray-200'
                    }`}
                  >
                    <div className="p-2 space-y-1">
                      <div className={`px-3 py-1 text-[10px] uppercase font-bold tracking-widest ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>Platform Mode</div>
                      
                      <button 
                        onClick={() => { switchMode('nexus'); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          mode === 'nexus' ? 'bg-blue-600 text-white shadow-lg' : (theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700')
                        }`}
                      >
                        <Terminal size={16} />
                        Nexus Platform (General)
                      </button>

                      <button 
                        onClick={() => { switchMode('estate'); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          mode === 'estate' ? 'bg-blue-600 text-white shadow-lg' : (theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700')
                        }`}
                      >
                        <Bot size={16} />
                        EstateNexus (Real Estate)
                      </button>

                      <div className={`h-[1px] my-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />

                      <button 
                        onClick={() => { setShowResultsPanel(!showResultsPanel); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          showResultsPanel ? 'bg-blue-500/20 text-blue-500' : (theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700')
                        }`}
                      >
                        <FileText size={16} />
                        Processed Results
                      </button>
                      
                      <button 
                        onClick={() => { setTheme(theme === 'dark' ? 'light' : 'dark'); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                        {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                      </button>

                      <button 
                        onClick={() => { setShowPrompts(!showPrompts); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          showPrompts ? 'bg-blue-500/20 text-blue-500' : (theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700')
                        }`}
                      >
                        <RefreshCw size={16} />
                        {showPrompts ? 'Hide Suggestions' : 'Show Suggestions'}
                      </button>

                      <div className={`h-[1px] my-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />

                      <button 
                        onClick={() => { setShowSettings(true); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Settings size={16} />
                        Platform Settings
                      </button>

                      <button 
                        onClick={() => { setShowArch(true); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5 text-white/70' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <Layers size={16} />
                        System Architecture
                      </button>

                      <div className={`h-[1px] my-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />

                      {mode === 'estate' && role === 'admin' && (
                        <>
                          <button 
                            onClick={() => { setShowAdminDashboard(true); setShowMenu(false); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                              theme === 'dark' ? 'hover:bg-white/5 text-white/70 text-blue-400 font-bold' : 'hover:bg-gray-50 text-blue-600 font-bold'
                            }`}
                          >
                            <TrendingUp size={16} />
                            Admin Dashboard
                          </button>
                          <div className={`h-[1px] my-1 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`} />
                        </>
                      )}

                      <button 
                        onClick={() => { handleReset(); setShowMenu(false); }}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium text-yellow-500 transition-colors ${
                          theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                        }`}
                      >
                        <AlertCircle size={16} />
                        Reset Session
                      </button>
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Architecture Modal */}
        <AnimatePresence>
          {showArch && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowArch(false)}
                className="absolute inset-0 bg-black/80 backdrop-blur-md"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`relative w-full max-w-4xl border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
              >
                <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <Layers size={20} className="text-blue-500" />
                    <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>System Architecture</h2>
                  </div>
                  <button onClick={() => setShowArch(false)} className={`${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                    <AlertCircle size={20} className="rotate-45" />
                  </button>
                </div>
                
                <div className={`flex-1 overflow-y-auto p-8 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-gray-50'}`}>
                  <div className="mb-6">
                    <p className={`text-sm font-mono ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Click any component to learn more about its role in the Nexus architecture.</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {architectureNodes.map((node) => (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(selectedNode === node.id ? null : node.id)}
                        className={`p-4 rounded-xl border transition-all text-left flex flex-col ${
                          selectedNode === node.id 
                            ? (theme === 'dark' ? 'bg-blue-600/20 border-blue-500' : 'bg-blue-50 border-blue-500') 
                            : (theme === 'dark' ? 'bg-white/5 border-white/10 hover:border-white/20' : 'bg-white border-gray-200 hover:border-gray-300')
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5 text-white/60' : 'bg-gray-100 text-gray-600'}`}>
                            {node.icon}
                          </div>
                          <div>
                            <div className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{node.title}</div>
                            <div className={`text-[10px] uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{node.subtitle}</div>
                          </div>
                        </div>
                        <AnimatePresence>
                          {selectedNode === node.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <p className={`text-xs pt-3 mt-3 border-t leading-relaxed ${theme === 'dark' ? 'text-white/60 border-white/10' : 'text-gray-600 border-gray-100'}`}>
                                {node.desc}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className={`p-6 border-t flex justify-end ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <button 
                    onClick={() => setShowArch(false)}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <AnimatePresence>
          {showSettings && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowSettings(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className={`relative w-full max-w-lg border rounded-3xl overflow-hidden shadow-2xl ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
              >
                <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                  <div className="flex items-center gap-3">
                    <Settings size={20} className="text-blue-500" />
                    <h2 className={`text-lg font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Platform Settings</h2>
                  </div>
                  <button onClick={() => setShowSettings(false)} className={`${theme === 'dark' ? 'text-white/40 hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}>
                    <AlertCircle size={20} className="rotate-45" />
                  </button>
                </div>
                <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                  <div className="space-y-4">
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Security & Access</h3>
                    <div className="grid gap-3">
                      <div className={`p-4 rounded-2xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                        <div className="flex-1">
                          <div className="text-sm font-medium">Access Level</div>
                          <div className={`text-[10px] uppercase tracking-tighter mb-2 ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Current: {role}</div>
                          <div className="flex gap-2">
                            {(['viewer', 'developer', 'admin'] as const).map((r) => (
                              <button
                                key={r}
                                onClick={() => initAgent(r)}
                                className={`px-2 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                  role === r 
                                    ? 'bg-blue-600 text-white' 
                                    : (theme === 'dark' ? 'bg-white/5 text-white/40 hover:bg-white/10' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-100')
                                }`}
                              >
                                {r}
                              </button>
                            ))}
                          </div>
                        </div>
                        <Shield size={20} className={role === 'admin' ? 'text-red-500' : role === 'developer' ? 'text-blue-500' : 'text-gray-400'} />
                      </div>
                      <div className={`p-4 rounded-2xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <div className="text-sm font-medium">Token Scoping</div>
                          <div className={`text-[10px] uppercase tracking-tighter ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Status: Active</div>
                        </div>
                        <CheckCircle size={20} className="text-green-500" />
                      </div>
                      <div className={`p-4 rounded-2xl border flex items-center justify-between ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <div className="text-sm font-medium">Simulation Mode</div>
                          <div className={`text-[10px] uppercase tracking-tighter ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Bypass LLM for testing</div>
                        </div>
                        <button 
                          onClick={toggleSimulation}
                          className={`w-12 h-6 rounded-full transition-all relative ${simulationMode ? 'bg-blue-600' : 'bg-gray-300'}`}
                        >
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${simulationMode ? 'left-7' : 'left-1'}`} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Active Integrations</h3>
                    <div className="grid grid-cols-1 gap-3">
                      {['github', 'slack', 'cicd', 'weather', 'whatsapp', 'teams'].map(int => (
                        <div key={int} className={`p-3 rounded-xl border flex flex-col gap-2 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${tokens[int as keyof typeof tokens] ? 'bg-green-500' : 'bg-gray-300'}`} />
                            <span className="text-xs font-medium capitalize">{int === 'cicd' ? 'CI/CD' : int}</span>
                          </div>
                          <input 
                            type="password"
                            placeholder={`Enter ${int} API Key`}
                            value={tokens[int as keyof typeof tokens]}
                            onChange={(e) => setTokens(prev => ({ ...prev, [int]: e.target.value }))}
                            className={`w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-white border-gray-300 text-gray-900'}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className={`p-6 border-t flex justify-end ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <button 
                    onClick={saveTokens}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all"
                  >
                    Save & Close
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Upload Confirmation Modal */}
        <AnimatePresence>
          {pendingUpload && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#141414] border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl"
              >
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-3 text-blue-400">
                    <FileText size={20} />
                    <h3 className="font-bold uppercase tracking-wider text-sm text-white">Confirm Upload</h3>
                  </div>
                  <p className="text-sm text-white/60">
                    Are you sure you want to upload <strong className="text-white">{pendingUpload.file.name}</strong> to the workspace?
                  </p>
                  <div className="flex gap-3 pt-4">
                    <button 
                      onClick={() => {
                        socketRef.current?.emit("workspace:upload_file", { 
                          agentId, 
                          fileName: pendingUpload.file.name,
                          base64Content: pendingUpload.base64
                        });
                        addNotification(`Uploading ${pendingUpload.file.name}...`, "info");
                        setPendingUpload(null);
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors text-sm"
                    >
                      Upload File
                    </button>
                    <button 
                      onClick={() => setPendingUpload(null)}
                      className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-2 rounded-lg transition-colors text-sm border border-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Chat Area */}
        <div ref={scrollRef} className={`flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth ${theme === 'dark' ? '' : 'bg-gray-50'}`}>
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  msg.role === 'user' ? 'bg-blue-600' : 
                  msg.role === 'tool' ? (theme === 'dark' ? 'bg-white/5 border border-white/10' : 'bg-gray-200 border border-gray-300') : 
                  (theme === 'dark' ? 'bg-white/10' : 'bg-gray-200')
                }`}>
                  {msg.role === 'user' ? <User size={16} className="text-white" /> : 
                   msg.role === 'tool' ? <Terminal size={14} className={theme === 'dark' ? 'text-white/40' : 'text-gray-500'} /> : 
                   <Bot size={16} className={theme === 'dark' ? 'text-white' : 'text-gray-700'} />}
                </div>
                <div className={`max-w-[80%] space-y-1 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user' ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/10' : 
                    msg.role === 'tool' ? (theme === 'dark' ? 'bg-white/5 border border-white/10 font-mono text-xs text-white/80' : 'bg-white border border-gray-200 font-mono text-xs text-gray-800 shadow-sm') : 
                    (theme === 'dark' ? 'bg-white/5 border border-white/10 shadow-sm text-white' : 'bg-white border border-gray-200 shadow-sm text-gray-800')
                  }`}>
                    {msg.role === 'tool' && (
                      <div className={`flex items-center gap-2 mb-2 pb-2 border-b ${theme === 'dark' ? 'border-white/10 text-white/40' : 'border-gray-200 text-gray-500'}`}>
                        <Terminal size={12} />
                        <span className="uppercase tracking-tighter font-bold">{msg.toolName}</span>
                        {msg.status === 'pending' && <Loader2 size={12} className="animate-spin" />}
                        {msg.status === 'success' && <CheckCircle size={12} className="text-green-500" />}
                        {msg.status === 'error' && <AlertCircle size={12} className="text-red-500" />}
                      </div>
                    )}
                    {msg.role === 'tool' && msg.toolName === 'get_market_insights' && msg.toolResult ? (
                      <div className="space-y-4 py-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400">Market Insights: {msg.toolResult.location}</h4>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${msg.toolResult.marketState === 'Bullish' ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                            {msg.toolResult.marketState}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Price Change</div>
                            <div className="text-lg font-bold text-green-400">{msg.toolResult.averagePriceChange}</div>
                          </div>
                          <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                            <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Inventory</div>
                            <div className="text-lg font-bold text-yellow-400">{msg.toolResult.inventoryLevel}</div>
                          </div>
                        </div>
                        <div className={`h-48 w-full p-2 rounded-xl border ${theme === 'dark' ? 'bg-black/40 border-white/10' : 'bg-white border-gray-100'}`}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'Change', value: parseFloat(msg.toolResult.averagePriceChange) },
                              { name: 'Inv', value: msg.toolResult.inventoryLevel === 'Low' ? 30 : 70 }
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
                              <XAxis dataKey="name" stroke={theme === 'dark' ? '#666' : '#999'} fontSize={10} />
                              <YAxis stroke={theme === 'dark' ? '#666' : '#999'} fontSize={10} />
                              <Tooltip 
                                contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: 'none', borderRadius: '8px', fontSize: '10px' }}
                              />
                              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                                <Cell fill="#3b82f6" />
                                <Cell fill="#f59e0b" />
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div className={`p-3 rounded-xl border italic text-xs leading-relaxed ${theme === 'dark' ? 'bg-blue-600/5 border-blue-500/20 text-blue-200/70' : 'bg-blue-50 border-blue-100 text-blue-800'}`}>
                          "{msg.toolResult.recommendation}"
                        </div>
                      </div>
                    ) : msg.role === 'tool' ? (
                      <details className="group">
                        <summary className="flex items-center gap-2 cursor-pointer list-none text-[10px] font-bold uppercase tracking-widest text-blue-400/80 hover:text-blue-400 transition-colors">
                          <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
                          View Raw Service Execution {msg.status === 'success' ? 'Output' : 'Log'}
                        </summary>
                        <pre className={`mt-3 whitespace-pre-wrap break-all p-3 rounded-lg border text-[10px] ${theme === 'dark' ? 'bg-black/30 border-white/5' : 'bg-gray-50 border-gray-200 shadow-inner'}`}>{msg.content}</pre>
                      </details>
                    ) : (
                      <div className="space-y-3">
                        <div className="markdown-body">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                        {mode === 'estate' && msg.role === 'assistant' && (
                          <div className="flex flex-wrap gap-2 pt-2">
                             {(msg.content.match(/\*\*PROP_[0-9]+\*\*|\*\*TEN_[0-9]+\*\*|[A-Z][a-z]+ [A-Z][a-z]+ St|[A-Z][a-z]+ Ave/g) || []).map(entity => {
                                 const cleanEntity = entity.replace(/\*\*/g, '');
                                 return (
                                   <button
                                     key={entity}
                                     onClick={() => {
                                       const command = cleanEntity.startsWith('PROP_') ? `Get property details for ${cleanEntity}` : 
                                                     cleanEntity.startsWith('TEN_') ? `Get tenant details for ${cleanEntity}` :
                                                     `Search for ${cleanEntity}`;
                                       setInput(command);
                                       handleSend();
                                     }}
                                     className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                                       theme === 'dark' 
                                         ? 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20' 
                                         : 'bg-blue-50 border-blue-100 text-blue-600 hover:bg-blue-100 shadow-sm'
                                     }`}
                                   >
                                     {cleanEntity.startsWith('PROP_') ? <Home size={10} /> : <Users size={10} />}
                                     Inspect {cleanEntity}
                                   </button>
                                 );
                             })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className={`text-[10px] px-1 ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {status === "thinking" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-4"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                <Bot size={16} className={theme === 'dark' ? 'text-white' : 'text-gray-700'} />
              </div>
              <div className={`border rounded-2xl p-4 flex items-center gap-3 ${theme === 'dark' ? 'bg-white/5 border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                <Loader2 size={14} className="animate-spin text-blue-500" />
                <span className={`text-xs font-bold uppercase tracking-widest animate-pulse ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>Nexus is thinking...</span>
              </div>
            </motion.div>
          )}

          {pendingApproval && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`border rounded-2xl p-6 space-y-4 shadow-xl ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-white border-yellow-200 shadow-yellow-500/5'}`}
            >
              <div className={`flex items-center gap-3 ${theme === 'dark' ? 'text-yellow-500' : 'text-yellow-600'}`}>
                <Shield size={20} />
                <h3 className="font-bold uppercase tracking-wider text-sm">Security Approval Required</h3>
              </div>

              {mode === 'estate' && pendingApproval.toolName === 'schedule_maintenance' ? (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-blue-500 mb-2">
                    <Calendar size={18} />
                    <h4 className="text-sm font-bold uppercase tracking-wider">Maintenance Request Form</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-[9px] uppercase font-bold text-gray-500 mb-1">Property</div>
                      <div className="text-xs font-semibold">{pendingApproval.args.propertyId}</div>
                    </div>
                    <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-[9px] uppercase font-bold text-gray-500 mb-1">Issue</div>
                      <div className="text-xs font-semibold">{pendingApproval.args.issueType}</div>
                    </div>
                    <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-[9px] uppercase font-bold text-gray-500 mb-1">Priority</div>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        pendingApproval.args.urgency === 'high' ? 'bg-red-500/20 text-red-500' :
                        pendingApproval.args.urgency === 'medium' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-green-500/10 text-green-500'
                      }`}>{pendingApproval.args.urgency}</span>
                    </div>
                    <div className={`p-3 rounded-xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-50 border-gray-100'}`}>
                      <div className="text-[9px] uppercase font-bold text-gray-500 mb-1">Preferred Date</div>
                      <div className="text-xs font-semibold">{pendingApproval.args.preferredDate || 'TBD'}</div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className={`text-sm ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>
                    The agent wants to execute <code className={`px-1.5 py-0.5 rounded font-bold ${theme === 'dark' ? 'bg-white/10 text-yellow-400' : 'bg-yellow-50 text-yellow-700'}`}>{pendingApproval.toolName}</code> with the following arguments:
                  </div>
                  <pre className={`p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap break-words border ${theme === 'dark' ? 'bg-black/40 text-white/60 border-white/5' : 'bg-gray-50 border-gray-100 text-gray-800 shadow-inner'}`}>
                    {JSON.stringify(pendingApproval.args, null, 2)}
                  </pre>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => handleApproval(true)}
                  className={`flex-1 font-bold py-2.5 rounded-lg transition-colors text-sm shadow-lg ${theme === 'dark' ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/20'}`}
                >
                  Approve Execution
                </button>
                <button 
                  onClick={() => handleApproval(false)}
                  className={`flex-1 font-bold py-2.5 rounded-lg transition-colors text-sm border ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10 text-white border-white/10' : 'bg-white hover:bg-gray-50 text-gray-700 border-gray-300 shadow-sm'}`}
                >
                  Deny
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Input Area */}
        <div className={`p-6 border-t ${theme === 'dark' ? 'bg-[#0a0a0a] border-white/5' : 'bg-white border-gray-200'}`}>
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask Nexus to perform a task..."
                className={`w-full border rounded-2xl py-4 pl-6 pr-16 focus:outline-none focus:border-blue-500/50 transition-all text-sm ${
                  theme === 'dark' 
                    ? 'bg-white/5 border-white/10 placeholder:text-white/20 text-white' 
                    : 'bg-white border-gray-200 placeholder:text-gray-400 text-gray-900 shadow-sm'
                }`}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 rounded-xl transition-all text-white"
              >
                <Send size={20} />
              </button>
            </div>

            <AnimatePresence>
              {showPrompts && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="flex flex-wrap gap-1.5 justify-center py-1 max-w-3xl mx-auto">
                    {examplePrompts.map((prompt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          setInput(prompt.text);
                          handleExampleClick(prompt.text);
                        }}
                        className={`px-2.5 py-1 rounded-lg border transition-all text-[9px] font-medium flex items-center gap-1.5 whitespace-nowrap ${
                          theme === 'dark' 
                            ? 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-blue-500/30 text-white/40 hover:text-white' 
                            : 'bg-white border-gray-200 hover:bg-gray-50 hover:border-blue-500/30 text-gray-500 hover:text-gray-900 shadow-sm'
                        }`}
                      >
                        <span className="text-blue-500/50">{prompt.icon}</span>
                        {prompt.text}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className={`text-center mt-4 text-[10px] uppercase tracking-widest font-medium ${theme === 'dark' ? 'text-white/20' : 'text-gray-400'}`}>
            Nexus v1.0.0 • Production Grade Agent Runtime
          </div>
        </div>
      </div>

      {/* Processed Results Panel */}
      <AnimatePresence>
        {showResultsPanel && (
          <motion.div
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className={`w-[450px] border-l flex flex-col z-40 shadow-2xl relative ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
          >
            <div className="absolute top-4 right-4 z-50">
              <button 
                onClick={() => setShowResultsPanel(false)} 
                className={`p-2 rounded-xl transition-all ${theme === 'dark' ? 'hover:bg-white/5 text-white/40 hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
              >
                <X size={18} />
              </button>
            </div>
            
            <LiveOpsFeed theme={theme} socket={socketRef.current} />
          </motion.div>
        )}
      </AnimatePresence>

        {/* Admin Dashboard Modal */}
        <AnimatePresence>
          {showAdminDashboard && (
            <AdminDashboard theme={theme} onClose={() => setShowAdminDashboard(false)} />
          )}
        </AnimatePresence>

      {/* File Viewer Modal */}
      <AnimatePresence>
        {selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFile(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={`relative w-full max-w-4xl border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}
            >
              <div className={`p-4 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3">
                  <FileText size={20} className="text-blue-500" />
                  <h2 className="font-bold text-lg">{selectedFile.name}</h2>
                </div>
                <div className="flex items-center gap-2">
                  <a 
                    href={`/api/workspace/file?agentId=${agentId}&file=${encodeURIComponent(selectedFile.name)}`}
                    download={selectedFile.name.split('/').pop()}
                    className={`p-2 rounded-md transition-colors flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'hover:bg-white/10 text-white/80' : 'hover:bg-gray-100 text-gray-700'}`}
                  >
                    <Download size={16} />
                    Download
                  </a>
                  <button onClick={() => setSelectedFile(null)} className={`p-2 rounded-md transition-colors ${theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-gray-100 text-gray-500'}`}>
                    <X size={20} />
                  </button>
                </div>
              </div>
              <div className={`flex-1 overflow-auto p-6 ${theme === 'dark' ? 'bg-[#0a0a0a]' : 'bg-gray-50'}`}>
                {selectedFile.isImage ? (
                  <img src={selectedFile.content} alt={selectedFile.name} className="max-w-full h-auto mx-auto rounded-lg shadow-md" />
                ) : (
                  <pre className={`text-sm font-mono whitespace-pre-wrap break-words ${theme === 'dark' ? 'text-white/80' : 'text-gray-800'}`}>
                    {selectedFile.content}
                  </pre>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
