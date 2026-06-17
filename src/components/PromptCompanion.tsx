/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  User, 
  RefreshCw, 
  Settings, 
  HelpCircle, 
  BookOpen, 
  Check, 
  Copy, 
  AlertTriangle, 
  ChevronRight,
  Database,
  ArrowRight,
  ShieldAlert,
  Info,
  Cpu,
  PlayCircle,
  FilePlus,
  ThumbsUp,
  AlertCircle,
  Globe,
  Link
} from 'lucide-react';
import { Message, SourceDoc } from '../types';

interface PromptCompanionProps {
  messages: Message[];
  documents: SourceDoc[];
  isLoading: boolean;
  onSendMessage: (text: string, forceGeneral?: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
  systemInstruction: string;
  onSystemInstructionChange: (inst: string) => void;
  onSaveEvaluationToNotebook?: (title: string, content: string) => void;
}

export default function PromptCompanion({
  messages,
  documents,
  isLoading,
  onSendMessage,
  selectedModel,
  onModelChange,
  systemInstruction,
  onSystemInstructionChange,
  onSaveEvaluationToNotebook
}: PromptCompanionProps) {
  const [promptInput, setPromptInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Track selected tab within each AI Assistant response message bubble
  const [messageActiveTabs, setMessageActiveTabs] = useState<Record<string, 'code' | 'analysis'>>({});

  // Parse dual layout sections (Code Creation vs Deep ChatGPT Analysis)
  const parseDualMessage = (content: string) => {
    let codePart = '';
    let analysisPart = '';

    const codeStartToken = '[CODE_CREATION_START]';
    const codeEndToken = '[CODE_CREATION_END]';
    const analysisStartToken = '[DEEP_ANALYSIS_START]';
    const analysisEndToken = '[DEEP_ANALYSIS_END]';

    if (content.includes(codeStartToken)) {
      const parts = content.split(codeStartToken);
      if (parts[1]) {
        const inside = parts[1].split(codeEndToken);
        codePart = inside[0].trim();
      }
    }
    
    if (content.includes(analysisStartToken)) {
      const parts = content.split(analysisStartToken);
      if (parts[1]) {
        const inside = parts[1].split(analysisEndToken);
        analysisPart = inside[0].trim();
      }
    }

    // Fallback if formatting tags are completely absent
    if (!codePart && !analysisPart) {
      codePart = content;
      analysisPart = content;
    }

    return { codePart, analysisPart };
  };
  
  // State for tracking multiple inline code evaluations
  interface CodeEvaluation {
    status: 'idle' | 'configuring' | 'evaluating' | 'completed' | 'failed';
    customInstructions?: string;
    score?: number;
    statusTier?: 'PASS' | 'WARNING' | 'FAIL';
    report?: string;
    refactored?: string;
    error?: string;
  }

  const [evaluations, setEvaluations] = useState<Record<string, CodeEvaluation>>({});

  // Custom dialog state for "Out of Context" query handling
  const [showContextWarning, setShowContextWarning] = useState(false);
  const [stashedPrompt, setStashedPrompt] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInitEvaluation = (uniqueId: string) => {
    setEvaluations(prev => ({
      ...prev,
      [uniqueId]: prev[uniqueId]?.status === 'completed' ? prev[uniqueId] : {
        status: 'configuring',
        customInstructions: ''
      }
    }));
  };

  const runCodeEvaluation = async (uniqueId: string, code: string) => {
    setEvaluations(prev => ({
      ...prev,
      [uniqueId]: { ...prev[uniqueId], status: 'evaluating', error: undefined }
    }));

    try {
      const res = await fetch('/api/gemini/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          manuals: documents,
          customInstructions: evaluations[uniqueId]?.customInstructions || '',
          model: selectedModel
        })
      });

      let data: any = {};
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error(`Compliance audit compiler returned an unexpected text response (Status ${res.status}). The server might be booting or updating. Please click check again in a few seconds.`);
      }

      if (!res.ok) {
        throw new Error(data.error || 'Syntax compiler check call failed.');
      }

