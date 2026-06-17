/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  Layers, 
  ChevronRight, 
  BookOpen, 
  FileText, 
  Activity, 
  Volume2, 
  Send, 
  Key, 
  Clock, 
  HelpCircle,
  Database,
  Grid,
  Brain
} from 'lucide-react';

// Import Types
import { Message, SourceDoc, ChatSession, MemoryFact } from './types';

// Import Components
import PromptCompanion from './components/PromptCompanion';
import DocumentManager from './components/DocumentManager';
import MemoryHistoryManager from './components/MemoryHistoryManager';

// Predefined mock SAP and training templates for 1-click loading / training simulation
const SAP_ABAP_TEMPLATE = `*-------------------------------------------------------------------*
* REPORT ZSAP_PURCHASE_ORDER_VALIDATION
* Purpose: Validates standard SAP Purchase Orders and flags currency
* discrepancies and ceiling authorizations for HANA core modules.
*-------------------------------------------------------------------*
REPORT Z_PO_VALIDATOR NO STANDARD PAGE HEADING.

TYPES: BEGIN OF ty_purchase_order,
         ebeln TYPE ebeln,     " PO Document Identification Number
         bsart TYPE bsart,     " PO Document Type (e.g. NB for Standard)
         lifnr TYPE lifnr,     " Vendor Account Identification Code
         waers TYPE waers,     " PO Document Currency Key (USD, EUR, INR)
         netwr TYPE netwr_ap,  " Net Price/Value in Document Currency
         ekorg TYPE ekorg,     " Purchasing Organization Entity Code
       END OF ty_purchase_order.

DATA: lt_po_records TYPE TABLE OF ty_purchase_order,
      ls_po_record  TYPE ty_purchase_order,
      lv_po_status  TYPE char10.

* Validation Routine: 
* Rule 1: Document classification Type 'NB' must retain currency USD or EUR.
* Rule 2: PO transactions where Net Price (NETWR) exceeds 150,000 require manual CFO audit.
LOOP AT lt_po_records INTO ls_po_record.
  IF ls_po_record-bsart = 'NB' AND ( ls_po_record-waers NE 'USD' AND ls_po_record-waers NE 'EUR' ).
    lv_po_status = 'REJECTED'.
    MESSAGE 'CRITICAL: Currency mismatch on Standard PO. Document rejected.' TYPE 'E'.
  ELSEIF ls_po_record-netwr > 150000.
    lv_po_status = 'CFO_AUDIT'.
    MESSAGE 'WARNING: Ceiling exceeded. Routing purchase document to audit.' TYPE 'W'.
  ELSE.
    lv_po_status = 'APPROVED'.
  ENDIF.
ENDLOOP.`;

const SAP_MM_PDF_TEMPLATE = `=== SAP S/4HANA MATERIAL MANAGEMENT MANUAL ===
Document Ref: MM-PR-2026-HANA
Classification: Internal Training Guide

1. MATERIAL REQUIREMENT PLANNING (MRP) GROUPS
MRP groups manage different materials under specialized manufacturing runs. The central transaction is MD04 (Stock/Requirements List).

2. PURCHASING GROUPS (ORGANIZATION ALIGNMENT)
Purchasing Group 001 maps to regional industrial procurements, whereas Purchasing Group XYZ handles global tech allocations.

3. PHYSICAL INVENTORY (PI) FLOW
PI counts must be cleared within 30 days of standard fiscal run closure. MIGO_GI transaction handles physical balance postings back directly to DB tables:
- Table MARA: General Material Data indicators
- Table MARC: Material Data per Plant
- Table MARD: Storage Location Data parameters for Materials`;

