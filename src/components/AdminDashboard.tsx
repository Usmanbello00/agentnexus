import React, { useState, useEffect, useRef } from "react";
import { X, TrendingUp, Home, Users, FileText, Upload, Plus, Trash2, Edit2, Loader2, RefreshCw, Mail, Send, Save, Check, Activity, ShieldCheck, DollarSign, Wrench, Book } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import ReactMarkdown from "react-markdown";

interface AdminDashboardProps {
  onClose: () => void;
  theme: "light" | "dark";
}

interface Ticket {
  id: string;
  source: "local" | "zoho";
  external_id?: string;
  subject: string;
  description: string;
  status: "Open" | "On Hold" | "Escalated" | "Closed";
  priority: "Low" | "Medium" | "High" | "Urgent";
  tenant_id?: string;
  property_id?: string;
  contact_email: string;
  created_at: string;
  updated_at: string;
  resolution?: string;
}

export function AdminDashboard({ onClose, theme }: AdminDashboardProps) {
const [activeTab, setActiveTab] = useState<"overview" | "properties" | "tenants" | "leases" | "import" | "emails" | "operations" | "integrations" | "tickets" | "knowledgeBase">("overview");

  // MS Auth state
  const [msConnected, setMsConnected] = useState(false);
  const [zohoConnected, setZohoConnected] = useState(false);

  useEffect(() => {
    fetch('/api/auth/ms/status').then(r => r.json()).then(d => setMsConnected(d.connected)).catch(() => {});
    fetch('/api/auth/zoho/status').then(r => r.json()).then(d => setZohoConnected(d.connected)).catch(() => {});
    
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from AI Studio preview or localhost
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'MS_AUTH_SUCCESS') {
        toast.success("Successfully connected to Microsoft!");
        setMsConnected(true);
      }
      if (event.data?.type === 'ZOHO_AUTH_SUCCESS') {
        toast.success("Successfully connected to Zoho Desk!");
        setZohoConnected(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectMs = async () => {
    try {
      const response = await fetch('/api/auth/ms/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        toast.error('Please allow popups to connect your account.');
      }
    } catch(e) {
      toast.error('Error connecting to Microsoft');
    }
  };

  const handleDisconnectMs = async () => {
    try {
      await fetch('/api/auth/ms/disconnect', { method: 'POST' });
      setMsConnected(false);
      toast.success("Disconnected Microsoft account");
    } catch(e) {
      toast.error('Error disconnecting');
    }
  };

  const handleConnectZoho = async () => {
    try {
      const response = await fetch('/api/auth/zoho/url');
      if (!response.ok) throw new Error('Failed to get auth URL');
      const { url } = await response.json();
      
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
        toast.error('Please allow popups to connect your account.');
      }
    } catch(e) {
      toast.error('Error connecting to Zoho');
    }
  };

  const handleDisconnectZoho = async () => {
    try {
      await fetch('/api/auth/zoho/disconnect', { method: 'POST' });
      setZohoConnected(false);
      toast.success("Disconnected Zoho account");
    } catch(e) {
      toast.error('Error disconnecting');
    }
  };
  
  const [summary, setSummary] = useState<any>(null);
  const [properties, setProperties] = useState<any[]>([]);
  const [tenants, setTenants] = useState<any[]>([]);
  const [leases, setLeases] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  // Email review state
  const [editingEmail, setEditingEmail] = useState<any>(null);

  // Forms states
  const [propertyForm, setPropertyForm] = useState({ name: '', address: '', city: '', country: '', units: 1, property_type: 'multifamily' });
  const [tenantForm, setTenantForm] = useState({ name: '', email: '', phone: '', assigned_unit: '', property_id: '' });
  const [leaseForm, setLeaseForm] = useState({ tenant_id: '', property_id: '', unit: '', rent: 0, start_date: '', end_date: '', payment_frequency: 'monthly' });

  // Excel states
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);

  // Integration states
  const [integrationProvider, setIntegrationProvider] = useState('yardi');
  const [integrationKey, setIntegrationKey] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [kbContent, setKbContent] = useState("");

  const fetchSummary = async () => {
    try {
      const res = await fetch('/api/estate/dashboard-summary', { headers: { 'x-role': 'admin' }});
      if (res.ok) setSummary(await res.json());
    } catch(e) { console.error(e); }
  };

  const fetchProperties = async () => {
    const res = await fetch('/api/estate/properties', { headers: { 'x-role': 'admin' }});
    if (res.ok) setProperties(await res.json());
  };

  const fetchTenants = async () => {
    const res = await fetch('/api/estate/tenants', { headers: { 'x-role': 'admin' }});
    if (res.ok) setTenants(await res.json());
  };

  const fetchLeases = async () => {
    const res = await fetch('/api/estate/leases', { headers: { 'x-role': 'admin' }});
    if (res.ok) setLeases(await res.json());
  };

  const fetchEmails = async () => {
    const res = await fetch('/api/estate/emails', { headers: { 'x-role': 'admin' }});
    if (res.ok) setEmails(await res.json());
  };

  const fetchTickets = async () => {
    const res = await fetch('/api/estate/tickets', { headers: { 'x-role': 'admin' }});
    if (res.ok) setTickets(await res.json());
  };

  const fetchKnowledgeBase = async () => {
    try {
      const res = await fetch('/api/estate/knowledge-base', { headers: { 'x-role': 'admin' }});
      if (res.ok) {
        const data = await res.json();
        setKbContent(data.content);
      }
    } catch(e) { console.error(e); }
  };

  // Ticket form states
  const [ticketForm, setTicketForm] = useState({ subject: '', description: '', priority: 'Medium', contact_email: '', status: 'Open' });
  const [showCreateTicket, setShowCreateTicket] = useState(false);

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/estate/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify(ticketForm)
      });
      if (res.ok) {
        toast.success("Ticket created!");
        setTicketForm({ subject: '', description: '', priority: 'Medium', contact_email: '', status: 'Open' });
        setShowCreateTicket(false);
        fetchTickets();
      } else toast.error("Failed to create ticket");
    } catch(e) { toast.error("Error creating ticket"); }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchSummary(), 
        fetchProperties(), 
        fetchTenants(), 
        fetchLeases(), 
        fetchEmails(), 
        fetchTickets(),
        fetchKnowledgeBase()
      ]);
      setLoading(false);
    };
    loadAll();
  }, [activeTab]);

  const handlePropertySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/estate/properties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify({ ...propertyForm, location: { address: propertyForm.address, city: propertyForm.city, country: propertyForm.country } })
      });
      if (res.ok) {
        toast.success("Property added!");
        setPropertyForm({ name: '', address: '', city: '', country: '', units: 1, property_type: 'multifamily' });
        fetchProperties();
        fetchSummary();
      } else toast.error("Failed to add property");
    } catch(e) { toast.error("Error adding property"); }
  };

  const handleDeleteProperty = async (id: string) => {
    try {
      const res = await fetch(`/api/estate/properties/${id}`, { method: 'DELETE', headers: { 'x-role': 'admin' }});
      if (res.ok) { toast.success("Property deleted"); fetchProperties(); fetchSummary(); }
    } catch(e) { toast.error("Error deleting property"); }
  };

  const handleTenantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/estate/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify({ name: tenantForm.name, assigned_unit: tenantForm.assigned_unit, property_id: tenantForm.property_id, contact: { email: tenantForm.email, phone: tenantForm.phone } })
      });
      if (res.ok) {
        toast.success("Tenant added!");
        setTenantForm({ name: '', email: '', phone: '', assigned_unit: '', property_id: '' });
        fetchTenants();
        fetchSummary();
      } else toast.error("Failed to add tenant");
    } catch(e) { toast.error("Error adding tenant"); }
  };

  const handleDeleteTenant = async (id: string) => {
    try {
      const res = await fetch(`/api/estate/tenants/${id}`, { method: 'DELETE', headers: { 'x-role': 'admin' }});
      if (res.ok) { toast.success("Tenant deleted"); fetchTenants(); fetchSummary(); }
    } catch(e) { toast.error("Error deleting tenant"); }
  };

  const handleLeaseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/estate/leases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify(leaseForm)
      });
      if (res.ok) {
        toast.success("Lease added!");
        setLeaseForm({ tenant_id: '', property_id: '', unit: '', rent: 0, start_date: '', end_date: '', payment_frequency: 'monthly' });
        fetchLeases();
        fetchSummary();
      } else toast.error("Failed to add lease");
    } catch(e) { toast.error("Error adding lease"); }
  };

  const handleDeleteLease = async (id: string) => {
    try {
      const res = await fetch(`/api/estate/leases/${id}`, { method: 'DELETE', headers: { 'x-role': 'admin' }});
      if (res.ok) { toast.success("Lease deleted"); fetchLeases(); fetchSummary(); }
    } catch(e) { toast.error("Error deleting lease"); }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) { toast.error("Select file first"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', excelFile);
      
      const res = await fetch('/api/estate/upload-excel', {
        method: 'POST',
        headers: { 'x-role': 'admin' },
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(data.message || "File uploaded successfully!");
        setPreviewData(data.preview);
        fetchSummary();
        fetchProperties();
        fetchTenants();
        fetchLeases();
      } else {
        toast.error(data.error || "Failed to upload file");
      }
    } catch (e: any) {
      toast.error(e.message || "Error during upload");
    }
    setUploading(false);
  };

  const handleSaveEmailDraft = async () => {
    if (!editingEmail) return;
    try {
      const isNew = !editingEmail.id;
      const res = await fetch(isNew ? '/api/estate/emails' : `/api/estate/emails/${editingEmail.id}`, { 
        method: isNew ? 'POST' : 'PUT', 
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify(editingEmail)
      });
      if (res.ok) { toast.success(isNew ? "Draft created!" : "Draft saved!"); fetchEmails(); setEditingEmail(null); }
      else { toast.error("Failed to save draft"); }
    } catch(e) { toast.error("Error saving draft"); }
  };

  const handleSendEmail = async (email: any) => {
    try {
      let idToSend = email.id;
      // If it's a new email, create it first
      if (!idToSend) {
          const res = await fetch('/api/estate/emails', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
              body: JSON.stringify({ ...email, type: 'draft' })
          });
          if (res.ok) {
              const data = await res.json();
              idToSend = data.id;
          } else {
              toast.error("Failed to process new email");
              return;
          }
      }

      const res = await fetch(`/api/estate/emails/${idToSend}/send`, { method: 'POST', headers: { 'x-role': 'admin' }});
      if (res.ok) { toast.success("Email sent!"); setEditingEmail(null); fetchEmails(); }
      else { toast.error("Failed to send email"); }
    } catch(e) { toast.error("Error sending email"); }
  };

  const handleDeleteEmail = async (id: string) => {
    try {
      const res = await fetch(`/api/estate/emails/${id}`, { method: 'DELETE', headers: { 'x-role': 'admin' }});
      if (res.ok) { toast.success("Email deleted"); fetchEmails(); }
    } catch(e) { toast.error("Error deleting email"); }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setExcelFile(e.target.files[0]);
    }
  };

  const handleSyncIntegration = async () => {
    if (!integrationKey) { toast.error("Please provide an API Key."); return; }
    setSyncing(true);
    try {
      const res = await fetch("/api/estate/sync-integration", {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
        body: JSON.stringify({ provider: integrationProvider, apiKey: integrationKey })
      });
      const data = await res.json();
      if (res.ok) {
         toast.success(data.message);
         fetchSummary(); fetchProperties(); fetchTenants(); fetchLeases();
         setIntegrationKey('');
      } else {
         toast.error(data.error || "Sync failed");
      }
    } catch(e) {
      toast.error("Error connecting to integration.");
    }
    setSyncing(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
      <Toaster position="top-right" />
      <div className={`relative w-full max-w-6xl border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-[#161616]' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-3">
            <TrendingUp size={24} className="text-blue-500" />
            <div>
              <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>EstateNexus Enterprise Admin</h2>
            </div>
          </div>
          <button onClick={onClose} className={`p-2 rounded-full ${theme === 'dark' ? 'hover:bg-white/10 text-white/60' : 'hover:bg-black/5 text-gray-500'}`}>
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex flex-1 overflow-hidden">
          
          {/* Sidebar */}
          <div className={`w-56 flex flex-col border-r p-4 gap-2 ${theme === 'dark' ? 'border-white/10 bg-[#111]' : 'border-gray-200 bg-white'}`}>
            <button onClick={() => setActiveTab('overview')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <TrendingUp size={18} /> Overview
            </button>
            <button onClick={() => setActiveTab('properties')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'properties' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Home size={18} /> Properties
            </button>
            <button onClick={() => setActiveTab('tenants')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'tenants' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Users size={18} /> Tenants
            </button>
            <button onClick={() => setActiveTab('leases')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'leases' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <FileText size={18} /> Leases
            </button>
            <button onClick={() => setActiveTab('emails')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'emails' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Mail size={18} /> Communications
            </button>
            <button onClick={() => setActiveTab('import')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'import' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Upload size={18} /> Data Import
            </button>
            <button onClick={() => setActiveTab('integrations')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'integrations' ? 'bg-blue-500 text-white' : theme === 'dark' ? 'text-white/70 hover:bg-white/5' : 'text-gray-600 hover:bg-gray-100'}`}>
              <Save size={18} /> Integrations
            </button>
            <button onClick={() => setActiveTab('tickets')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'tickets' ? 'bg-orange-500 text-white' : theme === 'dark' ? 'text-orange-400/90 hover:bg-white/5' : 'text-orange-600 hover:bg-orange-50'}`}>
              <Activity size={18} /> Help Desk Tickets
            </button>
            <button onClick={() => setActiveTab('operations')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'operations' ? 'bg-purple-500 text-white' : theme === 'dark' ? 'text-purple-400/90 hover:bg-white/5' : 'text-purple-600 hover:bg-purple-50'}`}>
              <Activity size={18} /> AI Operations
            </button>
            <button onClick={() => setActiveTab('knowledgeBase')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === 'knowledgeBase' ? 'bg-green-600 text-white' : theme === 'dark' ? 'text-green-400/90 hover:bg-white/5' : 'text-green-600 hover:bg-green-50'}`}>
              <Book size={18} /> Knowledge Base
            </button>
          </div>

          {/* Main Area */}
          <div className={`flex-1 overflow-y-auto p-8 custom-scrollbar ${theme === 'dark' ? 'bg-[#0a0a0a] text-white' : 'bg-gray-50 text-gray-900'}`}>
            
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="animate-spin text-blue-500" size={32} />
              </div>
            ) : (
              <>
                {activeTab === 'overview' && summary && (
                  <div className="space-y-6">
                    <h3 className="text-xl font-bold tracking-tight">Dashboard Overview</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">Total Properties</div>
                        <div className="text-4xl font-black">{summary.totalProperties || 0}</div>
                        <div className="text-xs text-green-500 font-medium mt-2">↑ 12% YoY</div>
                      </div>
                      <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">Total Tenants</div>
                        <div className="text-4xl font-black">{summary.totalTenants || 0}</div>
                        <div className="text-xs text-green-500 font-medium mt-2">↑ 8.4% YoY</div>
                      </div>
                      <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">Active Leases</div>
                        <div className="text-4xl font-black">{summary.activeLeases || 0}</div>
                        <div className="text-xs text-green-500 font-medium mt-2">Target: &gt;92%</div>
                      </div>
                      <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="text-xs uppercase tracking-widest font-bold text-gray-400 mb-2">Occupancy Rate</div>
                        <div className="text-4xl font-black text-blue-500">{summary.occupancyRate || 0}%</div>
                        <div className="text-xs text-red-500 font-medium mt-2">12 Emergency (Demo)</div>
                      </div>
                    </div>
                    
                    {/* Charts Section */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                      <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#141414] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Revenue vs Target</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>Monthly</span>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[
                              { name: 'Jan', revenue: 4000, target: 4400 },
                              { name: 'Feb', revenue: 3000, target: 3200 },
                              { name: 'Mar', revenue: 2000, target: 2400 },
                              { name: 'Apr', revenue: 2780, target: 2900 },
                              { name: 'May', revenue: 1890, target: 4800 },
                              { name: 'Jun', revenue: 2390, target: 3800 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} vertical={false} />
                              <XAxis dataKey="name" stroke={theme === 'dark' ? '#666' : '#999'} fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke={theme === 'dark' ? '#666' : '#999'} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}k`} />
                              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`, borderRadius: '8px' }} />
                              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                              <Bar dataKey="target" fill={theme === 'dark' ? '#4ade80' : '#22c55e'} radius={[4, 4, 0, 0]} barSize={20} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#141414] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-6">
                          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Property Value Trend</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${theme === 'dark' ? 'bg-purple-500/20 text-purple-400' : 'bg-purple-50 text-purple-600'}`}>YTD</span>
                        </div>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={[
                              { name: 'Q1', value: 3.2 },
                              { name: 'Q2', value: 3.5 },
                              { name: 'Q3', value: 4.1 },
                              { name: 'Q4', value: 4.8 },
                            ]}>
                              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} vertical={false} />
                              <XAxis dataKey="name" stroke={theme === 'dark' ? '#666' : '#999'} fontSize={12} tickLine={false} axisLine={false} />
                              <YAxis stroke={theme === 'dark' ? '#666' : '#999'} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                              <Tooltip contentStyle={{ backgroundColor: theme === 'dark' ? '#1a1a1a' : '#fff', border: `1px solid ${theme === 'dark' ? '#333' : '#eee'}`, borderRadius: '8px' }} />
                              <Line type="monotone" dataKey="value" stroke="#a855f7" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    </div>

                    {/* System Status and Activity Feed */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
                      <div className={`p-6 rounded-3xl border lg:col-span-1 ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                         <h3 className={`text-sm font-bold uppercase tracking-widest mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Sub-Systems Status</h3>
                         <div className="grid grid-cols-1 gap-4">
                           <div className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
                             <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                               <span className="text-sm font-medium">IoT Sensors</span>
                             </div>
                             <span className="text-xs text-green-500 uppercase font-bold">Online</span>
                           </div>
                           <div className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
                             <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                               <span className="text-sm font-medium">Predictive Maint.</span>
                             </div>
                             <span className="text-xs text-green-500 uppercase font-bold">Online</span>
                           </div>
                           <div className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
                             <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                               <span className="text-sm font-medium">Mailroom Engine</span>
                             </div>
                             <span className="text-xs text-yellow-500 uppercase font-bold">Syncing</span>
                           </div>
                           <div className="flex items-center justify-between p-3 rounded-lg bg-black/5 dark:bg-white/5">
                             <div className="flex items-center gap-3">
                               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                               <span className="text-sm font-medium">Financial Sync</span>
                             </div>
                             <span className="text-xs text-green-500 uppercase font-bold">Online</span>
                           </div>
                         </div>
                      </div>

                      <div className={`p-6 rounded-3xl border lg:col-span-2 overflow-hidden flex flex-col h-72 ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className={`text-sm font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Daily Operations Log</h3>
                          <span className={`px-2 py-1 rounded text-xs font-bold ${theme === 'dark' ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'}`}>Live Updates</span>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                          {[
                            { time: '10:42 AM', type: 'email', action: 'Sent 145 renewal offers (Auto-Pricing)', status: 'Success' },
                            { time: '10:15 AM', type: 'maintenance', action: 'Dispatched plumber to 123 Maple St', status: 'Urgent' },
                            { time: '09:30 AM', type: 'report', action: 'Generated Q3 Forecast Report', status: 'Completed' },
                            { time: '09:05 AM', type: 'email', action: 'Processed 34 inbound tenant emails', status: 'Parsed' },
                            { time: '08:00 AM', type: 'system', action: 'Daily financial ledger reconciliation', status: 'Synced' },
                            { time: '07:30 AM', type: 'marketing', action: 'Updated listings on 4 syndication networks', status: 'Success' }
                          ].map((log, i) => (
                            <div key={i} className={`flex items-center justify-between p-3 rounded-xl text-sm ${theme === 'dark' ? 'hover:bg-white/5 border border-white/5' : 'hover:bg-gray-50 border border-gray-100'}`}>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-mono ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`}>{log.time}</span>
                                <span className={`font-medium ${theme === 'dark' ? 'text-white/80' : 'text-gray-700'}`}>{log.action}</span>
                              </div>
                              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md ${
                                log.status === 'Urgent' ? 'bg-red-500/20 text-red-500' :
                                theme === 'dark' ? 'bg-white/10 text-white/50' : 'bg-gray-100 text-gray-500'
                              }`}>{log.status}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'properties' && (
                  <div className="space-y-8">
                    <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18} /> Add Property</h3>
                      <form onSubmit={handlePropertySubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Property Name" value={propertyForm.name} onChange={e => setPropertyForm({...propertyForm, name: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Address" value={propertyForm.address} onChange={e => setPropertyForm({...propertyForm, address: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="City" value={propertyForm.city} onChange={e => setPropertyForm({...propertyForm, city: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Country" value={propertyForm.country} onChange={e => setPropertyForm({...propertyForm, country: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} type="number" min="1" placeholder="Number of Units" value={propertyForm.units} onChange={e => setPropertyForm({...propertyForm, units: parseInt(e.target.value)})} required />
                        <select className={`p-3 text-sm rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={propertyForm.property_type} onChange={e => setPropertyForm({...propertyForm, property_type: e.target.value})}>
                          <option value="multifamily">Multi-Family</option>
                          <option value="single_family">Single Family</option>
                          <option value="commercial">Commercial</option>
                        </select>
                        <div className="md:col-span-2 flex justify-end">
                          <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md">Add Property</button>
                        </div>
                      </form>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <table className="w-full text-left text-sm">
                        <thead className={`${theme === 'dark' ? 'bg-black/30 text-gray-400' : 'bg-gray-50 text-gray-600'} uppercase font-bold text-xs tracking-wider`}>
                          <tr><th className="p-4">Name</th><th className="p-4">Location</th><th className="p-4">Units</th><th className="p-4">Type</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                          {properties.map(p => (
                            <tr key={p.id}>
                              <td className="p-4 font-medium">{p.name}</td>
                              <td className="p-4">{p.location?.address}, {p.location?.city}</td>
                              <td className="p-4 text-center">{p.units}</td>
                              <td className="p-4 capitalize">{p.property_type}</td>
                              <td className="p-4 flex gap-2 justify-end">
                                <button onClick={() => handleDeleteProperty(p.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                          {properties.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No properties found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'tenants' && (
                  <div className="space-y-8">
                     <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18} /> Add Tenant</h3>
                      <form onSubmit={handleTenantSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Full Name" value={tenantForm.name} onChange={e => setTenantForm({...tenantForm, name: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} type="email" placeholder="Email" value={tenantForm.email} onChange={e => setTenantForm({...tenantForm, email: e.target.value})} required />
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Phone" value={tenantForm.phone} onChange={e => setTenantForm({...tenantForm, phone: e.target.value})} required />
                        
                        <select className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={tenantForm.property_id} onChange={e => setTenantForm({...tenantForm, property_id: e.target.value})} required>
                          <option value="">Select Property...</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Assigned Unit" value={tenantForm.assigned_unit} onChange={e => setTenantForm({...tenantForm, assigned_unit: e.target.value})} required />
                        <div className="md:col-span-2 flex justify-end">
                          <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-all shadow-md">Add Tenant</button>
                        </div>
                      </form>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <table className="w-full text-left text-sm">
                        <thead className={`${theme === 'dark' ? 'bg-black/30 text-gray-400' : 'bg-gray-50 text-gray-600'} uppercase font-bold text-xs tracking-wider`}>
                          <tr><th className="p-4">Name</th><th className="p-4">Contact</th><th className="p-4">Property</th><th className="p-4">Unit</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                          {tenants.map(t => (
                            <tr key={t.id}>
                              <td className="p-4 font-bold">{t.name}</td>
                              <td className="p-4 text-xs">{t.contact?.email}<br/><span className="text-gray-500">{t.contact?.phone}</span></td>
                              <td className="p-4">{properties.find(p => p.id === t.property_id)?.name || t.property_id}</td>
                              <td className="p-4 font-mono text-xs">{t.assigned_unit}</td>
                              <td className="p-4 flex justify-end">
                                <button onClick={() => handleDeleteTenant(t.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                              </td>
                            </tr>
                          ))}
                          {tenants.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No tenants found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'leases' && (
                  <div className="space-y-8">
                     <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Plus size={18} /> Add Lease</h3>
                      <form onSubmit={handleLeaseSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <select className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={leaseForm.tenant_id} onChange={e => setLeaseForm({...leaseForm, tenant_id: e.target.value})} required>
                          <option value="">Select Tenant...</option>
                          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <select className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={leaseForm.property_id} onChange={e => setLeaseForm({...leaseForm, property_id: e.target.value})} required>
                          <option value="">Select Property...</option>
                          {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Unit" value={leaseForm.unit} onChange={e => setLeaseForm({...leaseForm, unit: e.target.value})} required />
                        
                        <div className="relative">
                          <span className="absolute left-3 top-3 text-gray-500 font-bold">$</span>
                          <input className={`pl-8 p-3 w-full text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} type="number" placeholder="Rent Amount" value={leaseForm.rent} onChange={e => setLeaseForm({...leaseForm, rent: parseFloat(e.target.value)})} required />
                        </div>
                        
                        <select className={`p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={leaseForm.payment_frequency} onChange={e => setLeaseForm({...leaseForm, payment_frequency: e.target.value})}>
                          <option value="monthly">Monthly</option>
                          <option value="weekly">Weekly</option>
                          <option value="yearly">Yearly</option>
                        </select>
                        
                        <div className="flex gap-2">
                          <input type="date" className={`p-3 text-sm w-full rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={leaseForm.start_date} onChange={e => setLeaseForm({...leaseForm, start_date: e.target.value})} required />
                          <input type="date" className={`p-3 text-sm w-full rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={leaseForm.end_date} onChange={e => setLeaseForm({...leaseForm, end_date: e.target.value})} required />
                        </div>

                        <div className="md:col-span-2 lg:col-span-3 flex justify-end">
                          <button type="submit" className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-md">Create Lease</button>
                        </div>
                      </form>
                    </div>

                    <div className={`rounded-2xl border overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                      <table className="w-full text-left text-sm">
                        <thead className={`${theme === 'dark' ? 'bg-black/30 text-gray-400' : 'bg-gray-50 text-gray-600'} uppercase font-bold text-xs tracking-wider`}>
                          <tr><th className="p-4">Tenant</th><th className="p-4">Property/Unit</th><th className="p-4">Rent</th><th className="p-4">Dates</th><th className="p-4 text-right">Actions</th></tr>
                        </thead>
                        <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                          {leases.map(l => {
                            const isExpiring = new Date(l.end_date).getTime() < Date.now() + (90 * 86400000);
                            return (
                              <tr key={l.id}>
                                <td className="p-4 font-bold">{tenants.find(t=>t.id===l.tenant_id)?.name || l.tenant_id}</td>
                                <td className="p-4">{properties.find(p=>p.id===l.property_id)?.name} - Unit {l.unit}</td>
                                <td className="p-4 text-green-500 font-bold">${l.rent}/{l.payment_frequency}</td>
                                <td className="p-4 text-xs">
                                  {l.start_date} to {l.end_date}
                                  {isExpiring && <span className="ml-2 px-1.5 py-0.5 bg-yellow-500/20 text-yellow-500 border border-yellow-500/50 rounded text-[10px] uppercase font-bold">Expiring Soon</span>}
                                </td>
                                <td className="p-4 flex justify-end">
                                  <button onClick={() => handleDeleteLease(l.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg"><Trash2 size={16} /></button>
                                </td>
                              </tr>
                            );
                          })}
                          {leases.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">No active leases found.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {activeTab === 'emails' && (
                  <div className="space-y-6">
                    {editingEmail ? (
                      <div className={`p-6 rounded-2xl border shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2"><Edit2 size={20} /> Review Email Draft</h3>
                            <button onClick={()=>setEditingEmail(null)} className="text-gray-500 hover:text-gray-800"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-xs uppercase font-bold text-gray-500 mb-1">To</label>
                            <input className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={editingEmail.to} onChange={e => setEditingEmail({...editingEmail, to: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Subject</label>
                            <input className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={editingEmail.subject} onChange={e => setEditingEmail({...editingEmail, subject: e.target.value})} />
                          </div>
                          <div>
                            <label className="block text-xs uppercase font-bold text-gray-500 mb-1">Body</label>
                            <textarea className={`w-full p-4 text-sm rounded-xl border min-h-[200px] focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={editingEmail.body} onChange={e => setEditingEmail({...editingEmail, body: e.target.value})} />
                          </div>
                          <div className="flex justify-end gap-3 pt-4">
                            <button onClick={handleSaveEmailDraft} className="px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-gray-200 hover:bg-gray-300 text-gray-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-colors"><Save size={16}/> Save Draft</button>
                            <button onClick={() => handleSendEmail(editingEmail)} className="px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors"><Send size={16}/> Approve & Send</button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className="text-xl font-bold mb-2">Communications Center</h3>
                                <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Review agent drafts or view sent/received communication.</p>
                            </div>
                            <button onClick={() => setEditingEmail({ type: 'draft', to: '', subject: '', body: '' })} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-colors"><Plus size={16}/> Compose</button>
                        </div>

                        <div className={`rounded-3xl border overflow-hidden shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                          <div className={`grid grid-cols-6 p-4 text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'bg-black/30 text-gray-400 border-b border-white/5' : 'bg-gray-50 text-gray-600 border-b border-gray-200'}`}>
                              <div className="col-span-1">Status</div>
                              <div className="col-span-2">Recipient / Sender</div>
                              <div className="col-span-2">Subject</div>
                              <div className="col-span-1 text-right">Actions</div>
                          </div>
                          <div className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                            {emails.length === 0 ? (
                              <div className="p-8 text-center text-gray-500">No emails in the system.</div>
                            ) : emails.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(email => (
                              <div key={email.id} className="grid grid-cols-6 p-4 items-center gap-4 hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-sm">
                                <div className="col-span-1 flex items-center gap-2">
                                  {email.type === 'draft' ? (
                                    <span className="px-2 py-1 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-bold text-[10px] uppercase border border-yellow-500/30">Review Pending</span>
                                  ) : email.type === 'sent' ? (
                                    <span className="px-2 py-1 flex items-center gap-1 rounded bg-green-500/20 text-green-600 dark:text-green-400 font-bold text-[10px] uppercase border border-green-500/30"><Check size={12}/> Deliv.</span>
                                  ) : (
                                    <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 font-bold text-[10px] uppercase border border-blue-500/30">Received</span>
                                  )}
                                </div>
                                <div className="col-span-2 font-medium truncate" title={email.to || email.from}>{email.type === 'received' ? email.from : email.to}</div>
                                <div className="col-span-2 truncate text-gray-600 dark:text-gray-300" title={email.subject}>{email.subject}</div>
                                <div className="col-span-1 flex justify-end gap-2">
                                  {email.type === 'draft' && (
                                    <button onClick={() => setEditingEmail(email)} className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors"><Edit2 size={16}/></button>
                                  )}
                                  <button onClick={() => handleDeleteEmail(email.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'import' && (
                  <div className="space-y-8 max-w-4xl mx-auto mt-4">
                    {/* Bulk Excel Upload Section */}
                    <div className={`p-8 rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center ${theme === 'dark' ? 'bg-black/20 border-white/20' : 'bg-gray-50 border-gray-300'}`}>
                      <Upload size={48} className={`mb-4 ${theme === 'dark' ? 'text-white/40' : 'text-gray-400'}`} />
                      <h3 className="text-xl font-bold mb-2">Upload Excel or CSV Data</h3>
                      <p className={`mb-6 text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Import Properties, Tenants, and Leases in one go. Must contain columns: <code className="px-1 py-0.5 bg-black/10 rounded">property_name</code>, <code className="px-1 py-0.5 bg-black/10 rounded">tenant_name</code>, <code className="px-1 py-0.5 bg-black/10 rounded">rent_amount</code>.</p>
                      
                      <div className="flex flex-col items-center gap-4">
                        <label className="cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-md">
                          Choose File
                          <input type="file" accept=".xlsx, .xls, .csv" onChange={handleFileChange} className="hidden" />
                        </label>
                        {excelFile && <div className="text-sm font-mono bg-blue-500/10 text-blue-500 px-3 py-1 rounded-full">{excelFile.name}</div>}
                      </div>
                      
                      <button 
                        onClick={handleExcelUpload} 
                        disabled={!excelFile || uploading}
                        className={`mt-6 px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center justify-center min-w-[200px] ${!excelFile ? 'bg-gray-500/20 text-gray-500 cursor-not-allowed' : uploading ? 'bg-blue-500/50 text-white cursor-wait' : 'bg-green-600 hover:bg-green-700 text-white'}`}
                      >
                        {uploading ? <><Loader2 className="animate-spin mr-2" size={18} /> Processing...</> : 'Upload & Process Data'}
                      </button>
                    </div>

                    {/* API Integration Section */}
                    <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <div className="mb-6">
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2">Third-Party PMS Integration</h3>
                        <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Automatically onboard your clients by syncing properties, tenants, and active leases from Yardi, AppFolio, or Buildium using our secure API gateways.</p>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div className="space-y-1">
                          <label className="text-xs uppercase font-bold tracking-wider text-gray-500">Select Provider</label>
                          <select className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={integrationProvider} onChange={e => setIntegrationProvider(e.target.value)}>
                            <option value="yardi">Yardi Voyager / Breeze</option>
                            <option value="appfolio">AppFolio Property Manager</option>
                            <option value="buildium">Buildium</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs uppercase font-bold tracking-wider text-gray-500">API Key / Integration Token</label>
                          <input type="password" placeholder="sk_test_..." className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={integrationKey} onChange={e => setIntegrationKey(e.target.value)} />
                        </div>
                      </div>
                      
                      <div className="mt-6 flex justify-end">
                         <button 
                          onClick={handleSyncIntegration} 
                          disabled={syncing || !integrationKey}
                          className={`px-6 py-3 rounded-xl font-bold flex items-center transition-all ${syncing || !integrationKey ? 'bg-gray-500/20 text-gray-500' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'}`}
                        >
                          {syncing ? <><RefreshCw className="animate-spin mr-2" size={18} /> Synchronizing...</> : <><RefreshCw className="mr-2" size={18} /> Connect & Sync</>}
                        </button>
                      </div>
                    </div>

                    {previewData && (
                      <div className="mt-8 space-y-4">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-green-500">Data Preview (First 5 Rows)</h4>
                        <div className={`rounded-2xl border overflow-x-auto shadow-sm ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200'}`}>
                          <table className="w-full text-left text-xs whitespace-nowrap">
                            <thead className={`${theme === 'dark' ? 'bg-black/30 text-gray-400' : 'bg-gray-50 text-gray-600'} font-bold`}>
                              <tr>
                                {Object.keys(previewData[0] || {}).map(k => <th key={k} className="p-3">{k}</th>)}
                              </tr>
                            </thead>
                            <tbody className={`divide-y ${theme === 'dark' ? 'divide-white/5' : 'divide-gray-100'}`}>
                              {previewData.map((row: any, i) => (
                                <tr key={i}>
                                  {Object.values(row).map((v: any, j) => <td key={j} className="p-3">{String(v)}</td>)}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {activeTab === 'integrations' && (
                  <div className="space-y-6 max-w-4xl mx-auto mt-4">
                    <div className={`p-8 rounded-3xl border ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <h3 className="text-xl font-bold mb-2">Integrations</h3>
                      <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Connect external services to EstateNexus for enhanced AI capabilities.</p>
                      
                      <div className={`p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <h4 className="font-bold flex items-center gap-2">
                            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-5 h-5"><path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" fill="#00a4ef"/></svg>
                            Microsoft 365 / Entra ID
                          </h4>
                          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Connect personal Outlook or Entra ID for reading/sending emails and team management.</p>
                        </div>
                        <div>
                          {msConnected ? (
                            <button onClick={handleDisconnectMs} className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-all">
                              Disconnect
                            </button>
                          ) : (
                            <button onClick={handleConnectMs} className="px-4 py-2 bg-[#00a4ef] hover:bg-[#008ac9] text-white rounded-lg text-sm font-bold transition-all">
                              Connect Microsoft
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {!msConnected && (
                        <div className={`mt-6 p-4 rounded-xl text-xs flex gap-3 ${theme === 'dark' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-yellow-50 text-yellow-800'}`}>
                          <div className="w-1 h-full bg-yellow-500 rounded-full" />
                          <div>
                            <p className="font-bold mb-1">Setup Required</p>
                            <p>To use this feature, configure these environment variables:</p>
                            <ul className="list-disc ml-5 mt-1">
                              <li><code>MS_CLIENT_ID</code></li>
                              <li><code>MS_CLIENT_SECRET</code></li>
                            </ul>
                            <p className="mt-2 text-[10px] opacity-80">Provider URL: https://login.microsoftonline.com/common/oauth2/v2.0/authorize</p>
                          </div>
                        </div>
                      )}

                      <div className={`mt-6 p-6 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${theme === 'dark' ? 'bg-black/30 border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                        <div>
                          <h4 className="font-bold flex items-center gap-2">
                            <span className="text-xl font-black text-green-600">ZOHO</span> Desk
                          </h4>
                          <p className={`text-xs mt-1 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Integrate your Zoho Desk ticketing system for automatic ticket creation, customer identification, and management by the AI.</p>
                        </div>
                        <div>
                           {zohoConnected ? (
                            <button onClick={handleDisconnectZoho} className="px-4 py-2 border border-red-500 text-red-500 hover:bg-red-500 hover:text-white rounded-lg text-sm font-bold transition-all">
                              Disconnect
                            </button>
                           ) : (
                             <button onClick={handleConnectZoho} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition-all">
                               Connect Zoho
                             </button>
                           )}
                        </div>
                      </div>

                      {!zohoConnected && (
                        <div className={`mt-6 p-4 rounded-xl text-xs flex gap-3 ${theme === 'dark' ? 'bg-yellow-500/10 text-yellow-300' : 'bg-yellow-50 text-yellow-800'}`}>
                          <div className="w-1 h-full bg-yellow-500 rounded-full" />
                          <div>
                            <p className="font-bold mb-1">Zoho Setup Instructions</p>
                            <p>To use this feature, create an OAuth client in Zoho Developer Console (Server-based Application) and configure these environment variables:</p>
                            <ul className="list-disc ml-5 mt-1">
                              <li><code>ZOHO_CLIENT_ID</code></li>
                              <li><code>ZOHO_CLIENT_SECRET</code></li>
                            </ul>
                            <p className="mt-2 text-[10px] space-y-1 opacity-80">
                               <strong>Homepage URL:</strong> <code>{typeof window !== 'undefined' && window.location.origin}</code><br/>
                               <strong>Authorized Redirect URIs:</strong> <code>{typeof window !== 'undefined' && `${window.location.origin}/api/auth/zoho/callback`}</code>
                            </p>
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                )}
                             {activeTab === 'tickets' && (
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold">Help Desk & Tickets</h3>
                        <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Manage service requests and automated AI issue resolution.</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={async () => {
                            toast.loading("Syncing Zoho tickets...", { id: "sync-zoho" });
                            try {
                               const res = await fetch("/api/estate/sync-zoho-tickets", { method: 'POST', headers: { 'x-role': 'admin' }});
                               if (res.ok) {
                                  toast.success("Successfully synced Zoho tickets", { id: "sync-zoho" });
                                  fetchTickets();
                               } else {
                                  toast.error("Failed to sync Zoho tickets", { id: "sync-zoho" });
                               }
                            } catch (e) {
                               toast.error("Sync failed", { id: "sync-zoho" });
                            }
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-all">
                          <RefreshCw size={16} /> Sync Zoho
                        </button>
                        <button 
                          onClick={() => setShowCreateTicket(true)}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-all">
                          <Plus size={16} /> New Ticket
                        </button>
                        <button 
                          onClick={async () => {
                            toast.loading("AI Agent processing tickets...", { id: "ai-process" });
                            try {
                               const res = await fetch("/api/estate/process-tickets", { method: 'POST', headers: { 'x-role': 'admin' }});
                               if (res.ok) {
                                  const result = await res.json();
                                  toast.success(result.message || "Tickets processed by AI", { id: "ai-process" });
                                  fetchTickets();
                               } else {
                                  toast.error("Processing failed", { id: "ai-process" });
                               }
                            } catch (e) {
                               toast.error("AI service error", { id: "ai-process" });
                            }
                          }}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-bold flex items-center gap-2 text-sm shadow-md transition-all">
                          <Activity size={16} /> AI Process
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
                      {(["Open", "On Hold", "Escalated", "Closed"] as const).map(status => (
                        <div key={status} className={`flex flex-col gap-4 p-4 rounded-3xl border ${theme === 'dark' ? 'bg-black/20 border-white/5' : 'bg-gray-100 border-gray-200'} min-h-[500px]`}>
                          <div className="flex items-center justify-between px-2">
                            <h4 className="text-xs uppercase tracking-widest font-black flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                status === 'Open' ? 'bg-blue-400' :
                                status === 'On Hold' ? 'bg-yellow-400' :
                                status === 'Escalated' ? 'bg-red-400' : 'bg-green-400'
                              }`} />
                              {status}
                            </h4>
                            <span className="text-[10px] font-bold opacity-40">{tickets.filter(t => t.status === status).length}</span>
                          </div>
                          
                          <div className="flex-1 space-y-3 overflow-y-auto max-h-[500px] pr-1 custom-scrollbar">
                            {tickets.filter(t => t.status === status).length === 0 ? (
                              <div className="text-[10px] text-center p-8 opacity-20 italic">No tickets</div>
                            ) : tickets.filter(t => t.status === status).map(ticket => (
                              <div 
                                key={ticket.id} 
                                onClick={() => setSelectedTicket(ticket)}
                                className={`p-4 rounded-2xl border shadow-sm transition-all hover:scale-[1.02] cursor-pointer ${theme === 'dark' ? 'bg-[#1a1a1a] border-white/10 hover:border-blue-500/30' : 'bg-white border-gray-200 hover:border-blue-300'}`}
                              >
                                <div className="flex justify-between items-start mb-2">
                                  <span className={`text-[8px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded border ${
                                    ticket.source === 'zoho' ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-blue-500/30 text-blue-500 bg-blue-500/5'
                                  }`}>{ticket.source}</span>
                                  <span className={`text-[8px] font-bold uppercase tracking-tighter ${
                                    ticket.priority === 'Urgent' ? 'text-red-500' : 
                                    ticket.priority === 'High' ? 'text-orange-500' : 'text-gray-400'
                                  }`}>{ticket.priority}</span>
                                </div>
                                <h5 className="text-sm font-bold truncate mb-1">{ticket.subject}</h5>
                                <p className={`text-[11px] line-clamp-2 mb-3 leading-relaxed ${theme === 'dark' ? 'text-white/40' : 'text-gray-500'}`}>{ticket.description}</p>
                                <div className="flex items-center justify-between pt-2 border-t border-dashed border-white/5">
                                  <span className="text-[9px] font-mono opacity-40">{ticket.contact_email}</span>
                                  <div className="flex gap-1">
                                    <button onClick={() => {}} className="p-1 hover:bg-white/10 rounded"><Edit2 size={10}/></button>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {showCreateTicket && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                    <div className={`relative w-full max-w-xl border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}>
                      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-[#161616]' : 'border-gray-200 bg-gray-50'}`}>
                        <h3 className="font-bold flex items-center gap-2"><Plus size={18}/> Create New Ticket</h3>
                        <button onClick={() => setShowCreateTicket(false)} className="p-2 hover:bg-black/10 rounded-full transition-colors"><X size={20}/></button>
                      </div>
                      <form onSubmit={handleTicketSubmit} className="flex-1 overflow-y-auto p-8 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-500">Subject</label>
                          <input className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Issue Title" value={ticketForm.subject} onChange={e => setTicketForm({...ticketForm, subject: e.target.value})} required />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-500">Contact Email</label>
                          <input className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} type="email" placeholder="tenant@example.com" value={ticketForm.contact_email} onChange={e => setTicketForm({...ticketForm, contact_email: e.target.value})} required />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Priority</label>
                            <select className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={ticketForm.priority} onChange={e => setTicketForm({...ticketForm, priority: e.target.value})}>
                              <option value="Low">Low</option>
                              <option value="Medium">Medium</option>
                              <option value="High">High</option>
                              <option value="Urgent">Urgent</option>
                            </select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] uppercase font-bold text-gray-500">Initial Status</label>
                            <select className={`w-full p-3 text-sm rounded-xl border focus:outline-none ${theme === 'dark' ? 'bg-black/40 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} value={ticketForm.status} onChange={e => setTicketForm({...ticketForm, status: e.target.value})}>
                              <option value="Open">Open</option>
                              <option value="On Hold">On Hold</option>
                              <option value="Escalated">Escalated</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] uppercase font-bold text-gray-500">Description</label>
                          <textarea className={`w-full p-4 text-sm rounded-xl border min-h-[120px] focus:outline-none ${theme === 'dark' ? 'bg-black/50 border-white/10 text-white' : 'bg-gray-50 border-gray-300'}`} placeholder="Provide details about the request..." value={ticketForm.description} onChange={e => setTicketForm({...ticketForm, description: e.target.value})} required />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                           <button type="button" onClick={() => setShowCreateTicket(false)} className="px-5 py-2.5 rounded-xl font-bold bg-gray-200 dark:bg-white/10 text-sm">Cancel</button>
                           <button type="submit" className="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white text-sm shadow-md">Create Ticket</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Ticket Details Modal */}
                {selectedTicket && (
                  <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
                    <div className={`relative w-full max-w-2xl border rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh] ${theme === 'dark' ? 'bg-[#0f0f0f] border-white/10' : 'bg-white border-gray-200'}`}>
                      <div className={`p-6 border-b flex items-center justify-between ${theme === 'dark' ? 'border-white/10 bg-[#161616]' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border ${
                            selectedTicket.source === 'zoho' ? 'border-green-500/30 text-green-500 bg-green-500/5' : 'border-blue-500/30 text-blue-500 bg-blue-500/5'
                          }`}>{selectedTicket.source}</span>
                          <h3 className="font-bold">Ticket Details</h3>
                        </div>
                        <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-black/10 rounded-full transition-colors"><X size={20}/></button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-8 space-y-6">
                        <div>
                          <h4 className="text-2xl font-black mb-2 tracking-tight">{selectedTicket.subject}</h4>
                          <div className="flex items-center gap-4 text-xs">
                             <div className="flex items-center gap-1.5 font-bold">
                               <div className={`w-2 h-2 rounded-full ${
                                  selectedTicket.status === 'Open' ? 'bg-blue-400' :
                                  selectedTicket.status === 'On Hold' ? 'bg-yellow-400' :
                                  selectedTicket.status === 'Escalated' ? 'bg-red-400' : 'bg-green-400'
                               }`} />
                               {selectedTicket.status}
                             </div>
                             <div className={`font-bold ${selectedTicket.priority === 'Urgent' ? 'text-red-500' : 'text-gray-400'}`}>Priority: {selectedTicket.priority}</div>
                             <div className="text-gray-400 font-mono">ID: {selectedTicket.external_id || selectedTicket.id}</div>
                          </div>
                        </div>

                        <div className={`p-4 rounded-2xl ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-2">Description</h5>
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">{selectedTicket.description || "No description provided."}</p>
                        </div>

                        {selectedTicket.resolution && (
                          <div className="p-4 rounded-2xl bg-green-500/10 border border-green-500/20">
                            <h5 className="text-[10px] uppercase tracking-widest font-black text-green-500 mb-2">Resolution / Response</h5>
                            <p className="text-sm leading-relaxed font-medium">{selectedTicket.resolution}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                           <div>
                             <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">Contact Email</h5>
                             <div className="text-sm font-medium">{selectedTicket.contact_email}</div>
                           </div>
                           <div>
                             <h5 className="text-[10px] uppercase tracking-widest font-black text-gray-500 mb-1">Created At</h5>
                             <div className="text-sm font-medium">{new Date(selectedTicket.created_at).toLocaleString()}</div>
                           </div>
                        </div>
                      </div>

                      <div className={`p-6 border-t flex justify-end gap-3 ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                         {selectedTicket.status !== 'Closed' && (
                           <button 
                            onClick={async () => {
                              toast.loading("Closing ticket...", { id: "close-ticket" });
                              try {
                                const res = await fetch(`/api/estate/tickets/${selectedTicket.id}`, {
                                  method: 'PUT',
                                  headers: { 'Content-Type': 'application/json', 'x-role': 'admin' },
                                  body: JSON.stringify({ status: 'Closed' })
                                });
                                if (res.ok) {
                                  toast.success("Ticket closed", { id: "close-ticket" });
                                  fetchTickets();
                                  setSelectedTicket({ ...selectedTicket, status: 'Closed' });
                                }
                              } catch (e) {
                                toast.error("Failed to close", { id: "close-ticket" });
                              }
                            }}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-bold shadow-md transition-all">Close Ticket</button>
                         )}
                         <button onClick={() => setSelectedTicket(null)} className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-white/10 dark:hover:bg-white/20 rounded-xl text-sm font-bold transition-all">Close View</button>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'operations' && (
                  <div className="space-y-6 max-w-5xl mx-auto mt-4">
                    <div className={`p-6 rounded-3xl border ${theme === 'dark' ? 'bg-[#181818] border-white/10' : 'bg-white border-gray-200 shadow-sm'}`}>
                      <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-purple-500"><Activity size={20} /> AI Autonomous Operations</h3>
                      <p className={`text-sm mb-6 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>These modules are managed automatically by the AI Agent based on continuous analysis of the properties, leases, and market data.</p>
                      
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Financials */}
                        <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'} border border-transparent hover:border-purple-500/30 transition-all`}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 w-10 h-10 flex flex-col items-center justify-center bg-blue-500 text-white rounded-xl shadow-lg"><DollarSign size={20}/></div>
                            <h4 className="font-bold text-md">Advanced Financials</h4>
                          </div>
                          <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Automated multi-currency budgeting and machine-learning yield forecasting.</p>
                          <div className="space-y-2">
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">EUR/USD Hedging</span>
                              <span className="text-green-500 font-bold">Active</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">Q4 Forecast Variance</span>
                              <span className="text-blue-500 font-bold">+2.4%</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">Dynamic Pricing Avg</span>
                              <span className="text-purple-500 font-bold">Optimized</span>
                            </div>
                          </div>
                        </div>

                        {/* Compliance */}
                        <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'} border border-transparent hover:border-purple-500/30 transition-all`}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 w-10 h-10 flex flex-col items-center justify-center bg-green-500 text-white rounded-xl shadow-lg"><ShieldCheck size={20}/></div>
                            <h4 className="font-bold text-md">Regulatory Compliance</h4>
                          </div>
                          <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>Real-time jurisdictional monitoring and automated audit preparation.</p>
                          <div className="space-y-2">
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">NYC Local Law 97</span>
                              <span className="text-green-500 font-bold">Compliant</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg border  ${theme === 'dark' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-yellow-50 border-yellow-200'}`}>
                              <span className="font-medium">CA Tenant Prot. Act</span>
                              <span className="text-yellow-600 font-bold">Review Needed</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">UK GDPR Compliance</span>
                              <span className="text-green-500 font-bold">100%</span>
                            </div>
                          </div>
                        </div>

                        {/* predictive maintenance */}
                        <div className={`p-5 rounded-2xl ${theme === 'dark' ? 'bg-black/30' : 'bg-gray-50'} border border-transparent hover:border-purple-500/30 transition-all`}>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 w-10 h-10 flex flex-col items-center justify-center bg-orange-500 text-white rounded-xl shadow-lg"><Wrench size={20}/></div>
                            <h4 className="font-bold text-md">Predictive Maintenance</h4>
                          </div>
                          <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-white/60' : 'text-gray-500'}`}>IoT sensor analytics identifying equipment anomalies and dispatching vendors.</p>
                          <div className="space-y-2">
                            <div className={`flex justify-between text-xs p-2 rounded-lg border ${theme === 'dark' ? 'bg-red-500/10 border-red-500/20' : 'bg-red-50 border-red-200'}`}>
                              <span className="font-medium">HVAC Unit B-4</span>
                              <span className="text-red-500 font-bold">89% Fail Prob.</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">Vendor Dispatch</span>
                              <span className="text-blue-500 font-bold">Scheduled</span>
                            </div>
                            <div className={`flex justify-between text-xs p-2 rounded-lg ${theme === 'dark' ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                              <span className="font-medium">Elevator Network</span>
                              <span className="text-green-500 font-bold">Healthy</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      <div className={`mt-6 p-4 rounded-xl text-xs flex gap-3 ${theme === 'dark' ? 'bg-blue-500/10 text-blue-300' : 'bg-blue-50 text-blue-800'}`}>
                        <div className="w-1 h-full bg-blue-500 rounded-full" />
                        <p><strong>Note:</strong> Ask the AI agent in the chat to provide specific detailed reports on budgeting across multiple currencies, regulatory monitoring per property, or current IoT predictive maintenance statuses.</p>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === 'knowledgeBase' && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl font-bold">Estate Knowledge Base</h3>
                      <button 
                        onClick={fetchKnowledgeBase}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${theme === 'dark' ? 'bg-white/5 hover:bg-white/10' : 'bg-gray-100 hover:bg-gray-200'}`}
                      >
                        <RefreshCw size={14} /> Refresh KB
                      </button>
                    </div>
                    <div className={`p-8 rounded-3xl border shadow-sm markdown-body ${theme === 'dark' ? 'bg-[#121212] border-white/10' : 'bg-white border-gray-200'}`}>
                      <ReactMarkdown>{kbContent || "*Knowledge base is empty. Please add properties or tenants to populate it.*"}</ReactMarkdown>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
