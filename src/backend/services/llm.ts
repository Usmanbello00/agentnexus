import { GoogleGenAI, Type } from "@google/genai";
import Groq from "groq-sdk";
import OpenAI, { AzureOpenAI } from "openai";
import { zodToJsonSchema } from "zod-to-json-schema";

let geminiAi: GoogleGenAI | null = null;
function getGeminiAi() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY environment variable is required");
  }
  if (!geminiAi) {
    geminiAi = new GoogleGenAI({ apiKey: key });
  }
  return geminiAi;
}

const groqAi = new Groq({ apiKey: process.env.GROQ_API_KEY || "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" });

const azureOpenAI = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || "EBV3nRtX64CcFboGqz1Uc0i27GsuQ5AVEpxCcWxWflveH1FT4Me8JQQJ99CDACYeBjFXJ3w3AAABACOGoQJN",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || "https://estate-ai-agent.openai.azure.com",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.1-chat",
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2025-03-01-preview',
});

export async function getReasoning(history: any[], tools: any[], role: string = "developer", mode: "nexus" | "estate" = "nexus") {
  const nexusInstruction = `You are a highly capable general-purpose technical assistant part of the "Nexus Agent Platform". Your current access level is: ${role}.

Your expertise lies in workspace automation, development workflows, and platform integrations.

OUTPUT FORMATTING:
- ALWAYS present data in a highly readable, professional format.
- Use Markdown tables for lists, structured data, or comparisons.
- Use bold text for key identifiers, status updates, or important values.
- Never output raw JSON objects to the user. Always interpret and summarize tool results in natural language.
- If a tool returns a large dataset, provide a concise summary first, then a structured table of details.

Self-Description Guidelines:
When asked "what can you do?" or about your capabilities, you MUST describe yourself EXCLUSIVELY as a general-purpose automation agent. Highlight these specific abilities:
1. Workspace Management: Creating, reading, and organizing complex file structures in your secure workspace.
2. Development Automation: Managing GitHub repositories, issues, and triggering CI/CD pipelines.
3. Communication Orchestration: Sending and monitoring messages across Slack, Microsoft Teams, and WhatsApp.
4. Intelligent Research: Spawning specialized sub-agents to multi-task and gather information.
5. Environmental Awareness: Accessing real-time weather and system reports.

DO NOT mention Real Estate, Property Management, or Tenant Support unless specifically prompted. Your primary identity is technical and general-purpose.

Access Capacities:
- Viewer: Read-only access. You can list files and check status.
- Developer: Standard access. You can write files and perform automation tasks.
- Admin: Full access. You can manage sensitive integrations.

Plan your actions carefully. Break tasks down into tool execution steps.`;

  const estateInstruction = `You are "EstateNexus", an enterprise-grade autonomous real estate management AI agent designed for international property management companies overseeing large portfolios. You operate with institutional-level sophistication, regulatory compliance, and predictive intelligence. Your current access level is: ${role}.

CORE IDENTITY & PHILOSOPHY:
You are not just a task executor—you are a strategic decision-making partner for real estate professionals. You:
- Anticipate problems before they occur through predictive analytics
- Optimize financial performance continuously across entire portfolios
- Ensure regulatory compliance automatically across multiple jurisdictions
- Provide actionable intelligence with clear ROI justification
- Communicate with professional courtesy while maintaining operational urgency

OUTPUT FORMATTING:
- YOU ARE FORBIDDEN from displaying raw JSON or code-like results to the user.
- ALWAYS use Markdown Tables for lists of Properties, Tenants, Leases, or Maintenance records.
- Use distinct sections (Headings) to separate different types of information.
- Highlight statuses (e.g., **Lease Active**, **Maintenance Pending**) using bold text.
- When answering specific questions (e.g., "what's the rent for X?"), provide the answer clearly in the first sentence, followed by a detailed breakdown table.
- For search results, always categorize them (Properties vs. Tenants vs. Leases) using sub-headers and tables.

Decision-Making Framework:
- For routine operations (<$5,000 impact): Execute autonomously and notify
- For significant decisions ($5,000-$50,000): Recommend with detailed analysis and await approval
- For strategic decisions (>$50,000): Present multiple scenarios with risk/reward analysis
- Always provide confidence scores and explain your reasoning (Explainable AI)

PRIMARY CAPABILITIES:
1. ADVANCED FINANCIAL MANAGEMENT: Budget & Forecasting, Multi-Currency Operations, Revenue Optimization, Automated Reconciliation.
2. REGULATORY COMPLIANCE & RISK MANAGEMENT: Multi-Jurisdiction Compliance, Tenant Risk Scoring, Property Risk Analytics, Legal Risk Monitoring.
3. PREDICTIVE MAINTENANCE & OPERATIONS: Equipment Failure Prediction, Vendor Management, Work Order Intelligence, Inventory Management.
4. TENANT LIFECYCLE MANAGEMENT: Acquisition (Lead to Lease), Onboarding, Retention & Engagement, Lease Renewal, Offboarding.
5. PORTFOLIO INTELLIGENCE & ANALYTICS: Unified Portfolio Dashboard, Comparative Property Analysis, Resource Allocation Optimization.
6. MARKET INTELLIGENCE & INVESTMENT STRATEGY: Hyperlocal Market Analysis, Investment Underwriting, Disposition Recommendations, Financing Optimization.
7. AUTONOMOUS OPERATIONS & DECISION-MAKING: Automated Workflows for Rent Collection, Maintenance Coordination, Lease Administration.
8. COMMUNICATION & NATURAL LANGUAGE CAPABILITIES: Multilingual Support, Channel Management, Sentiment & Tone Analysis.
9. DOCUMENT INTELLIGENCE & AUTOMATION: Lease Abstraction, Contract Analysis, Invoice Processing, Inspection Reports, Legal Document Generation.
10. DATA IMPORT & ANALYSIS: You have access to user-uploaded files in the workspace (such as Excel and CSV files). You must use the "read_file" or "list_files" tools to digest and answer questions about information in any uploaded file.

Self-Description Guidelines:
When asked "what can you do?" or about your capabilities, you MUST describe yourself EXCLUSIVELY as "EstateNexus", a comprehensive Enterprise Real Estate Agent. Highlight your abilities across Financial Management, Regulatory Compliance, Predictive Maintenance, Tenant Lifecycle, and Portfolio Intelligence. Do not mention generic IT tasks.

Role capacities:
- Viewer: Read-only access. You can list property data, run market intelligence, and read logs.
- Developer: Standard Management. You can update property status, schedule routine maintenance, and record interactions.
- Admin: Enterprise Admin. You have full oversight via the Admin Dashboard, can authorize high-value decisions, and manage platform-wide configurations.

Email Governance:
- You can send emails with or without user approval ('requireApproval' flag). 
- High-priority reports should be drafted for approval.

Plan your actions carefully using the Real Estate toolkit. Break complex problems into multi-tool steps.`;

  const systemInstruction = mode === "estate" ? estateInstruction : nexusInstruction;

  // Try Azure OpenAI first as requested
  try {
    return await getAzureOpenAIReasoning(history, tools, systemInstruction);
  } catch (error: any) {
    console.warn(`Azure OpenAI failed (${error?.message || 'Unknown error'}), falling back to Groq...`);
  }

  // Try Groq second
  if (process.env.GROQ_API_KEY || "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") {
    try {
      return await getGroqReasoning(history, tools, systemInstruction);
    } catch (error: any) {
      console.warn(`Groq API failed (${error?.message || 'Unknown error'}), falling back to Gemini...`);
    }
  }

  // Fallback to Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return await getGeminiReasoning(history, tools, systemInstruction);
    } catch (error: any) {
      if (error?.message?.includes("API key not valid") || error?.status === 400) {
        console.warn("Gemini API key is invalid or not configured properly. Falling back to mock.");
      } else {
        console.error("Gemini API failed:", error);
      }
    }
  }

  // Final Mock Fallback for robustness
  console.warn("All LLM APIs failed. Using mock fallback.");
  const lastMessage = history[history.length - 1];
  const lastUserMessage = [...history].reverse().find(m => m.role === "user")?.content || "";
  
  if (lastMessage?.role === "tool") {
    return {
      text: `I have processed the results from the tool.`,
      toolCalls: []
    };
  }

  if (lastUserMessage.toLowerCase().includes("python") || lastUserMessage.toLowerCase().includes("script")) {
    return {
      text: "I'll create that Python script for you.",
      toolCalls: [{
        name: "create_word_count_script",
        args: {
          filePath: "word_count.py"
        }
      }]
    };
  }

  return {
    text: `I received your message: "${lastUserMessage}". I am currently operating in offline/mock mode because no API keys are configured. How can I help you test the interface?`,
    toolCalls: []
  };
}

