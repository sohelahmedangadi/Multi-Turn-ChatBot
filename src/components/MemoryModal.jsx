import React, { useState, useEffect } from 'react';
import {
  X,
  Brain,
  Trash2,
  Plus,
  Sparkles,
  BookOpen,
  Check,
  Tag,
  Clock,
  Edit2,
  Save,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-100">LangChain & 3-Tier Memory Store</h2>
              <p className="text-xs text-slate-400">
                Persistent cross-session facts, automatic conflict updates, and domain knowledge
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('user-memories')}
              className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'user-memories'
                  ? 'border-indigo-500 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Tier 2: User Memories ({memories.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('knowledge-base')}
              className={`pb-2.5 px-3 border-b-2 transition flex items-center gap-1.5 ${
                activeTab === 'knowledge-base'
                  ? 'border-indigo-500 text-indigo-300 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Tier 3: Knowledge Base ({knowledgeChunks.length})</span>
            </button>
          </div>

          {activeTab === 'user-memories' && (
            <button
              onClick={() => setIsAdding(!isAdding)}
              className="mb-2 px-2.5 py-1 bg-indigo-600/30 hover:bg-indigo-600 text-indigo-200 hover:text-white rounded-lg text-xs transition flex items-center gap-1 border border-indigo-500/30"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Memory</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'user-memories' && (
            <div className="space-y-4">
              {/* Add Memory Form */}
              {isAdding && (
                <form
                  onSubmit={handleAddMemory}
                  className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/40 space-y-3 animate-fade-in"
                >
                  <div className="text-xs font-semibold text-indigo-300">Add New Long-Term Fact</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Key / Topic</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. project_name, favorite_editor"
                        value={newKey}
                        onChange={(e) => setNewKey(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Category</label>
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
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
                    <label className="block text-[11px] text-slate-400 mb-1">Fact Statement</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. User is building an AI dashboard using React 19"
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsAdding(false)}
                      className="px-3 py-1 text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium shadow-sm"
                    >
                      Save Memory
                    </button>
                  </div>
                </form>
              )}

              {/* Notice Banner */}
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>LangChain & LLM Powered:</strong> Information mentioned during chats (e.g. *"My self Sohail"*, *"I'm building OmniTurn"*, *"I renamed my project"*) is automatically extracted, categorized, and updated with AI reasoning.
                </span>
              </div>

              {/* Memory Cards */}
              {memories.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs space-y-2">
                  <Brain className="w-8 h-8 mx-auto opacity-30" />
                  <p>No user memories stored yet.</p>
                  <p className="text-slate-600">
                    Mention your name, project, tech stack, or preferences in chat, and the AI will remember them across tabs and conversations!
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {memories.map((mem) => {
                    const isEditing = editingId === mem.id;

                    return (
                      <div
                        key={mem.id}
                        className="group p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-200 font-mono">
                              {mem.key}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                              {mem.category || 'general'}
                            </span>
                          </div>

                          {isEditing ? (
                            <div className="flex items-center gap-2 pt-1">
                              <input
                                type="text"
                                value={editFact}
                                onChange={(e) => setEditFact(e.target.value)}
                                className="flex-1 bg-slate-900 border border-indigo-500 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none"
                              />
                              <button
                                onClick={() => handleUpdate(mem.id)}
                                className="p-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded transition"
                                title="Save changes"
                              >
                                <Save className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="p-1.5 text-slate-400 hover:text-slate-200"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-300 leading-relaxed">{mem.fact}</p>
                          )}

                          <div className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                            <Clock className="w-3 h-3" />
                            <span>Updated: {new Date(mem.updatedAt || mem.createdAt).toLocaleString()}</span>
                          </div>
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                            <button
                              onClick={() => {
                                setEditingId(mem.id);
                                setEditFact(mem.fact);
                              }}
                              title="Edit memory"
                              className="p-1.5 text-slate-500 hover:text-indigo-300 hover:bg-slate-800 rounded-lg transition"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(mem.id)}
                              title="Delete memory"
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
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
              <div className="text-xs text-slate-400 p-3 rounded-xl bg-slate-950/40 border border-slate-800">
                Tier 3 stores global domain knowledge chunks retrieved via semantic vector search when users ask about architecture, capabilities, or guidelines.
              </div>

              {knowledgeChunks.map((chunk) => (
                <div
                  key={chunk.id}
                  className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-slate-200">{chunk.title}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                      {chunk.category}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{chunk.content}</p>
                  {chunk.tags && chunk.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      {chunk.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800"
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
