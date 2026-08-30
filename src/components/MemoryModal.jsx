import React, { useState, useEffect } from 'react';
import {
  X,
  Brain,
  Trash2,
  Plus,
  Sparkles,
  BookOpen,
  Clock,
  Edit2,
  Save,
  FileText,
} from 'lucide-react';

export const MemoryModal = ({
  isOpen,
  onClose,
  token,
}) => {
  const [memories, setMemories] = useState([]);
  const [knowledgeChunks, setKnowledgeChunks] = useState([]);
  const [activeTab, setActiveTab] = useState('user-memories');
  const [loading, setLoading] = useState(false);

  // New Memory Form
  const [newKey, setNewKey] = useState('');
  const [newFact, setNewFact] = useState('');
  const [newCategory, setNewCategory] = useState('project');
  const [isAdding, setIsAdding] = useState(false);

  // Edit Mode
  const [editingId, setEditingId] = useState(null);
  const [editFact, setEditFact] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchMemories();
      fetchKnowledge();
    }
  }, [isOpen, token]);

  const fetchMemories = async () => {
    setLoading(true);
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/memories', { headers });
      const data = await res.json();
      if (data.memories) {
        setMemories(data.memories);
      }
    } catch (err) {
      console.error('Failed to fetch memories:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchKnowledge = async () => {
    try {
      const res = await fetch('/api/knowledge');
      const data = await res.json();
      if (data.chunks) {
        setKnowledgeChunks(data.chunks);
      }
    } catch (err) {
      console.error('Failed to fetch knowledge:', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers,
      });
      if (res.ok) {
        setMemories((prev) => prev.filter((m) => m.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete memory:', err);
    }
  };

  const handleUpdate = async (id) => {
    if (!editFact.trim()) return;
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/memories/${id}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ fact: editFact.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => prev.map((m) => (m.id === id ? data.memory : m)));
        setEditingId(null);
        setEditFact('');
      }
    } catch (err) {
      console.error('Failed to update memory:', err);
    }
  };

  const handleAddMemory = async (e) => {
    e.preventDefault();
    if (!newKey.trim() || !newFact.trim()) return;

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/memories', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          key: newKey.trim(),
          fact: newFact.trim(),
          category: newCategory,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMemories((prev) => [data.memory, ...prev.filter((m) => m.key !== data.memory.key)]);
        setNewKey('');
        setNewFact('');
        setIsAdding(false);
      }
    } catch (err) {
      console.error('Failed to save memory:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in font-sans">
      <div className="w-full max-w-3xl bg-[#FBF9F5] border-2 border-stone-900 rounded-lg shadow-[6px_6px_0px_0px_#1C1917] flex flex-col max-h-[85vh] overflow-hidden text-stone-900">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b-2 border-stone-800 bg-[#F5EFEB] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded border-2 border-stone-900 bg-purple-200 text-purple-950 flex items-center justify-center shadow-[2px_2px_0px_0px_#000]">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-mono text-stone-950 uppercase tracking-tight">
                3-Tier Memory Store & Catalog
              </h2>
              <p className="text-xs font-mono text-stone-600">
                Persistent cross-session facts, automatic conflict updates, and domain knowledge
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded border border-stone-400 hover:border-stone-900 bg-white hover:bg-stone-100 text-stone-900 shadow-[1px_1px_0px_0px_#000] transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 border-b-2 border-stone-800 bg-[#EFE9E2] text-xs font-mono font-bold">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('user-memories')}
              className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer uppercase ${
                activeTab === 'user-memories'
                  ? 'border-purple-700 text-purple-950 font-bold bg-white rounded-t border-t-2 border-x-2 border-stone-800 -mb-[2px]'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Tier 2: User Facts ({memories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge-base')}
              className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 cursor-pointer uppercase ${
                activeTab === 'knowledge-base'
                  ? 'border-purple-700 text-purple-950 font-bold bg-white rounded-t border-t-2 border-x-2 border-stone-800 -mb-[2px]'
                  : 'border-transparent text-stone-600 hover:text-stone-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tier 3: Domain RAG ({knowledgeChunks.length})</span>
            </button>
          </div>

          {activeTab === 'user-memories' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="mb-2 px-3 py-1 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase transition flex items-center gap-1 shadow-[2px_2px_0px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Fact</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#FBF9F5]">
          {activeTab === 'user-memories' && (
            <div className="space-y-4">
              {/* Add Memory Form */}
              {isAdding && (
                <form
                  onSubmit={handleAddMemory}
                  className="p-4 rounded-lg bg-white border-2 border-stone-900 shadow-[3px_3px_0px_0px_#1C1917] space-y-3 animate-fade-in"
                >
                  <div className="text-xs font-mono font-bold text-stone-900 uppercase">New Long-Term Fact Card</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono font-bold text-stone-700 mb-1 uppercase">Key / Topic</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. project_name, tech_stack"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full bg-[#FAF6F0] border-2 border-stone-800 rounded px-3 py-1.5 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono font-bold text-stone-700 mb-1 uppercase">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full bg-[#FAF6F0] border-2 border-stone-800 rounded px-3 py-1.5 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                      >
                        <option value="profile">Profile (Name, Role, Location)</option>
                        <option value="project">Project Details</option>
                        <option value="tech_stack">Tech Stack</option>
                        <option value="preference">Preference</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-bold text-stone-700 mb-1 uppercase">Fact Statement</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. User is building an AI dashboard using React 19"
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      className="w-full bg-[#FAF6F0] border-2 border-stone-800 rounded px-3 py-1.5 text-xs font-mono text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-3 py-1 text-xs font-mono text-stone-600 hover:text-stone-900 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 border-2 border-stone-900 rounded text-xs font-mono font-bold uppercase shadow-[2px_2px_0px_0px_#000] cursor-pointer"
                    >
                      Save Fact
                    </button>
                  </div>
                </form>
              )}

              {/* Notice Banner */}
              <div className="flex items-start gap-2.5 p-3 rounded bg-amber-50 border-2 border-amber-300 text-xs text-amber-950 font-mono shadow-[2px_2px_0px_0px_#F59E0B]">
                <Sparkles className="w-4 h-4 text-amber-800 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>LANGCHAIN PARSER:</strong> Dialogue mentions (e.g. *"My name is Sohail"*, *"I renamed my project"*) are automatically extracted, categorized, and updated with conflict resolution.
                </span>
              </div>

              {/* Memory Cards */}
              {memories.length === 0 ? (
                <div className="text-center py-10 text-stone-500 text-xs font-mono space-y-2">
                  <Brain className="w-8 h-8 mx-auto opacity-40 text-stone-700" />
                  <p className="font-bold">NO USER FACTS STORED YET.</p>
                  <p className="text-stone-600">
                    Mention your name, project, tech stack, or preferences in chat to automatically persist them!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {memories.map((mem) => {
                    const isEditing = editingId === mem.id;

                    return (
                      <div
                        key={mem.id}
                        className="group p-3.5 rounded-lg bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1 font-mono">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-stone-950 uppercase">
                              {mem.key}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-purple-100 text-purple-950 border border-purple-300">
                              {mem.category || 'general'}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={editFact}
                                onChange={(e) => setEditFact(e.target.value)}
                                className="flex-1 bg-[#FAF6F0] border-2 border-stone-800 rounded px-2.5 py-1 text-xs text-stone-900 focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdate(mem.id)}
                                className="p-1.5 bg-amber-400 hover:bg-amber-300 text-stone-950 border border-stone-800 rounded shadow-[1px_1px_0px_0px_#000] cursor-pointer"
                                title="Save changes"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-stone-500 hover:text-stone-900 cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-800 font-sans leading-relaxed">{mem.fact}</p>
                          )}

                          <div className="text-[10px] text-stone-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>Updated: {new Date(mem.updatedAt || mem.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition">
                            <button
                              onClick={() => {
                                setEditingId(mem.id);
                                setEditFact(mem.fact);
                              }}
                              title="Edit memory"
                              className="p-1.5 text-stone-600 hover:text-stone-950 hover:bg-amber-100 rounded border border-stone-300 shadow-[1px_1px_0px_0px_#1C1917] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              title="Delete memory"
                              className="p-1.5 text-stone-600 hover:text-rose-700 hover:bg-rose-50 rounded border border-stone-300 shadow-[1px_1px_0px_0px_#1C1917] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'knowledge-base' && (
            <div className="space-y-3">
              <div className="text-xs text-stone-700 p-3 rounded bg-white border-2 border-stone-800 font-mono shadow-[2px_2px_0px_0px_#1C1917]">
                Tier 3 stores global domain knowledge chunks retrieved via semantic vector search when users ask about architecture, capabilities, or guidelines.
              </div>

              {knowledgeChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-4 rounded-lg bg-white border-2 border-stone-800 shadow-[2px_2px_0px_0px_#1C1917] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold font-mono text-stone-950 uppercase">{chunk.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-100 text-stone-800 border border-stone-400 font-mono font-bold uppercase">
                      {chunk.category}
                    </span>
                  </div>
                  <p className="text-xs text-stone-800 font-sans leading-relaxed">{chunk.content}</p>
                  {chunk.tags && chunk.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {chunk.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-[#FAF6F0] text-stone-700 border border-stone-300 font-mono"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