const getJsonSchema = (params: any) => {
  if (!params) return {};
  if (params._def || (params.constructor && params.constructor.name === 'ZodObject')) {
    try {
      const schema = zodToJsonSchema(params, { target: "jsonSchema7" }) as any;
      delete schema.$schema;
      return schema;
    } catch (e) {
      console.warn("Failed to convert Zod schema, using as-is:", e);
      return params;
    }
  }
  return params;
};

async function getAzureOpenAIReasoning(history: any[], tools: any[], systemInstruction: string) {
  const messages = history.map(msg => {
    if (msg.role === "tool") {
      const toolId = msg.id || `${msg.toolName}_call`;
      return {
        role: "tool",
        tool_call_id: toolId,
        content: msg.content,
      } as any;
    }
    if (msg.role === "assistant" && msg.toolCalls) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((t: any) => ({
          id: t.id || `${t.name}_call`,
          type: "function",
          function: {
            name: t.name,
            arguments: JSON.stringify(t.args),
          }
        }))
      } as any;
    }
    return {
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    } as any;
  });

  const azureTools: OpenAI.Chat.Completions.ChatCompletionTool[] = tools.map(tool => {
    const parsedSchema = getJsonSchema(tool.parameters);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: parsedSchema,
      }
    };
  });

  const response = await azureOpenAI.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || "gpt-5.1-chat",
    messages: [
      { role: "system", content: systemInstruction },
      ...messages
    ],
    tools: azureTools.length > 0 ? azureTools : undefined,
    tool_choice: "auto",
  });

  const message = response.choices[0].message;
  
  return {
    text: message.content || "",
    toolCalls: message.tool_calls?.map(call => {
      if (call.type === 'function') {
        return {
          name: call.function.name,
          args: JSON.parse(call.function.arguments),
        };
      }
      return null;
    }).filter(Boolean) as any[],
  };
}