      setEvaluations(prev => ({
        ...prev,
        [uniqueId]: {
          ...prev[uniqueId],
          status: 'completed',
          score: data.score != null ? Number(data.score) : 80,
          statusTier: data.statusTier || 'WARNING',
          report: data.report || 'No audit report received.',
          refactored: data.refactored || undefined
        }
      }));
    } catch (err: any) {
      setEvaluations(prev => ({
        ...prev,
        [uniqueId]: {
          ...prev[uniqueId],
          status: 'failed',
          error: err.message || 'Audit execution engine timed out.'
        }
      }));
    }
  };

  // Perform heuristic context check
  const checkPromptContext = (text: string): boolean => {
    if (documents.length === 0) return true; // If no documents are loaded, anything goes by default
    
    const lowercasePrompt = text.toLowerCase().trim();
    if (!lowercasePrompt) return true;

    // Common/conversational stop words to ignore for strict content matching
    const stopWords = new Set([
      'the', 'and', 'or', 'to', 'in', 'on', 'at', 'by', 'for', 'with', 'is', 'am', 'are', 'was', 'were', 
      'be', 'been', 'being', 'do', 'does', 'did', 'has', 'have', 'had', 'it', 'its', 'they', 'them', 
      'their', 'this', 'that', 'these', 'those', 'what', 'who', 'how', 'why', 'where', 'when', 
      'explain', 'about', 'tell', 'show', 'me', 'please', 'give', 'us', 'an', 'a', 'of', 'i', 'my', 
      'your', 'you', 'hello', 'hi', 'hey', 'there', 'good', 'morning', 'afternoon', 'evening',
      'help', 'ask', 'question', 'answer', 'but', 'not', 'can', 'could', 'would', 'should',
      'file', 'document', 'documents', 'text', 'code', 'routine', 'info', 'information', 'detail', 'details'
    ]);

    // Split on any non-alphanumeric character to get individual terms of length >= 2
    const queryWords = lowercasePrompt.split(/[^a-zA-Z0-9]+/).filter(w => w.length >= 2 && !stopWords.has(w));

    // If the query contains only stop/conversational words (e.g. "hi there", "please explain"),
    // allow it so we don't block the user's natural greeting or general guidance.
    if (queryWords.length === 0) {
      return true;
    }

    let hasMatch = false;
    for (const doc of documents) {
      const content = doc.content.toLowerCase();
      const docName = doc.name.toLowerCase();

      // Direct checks: prompt includes document name, or document name is in the prompt
      if (lowercasePrompt.includes(docName) || docName.includes(lowercasePrompt)) {
        hasMatch = true;
        break;
      }

      // Check if any of our parsed query keywords (like "pap" or "ppap") matches
      // either the content of the document or its original name.
      const wordMatch = queryWords.some(word => content.includes(word) || docName.includes(word));
      if (wordMatch) {
        hasMatch = true;
        break;
      }
    }

    return hasMatch;
  };

  const handlePreSend = () => {
    const trimmed = promptInput.trim();
    if (!trimmed || isLoading) return;

    // Evaluate RAG relevance
    const isMatched = checkPromptContext(trimmed);
    if (!isMatched && documents.length > 0) {
      // Trigger the interactive "Out of Context" validation workflow
      setStashedPrompt(trimmed);
      setShowContextWarning(true);
    } else {
      onSendMessage(trimmed);
      setPromptInput('');
    }
  };

  const proceedWithGeneralQuery = () => {
    onSendMessage(stashedPrompt, true); // force general search
    setPromptInput('');
    setShowContextWarning(false);
    setStashedPrompt('');
  };

  const formatMessageText = (text: string, messageId: string, isAssistant: boolean) => {
    const lines = text.split('\n');
    let insideCodeBlock = false;
    let codeBlockText: string[] = [];
    const formattedElements: any[] = [];
    let blockCount = 0;

    lines.forEach((line, index) => {
      if (line.trim().startsWith('```')) {
        if (insideCodeBlock) {
          // Close block
          const fullCode = codeBlockText.join('\n');
          const currentBlockIdx = blockCount;
          const uniqueId = `code-block-${messageId}-${currentBlockIdx}`;
          
          formattedElements.push(
            <div key={uniqueId} className="my-3 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden font-mono text-xs shadow-lg">
              <div className="bg-zinc-900 px-4 py-2 flex items-center justify-between text-[11px] text-zinc-500 border-b border-zinc-850">
                <span className="flex items-center gap-1.5 font-bold">
                  <Cpu className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> Code Block / SAP Program snippet
                </span>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => copyToClipboard(fullCode, uniqueId)}
                    className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-all font-semibold active:scale-95 cursor-pointer"
                  >
                    {copiedId === uniqueId ? (
                      <span className="flex items-center gap-1 text-green-400 font-bold"><Check className="w-3 h-3" /> Copied</span>
                    ) : (
                      <span className="flex items-center gap-1"><Copy className="w-3 h-3" /> Copy</span>
                    )}
                  </button>

                  {isAssistant && (
                    <button 
                      onClick={() => handleInitEvaluation(uniqueId)}
                      className="flex items-center gap-1 text-amber-450 hover:text-amber-200 transition-all font-semibold active:scale-95 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 text-amber-400" /> Evaluate Code
                    </button>
                  )}
                </div>
              </div>
              <pre className="p-4 overflow-x-auto bg-[#090b10] text-zinc-300 leading-normal select-text">
                <code>{fullCode}</code>
              </pre>

              {/* EVALUATION SECTION PANEL */}
              {evaluations[uniqueId] && (
                <div className="border-t border-zinc-850 bg-[#06080c] p-4 font-sans flex flex-col gap-3 text-zinc-200 border-b border-transparent">
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-900">
                    <span className="text-[11px] font-mono tracking-wider font-bold text-amber-400 flex items-center gap-1.5">
                      <Cpu className="w-3.5 h-3.5 text-amber-500 animate-pulse" /> SAP COMPLIANCE EVALUATOR
                    </span>
                    <button 
                      onClick={() => {
                        setEvaluations(prev => {
                          const copy = { ...prev };
                          delete copy[uniqueId];
                          return copy;
                        });
                      }}
                      className="text-[10px] text-zinc-500 hover:text-zinc-400 font-mono transition-all cursor-pointer"
                    >
                      Dismiss
                    </button>
                  </div>

                  {/* Configuring Stage */}
                  {evaluations[uniqueId].status === 'configuring' && (
                    <div className="flex flex-col gap-2.5">
                      <p className="text-xs text-zinc-400">
                        Synthesizing basic syntax, database logic, and training references in RAG manual Base. Checking compliance.
                      </p>
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[10px] font-mono uppercase text-zinc-500 font-bold">Custom Audit Instructions (Optional)</label>
                        <input 
                          type="text" 
                          placeholder="e.g., Check dynamic memory parameters, check FI/CO tables..."
                          value={evaluations[uniqueId].customInstructions || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setEvaluations(prev => ({
                              ...prev,
                              [uniqueId]: { ...prev[uniqueId], customInstructions: val }
                            }));
                          }}
                          className="w-full bg-zinc-900 border border-zinc-800 text-xs px-3 py-2 rounded-lg text-zinc-300 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <button 
                        onClick={() => runCodeEvaluation(uniqueId, fullCode)}
                        className="self-end px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-md select-none"
                      >
                        <PlayCircle className="w-4 h-4 fill-black" /> Ask to Generate Results & Run
                      </button>
                    </div>
                  )}

                  {/* Evaluating Loading Stage */}
                  {evaluations[uniqueId].status === 'evaluating' && (
                    <div className="py-6 flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-6 h-6 text-amber-400 animate-spin" />
                      <span className="text-xs font-mono text-zinc-450 animate-pulse">Running compiler sandbox & checking RAG manuals...</span>
                    </div>
                  )}

                  {/* Failed Stage */}
                  {evaluations[uniqueId].status === 'failed' && (
                    <div className="p-3.5 bg-red-950/20 border border-red-900/30 rounded-lg flex flex-col gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-red-400 font-semibold font-mono">
                        <AlertCircle className="w-4 h-4" /> COMPILE EXECUTOR FAILURE
                      </div>
                      <p className="text-zinc-300">{evaluations[uniqueId].error || 'Validation simulation failed.'}</p>
                      <button 
                        onClick={() => runCodeEvaluation(uniqueId, fullCode)}
                        className="self-start text-xs text-amber-500 hover:text-amber-400 underline font-mono"
                      >
                        Retry Check
                      </button>
                    </div>
                  )}

                  {/* Completed Results Stage */}
                  {evaluations[uniqueId].status === 'completed' && (
                    <div className="flex flex-col gap-4 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-4 bg-zinc-950/60 border border-zinc-900 p-3 rounded-xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                            evaluations[uniqueId].statusTier === 'PASS' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                              : evaluations[uniqueId].statusTier === 'WARNING' 
                              ? 'bg-amber-500/10 text-amber-400 border-amber-550/20' 
                              : 'bg-red-500/10 text-red-500 border-red-500/20'
                          }`}>
                            {evaluations[uniqueId].score}%
                          </div>
                          <div>
                            <span className="font-mono text-[9px] text-zinc-500 block">CROSS-MANUAL AUDIT VALUE</span>
                            <span className={`font-bold uppercase flex items-center gap-1 ${
                              evaluations[uniqueId].statusTier === 'PASS' ? 'text-emerald-400' : evaluations[uniqueId].statusTier === 'WARNING' ? 'text-amber-400' : 'text-red-400'
                            }`}>
                              {evaluations[uniqueId].statusTier === 'PASS' ? '✓ VERIFIED PASS' : evaluations[uniqueId].statusTier === 'WARNING' ? '⚠ REVIEW REMARKS' : '✗ SCHEMA FAILURE'}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          {onSaveEvaluationToNotebook && (
                            <button 
                              onClick={() => {
                                const report = evaluations[uniqueId].report || '';
                                const score = evaluations[uniqueId].score || 0;
                                const tier = evaluations[uniqueId].statusTier || '';
                                const refact = evaluations[uniqueId].refactored ? `\n\n## SUGGESTED CORRECT SNIPPET:\n\`\`\`abap\n${evaluations[uniqueId].refactored}\n\`\`\`` : '';
                                const formattedReport = `# Code Audit Report\n**Compliance Score:** ${score}/100\n**Audit Rating:** ${tier}\n\n${report}${refact}`;
                                onSaveEvaluationToNotebook(`Audit Report: ${uniqueId.replace('code-block-', '')}`, formattedReport);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 hover:border-zinc-700 text-zinc-300 font-mono text-[10px] flex items-center gap-1 cursor-pointer"
                            >
                              <FilePlus className="w-3 h-3 text-cyan-400" /> Export to Notebook
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setEvaluations(prev => ({
                                ...prev,
                                [uniqueId]: { ...prev[uniqueId], status: 'configuring' }
                              }));
                            }}
                            className="px-3 py-1.5 rounded-lg bg-zinc-905 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 font-mono text-[10px]"
                          >
                            Reconfigure
                          </button>
                        </div>
                      </div>

                      {/* Display Markdown Report */}
                      <div className="bg-[#090a0f] border border-zinc-900 p-4 rounded-xl leading-relaxed text-zinc-300 text-xs overflow-y-auto max-h-[220px]">
                        <div className="space-y-2">
                          {(evaluations[uniqueId].report || '').split('\n').map((line, rIdx) => {
                            if (line.startsWith('# ')) {
                              return <h3 key={rIdx} className="text-sm font-bold text-amber-200 mt-2 pb-1 border-b border-zinc-900">{line.replace('# ', '')}</h3>;
                            } else if (line.startsWith('## ')) {
                              return <h4 key={rIdx} className="text-xs font-bold text-amber-350 mt-2">{line.replace('## ', '')}</h4>;
                            } else if (line.startsWith('- ')) {
                              return <li key={rIdx} className="list-disc list-inside ml-1 text-zinc-300">{line.replace('- ', '')}</li>;
                            } else if (line.trim() === '') {
                              return <div key={rIdx} className="h-1" />;
                            }
                            return <p key={rIdx} className="text-zinc-450 font-sans">{line}</p>;
                          })}
                        </div>
                      </div>

                      {/* Suggested Refactored Snippet */}
                      {evaluations[uniqueId].refactored && (
                        <div className="flex flex-col gap-2">
                          <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold flex items-center gap-1">
                            <ThumbsUp className="w-3.5 h-3.5 text-emerald-450" /> Suggested Compliance Standard Snippet
                          </span>
                          <div className="bg-[#050608] border border-zinc-900 rounded-xl overflow-hidden font-mono text-[11px]">
                            <div className="bg-zinc-900/60 px-4 py-1.5 flex items-center justify-between text-[10px] text-zinc-400 border-b border-zinc-900">
                              <span>Refactored Core SAP Procedure</span>
                              <button 
                                onClick={() => copyToClipboard(evaluations[uniqueId].refactored || '', `${uniqueId}-refactored`)}
                                className="text-zinc-350 hover:text-zinc-100 font-bold cursor-pointer"
                              >
                                {copiedId === `${uniqueId}-refactored` ? 'Copied✓' : 'Copy Code'}
                              </button>
                            </div>
                            <pre className="p-3 overflow-x-auto text-zinc-300 max-h-[160px]">
                              <code>{evaluations[uniqueId].refactored}</code>
                            </pre>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
          codeBlockText = [];
          insideCodeBlock = false;
        } else {
          blockCount++;
          insideCodeBlock = true;
        }
      } else if (insideCodeBlock) {
        codeBlockText.push(line);
      } else {
        // Line styling
        if (line.startsWith('## ')) {
          formattedElements.push(<h3 key={index} className="text-md font-bold text-amber-200 mt-4 mb-2">{line.replace('## ', '')}</h3>);
        } else if (line.startsWith('# ')) {
          formattedElements.push(<h2 key={index} className="text-lg font-extrabold text-amber-300 mt-5 mb-3">{line.replace('# ', '')}</h2>);
        } else if (line.startsWith('- ')) {
          formattedElements.push(<li key={index} className="text-zinc-300 list-disc list-inside ml-2.5 my-1.5 leading-relaxed">{line.replace('- ', '')}</li>);
        } else if (line.trim() === '') {
          formattedElements.push(<div key={index} className="h-2.5" />);
        } else {
          formattedElements.push(<p key={index} className="text-zinc-300 leading-relaxed my-2 select-text">{line}</p>);
        }
      }
    });

    return formattedElements;
  };

  const suggestions = [
    { label: "📦 Fetch SAP PO Validator", p: "Analyze the uploaded SAP_PurchaseOrders_Validator structure. What are its validation routines?" },
    { label: "📊 Validate Material Manual", p: "Does SAP HANA Material Management manual say anything about database triggers?" },
    { label: "💳 Analyze CO/PA Control Spec", p: "Provide a quick audit report on the FI_COPA_Control_Spec document." }
  ];

  return (
    <div className="p-5 md:p-6 bg-[#0c0d13] border border-zinc-850 rounded-2xl flex flex-col gap-4 relative lg:h-full lg:max-h-[calc(100vh-140px)] min-h-0" id="prompt_interface">
      {/* Settings Panel Block */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-3 border-b border-zinc-850 flex-shrink-0">
        <div>
          <h3 className="text-md font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" /> Interactive AI Core Assistant (RAG Enabled)
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">Augments conversations using fed SAP files context.</p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select 
            value={selectedModel} 
            onChange={(e) => onModelChange(e.target.value)}
            className="w-full sm:w-auto bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-lg text-xs font-mono text-amber-400 focus:outline-none"
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash (Balanced)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Detailed)</option>
          </select>
        </div>
      </div>

      {/* System Parameter block */}
      <div className="bg-zinc-950/40 border border-zinc-900 p-3.5 rounded-xl flex flex-col gap-1.5 flex-shrink-0">
        <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-zinc-500 animate-spin-slow" /> Hyper-Parameter Directive (System Instruction)
        </span>
        <input 
          type="text"
          value={systemInstruction}
          onChange={(e) => onSystemInstructionChange(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-mono text-zinc-350 focus:outline-none focus:border-amber-500/30 transition-all"
        />
      </div>

      {/* RAG sources indicator overlay */}
      {documents.length > 0 && (
        <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl text-xs flex-shrink-0">
          <Info className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-zinc-300">
            <b>RAG Active:</b> Loaded <b>{documents.length}</b> memory sources. Queries will automatically pull relevant pieces before calling Gemini.
          </span>
        </div>
      )}

      {/* Interaction Stream Area */}
      <div className="space-y-4 flex-1 overflow-y-auto pr-1 flex flex-col min-h-[160px] bg-zinc-950/40 rounded-xl p-4 border border-zinc-900 select-text">
        {messages.map((m) => (
          <div 
            key={m.id} 
            className={`p-4 rounded-xl border max-w-[90%] ${
              m.role === 'user' 
                ? 'bg-zinc-900 border-zinc-800 ml-auto' 
                : m.role === 'error'
                ? 'bg-red-950/20 border-red-900/30 text-red-200'
                : 'bg-gradient-to-b from-[#11131a] to-[#0c0d13] border-zinc-850 text-zinc-300'
            }`}
          >
            <div className="flex items-center justify-between gap-6 mb-2">
              <div className="flex items-center gap-2">
                {m.role === 'user' ? (
                  <div className="w-5 h-5 rounded bg-zinc-850 flex items-center justify-center">
                    <User className="w-3 h-3 text-zinc-400" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded bg-amber-500/10 flex items-center justify-center">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                  </div>
                )}
                <span className="text-[10px] text-zinc-500 font-mono">
                  {m.role === 'user' ? 'Developer Request' : 'Verified Knowledge Engine'} • {new Date(m.timestamp as any).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {m.role === 'assistant' ? (() => {
              const { codePart, analysisPart } = parseDualMessage(m.content);
              const activeTab = messageActiveTabs[m.id] || 'code';
              return (
                <div className="flex flex-col gap-3 w-full">
                  {/* Dynamic Tab Selector for Code vs ChatGPT-style Analysis */}
                  <div className="flex border-b border-zinc-900 text-xs w-full mb-1">
                    <button
                      type="button"
                      onClick={() => setMessageActiveTabs(prev => ({ ...prev, [m.id]: 'code' }))}
                      className={`flex-1 py-2 text-center font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTab === 'code'
                          ? 'border-amber-500 text-amber-400 bg-amber-500/5'
                          : 'border-transparent text-zinc-550 hover:text-zinc-300'
                      }`}
                    >
                      💻 Custom ABAP Code & Specifications
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessageActiveTabs(prev => ({ ...prev, [m.id]: 'analysis' }))}
                      className={`flex-1 py-2 text-center font-mono font-bold border-b-2 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        activeTab === 'analysis'
                          ? 'border-emerald-500 text-emerald-400 bg-emerald-500/5'
                          : 'border-transparent text-zinc-550 hover:text-zinc-300'
                      }`}
                    >
                      🔍 Deep ChatGPT-Style Web Analysis
                    </button>
                  </div>

                  {/* Tab Body */}
                  <div className="text-sm select-text text-zinc-300 leading-relaxed font-sans">
                    {activeTab === 'code' ? (
                      <div className="animate-fadeIn">
                        {formatMessageText(codePart, m.id, true)}
                      </div>
                    ) : (
                      <div className="animate-fadeIn">
                        {formatMessageText(analysisPart, m.id, true)}
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              <div className="text-sm select-text font-sans">
                {m.content}
              </div>
            )}

            {/* Synthesized Google Grounding search links & live citations at reply block footer */}
            {m.role === 'assistant' && m.groundingChunks && m.groundingChunks.length > 0 && (
              <div className="mt-3.5 pt-2.5 border-t border-zinc-900/60 flex flex-col gap-2">
                <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-emerald-400 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-emerald-400" /> Synthesized Live Search References (Google Custom Grounding)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" id="verification_citations_board">
                  {m.groundingChunks.map((chunk: any, chunkIdx: number) => {
                    const title = chunk.web?.title || 'Online Knowledge Source';
                    const uri = chunk.web?.uri;
                    if (!uri) return null;
                    return (
                      <a 
                        key={chunkIdx}
                        href={uri}
                        target="_blank"
                        rel="noreferrer"
                        className="p-2 rounded bg-zinc-950/80 border border-zinc-900 hover:bg-zinc-900 hover:border-emerald-500/30 transition-all flex items-center gap-2.5 text-[11px] text-zinc-350 hover:text-white group"
                      >
                        <Globe className="w-3.5 h-3.5 text-zinc-500 group-hover:text-emerald-400 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold block truncate text-zinc-200">{title}</span>
                          <span className="text-[9px] text-emerald-400 underline truncate block">{uri}</span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RAG Source attributions listing inside the message wrapper as requested */}
            {m.sources && m.sources.length > 0 && (
              <div className="mt-3.5 pt-2.5 border-t border-zinc-900 flex flex-col gap-1.5">
                <span className="text-[10px] uppercase font-mono tracking-widest font-bold text-emerald-400/90 flex items-center gap-1">
                  <Database className="w-3 h-3" /> Retrieved Training Sources (RAG Model Chunks)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {m.sources.map((s, idx) => (
                    <span 
                      key={idx} 
                      className="text-[9px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1 font-bold"
                    >
                      <BookOpen className="w-2.5 h-2.5" /> {s.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Indicator of Out of Context execution */}
            {m.outOfContextOccurred && (
              <div className="mt-2.5 pt-2 border-t border-zinc-900/40 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Context mismatch identified: answered using general fallback AI knowledge.
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="p-3.5 bg-zinc-900/30 border border-zinc-850/60 rounded-xl flex items-center gap-2.5 text-zinc-400 self-start animate-pulse">
            <RefreshCw className="w-4 h-4 text-amber-400 animate-spin" />
            <span className="text-xs font-mono">Consulting multi-agent vectors & prompt rules...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Preset Actionable Suggestions */}
      {documents.length > 0 && (
        <div className="flex flex-col gap-2 flex-shrink-0">
          <span className="text-[10px] font-mono text-zinc-500 tracking-wider">⚡ RECOMMENDATIONS BASED ON ACTIVE TRAINING FILES</span>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPromptInput(p.p);
                }}
                className="px-3 py-1.5 rounded-lg border border-zinc-850 bg-[#090a0f] hover:bg-amber-500/5 hover:border-amber-500/20 text-xs text-zinc-400 hover:text-amber-400 font-mono transition-all text-left truncate max-w-full"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input controls container */}
      <div className="flex gap-2.5 flex-shrink-0">
        <input 
          type="text"
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handlePreSend()}
          placeholder={documents.length > 0 ? "Ask a question about the active training files..." : "Enter prompt (e.g. 'Generate an ABAP Purchase Order spec')..."}
          disabled={isLoading}
          className="flex-1 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-amber-500/70 px-4 py-3 rounded-xl text-sm focus:outline-none transition-all"
        />
        <button 
          onClick={handlePreSend}
          disabled={isLoading || !promptInput.trim()}
          className="h-[46px] w-[46px] rounded-xl bg-amber-500 hover:bg-amber-400 text-black flex items-center justify-center transition-all cursor-pointer shadow-md disabled:bg-zinc-800 disabled:opacity-50"
        >
          <Send className="w-5 h-5 stroke-[2.2]" />
        </button>
      </div>

      {/* OUT OF CONTEXT DIALOG WORKFLOW (STRICT RAG IMPLEMENTATION) */}
      {showContextWarning && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex items-center justify-center p-6 z-50">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 border border-amber-500/20 animate-pulse">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-md font-bold text-zinc-150">⚠️ Out of Source Context Alert</h4>
                <p className="text-xs text-zinc-500 font-mono mt-0.5">Prompt exceeds trained document boundaries</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 bg-zinc-950 p-3 rounded-lg font-mono border border-zinc-850 leading-relaxed max-h-[140px] overflow-y-auto">
              Your prompt: &ldquo;<span className="text-amber-400">{stashedPrompt}</span>&rdquo; is not represented in the loaded target files:
              <span className="block mt-1 text-[10px] text-zinc-500">
                ({documents.map(d => d.name).join(', ')})
              </span>
            </p>

            <span className="text-xs text-zinc-400 leading-relaxed">
              We highly advise aligning questions to the provided training docs or SAP files first. Would you like to proceed with fallback AI knowledge anyway, or refine your query?
            </span>

            <div className="flex flex-col gap-2 mt-2">
              <button 
                onClick={proceedWithGeneralQuery}
                className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                Skip Check & Continue to Answer <ChevronRight className="w-3.5 h-3.5" />
              </button>

              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    setShowContextWarning(false);
                    setStashedPrompt('');
                  }}
                  className="flex-1 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono transition-all"
                >
                  Edit Question
                </button>
                <button 
                  onClick={() => {
                    setShowContextWarning(false);
                    setStashedPrompt('');
                    // Switch tab globally to document manager
                    (window as any)._switchTabGlobal?.('doc-manage');
                  }}
                  className="flex-1 py-2 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono transition-all flex items-center justify-center gap-1"
                >
                  Upload More Docs
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
