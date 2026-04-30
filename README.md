# EstateNexus: Enterprise Help Desk

EstateNexus is an enterprise-grade AI agentic help desk specialized for Real Estate Management. Inspired by modern agent runtimes (like LangGraph) and secure tool execution layers (like Arcade.dev), it enables property managers and tenants to interact with properties via a highly capable reasoning engine.

## 🏢 Specialized Architecture

```text
+-----------------------------------------------------------+
|               FRONTEND (React - EstateNexus)              |
| Tenant Inquiries | Maintenance Forms | Admin Dashboard    |
| Interactive Market Charts | Deep-linked Property Shortcuts|
+---------------------------+-------------------------------+
                            |
                            v
+-----------------------------------------------------------+
|                  BACKEND (Express Logic)                  |
|                                                           |
|  +--------------------+                                   |
|  | Help Desk Manager  |                                   |
|  | (RBAC: Admin, Dev) |                                   |
|  +---------+----------+                                   |
|            |                                              |
|            v                                              |
|  +------------------------+                               |
|  | Real Estate reasoning  |  ← Specialized LLM Core       |
|  | (Planning Engine)      |  ← Domain Knowledge Injection |
|  +-----------+------------+                               |
|              |                                            |
|   -------------------------------------------------       |
|   |            |             |                    |       |
|   v            v             v                    v       |
| Property     Context       Mailroom       Admin Dashboard |
| Ledgers      Store         Engine         & Live Logging  |
|                                                           |
|  +-----------------------------+                          |
|  | Service Runtime             |                          |
|  | - Security Masking          |                          |
|  | - Human-in-the-Loop         |                          |
|  | - Daily Activity Feeding    |                          |
|  +-------------+--------------+                           |
|                |                                          |
|                v                                          |
|        Property Integration Fabric                        |
|                |                                          |
|     --------------------------------------------          |
|     |        |        |        |        |      |          |
|     v        v        v        v        v      v          |
|   PMS   IoT Sensors Vendor   Email/SMS Comms Market Data  |
+-----------------------------------------------------------+
```

## 🧠 Core Domain Components

### 1. Real Estate Harness (`src/backend/agent/manager.ts`)
The "brain" of the help desk. It handles the multi-step lifecycle of real estate issues. For example, if a tenant reports a leak, the harness plans: 
1. Determine location (Fetch property info).
2. Assess urgency (LLM Reasoning).
3. Schedule emergency plumbing (Tool execution).
4. Notify tenant (Communication tool).

### 2. Domain LLM Core (`src/backend/services/llm.ts`)
Powered by GPT-4 and the latest Gemini models, with specific system instructions for property management etiquette, legal awareness (mock), and tenant support empathy.

### 3. Property Interaction Tools (`src/backend/tools/implementations/realEstateTools.ts`)
- `get_property_details`: Instant access to property ledger (Price, Status, Owner, History).
- `schedule_maintenance`: Direct scheduling with maintenance vendors, now integrated with frontend form confirmation.
- `record_tenant_interaction`: Unified logging for inquiries and complaints, writing persistent logs to workspace (`tenant_interactions.json`).
- `get_market_insights`: Strategic data for property investors and managers, rendered via interactive Recharts.
- `analyze_email_context`: Dedicated Mailroom Engine tool to extract insights from tenant emails.

## 🚀 Future Enterprise Requirements
To upgrade this from a prototype to a full production deployment, the following are recommended:
1. **Live PMS Integration**: Connect to real Property Management Systems like Yardi or AppFolio via their official APIs.
2. **IoT Sensor Integration**: Feed real-time data from smart building sensors (moisture, temperature, door locks) into the agent's context.
3. **Legal/Compliance Layer**: Integrate with local zoning and tenant law databases for automated compliance checking.
4. **Voice/Phone Channel**: Add Twilio integration to allow tenants to call the help desk and speak directly to EstateNexus.
5. **Secure DB**: Replace the mock JSON/Memory store with a persistent PostgreSQL database with row-level security.

## 🏗️ Technical Features
- **High Availability**: Automatic fallback between Azure OpenAI, Groq, and Gemini.
- **RBAC & Admin Dashboards**: Secure roles (Viewer, Developer, Admin). Admins have access to the Enterprise Dashboard for KPIs, sub-system monitoring, and daily operations logging.
- **Human-in-the-Loop**: High-urgency maintenance or expensive service requests require manual manager approval via auto-generated, structured forms in the UI.
- **Visual Intelligence**: Recharts implementation for mapping market movements dynamically.

## 🛠️ Getting Started
Refer to the `.env.example` to set up your AI provider keys. Run `npm run dev` to start the local helper environment.