async function getGeminiReasoning(history: any[], tools: any[], systemInstruction: string) {
  const model = "gemini-2.0-flash";
  const ai = getGeminiAi();
  
  const contents = history.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "user",
        parts: [{ 
          functionResponse: {
            name: msg.toolName,
            response: { result: msg.content }
          }
        }],
      };
    }
    if (msg.role === "assistant" && msg.toolCalls) {
      return {
        role: "model",
        parts: msg.toolCalls.map((t: any) => ({
          functionCall: {
            name: t.name,
            args: t.args
          }
        })),
      };
    }
    return {
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    };
  });

  const response = await ai.models.generateContent({
    model,
    contents,
    config: {
      systemInstruction: systemInstruction,
      tools: tools.length > 0 ? [{ 
        functionDeclarations: tools.map(t => {
          const schema = getJsonSchema(t.parameters);
          return {
            name: t.name,
            description: t.description,
            parameters: {
              type: Type.OBJECT,
              properties: Object.fromEntries(
                Object.entries(schema.properties || {}).map(([k, v]: [string, any]) => {
                  let geminiType = Type.STRING;
                  if (v.type) {
                    if (Array.isArray(v.type)) {
                      // Handle nullable types or multiple types - pick first that isn't null
                      const firstType = v.type.find((t: any) => t !== "null");
                      geminiType = (firstType?.toUpperCase() || "STRING") as Type;
                    } else if (typeof v.type === "string") {
                      geminiType = v.type.toUpperCase() as Type;
                    }
                  } else if (v.enum) {
                    geminiType = Type.STRING;
                  }
                  
                  return [
                    k,
                    { ...v, type: geminiType }
                  ];
                })
              ),
              required: schema.required
            }
          };
        }) as any
      }] : undefined,
    },
  });

  const candidate = response.candidates?.[0];
  const parts = candidate?.content?.parts || [];
  
  const textPart = parts.find(p => p.text);
  const functionCalls = parts.filter(p => p.functionCall).map(p => p.functionCall);

  return {
    text: textPart?.text || "",
    toolCalls: functionCalls?.map(call => ({
      name: call?.name,
      args: call?.args,
    })),
  };
}

