"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Search, 
  Sparkles, 
  Database, 
  History, 
  X, 
  ChevronDown, 
  BookOpen, 
  Check, 
  AlertCircle, 
  HelpCircle, 
  ArrowRight,
  TrendingUp,
  Cpu
} from "lucide-react";

interface Subject {
  id: number;
  name: string;
  file_name: string;
  question_count: number;
  created_at: string;
}

interface MCQ {
  id: number;
  subject_id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string;
  category?: string;
  topic?: string;
  difficulty?: string;
  score: number;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export default function Home() {
  // State
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MCQ[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ connected: boolean; totalMcqs: number } | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  
  // Dropdown UI state
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("");
  
  // Ref for search input and dropdown
  const searchInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Debounce search timer
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch subjects and status on load
  useEffect(() => {
    fetchSubjects();
    fetchBackendStatus();
    
    // Load recent searches from localStorage
    const saved = localStorage.getItem("mcq_recent_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse recent searches", e);
      }
    }

    // Keyboard shortcut to focus search input: '/'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setIsDropdownOpen(false);
        setSubjectFilter("");
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSubjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subjects`);
      if (res.ok) {
        const data: Subject[] = await res.json();
        setSubjects(data);
        // Automatically select the first subject if available
        if (data.length > 0 && !selectedSubject) {
          setSelectedSubject(data[0]);
        }
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    }
  };

  const fetchBackendStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setBackendStatus({
          connected: true,
          totalMcqs: data.total_mcqs
        });
      } else {
        setBackendStatus({ connected: false, totalMcqs: 0 });
      }
    } catch (err) {
      setBackendStatus({ connected: false, totalMcqs: 0 });
    }
  };

  // Perform search
  const performSearch = async (searchQuery: string, subjectId: number) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject_id: subjectId,
          query: searchQuery
        })
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        
        // Add to recent searches if search was successful and has query
        if (searchQuery.trim().length > 3) {
          addRecentSearch(searchQuery.trim());
        }
      } else {
        console.error("Search API error:", res.statusText);
      }
    } catch (err) {
      console.error("Error searching:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // Add search query to recent list
  const addRecentSearch = (str: string) => {
    setRecentSearches(prev => {
      const filtered = prev.filter(item => item.toLowerCase() !== str.toLowerCase());
      const updated = [str, ...filtered].slice(0, 5); // limit to 5
      localStorage.setItem("mcq_recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  // Clear search history
  const clearHistory = () => {
    setRecentSearches([]);
    localStorage.removeItem("mcq_recent_searches");
  };

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }

    if (!selectedSubject) return;

    if (val.trim()) {
      searchTimerRef.current = setTimeout(() => {
        performSearch(val, selectedSubject.id);
      }, 250); // 250ms debounce
    } else {
      setResults([]);
    }
  };

  // Trigger search on Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && selectedSubject) {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
      }
      performSearch(query, selectedSubject.id);
    }
  };

  // Run a quick suggestion / recent search
  const runPresetSearch = (text: string) => {
    setQuery(text);
    if (selectedSubject) {
      performSearch(text, selectedSubject.id);
    }
    searchInputRef.current?.focus();
  };

  // Filter subjects for dropdown search
  const filteredSubjects = subjects.filter(sub => 
    sub.name.toLowerCase().includes(subjectFilter.toLowerCase())
  );

  // Helper to determine active state of options
  const isCorrectOption = (letter: string, correctAnswer: string) => {
    const cleanedAnswer = correctAnswer.trim().toUpperCase();
    const cleanedLetter = letter.trim().toUpperCase();
    
    // Check for exact matching e.g., "A" == "A"
    if (cleanedAnswer === cleanedLetter) return true;
    
    // Check if the answer matches a format like "Option A" or "A. Option A text" or just starts with the option letter
    if (cleanedAnswer.startsWith(cleanedLetter) && (cleanedAnswer.length === 1 || cleanedAnswer[1] === "." || cleanedAnswer[1] === ")" || cleanedAnswer[1] === " ")) {
      return true;
    }
    
    return false;
  };

  return (
    <div className="min-h-screen grid-bg radial-glow pb-20 relative bg-[#fafafa] text-zinc-800">
      
      {/* Radial lighting blur */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] radial-glow pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[300px] radial-glow-bottom pointer-events-none -z-10" />

      {/* Top Header Navigation */}
      <header className="w-full py-6 px-8 flex justify-between items-center max-w-7xl mx-auto border-b border-zinc-200/50 backdrop-blur-md sticky top-0 z-40 bg-[#fafafa]/40">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-orange-groq to-amber-500 flex items-center justify-center shadow-md shadow-orange-groq/15 border border-orange-groq/20">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <span className="font-outfit font-bold text-xl tracking-tight bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-500 bg-clip-text text-transparent">
            MCQ <span className="text-orange-groq">Finder</span>
          </span>
        </div>

        {/* Database Status Indicator */}
        <div className="flex items-center space-x-4">
          {backendStatus ? (
            backendStatus.connected ? (
              <div className="flex items-center space-x-2 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <div className="w-2 h-2 rounded-full bg-emerald-500 absolute" />
                <span className="text-xs text-emerald-700 font-medium">
                  Active • {backendStatus.totalMcqs.toLocaleString()} MCQs
                </span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 bg-red-500/10 px-3 py-1 rounded-full border border-red-500/20">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span className="text-xs text-red-700 font-medium">Offline</span>
              </div>
            )
          ) : (
            <div className="flex items-center space-x-2 bg-zinc-500/10 px-3 py-1 rounded-full border border-zinc-500/20">
              <div className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
              <span className="text-xs text-zinc-600 font-medium">Connecting...</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-3xl mx-auto px-6 mt-16 flex flex-col items-center">
        
        {/* Title Group */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          >
            <h1 className="font-outfit text-5xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-b from-zinc-900 to-zinc-600 bg-clip-text text-transparent mb-4">
              MCQ Finder
            </h1>
            <p className="text-zinc-500 font-inter text-md md:text-lg max-w-md mx-auto">
              Find answers instantly from your course question banks.
            </p>
          </motion.div>
        </div>

        {/* Subject Selector (Command Palette Dropdown) */}
        <div className="w-full max-w-xl mb-6 relative z-30" ref={dropdownRef}>
          <div className="flex justify-between items-center mb-2 px-1">
            <span className="text-xs text-zinc-400 uppercase tracking-widest font-semibold flex items-center gap-1.5 select-none">
              <BookOpen className="w-3 h-3 text-orange-groq" /> Select Course Subject
            </span>
            {selectedSubject && (
              <span className="text-xs text-zinc-400 font-medium">
                {selectedSubject.question_count} questions loaded
              </span>
            )}
          </div>
          
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl bg-white border border-zinc-200 hover:border-orange-groq/30 focus:outline-none transition-all duration-300 shadow-sm shadow-zinc-100 group text-left cursor-pointer"
          >
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-orange-groq/5 text-orange-groq border border-orange-groq/10">
                <Database className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Active Subject</span>
                <span className="text-zinc-800 font-semibold font-outfit text-md">
                  {selectedSubject ? selectedSubject.name : "Choose a subject..."}
                </span>
              </div>
            </div>
            <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${isDropdownOpen ? "rotate-180 text-orange-groq" : ""}`} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {isDropdownOpen && (
              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 4, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute w-full mt-2 rounded-2xl bg-white border border-zinc-200 shadow-xl shadow-zinc-200/50 overflow-hidden"
              >
                {/* Search in Dropdown */}
                <div className="p-3 border-b border-zinc-200 flex items-center gap-2 bg-zinc-50/50">
                  <Search className="w-4 h-4 text-zinc-400 ml-1" />
                  <input
                    type="text"
                    placeholder="Search subject..."
                    value={subjectFilter}
                    onChange={(e) => setSubjectFilter(e.target.value)}
                    className="w-full bg-transparent border-none text-sm text-zinc-800 focus:outline-none placeholder-zinc-400 py-1"
                  />
                  {subjectFilter && (
                    <button onClick={() => setSubjectFilter("")} className="text-zinc-400 hover:text-zinc-600">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                  {filteredSubjects.length > 0 ? (
                    filteredSubjects.map((sub) => (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setSelectedSubject(sub);
                          setIsDropdownOpen(false);
                          setSubjectFilter("");
                          setQuery("");
                          setResults([]);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left text-sm transition-all duration-200 cursor-pointer ${
                          selectedSubject?.id === sub.id
                            ? "bg-orange-groq/5 border border-orange-groq/10 text-orange-groq font-semibold"
                            : "hover:bg-zinc-50 border border-transparent text-zinc-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <BookOpen className={`w-4 h-4 ${selectedSubject?.id === sub.id ? "text-orange-groq" : "text-zinc-400"}`} />
                          <span>{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                            selectedSubject?.id === sub.id ? "bg-orange-groq/15 text-orange-groq" : "bg-zinc-100 text-zinc-500"
                          }`}>
                            {sub.question_count} Qs
                          </span>
                          {selectedSubject?.id === sub.id && <Check className="w-4 h-4 text-orange-groq" />}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-8 text-center text-zinc-400 text-sm flex flex-col items-center gap-2">
                      <AlertCircle className="w-5 h-5 text-zinc-300" />
                      <span>No subjects found</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Large Search Box Area */}
        <div className="w-full max-w-xl mb-4 relative z-20">
          <div className="relative flex items-center">
            <Search className={`absolute left-4 w-5 h-5 transition-colors duration-300 ${query ? "text-orange-groq" : "text-zinc-400"}`} />
            
            <input
              ref={searchInputRef}
              type="text"
              placeholder={selectedSubject ? `Search in ${selectedSubject.name}...` : "Paste a question, keyword, or phrase..."}
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={!selectedSubject}
              className="w-full bg-white border border-zinc-200 hover:border-zinc-300 focus:border-orange-groq/60 text-zinc-800 placeholder-zinc-400 pl-12 pr-12 py-4.5 rounded-2xl text-md focus:outline-none transition-all duration-300 shadow-sm focus:shadow-[0_0_30px_rgba(255,94,0,0.04)] disabled:opacity-50 disabled:cursor-not-allowed"
            />
            
            <div className="absolute right-4 flex items-center space-x-2">
              {query ? (
                <button
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                  }}
                  className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <span className="text-[10px] border border-zinc-200 bg-zinc-50 px-2 py-1 rounded-md text-zinc-400 font-mono select-none">
                  /
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Recent Searches / Suggestions */}
        <div className="w-full max-w-xl mb-12">
          {recentSearches.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-1 text-xs">
              <span className="text-zinc-400 flex items-center gap-1 font-medium mr-1 select-none">
                <History className="w-3.5 h-3.5 text-zinc-400" /> Recents:
              </span>
              {recentSearches.map((term, idx) => (
                <button
                  key={idx}
                  onClick={() => runPresetSearch(term)}
                  className="bg-white border border-zinc-200 hover:border-orange-groq/30 text-zinc-600 hover:text-orange-groq px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer truncate max-w-[150px]"
                >
                  {term}
                </button>
              ))}
              <button
                onClick={clearHistory}
                className="text-zinc-400 hover:text-red-500 ml-auto transition-colors duration-200 cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          {/* Quick suggestions if no recent history */}
          {recentSearches.length === 0 && selectedSubject && (
            <div className="flex flex-wrap items-center gap-2 px-1 text-xs select-none">
              <span className="text-zinc-400 flex items-center gap-1 font-medium mr-1">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-400" /> Try searching:
              </span>
              <button
                onClick={() => runPresetSearch("lookup order")}
                className="bg-white border border-zinc-200 hover:border-orange-groq/30 text-zinc-500 hover:text-orange-groq px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer"
              >
                lookup order
              </button>
              <button
                onClick={() => runPresetSearch("variable binding")}
                className="bg-white border border-zinc-200 hover:border-orange-groq/30 text-zinc-500 hover:text-orange-groq px-2.5 py-1 rounded-full transition-all duration-200 cursor-pointer"
              >
                variable binding
              </button>
            </div>
          )}
        </div>

        {/* Results / Dynamic Panel */}
        <div className="w-full max-w-xl min-h-[300px]">
          <AnimatePresence mode="wait">
            
            {/* 1. Loading State */}
            {isLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 w-full"
              >
                {[1, 2].map((i) => (
                  <div key={i} className="w-full p-6 rounded-2xl bg-white border border-zinc-200 animate-pulse space-y-4 shadow-sm">
                    <div className="flex justify-between items-center">
                      <div className="h-4 bg-zinc-200 rounded-full w-24" />
                      <div className="h-4 bg-zinc-200 rounded-full w-12" />
                    </div>
                    <div className="space-y-2">
                      <div className="h-5 bg-zinc-200 rounded-full w-full" />
                      <div className="h-5 bg-zinc-200 rounded-full w-3/4" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                      {[1, 2, 3, 4].map((o) => (
                        <div key={o} className="h-10 bg-zinc-100 rounded-xl w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* 2. Empty State: No Subject Selected */}
            {!selectedSubject && !isLoading && (
              <motion.div
                key="no-subject"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full p-8 rounded-2xl glass-card border border-zinc-200/50 flex flex-col items-center justify-center text-center py-16 bg-white/60 shadow-sm"
              >
                <div className="p-4 rounded-full bg-orange-groq/5 border border-orange-groq/10 text-orange-groq mb-4">
                  <Database className="w-8 h-8 opacity-70" />
                </div>
                <h3 className="text-lg font-outfit font-semibold text-zinc-800 mb-1">No Subject Selected</h3>
                <p className="text-sm text-zinc-500 max-w-xs">
                  Choose a course subject to begin searching the question banks.
                </p>
              </motion.div>
            )}

            {/* 3. Empty State: No Query Typed */}
            {selectedSubject && !query.trim() && !isLoading && (
              <motion.div
                key="empty-query"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full p-8 rounded-2xl glass-card border border-zinc-200/50 flex flex-col items-center justify-center text-center py-16 bg-white/60 shadow-sm"
              >
                <div className="p-4 rounded-full bg-zinc-50 border border-zinc-100 text-zinc-400 mb-4">
                  <Search className="w-8 h-8 opacity-50 animate-pulse" />
                </div>
                <h3 className="text-lg font-outfit font-semibold text-zinc-700 mb-1">Ready to search</h3>
                <p className="text-sm text-zinc-500 max-w-xs mb-6">
                  Paste or type your question below. We will use fuzzy matching to fetch the correct MCQ answer.
                </p>
                <div className="text-xs text-zinc-500 border border-zinc-200 px-3 py-1.5 rounded-xl bg-zinc-50/50 font-mono select-none">
                  Press <kbd className="text-zinc-600 bg-white px-1.5 py-0.5 rounded border border-zinc-200 shadow-sm font-semibold">/</kbd> to focus search
                </div>
              </motion.div>
            )}

            {/* 4. Empty State: No Results Found */}
            {selectedSubject && query.trim() && results.length === 0 && !isLoading && (
              <motion.div
                key="no-results"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="w-full p-8 rounded-2xl glass-card border border-red-200 flex flex-col items-center justify-center text-center py-16 bg-white/60 shadow-sm"
              >
                <div className="p-4 rounded-full bg-red-500/5 border border-red-500/10 text-red-500 mb-4">
                  <AlertCircle className="w-8 h-8 opacity-70" />
                </div>
                <h3 className="text-lg font-outfit font-semibold text-zinc-800 mb-1">No results found</h3>
                <p className="text-sm text-zinc-500 max-w-xs">
                  We couldn&apos;t find any MCQs close to that query. Try using different keywords or checking for missing words.
                </p>
              </motion.div>
            )}

            {/* 5. Render Results */}
            {selectedSubject && query.trim() && results.length > 0 && !isLoading && (
              <motion.div
                key="results-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 w-full"
              >
                {/* Check if top score is a Confident Single Best Match */}
                {results.length === 1 ? (
                  <div className="text-xs font-semibold text-orange-groq uppercase tracking-widest px-1 mb-2 select-none flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> High Confidence Match Found
                  </div>
                ) : (
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest px-1 mb-2 select-none">
                    Multiple matching choices found (top 3 results)
                  </div>
                )}

                {results.map((mcq, idx) => {
                  const isTopMatch = idx === 0 && mcq.score >= 85;
                  
                  return (
                    <motion.div
                      key={mcq.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.08, duration: 0.4 }}
                      className={`w-full p-6 rounded-2xl transition-all duration-300 relative overflow-hidden ${
                        isTopMatch 
                          ? "correct-glow bg-gradient-to-br from-white via-white to-orange-groq/[0.01] border-orange-groq shadow-lg shadow-orange-groq/5" 
                          : "glass-card hover:border-zinc-300 bg-white/90 shadow-md shadow-zinc-100/50"
                      }`}
                    >
                      {/* Confident border accent lines */}
                      {isTopMatch && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-groq" />
                      )}

                      {/* Header row with badges & score */}
                      <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-2 border-b border-zinc-100">
                        <div className="flex flex-wrap gap-1.5">
                          {isTopMatch ? (
                            <span className="text-[10px] bg-orange-groq/10 text-orange-groq border border-orange-groq/20 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Best Match
                            </span>
                          ) : (
                            <span className="text-[10px] bg-zinc-50 border border-zinc-200 px-2 py-0.5 rounded-full font-medium text-zinc-500 uppercase tracking-wider">
                              Candidate #{idx + 1}
                            </span>
                          )}
                          
                          {/* Optional Category, Topic, Difficulty */}
                          {mcq.difficulty && (
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded-full font-medium">
                              {mcq.difficulty}
                            </span>
                          )}
                          {mcq.category && (
                            <span className="text-[10px] bg-zinc-100 text-zinc-600 border border-zinc-200 px-2 py-0.5 rounded-full font-medium max-w-[120px] truncate">
                              {mcq.category}
                            </span>
                          )}
                        </div>

                        {/* Match Confidence Score */}
                        <div className="flex items-center gap-1.5 select-none">
                          <span className="text-xs text-zinc-400">Confidence</span>
                          <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded-lg ${
                            mcq.score >= 85 
                              ? "text-orange-groq bg-orange-groq/5 border border-orange-groq/10" 
                              : mcq.score >= 60 
                                ? "text-amber-600 bg-amber-50 border border-amber-200/50" 
                                : "text-zinc-500 bg-zinc-50 border border-zinc-200"
                          }`}>
                            {Math.round(mcq.score)}%
                          </span>
                        </div>
                      </div>

                      {/* Question Text */}
                      <p className="text-zinc-800 font-semibold text-md leading-relaxed mb-6 font-outfit">
                        {mcq.question}
                      </p>

                      {/* Options Grid */}
                      <div className="grid grid-cols-1 gap-3">
                        {[
                          { label: "A", text: mcq.option_a },
                          { label: "B", text: mcq.option_b },
                          { label: "C", text: mcq.option_c },
                          { label: "D", text: mcq.option_d }
                        ].map((opt) => {
                          const isCorrect = isCorrectOption(opt.label, mcq.correct_answer);
                          
                          return (
                            <div
                              key={opt.label}
                              className={`flex items-start gap-3 p-3.5 rounded-xl border text-sm transition-all duration-300 ${
                                isCorrect
                                  ? "bg-orange-groq/5 border-orange-groq/20 text-orange-groq font-semibold shadow-sm"
                                  : "bg-zinc-50/50 border-zinc-200/60 text-zinc-500 opacity-70"
                              }`}
                            >
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold border transition-all ${
                                isCorrect
                                  ? "bg-orange-groq text-white border-orange-groq shadow-md shadow-orange-groq/10"
                                  : "bg-white text-zinc-400 border-zinc-200"
                              }`}>
                                {opt.label}
                              </div>
                              <div className="flex-1 pt-0.5 leading-snug break-words">
                                {opt.text}
                              </div>
                              
                              {/* Display animated indicator icon for correct answer */}
                              {isCorrect && (
                                <motion.div 
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 200, damping: 10 }}
                                  className="w-5 h-5 rounded-full bg-orange-groq/10 border border-orange-groq/30 flex items-center justify-center text-orange-groq self-center"
                                >
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </motion.div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Sub footer row */}
                      {mcq.topic && (
                        <div className="mt-4 pt-3 border-t border-zinc-100 text-[11px] text-zinc-500 flex items-center gap-1 select-none">
                          <Cpu className="w-3 h-3 text-orange-groq" />
                          <span>Topic: <strong>{mcq.topic}</strong></span>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer help guide */}
        <div className="w-full max-w-xl text-center mt-20 text-[11px] text-zinc-400 select-none">
          <p className="flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> 
            <span>Protip: Press <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded shadow-sm font-mono text-[9px] text-zinc-500">/</kbd> to search or <kbd className="px-1.5 py-0.5 bg-white border border-zinc-200 rounded shadow-sm font-mono text-[9px] text-zinc-500">Esc</kbd> to dismiss.</span>
          </p>
          <p className="mt-2 text-zinc-500">
            MCQ Finder Engine © 2026. Made with Vercel and FastAPI.
          </p>
        </div>

      </main>
    </div>
  );
}