const SAP_COPA_FI_TEMPLATE = `=== SAP CONTROLLING & FINANCIAL AUDITING SCHEMA ===
System Node: ER-FI-COPA-01
Storage Engine: S/4HANA DB Columnar Layout

1. FINANCIAL TRANSACTION IDENTIFIERS
- G_L Account Code Table: SKA1
- General Ledger Journal Postings Transaction: FB50

2. CO/PA (Controlling & Profitability Analysis) DIMENSION MATRIX
Profitability segments are mapped directly using the dynamic table CE1XXXX (where XXXX represents the active Operating Concern ID).
Active Keys:
- KNDNR: Customer Number key
- ARTNR: Material/Product Number reference code
- BUKRS: Company Code entity indicator

3. AUDITING RULES & CONTROL THRESHOLDS
All ledger transfers crossing 500,000 monetary weight values require absolute document verification against Table SKB1 (G/L account master record per company code).`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'doc-manage' | 'memory-history'>('chat');
  
  // Set global switcher so modal can redirect tab if needed
  useEffect(() => {
    (window as any)._switchTabGlobal = (tab: any) => {
      setActiveTab(tab);
    };
  }, []);

  const [localTime, setLocalTime] = useState(new Date().toLocaleTimeString());

  useEffect(() => {
    const timer = setInterval(() => {
      setLocalTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // -------------------------------------------------------------
  // MODULE 1: ACTIVE DOCUMENTS / RAG DATA SOURCES
  // -------------------------------------------------------------
  const [documents, setDocuments] = useState<SourceDoc[]>(() => {
    const saved = localStorage.getItem('multi_app_rag_docs');
    if (saved) return JSON.parse(saved);
    // Default initial seeded sources
    return [
      {
        id: 'seed-1',
        name: 'SAP_HANA_MM_Manual_v4.pdf',
        type: 'pdf',
        content: SAP_MM_PDF_TEMPLATE,
        size: '1.2 KB',
        uploadedAt: new Date().toLocaleDateString()
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('multi_app_rag_docs', JSON.stringify(documents));
  }, [documents]);

  const handleAddDocument = (newDoc: SourceDoc) => {
    setDocuments(prev => [newDoc, ...prev]);
  };

  const handleRemoveDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const handleLoadTemplate = (type: 'abap' | 'mm_pdf' | 'fi_doc') => {
    let name = '';
    let content = '';
    let fileType: 'code' | 'pdf' | 'text' = 'text';
    let sizeStr = '1.0 KB';

    if (type === 'abap') {
      name = 'SAP_PurchaseOrders_Validator.abap';
      content = SAP_ABAP_TEMPLATE;
      fileType = 'code';
      sizeStr = '2.1 KB';
    } else if (type === 'mm_pdf') {
      name = 'SAP_HANA_MM_Manual_v4.pdf';
      content = SAP_MM_PDF_TEMPLATE;
      fileType = 'pdf';
      sizeStr = '1.2 KB';
    } else if (type === 'fi_doc') {
      name = 'FI_COPA_Control_Spec.txt';
      content = SAP_COPA_FI_TEMPLATE;
      fileType = 'text';
      sizeStr = '1.4 KB';
    }

    // De-duplicate template loading
    if (documents.some(doc => doc.name === name)) return;

    const newDoc: SourceDoc = {
      id: 'template-' + Date.now(),
      name,
      type: fileType,
      content,
      size: sizeStr,
      uploadedAt: new Date().toLocaleDateString()
    };

    setDocuments(prev => [newDoc, ...prev]);
  };

  // -------------------------------------------------------------
  // MODULE 2: AI PROMPT WORKSPACE WITH DEEP RAG RETRIEVAL
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // CHAT SESSIONS & CONVERSATION HISTORY (CHATGPT STYLE)
  // -------------------------------------------------------------
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem('multi_app_sessions');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return [
      {
        id: 'session-default',
        title: 'Initial Corporate Audit',
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: "Hello! Welcome to the new RAG-enabled AI Studio Workbench. Under the 'Train Base' tab, load or upload your custom training text files, schemas, or images.\n\nType any query inside the workspace to execute automated matching and context evaluation.",
            timestamp: new Date()
          }
        ],
        updatedAt: new Date().toLocaleDateString()
      }
    ];
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const saved = localStorage.getItem('multi_app_active_session_id');
    return saved || 'session-default';
  });

  // Keep sessions and active session id in localStorage
  useEffect(() => {
    localStorage.setItem('multi_app_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('multi_app_active_session_id', activeSessionId);
  }, [activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0] || { id: 'fallback', title: 'Default', messages: [] };
  const messages = activeSession.messages;

  // -------------------------------------------------------------
  // PERSISTENT MEMORY MODULE (CHATGPT MEMORY FEATURE)
  // -------------------------------------------------------------
  const [memories, setMemories] = useState<MemoryFact[]>(() => {
    const saved = localStorage.getItem('multi_app_memories');
    if (saved) return JSON.parse(saved);
    return [
      {
        id: 'mem-1',
        fact: "Primary focus is SAP S/4HANA Material Management validation.",
        category: 'SAP Compliance',
        createdAt: new Date().toLocaleDateString()
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('multi_app_memories', JSON.stringify(memories));
  }, [memories]);

  const handleAddMemory = (fact: string, category: MemoryFact['category']) => {
    const newMem: MemoryFact = {
      id: 'mem-' + Date.now(),
      fact,
      category,
      createdAt: new Date().toLocaleDateString()
    };
    setMemories(prev => [newMem, ...prev]);
  };

  const handleDeleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const handleClearAllMemories = () => {
    setMemories([]);
  };

  // Sessions actions
  const handleStartNewSession = () => {
    const newId = 'session-' + Date.now();
    const newSess: ChatSession = {
      id: newId,
      title: `Audit Session ${sessions.length + 1}`,
      messages: [
        {
          id: 'welcome-' + newId,
          role: 'assistant',
          content: "Starting a fresh consultation. Let me know which SAP scripts, rulesets, or material guidelines we should index and verify today.",
          timestamp: new Date()
        }
      ],
      updatedAt: new Date().toLocaleDateString()
    };
    setSessions(prev => [newSess, ...prev]);
    setActiveSessionId(newId);
    setActiveTab('chat');
  };

  const handleDeleteSession = (id: string) => {
    if (sessions.length <= 1) return;
    const remaining = sessions.filter(s => s.id !== id);
    setSessions(remaining);
    
    if (activeSessionId === id) {
      setActiveSessionId(remaining[0].id);
    }
  };

  const handleRenameSession = (id: string, newTitle: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s));
  };

  const [systemInstruction, setSystemInstruction] = useState('You are an expert full-stack developer and professional SAP architect.');
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (text: string, forceGeneral = false) => {
    if (!text.trim() || isLoading) return;

    // Push client request matching the active session list
    const newUserMsg: Message = {
      id: 'msg-' + Date.now(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        return {
          ...s,
          messages: [...s.messages, newUserMsg],
          updatedAt: new Date().toLocaleDateString()
        };
      }
      return s;
    }));
    setIsLoading(true);

    // Perform client-side RAG search on matching text rules
    let retrievedPassages = '';
    const matchedDocs: SourceDoc[] = [];

    if (!forceGeneral && documents.length > 0) {
      const lowerQuery = text.toLowerCase().trim();
      
      const stopWords = new Set([
        'the', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'is', 'am', 'are', 'was', 'were', 
        'be', 'been', 'being', 'do', 'does', 'did', 'has', 'have', 'had', 'it', 'its', 'they', 'them', 
        'their', 'this', 'that', 'these', 'those', 'what', 'who', 'how', 'why', 'where', 'when', 
        'explain', 'about', 'tell', 'show', 'me', 'please', 'give', 'us', 'an', 'a', 'of', 'i', 'my', 
        'your', 'you', 'hello', 'hi', 'hey', 'there', 'good', 'morning', 'afternoon', 'evening',
        'help', 'ask', 'question', 'answer', 'but', 'not', 'can', 'could', 'would', 'should',
        'file', 'document', 'documents', 'text', 'code', 'routine', 'info', 'information', 'detail', 'details'
      ]);

      const queryWords = lowerQuery.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 2 && !stopWords.has(w));

      documents.forEach(doc => {
        // Skip matching content if it's base64 image data to avoid huge text tokens
        if (doc.type === 'image') return;
        
        const lowerContent = doc.content.toLowerCase();
        const lowerName = doc.name.toLowerCase();
        let matches = false;

        // Direct matching checks
        if (lowerContent.includes(lowerQuery) || lowerQuery.includes(lowerName) || lowerName.includes(lowerQuery)) {
          matches = true;
        } else if (queryWords.length > 0) {
          // Keyword match check (e.g. for "pap" or "ppap")
          const wordMatch = queryWords.some(word => lowerContent.includes(word) || lowerName.includes(word));
          if (wordMatch) {
            matches = true;
          }
        }

        if (matches) {
          matchedDocs.push(doc);
          retrievedPassages += `\n--- Document Source: ${doc.name} ---\n${doc.content}\n`;
        }
      });
    }

    // Embed matching image inputs into the AI call for multimodal training checks
    const matchedImages: { mimeType: string; data: string }[] = [];
    documents.forEach(doc => {
      if (doc.type === 'image') {
        const lowerName = doc.name.toLowerCase();
        const isMentioned = text.toLowerCase().includes(lowerName) || 
                            text.toLowerCase().includes('image') || 
                            text.toLowerCase().includes('diagram') || 
                            text.toLowerCase().includes('picture');
        // Include if explicitly referenced or if total images are small and we are evaluating
        if (isMentioned || documents.length <= 4) {
          const mime = doc.name.endsWith('.svg') ? 'image/svg+xml' : doc.name.endsWith('.png') ? 'image/png' : 'image/jpeg';
          matchedImages.push({
            mimeType: mime,
            data: doc.content // contains base64 string
          });
        }
      }
    });

    // Build the final optimized system instruction
    let dynamicSystemPrompt = systemInstruction;
    if (retrievedPassages) {
      dynamicSystemPrompt += `\n\n[STRICT RAG CONTEXT INFORMATION - ALWAYS REFER TO THIS TO ANSWER USER QUERIES]:\n${retrievedPassages}\nIf the user query is about SAP programs, read and output exact routines, rules, or data tables defined in the context. Format answers extremely precisely.`;
    }

    // Append long term memory facts into system prompt
    if (memories.length > 0) {
      const formattedMem = memories.map((m, i) => `${i + 1}. [${m.category}] ${m.fact}`).join('\n');
      dynamicSystemPrompt += `\n\n[PERSISTENT LONG-TERM SYSTEM MEMORY RECORDS (Keep these facts in mind forever across sessions)]:\n${formattedMem}`;
    }

    try {
      const response = await fetch('/api/gemini/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: text,
          systemInstruction: dynamicSystemPrompt,
          model: selectedModel,
          images: matchedImages,
          documents: documents // Pass all active search links and reference credentials
        })
      });

      let data: any = {};
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        throw new Error(`The workspace container returned an unexpected response (Status ${response.status}). The development server may still be finishing its boot processes. Please wait 5 seconds and resend your request.`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Gemini system failed to retrieve answer.');
      }

      const assistantMsg: Message = {
        id: 'msg-as-' + Date.now(),
        role: 'assistant',
        content: data.text || 'No response text received from model.',
        timestamp: new Date(),
        sources: matchedDocs.length > 0 ? matchedDocs : undefined,
        outOfContextOccurred: forceGeneral,
        groundingChunks: data.groundingChunks // Capture real-time web citations!
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, assistantMsg],
            updatedAt: new Date().toLocaleDateString()
          };
        }
        return s;
      }));

      // Automatically evaluate if the assistant response mentions adding a fact/preference to memory!
      const isDeclaringMemory = text.toLowerCase().includes('remember that') || 
                                text.toLowerCase().includes('keep in mind') || 
                                text.toLowerCase().includes('save memory');
      if (isDeclaringMemory && text.length < 150) {
        const cleanedFact = text.replace(/remember that|keep in mind|save memory/gi, '').trim();
        if (cleanedFact.length > 5) {
          handleAddMemory(cleanedFact, 'User Preference');
        }
      }

    } catch (err: any) {
      const errMsg: Message = {
        id: 'msg-err-' + Date.now(),
        role: 'error',
        content: `Error: ${err.message || 'Failed to analyze context. Trace process aborted.'}`,
        timestamp: new Date()
      };

      setSessions(prev => prev.map(s => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            messages: [...s.messages, errMsg],
            updatedAt: new Date().toLocaleDateString()
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEvaluationToNotebook = (title: string, content: string) => {
    // Save as memory fact instead!
    handleAddMemory(`${title}: ${content.substring(0, 100)}...`, 'SAP Compliance');
    setActiveTab('memory-history');
  };

  return (
    <div className="h-screen lg:h-screen lg:overflow-hidden bg-[#07080c] text-zinc-100 flex flex-col font-sans selection:bg-amber-500/20 relative" id="multi_app_root">
      
      {/* Visual Ambiance Backdrop */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,#18152c_0%,transparent_100%)] pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f111a_1px,transparent_1px),linear-gradient(to_bottom,#0f111a_1px,transparent_1px)] bg-[size:3rem_3rem] pointer-events-none opacity-20 z-0" />

      {/* Primary Responsive Header */}
      <header className="sticky top-0 z-40 bg-[#07080cd8] backdrop-blur-xl border-b border-zinc-900 px-4 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4 flex-shrink-0" id="global_hub_header">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/10">
            <Layers className="w-5 h-5 text-black stroke-[2.2]" id="workbench_logo" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Multi-App Workbench
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold tracking-wider">
                RAG Engine V2
              </span>
            </h1>
            <p className="text-xs text-zinc-500 font-mono">Dynamic Context Training, Multimodal RAG & Chat Memory</p>
          </div>
        </div>

        {/* Global indicators */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-900 px-3.5 py-1.5 rounded-lg text-xs font-mono">
            <Clock className="w-3.5 h-3.5 text-amber-550" />
            <span className="text-zinc-500">System Time:</span>
            <span className="text-zinc-200 font-bold">{localTime}</span>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-900 px-3.5 py-1.5 rounded-lg text-xs font-mono">
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-zinc-500">Retrieval:</span>
            <span className="text-emerald-450 font-bold">● Active</span>
          </div>
        </div>
      </header>

      {/* Main Container Layout */}
      <main className="flex-1 w-full max-w-full px-4 md:px-8 py-5 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 min-h-0 lg:overflow-hidden" id="workbench_main">
        
        {/* Left Navigation Rails (3 columns) */}
        <div className="lg:col-span-3 flex flex-col gap-4 lg:h-full min-h-0 overflow-y-auto">
          <div className="p-5 bg-zinc-950/60 backdrop-blur-md border border-zinc-900 rounded-2xl flex flex-col gap-5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1 font-bold">Modules & Control</span>
              <p className="text-xs text-zinc-500">Select any active sandbox to run calculations live.</p>
            </div>

            <div className="space-y-1.5">
              <button 
                onClick={() => setActiveTab('chat')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${activeTab === 'chat' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md shadow-amber-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'}`}
                id="btn_app_chat"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                    <Send className="w-3.5 h-3.5" />
                  </span>
                  AI Prompt Assistant
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </button>

              <button 
                onClick={() => setActiveTab('doc-manage')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${activeTab === 'doc-manage' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'}`}
                id="btn_app_docs"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                    <Database className="w-3.5 h-3.5" />
                  </span>
                  Train Base / RAG Docs
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </button>

              <button 
                onClick={() => setActiveTab('memory-history')}
                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium transition-all ${activeTab === 'memory-history' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md shadow-amber-500/5' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'}`}
                id="btn_app_memory"
              >
                <span className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-lg bg-pink-500/10 flex items-center justify-center text-pink-400">
                    <Brain className="w-3.5 h-3.5" />
                  </span>
                  AI Memory & History
                </span>
                <ChevronRight className="w-3.5 h-3.5 opacity-50" />
              </button>
            </div>
          </div>

          {/* Quick Specifications */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-2xl flex flex-col gap-2 font-mono text-xs text-zinc-500">
            <span className="text-[10px] uppercase font-bold tracking-wider text-zinc-400 flex items-center gap-1.5 mb-1">
              <Grid className="w-4 h-4 text-zinc-500" /> Platform specs
            </span>
            <div className="flex justify-between border-b border-zinc-900/40 pb-1.5">
              <span>RAG Engine:</span>
              <span className="text-zinc-300 font-semibold text-right">Passage Match</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900/40 pb-1.5">
              <span>Local storage:</span>
              <span className="text-zinc-300 font-semibold text-right">Synchronized</span>
            </div>
            <div className="flex justify-between">
              <span>SAP Code:</span>
              <span className="text-amber-400 font-semibold text-right">Supported</span>
            </div>
          </div>
        </div>

        {/* Workspace Portal Frame for active tab (9 columns) */}
        <div className="lg:col-span-9 lg:h-full min-h-0" id="app_workspace_portal">
          {activeTab === 'chat' && (
            <PromptCompanion
              messages={messages}
              documents={documents}
              isLoading={isLoading}
              onSendMessage={handleSendMessage}
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              systemInstruction={systemInstruction}
              onSystemInstructionChange={setSystemInstruction}
              onSaveEvaluationToNotebook={handleSaveEvaluationToNotebook}
            />
          )}

          {activeTab === 'doc-manage' && (
            <DocumentManager
              documents={documents}
              onAddDocument={handleAddDocument}
              onRemoveDocument={handleRemoveDocument}
              onLoadTemplate={handleLoadTemplate}
            />
          )}

          {activeTab === 'memory-history' && (
            <MemoryHistoryManager
              sessions={sessions}
              activeSessionId={activeSessionId}
              onSelectSession={setActiveSessionId}
              onStartNewSession={handleStartNewSession}
              onDeleteSession={handleDeleteSession}
              onRenameSession={handleRenameSession}
              memories={memories}
              onAddMemory={handleAddMemory}
              onDeleteMemory={handleDeleteMemory}
              onClearAllMemories={handleClearAllMemories}
            />
          )}
        </div>
      </main>
    </div>
  );
}
