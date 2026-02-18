import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, BarChart3, Table as TableIcon, FileText, PieChart, LineChart, RefreshCw, Download } from 'lucide-react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { ReportData } from '../types';

interface AIAnalysisWindowProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey?: string;
  model: string;
  sections: string[];
  currentDate: string;
  currentSection: string;
}

interface AnalysisMessage {
  role: 'user' | 'model';
  content: string;
  chartData?: any; // JSON object for charts
  tableData?: any; // JSON object for tables
}

export const AIAnalysisWindow: React.FC<AIAnalysisWindowProps> = ({ isOpen, onClose, apiKey, model, sections, currentDate, currentSection }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<AnalysisMessage[]>([
    { role: 'model', content: 'I am your Data Analyst. I can scan your logs, generate charts, and summarize performance. Ask me something like "Analyze downtime for last month" or "Show me a chart of machine interventions".' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (!isOpen) return null;

  // --- Helpers for Data Retrieval ---
  
  const parseDuration = (str: string): number => {
      if (!str) return 0;
      let total = 0;
      // Handle cases like "1h 30m" or "90m" or "1h+30m"
      const parts = str.toLowerCase().split(/[+\s]+/); 
      parts.forEach(p => {
         if (!p) return;
         let mins = 0;
         const h = p.match(/(\d+)h/);
         const m = p.match(/(\d+)m/);
         if(h) mins += parseInt(h[1]) * 60;
         if(m) mins += parseInt(m[1]);
         // Fallback for just numbers
         if(!h && !m) {
             const val = parseInt(p.replace(/[^0-9]/g, ''));
             if(!isNaN(val)) mins += val;
         }
         total += mins;
      });
      return total;
  };

  const getAllData = (startDate?: string, endDate?: string, section?: string) => {
      const allData: any[] = [];
      
      // Defaults:
      // Start: Beginning of time if not specified
      // End: Far future if not specified (Allows looking at "future" logs relative to system time)
      const effectiveStart = startDate || "1970-01-01";
      const effectiveEnd = endDate || "2099-12-31";

      // Use direct string comparison for YYYY-MM-DD dates
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('maintlog_report_')) {
              try {
                  const report: ReportData = JSON.parse(localStorage.getItem(key)!);
                  
                  // Filter by Date Strings
                  if (report.date < effectiveStart) continue;
                  if (report.date > effectiveEnd) continue;

                  // Filter by Section
                  if (section && report.section !== section) continue;

                  // Flatten entries
                  (['night', 'morning', 'evening'] as const).forEach(shiftKey => {
                      const shift = report.shifts[shiftKey];
                      shift.entries.forEach(entry => {
                          if (entry.machine || entry.description) {
                              allData.push({
                                  date: report.date,
                                  section: report.section,
                                  shift: shiftKey,
                                  machine: entry.machine,
                                  line: entry.line,
                                  description: entry.description,
                                  totalTimeStr: entry.totalTime,
                                  durationMinutes: parseDuration(entry.totalTime), // Pre-calculated for AI
                                  spareParts: entry.spareParts,
                                  qty: entry.quantity,
                                  engineers: shift.engineers
                              });
                          }
                      });
                  });
              } catch (e) { console.error("Error parsing report", e); }
          }
      }
      return allData;
  };

  const handleSend = async () => {
      if (!input.trim() || isLoading) return;
      if (!apiKey) {
          setMessages(prev => [...prev, { role: 'user', content: input }, { role: 'model', content: "Please configure your API Key in settings first." }]);
          setInput('');
          return;
      }

      const userMsg = input;
      setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
      setInput('');
      setIsLoading(true);

      try {
          const ai = new GoogleGenAI({ apiKey });

          // Tool: Get Data
          const getDataTool: FunctionDeclaration = {
              name: "get_maintenance_data",
              description: "Retrieves maintenance log data from the database. Use this to perform analysis, count occurrences, or summarize activities.",
              parameters: {
                  type: Type.OBJECT,
                  properties: {
                      startDate: { type: Type.STRING, description: "Start date (YYYY-MM-DD). If user says 'today', use the 'Current App Date'." },
                      endDate: { type: Type.STRING, description: "End date (YYYY-MM-DD)." },
                      section: { type: Type.STRING, description: "Optional section name to filter by. Defaults to 'Current App Section' if not specified." }
                  }
              }
          };

          const systemPrompt = `You are an expert Industrial Data Analyst for MaintLog Pro.
          
          SYSTEM CONTEXT:
          - Current App Date: ${currentDate} (If user asks for "today", use this date).
          - Current App Section: ${currentSection}
          
          Capabilities:
          1. Retrieve data using 'get_maintenance_data'.
          2. Analyze the data to answer user queries.
          3. GENERATE VISUALIZATIONS.

          RESPONSE FORMAT:
          If the user asks for a chart, graph, or table, you MUST output a standard JSON block at the end of your text response.
          
          The JSON must follow this EXACT schema:
          \`\`\`json
          {
            "visualization": {
              "type": "bar" | "pie" | "table",
              "title": "Chart Title",
              "data": { ... }
            }
          }
          \`\`\`

          Data Structures for "data":
          - For "bar": { "labels": ["Label A", "Label B"], "values": [10, 5], "color": "#3b82f6" }
          - For "pie": { "segments": [{ "name": "A", "value": 30, "color": "#475569" }, { "name": "B", "value": 50, "color": "#eab308" }] }
          - For "table": { "headers": ["Date", "Machine", "Desc"], "rows": [["2024-01-01", "CFA", "Jam"], ["2024-01-02", "TP", "Sensor"]] }
          
          General Rules:
          - If the tool returns empty data, tell the user no records were found.
          - Use the 'durationMinutes' field in the data for time calculations (downtime).
          - Keep text explanations concise.
          `;

          const chatHistory = messages.map(m => ({
              role: m.role,
              parts: [{ text: m.content }]
          }));

          const result = await ai.models.generateContent({
              model: model || 'gemini-3-flash-preview',
              contents: [...chatHistory, { role: 'user', parts: [{ text: userMsg }] }],
              config: {
                  systemInstruction: systemPrompt,
                  tools: [{ functionDeclarations: [getDataTool] }]
              }
          });

          // Handle Tool Calls
          const functionCalls = result.functionCalls;
          let finalResponseText = "";
          let chartData = null;
          let tableData = null;

          if (functionCalls && functionCalls.length > 0) {
              const toolResults = functionCalls.map(call => {
                  if (call.name === 'get_maintenance_data') {
                      // Apply defaults from context if arguments are missing, but let getAllData handle wide ranges if dates are omitted
                      const start = call.args.startDate;
                      const end = call.args.endDate;
                      const sec = call.args.section || currentSection; // Default to current section if not specified
                      
                      const data = getAllData(start, end, sec);
                      const jsonResult = JSON.stringify(data);
                      
                      // Limit context if too large
                      const truncatedResult = jsonResult.length > 20000 ? jsonResult.substring(0, 20000) + "...(truncated)" : jsonResult;
                      return {
                          functionResponse: {
                              name: call.name,
                              response: { result: truncatedResult }
                          }
                      };
                  }
                  return { functionResponse: { name: call.name, response: { result: "Unknown tool" } } };
              });

              const secondResponse = await ai.models.generateContent({
                  model: model || 'gemini-3-flash-preview',
                  contents: [
                      ...chatHistory,
                      { role: 'user', parts: [{ text: userMsg }] },
                      { role: 'model', parts: result.candidates?.[0]?.content?.parts || [] },
                      { role: 'function', parts: toolResults }
                  ],
                  config: { systemInstruction: systemPrompt }
              });

              finalResponseText = secondResponse.text || "";
          } else {
              finalResponseText = result.text || "";
          }

          // Robust JSON Parsing
          // Look for code block with json or just braces
          const jsonMatch = finalResponseText.match(/```json\s*([\s\S]*?)\s*```/i) || finalResponseText.match(/```\s*([\s\S]*?)\s*```/i);
          
          if (jsonMatch) {
              try {
                  const parsed = JSON.parse(jsonMatch[1]);
                  if (parsed.visualization) {
                      const viz = parsed.visualization;
                      if (viz.type === 'bar') {
                          chartData = { type: 'bar', ...viz };
                      } else if (viz.type === 'pie') {
                          chartData = { type: 'pie', title: viz.title, data: viz.data.segments };
                      } else if (viz.type === 'table') {
                          tableData = viz.data;
                      }
                      // Clean up the text to remove the raw JSON
                      finalResponseText = finalResponseText.replace(jsonMatch[0], '').trim();
                  }
              } catch (e) {
                  console.error("Failed to parse AI JSON visualization", e);
              }
          }

          // If text is empty after stripping JSON, add a placeholder so the bubble isn't empty
          if (!finalResponseText && (chartData || tableData)) {
              finalResponseText = "Here is the visualization based on your request.";
          }

          setMessages(prev => [...prev, { 
              role: 'model', 
              content: finalResponseText,
              chartData,
              tableData
          }]);

      } catch (error: any) {
          setMessages(prev => [...prev, { role: 'model', content: `Error: ${error.message}` }]);
      } finally {
          setIsLoading(false);
      }
  };

  // --- Simple Visualization Components ---
  const BarChart = ({ data }: { data: any }) => {
      if (!data || !data.data || !data.data.values || data.data.values.length === 0) return <div className="text-center text-gray-400 p-4">No data for chart</div>;
      const values = data.data.values;
      const labels = data.data.labels;
      const max = Math.max(...values, 1); // Avoid div by zero
      
      return (
          <div className="bg-white p-4 rounded-lg border border-slate-200 mt-4 shadow-sm w-full">
              <h4 className="font-bold text-slate-700 mb-4 text-center">{data.title}</h4>
              <div className="flex items-end gap-2 h-60 w-full px-2">
                  {values.map((val: number, idx: number) => (
                      <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                          <div className="text-[10px] text-slate-500 mb-1 opacity-0 group-hover:opacity-100 absolute -top-4">{val}</div>
                          <div 
                              className="w-full rounded-t hover:opacity-80 transition-all min-w-[20px]"
                              style={{ height: `${(val / max) * 100}%`, backgroundColor: data.data.color || '#3b82f6' }}
                          ></div>
                          <div className="text-[10px] text-slate-400 mt-2 rotate-45 origin-left whitespace-nowrap overflow-visible" title={labels[idx]}>{labels[idx]}</div>
                      </div>
                  ))}
              </div>
              <div className="h-8"></div> {/* Spacer for rotated labels */}
          </div>
      );
  };

  const PieChartComp = ({ data }: { data: any }) => {
      if (!data || !data.data) return null;
      // data.data is the array of segments due to parsing logic above
      const segments = data.data; 
      const total = segments.reduce((acc: number, item: any) => acc + item.value, 0);
      let currentDeg = 0;
      const gradientParts = segments.map((item: any) => {
          const deg = (item.value / total) * 360;
          const str = `${item.color || '#ccc'} ${currentDeg}deg ${currentDeg + deg}deg`;
          currentDeg += deg;
          return str;
      }).join(', ');

      return (
          <div className="bg-white p-6 rounded-lg border border-slate-200 mt-4 shadow-sm flex flex-col items-center">
              <h4 className="font-bold text-slate-700 mb-6">{data.title}</h4>
              <div className="flex items-center gap-8">
                <div 
                    className="w-40 h-40 rounded-full flex-shrink-0 shadow-inner"
                    style={{ background: `conic-gradient(${gradientParts})` }}
                ></div>
                <div className="space-y-2">
                    {segments.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-xs min-w-[150px]">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                                <span className="text-slate-600 font-medium">{item.name}</span>
                            </div>
                            <span className="font-bold text-slate-800">{item.value} ({Math.round(item.value/total*100)}%)</span>
                        </div>
                    ))}
                </div>
              </div>
          </div>
      );
  };

  const DataTable = ({ data }: { data: any }) => {
      if (!data || !data.rows) return null;
      return (
          <div className="bg-white rounded-lg border border-slate-200 mt-4 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-500 uppercase font-bold border-b border-slate-200">
                          <tr>
                              {data.headers.map((h: string, i: number) => <th key={i} className="px-4 py-3 whitespace-nowrap">{h}</th>)}
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                          {data.rows.map((row: any[], i: number) => (
                              <tr key={i} className="hover:bg-slate-50">
                                  {row.map((cell: any, j: number) => <td key={j} className="px-4 py-2.5 whitespace-nowrap text-slate-700">{cell}</td>)}
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>
      );
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-slate-50 w-full max-w-6xl h-[90vh] rounded-2xl shadow-2xl flex overflow-hidden font-inter">
            
            {/* Sidebar - Chat */}
            <div className="w-1/3 bg-white flex flex-col border-r border-slate-200">
                <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white">
                        <Sparkles size={16} />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800">AI Analyst</h3>
                        <p className="text-[10px] text-slate-500">Powered by {model}</p>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg, idx) => (
                        <div key={idx} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-slate-200' : 'bg-indigo-100 text-indigo-600'}`}>
                                {msg.role === 'user' ? <User size={12}/> : <Bot size={12}/>}
                            </div>
                            <div className={`p-2.5 rounded-xl text-xs max-w-[90%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-700 rounded-tl-none'}`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex gap-2">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                                <Loader2 size={12} className="animate-spin" />
                            </div>
                            <div className="text-xs text-slate-400 py-1">Analyzing data...</div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-slate-100">
                    <div className="relative">
                        <input 
                            className="w-full bg-slate-100 border-transparent focus:bg-white border focus:border-indigo-300 rounded-lg px-3 py-2.5 text-xs outline-none pr-10 text-black placeholder-slate-400" 
                            placeholder="Ask for analysis (e.g., 'Chart downtime by machine')"
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSend()}
                            disabled={isLoading}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="absolute right-1 top-1 p-1.5 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors disabled:opacity-50"
                        >
                            <Send size={12} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content - Visualization */}
            <div className="w-2/3 flex flex-col bg-slate-50/50">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white">
                    <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                        <BarChart3 className="text-indigo-600" /> Visualization Dashboard
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 relative flex flex-col">
                    {messages.length > 1 ? (
                        <div className="space-y-6 w-full max-w-4xl mx-auto">
                            {/* Render latest chart/table from the last AI message that has one */}
                            {(() => {
                                // Find last message with data
                                const lastDataMsg = [...messages].reverse().find(m => m.chartData || m.tableData);
                                if (!lastDataMsg) return (
                                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 mt-20">
                                        <Bot size={48} className="mb-4 opacity-20" />
                                        <p>No visualization generated yet.</p>
                                    </div>
                                );

                                return (
                                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                                        {lastDataMsg.chartData?.type === 'bar' && <BarChart data={lastDataMsg.chartData} />}
                                        {lastDataMsg.chartData?.type === 'pie' && <PieChartComp data={lastDataMsg.chartData} />}
                                        {lastDataMsg.tableData && <DataTable data={lastDataMsg.tableData} />}
                                        
                                        {!lastDataMsg.chartData && !lastDataMsg.tableData && (
                                            <div className="bg-white p-6 rounded-lg border border-slate-200 text-center text-slate-500 mt-10">
                                                <FileText className="mx-auto mb-2 opacity-50" size={32} />
                                                Check the chat for analysis.
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
                            <div className="w-20 h-20 bg-white rounded-3xl shadow-sm flex items-center justify-center mb-2">
                                <LineChart size={40} className="text-indigo-200" />
                            </div>
                            <div className="text-center">
                                <h4 className="font-bold text-slate-600 mb-1">Ready to Analyze</h4>
                                <p className="text-sm text-slate-400 max-w-xs mx-auto">Ask the AI to generate charts, tables, or summaries based on your maintenance logs.</p>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={() => { setInput("Show a chart of the top 5 machines by interventions"); handleSend(); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all text-slate-600 font-medium shadow-sm">
                                    📊 Top Machines Chart
                                </button>
                                <button onClick={() => { setInput("Table of all spare parts used recently"); handleSend(); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs hover:border-indigo-300 hover:text-indigo-600 transition-all text-slate-600 font-medium shadow-sm">
                                    📋 Spare Parts Table
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};