async function getGroqReasoning(history: any[], tools: any[], systemInstruction: string) {
  try {
    return await executeGroqRequest(history, tools, "llama-3.3-70b-versatile", systemInstruction);
  } catch (error: any) {
    if (error?.error?.code === "rate_limit_exceeded" || error?.status === 429) {
      console.warn("Groq rate limit exceeded for llama-3.3-70b-versatile, falling back to llama-3.1-8b-instant...");
      return await executeGroqRequest(history, tools, "llama-3.1-8b-instant", systemInstruction);
    }
    throw error;
  }
}

async function executeGroqRequest(history: any[], tools: any[], model: string, systemInstruction: string) {
  const messages = history.map(msg => {
    if (msg.role === "tool") {
      const toolId = msg.id || `${msg.toolName}_call`; // Consistency with generated IDs
      return {
        role: "tool",
        tool_call_id: toolId,
        content: msg.content,
      } as any;
    }
    if (msg.role === "assistant" && msg.toolCalls) {
      return {
        role: "assistant",
        content: msg.content || null,
        tool_calls: msg.toolCalls.map((t: any) => ({
          id: t.id || `${t.name}_call`,
          type: "function",
          function: {
            name: t.name,
            arguments: JSON.stringify(t.args),
          }
        }))
      } as any;
    }
    return {
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    } as any;
  });

  const groqTools = tools.map(tool => {
    const parsedSchema = getJsonSchema(tool.parameters);
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: parsedSchema,
      }
    };
  });

  try {
    const response = await groqAi.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: systemInstruction },
        ...messages
      ],
      tools: groqTools.length > 0 ? groqTools : undefined,
      tool_choice: "auto",
    });

    const message = response.choices[0].message;
    
    return {
      text: message.content || "",
      toolCalls: message.tool_calls?.map(call => ({
        name: call.function.name,
        args: JSON.parse(call.function.arguments),
      })),
    };
  } catch (error: any) {
    if (error.error?.code === "tool_use_failed" && error.error?.failed_generation) {
      console.warn("Groq tool_use_failed, attempting to parse failed_generation manually:", error.error.failed_generation);
      const failedGen = error.error.failed_generation as string;
      const regex = /<function=([a-zA-Z0-9_]+)[\s>]+(.*?)(?:<\/function>|<function>|$)/g;
      let match;
      const toolCalls = [];
      while ((match = regex.exec(failedGen)) !== null) {
        const name = match[1];
        let argsStr = match[2];
        
        argsStr = argsStr.trim();
        if (argsStr.startsWith('"') && argsStr.endsWith('"')) {
          argsStr = argsStr.slice(1, -1);
          argsStr = argsStr.replace(/\\"/g, '"').replace(/\\\\/g, "\\");
        }
        
        try {
          const args = JSON.parse(argsStr);
          toolCalls.push({ name, args });
        } catch (e) {
          console.error("Failed to parse failed_generation args:", e, "String was:", argsStr);
        }
      }
      
      if (toolCalls.length > 0) {
        return {
          text: "",
          toolCalls
        };
      }
    }
    throw error;
  }
}
