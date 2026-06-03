"use client";

import React, { useState, useEffect, useRef, use } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Sparkles, 
  Database, 
  BookOpen, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  ArrowLeft,
  Search,
  Filter,
  Check,
  X,
  BookOpenCheck,
  Eye,
  EyeOff,
  RefreshCw,
  HelpCircle,
  ExternalLink
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
}

interface PaginatedResponse {
  total: number;
  page: number;
  page_size: number;
  pages: number;
  results: MCQ[];
  categories: string[];
  topics: string[];
}

const API_BASE = typeof process.env.NEXT_PUBLIC_API_URL !== "undefined" 
  ? process.env.NEXT_PUBLIC_API_URL 
  : "http://127.0.0.1:8000";

export default function SubjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  // Data State
  const [subject, setSubject] = useState<Subject | null>(null);
  const [mcqs, setMcqs] = useState<MCQ[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  
  // Query / Filter State
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedDifficulty, setSelectedDifficulty] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMcqs, setTotalMcqs] = useState(0);
  
  // Loading & Error States
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [backendStatus, setBackendStatus] = useState<{ connected: boolean; totalMcqs: number } | null>(null);
  
  // Interactive Practice State
  const [isStudyMode, setIsStudyMode] = useState(true); // Study Mode: show answers immediately. Practice Mode: hide answers until clicked.
  const [userAnswers, setUserAnswers] = useState<{ [key: number]: string }>({});
  
  // Debounce search timer
  const searchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchSubjectInfo();
    fetchBackendStatus();

    // Keyboard shortcut to focus search input: '/'
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape") {
        searchInputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id]);

  useEffect(() => {
    fetchMCQs();
  }, [id, page, selectedCategory, selectedTopic, selectedDifficulty]);

  const fetchSubjectInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subjects/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSubject(data);
      } else {
        setIsError(true);
      }
    } catch (err) {
      console.error("Error fetching subject info:", err);
      setIsError(true);
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

  const fetchMCQs = async (searchTerm = search) => {
    setIsLoading(true);
    try {
      let url = `${API_BASE}/api/subjects/${id}/mcqs?page=${page}&page_size=15`;
      if (selectedCategory) url += `&category=${encodeURIComponent(selectedCategory)}`;
      if (selectedTopic) url += `&topic=${encodeURIComponent(selectedTopic)}`;
      if (selectedDifficulty) url += `&difficulty=${encodeURIComponent(selectedDifficulty)}`;
      if (searchTerm.trim()) url += `&search=${encodeURIComponent(searchTerm.trim())}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setMcqs(data.results);
        setTotalPages(data.pages);
        setTotalMcqs(data.total);
        // Only load the filters lists on initial/category change resets if empty
        if (data.categories.length > 0) setCategories(data.categories);
        if (data.topics.length > 0) setTopics(data.topics);
      } else {
        setIsError(true);
      }
    } catch (err) {
      console.error("Error fetching MCQs:", err);
      setIsError(true);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    setPage(1); // Reset page to 1 for search query change
    
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
    }
    
    searchTimerRef.current = setTimeout(() => {
      fetchMCQs(val);
    }, 400); // 400ms debounce
  };

  const clearFilters = () => {
    setSearch("");
    setSelectedCategory("");
    setSelectedTopic("");
    setSelectedDifficulty("");
    setPage(1);
    fetchMCQs("");
  };

  // Helper to determine active state of options
  const isCorrectOption = (letter: string, correctAnswer: string) => {
    const cleanedAnswer = correctAnswer.trim().toUpperCase();
    const cleanedLetter = letter.trim().toUpperCase();
    
    if (cleanedAnswer === cleanedLetter) return true;
    if (cleanedAnswer.startsWith(cleanedLetter) && (cleanedAnswer.length === 1 || cleanedAnswer[1] === "." || cleanedAnswer[1] === ")" || cleanedAnswer[1] === " ")) {
      return true;
    }
    return false;
  };

  const handleOptionClick = (mcqId: number, letter: string) => {
    if (isStudyMode) return; // In study mode, clicking options has no active quiz effect
    if (userAnswers[mcqId]) return; // Only allow one click per question
    
    setUserAnswers(prev => ({
      ...prev,
      [mcqId]: letter
    }));
  };

  const resetPractice = () => {
    setUserAnswers({});
  };

  const hasCategories = categories.length > 0;
  const hasTopics = topics.length > 0;

  let searchSpan = "md:col-span-4";
  if (hasCategories && hasTopics) {
    searchSpan = "md:col-span-2";
  } else if (hasCategories || hasTopics) {
    searchSpan = "md:col-span-3";
  }


  return (
    <div className="min-h-screen grid-bg radial-glow pb-20 relative bg-[#fafafa] text-zinc-800 antialiased">
      
      {/* Background radial overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] radial-glow pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[300px] radial-glow-bottom pointer-events-none -z-10" />

      {/* Top Header Navigation */}
      <header className="w-full py-5 px-8 flex justify-between items-center max-w-7xl mx-auto border-b border-zinc-200/60 backdrop-blur-md sticky top-0 z-40 bg-[#fafafa]/80 transition-all duration-300">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-3 cursor-pointer group select-none">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-groq to-amber-500 flex items-center justify-center shadow-md shadow-orange-groq/20 border border-orange-500/20"
            >
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </motion.div>
            <span className="font-outfit font-extrabold text-2xl tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">
              MCQ <span className="text-orange-groq font-black">Finder</span>
            </span>
          </Link>

          <nav className="hidden md:flex items-center space-x-1 select-none">
            <Link 
              href="/" 
              className="text-sm font-semibold font-outfit text-zinc-500 hover:text-zinc-800 px-3.5 py-2 rounded-xl hover:bg-zinc-100 transition-all duration-200"
            >
              Search
            </Link>
            <Link 
              href="/subjects" 
              className="text-sm font-semibold font-outfit text-orange-groq px-3.5 py-2 rounded-xl bg-orange-groq/5 border border-orange-groq/10"
            >
              Question Banks
            </Link>
          </nav>
        </div>

        {/* Database Status Indicator */}
        <div className="flex items-center space-x-4 select-none">
          <AnimatePresence mode="wait">
            {backendStatus ? (
              backendStatus.connected ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center space-x-2 bg-emerald-500/10 px-3.5 py-1.5 rounded-full border border-emerald-500/20 shadow-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-emerald-500 relative flex items-center justify-center">
                    <span className="absolute w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <span className="text-xs text-emerald-700 font-bold uppercase tracking-wider font-outfit">
                    Active • {backendStatus.totalMcqs.toLocaleString()} MCQs
                  </span>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center space-x-2 bg-red-500/10 px-3.5 py-1.5 rounded-full border border-red-500/20 shadow-sm"
                >
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <span className="text-xs text-red-700 font-bold uppercase tracking-wider font-outfit">Offline</span>
                </motion.div>
              )
            ) : (
              <div className="flex items-center space-x-2 bg-zinc-500/10 px-3.5 py-1.5 rounded-full border border-zinc-500/20 shadow-sm">
                <div className="w-2 h-2 rounded-full bg-zinc-400 animate-pulse" />
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider font-outfit">Connecting...</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-6 mt-12">
        
        {/* Navigation Breadcrumb & Mode Selectors */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8 select-none">
          <Link 
            href="/subjects" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-groq text-sm font-semibold font-outfit transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Question Banks
          </Link>

          {/* Mode Switcher */}
          <div className="flex items-center bg-white border border-zinc-200 p-1.5 rounded-2xl shadow-sm self-start sm:self-auto">
            <button
              onClick={() => {
                setIsStudyMode(true);
                resetPractice();
              }}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-outfit transition-all cursor-pointer ${
                isStudyMode 
                  ? "bg-orange-groq text-white shadow-md shadow-orange-groq/10" 
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              Study Mode
            </button>
            <button
              onClick={() => setIsStudyMode(false)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold font-outfit transition-all cursor-pointer ${
                !isStudyMode 
                  ? "bg-orange-groq text-white shadow-md shadow-orange-groq/10" 
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              <BookOpenCheck className="w-3.5 h-3.5" />
              Practice Mode
            </button>
          </div>
        </div>

        {/* Title Group */}
        <div className="mb-10">
          <AnimatePresence mode="wait">
            {subject ? (
              <motion.div
                key="title-section"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <h1 className="font-outfit text-3xl md:text-4xl font-black tracking-tight text-zinc-900 mb-2 leading-tight">
                  {subject.name}
                </h1>
                <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-zinc-500 font-outfit">
                  <span className="bg-orange-groq/10 text-orange-groq border border-orange-groq/20 px-3 py-1 rounded-full font-bold">
                    {subject.question_count} Questions total
                  </span>
                  {totalMcqs !== subject.question_count && (
                    <span className="bg-zinc-100 text-zinc-600 px-3 py-1 rounded-full font-bold">
                      {totalMcqs} matching criteria
                    </span>
                  )}
                  <span className="font-mono text-[10px] select-all uppercase">
                    File: {subject.file_name}
                  </span>
                </div>
              </motion.div>
            ) : (
              <div className="animate-pulse space-y-2">
                <div className="h-9 bg-zinc-200 rounded-full w-2/3" />
                <div className="h-5 bg-zinc-200 rounded-full w-1/3" />
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Search, Filter & Controls Panel */}
        <div className="bg-white border border-zinc-200/80 rounded-3xl p-6 shadow-sm mb-8 select-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            
            {/* Search Input Box */}
            <div className={`relative flex items-center ${searchSpan}`}>
              <Search className="absolute left-3.5 w-4 h-4 text-zinc-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search queries in this subject..."
                value={search}
                onChange={handleSearchChange}
                className="w-full bg-zinc-50/50 border border-zinc-200 hover:border-zinc-300 focus:border-orange-groq/60 text-zinc-800 placeholder-zinc-400 pl-10.5 pr-4 py-3 rounded-2xl text-sm focus:outline-none transition-all duration-300 font-medium"
              />
              {search && (
                <button
                  onClick={() => {
                    setSearch("");
                    setPage(1);
                    fetchMCQs("");
                  }}
                  className="absolute right-3.5 p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-all cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Category Select */}
            {hasCategories && (
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-zinc-50/50 border border-zinc-200 hover:border-zinc-300 focus:border-orange-groq/60 text-zinc-700 px-3.5 py-3 rounded-2xl text-sm focus:outline-none transition-all duration-300 appearance-none font-semibold font-outfit"
                >
                  <option value="">All Categories</option>
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat}>{cat}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <Filter className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

            {/* Topic Select */}
            {hasTopics && (
              <div className="relative">
                <select
                  value={selectedTopic}
                  onChange={(e) => {
                    setSelectedTopic(e.target.value);
                    setPage(1);
                  }}
                  className="w-full bg-zinc-50/50 border border-zinc-200 hover:border-zinc-300 focus:border-orange-groq/60 text-zinc-700 px-3.5 py-3 rounded-2xl text-sm focus:outline-none transition-all duration-300 appearance-none font-semibold font-outfit"
                >
                  <option value="">All Topics</option>
                  {topics.map((top, idx) => (
                    <option key={idx} value={top}>{top}</option>
                  ))}
                </select>
                <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                  <Filter className="w-3.5 h-3.5" />
                </div>
              </div>
            )}

          </div>

          {/* Quick Clear Filter Option */}
          {(selectedCategory || selectedTopic || selectedDifficulty || search) && (
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-zinc-100">
              <span className="text-xs text-zinc-400 font-semibold font-outfit">
                Active filters are hiding some questions.
              </span>
              <button
                onClick={clearFilters}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-orange-groq/30 text-zinc-600 hover:text-orange-groq text-xs font-bold font-outfit transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Clear Filters
              </button>
            </div>
          )}

          {/* Practice Mode reset helper */}
          {!isStudyMode && Object.keys(userAnswers).length > 0 && (
            <div className="mt-4 flex items-center justify-between pt-4 border-t border-zinc-100">
              <span className="text-xs text-zinc-400 font-semibold font-outfit">
                You answered {Object.keys(userAnswers).length} of {mcqs.length} questions on this page.
              </span>
              <button
                onClick={resetPractice}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 hover:border-orange-groq/30 text-zinc-600 hover:text-orange-groq text-xs font-bold font-outfit transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Reset Answers
              </button>
            </div>
          )}
        </div>

        {/* Error or Empty Screen */}
        {isError && (
          <div className="w-full p-8 rounded-3xl glass-card flex flex-col items-center justify-center text-center py-20">
            <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500 mb-4">
              <AlertCircle className="w-8 h-8 opacity-75" />
            </div>
            <h3 className="text-xl font-outfit font-bold text-zinc-800 mb-1">Subject Not Found</h3>
            <p className="text-sm text-zinc-500 font-inter max-w-sm mb-4">
              We couldn&apos;t load this subject data. It may have been renamed or deleted.
            </p>
            <Link 
              href="/subjects"
              className="px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-orange-groq text-white text-xs font-bold font-outfit transition-colors"
            >
              Browse Other Subjects
            </Link>
          </div>
        )}

        {/* MCQ Cards Container */}
        <div className="space-y-6">
          <AnimatePresence mode="wait">
            
            {/* Loading skeletons */}
            {isLoading && !isError && (
              <motion.div
                key="loading-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6 w-full"
              >
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-full p-6.5 rounded-3xl bg-white border border-zinc-200/60 animate-pulse space-y-4 shadow-sm">
                    <div className="flex gap-2">
                      <div className="h-4 bg-zinc-200 rounded-full w-20" />
                      <div className="h-4 bg-zinc-200 rounded-full w-24" />
                    </div>
                    <div className="h-6 bg-zinc-200 rounded-full w-4/5" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                      {[1, 2, 3, 4].map((o) => (
                        <div key={o} className="h-10 bg-zinc-100 rounded-xl w-full" />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Empty results */}
            {!isLoading && !isError && mcqs.length === 0 && (
              <motion.div
                key="no-mcqs"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full p-8 rounded-3xl glass-card flex flex-col items-center justify-center text-center py-20"
              >
                <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-100 text-zinc-400 mb-4">
                  <BookOpen className="w-8 h-8 opacity-65" />
                </div>
                <h3 className="text-xl font-outfit font-bold text-zinc-800 mb-1">No MCQs Match Your Filters</h3>
                <p className="text-sm text-zinc-500 font-inter max-w-sm">
                  Try clearing some category/topic selection filters or search keywords.
                </p>
              </motion.div>
            )}

            {/* MCQ List Items */}
            {!isLoading && !isError && mcqs.length > 0 && (
              <motion.div
                key="mcqs-list"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                {mcqs.map((mcq, idx) => {
                  const globalIdx = (page - 1) * 15 + idx + 1;
                  const selectedAnswer = userAnswers[mcq.id];
                  
                  return (
                    <motion.div
                      key={mcq.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04, type: "spring", stiffness: 130, damping: 20 }}
                      className="w-full p-6.5 rounded-3xl bg-white border border-zinc-200/80 relative overflow-hidden transition-all duration-300"
                    >
                      {/* Left accent indicator (in study mode, always orange. In practice mode, shows green/red status) */}
                      {isStudyMode ? (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-groq/50" />
                      ) : selectedAnswer ? (
                        isCorrectOption(selectedAnswer, mcq.correct_answer) ? (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />
                        ) : (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />
                        )
                      ) : (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-zinc-200" />
                      )}

                      {/* Header tags metadata */}
                      <div className="flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b border-zinc-100 select-none">
                        <div className="flex flex-wrap gap-1.5">
                          <span className="text-[9px] bg-zinc-100 border border-zinc-200/80 px-2.5 py-0.5 rounded-full font-bold text-zinc-500 uppercase tracking-wider font-outfit">
                            Q#{globalIdx}
                          </span>

                          {mcq.difficulty && (
                            <span className="text-[9px] bg-zinc-50 text-zinc-600 border border-zinc-200/80 px-2.5 py-0.5 rounded-full font-bold font-outfit uppercase">
                              {mcq.difficulty}
                            </span>
                          )}

                          {mcq.category && (
                            <span className="text-[9px] bg-zinc-50 text-zinc-600 border border-zinc-200/80 px-2.5 py-0.5 rounded-full font-bold font-outfit truncate max-w-[150px]">
                              {mcq.category}
                            </span>
                          )}

                          {mcq.topic && (
                            <span className="text-[9px] bg-zinc-50 text-zinc-600 border border-zinc-200/80 px-2.5 py-0.5 rounded-full font-bold font-outfit truncate max-w-[150px]">
                              {mcq.topic}
                            </span>
                          )}
                        </div>

                        {/* Optional Tag indicator (answered / practice) */}
                        {!isStudyMode && selectedAnswer && (
                          <span className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-outfit ${
                            isCorrectOption(selectedAnswer, mcq.correct_answer)
                              ? "bg-emerald-500/10 text-emerald-700"
                              : "bg-red-500/10 text-red-700"
                          }`}>
                            {isCorrectOption(selectedAnswer, mcq.correct_answer) ? "Correct" : "Incorrect"}
                          </span>
                        )}
                      </div>

                      {/* Question Text */}
                      <p className="text-zinc-900 font-bold text-md leading-relaxed mb-6 font-outfit select-text">
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
                          
                          // Style states based on Mode and interactions
                          let optionStyle = "bg-zinc-50/40 border-zinc-200/50 text-zinc-600 hover:bg-zinc-50";
                          let labelStyle = "bg-white text-zinc-500 border-zinc-200";
                          let showCheck = false;
                          let showCross = false;

                          if (isStudyMode) {
                            if (isCorrect) {
                              optionStyle = "bg-orange-groq/5 border-orange-groq/30 text-orange-groq font-bold shadow-sm shadow-orange-500/5";
                              labelStyle = "bg-orange-groq text-white border-orange-groq shadow-md shadow-orange-groq/20";
                              showCheck = true;
                            } else {
                              optionStyle = "bg-zinc-50/40 border-zinc-200/50 text-zinc-600 opacity-60";
                            }
                          } else {
                            // Practice Mode logic
                            const hasClickedOption = !!selectedAnswer;
                            const isThisClicked = selectedAnswer === opt.label;

                            if (hasClickedOption) {
                              if (isCorrect) {
                                // Always highlight correct option green once answered
                                optionStyle = "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 font-bold";
                                labelStyle = "bg-emerald-500 text-white border-emerald-500";
                                showCheck = true;
                              } else if (isThisClicked) {
                                // Highlight incorrect click as red
                                optionStyle = "bg-red-500/5 border-red-500/30 text-red-700 font-bold";
                                labelStyle = "bg-red-500 text-white border-red-500";
                                showCross = true;
                              } else {
                                optionStyle = "bg-zinc-50/40 border-zinc-200/50 text-zinc-600 opacity-50";
                              }
                            } else {
                              // Unanswered clickable states
                              optionStyle = "bg-zinc-50/40 border-zinc-200/50 text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 cursor-pointer";
                            }
                          }

                          return (
                            <div
                              key={opt.label}
                              onClick={() => handleOptionClick(mcq.id, opt.label)}
                              className={`flex items-start gap-3.5 p-4 rounded-2xl border text-sm transition-all duration-200 select-text ${optionStyle}`}
                            >
                              {/* Option Letter Icon */}
                              <div className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black border transition-all select-none ${labelStyle}`}>
                                {opt.label}
                              </div>

                              {/* Option text */}
                              <div className="flex-1 pt-0.5 leading-relaxed break-words font-medium font-inter">
                                {opt.text}
                              </div>

                              {/* Correct checkmark icon */}
                              {showCheck && (
                                <div className={`w-5.5 h-5.5 rounded-full text-white flex items-center justify-center self-center shadow select-none ${
                                  isStudyMode ? "bg-orange-groq shadow-orange-groq/20" : "bg-emerald-500 shadow-emerald-500/20"
                                }`}>
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}

                              {/* Incorrect X mark icon */}
                              {showCross && (
                                <div className="w-5.5 h-5.5 rounded-full bg-red-500 text-white flex items-center justify-center self-center shadow shadow-red-500/20 select-none">
                                  <X className="w-3.5 h-3.5 stroke-[3]" />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                    </motion.div>
                  );
                })}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Pagination controls footer */}
        {!isLoading && !isError && totalPages > 1 && (
          <div className="mt-12 flex justify-between items-center bg-white border border-zinc-200/80 p-4 rounded-3xl shadow-sm select-none">
            <button
              onClick={() => {
                if (page > 1) {
                  setPage(page - 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              disabled={page === 1}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-zinc-200/80 hover:border-zinc-300 disabled:opacity-40 disabled:hover:border-zinc-200/80 text-zinc-600 text-xs font-bold font-outfit transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-xs text-zinc-500 font-bold font-outfit">
              Page <span className="text-zinc-800">{page}</span> of {totalPages}
            </span>

            <button
              onClick={() => {
                if (page < totalPages) {
                  setPage(page + 1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }
              }}
              disabled={page === totalPages}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-zinc-200/80 hover:border-zinc-300 disabled:opacity-40 disabled:hover:border-zinc-200/80 text-zinc-600 text-xs font-bold font-outfit transition-all cursor-pointer disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Footer help guide */}
        <div className="w-full max-w-xl mx-auto text-center mt-20 text-[11px] text-zinc-400 select-none font-outfit font-semibold">
          <p className="flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> 
            <span>Protip: Press <kbd className="keycap px-1.5 py-0.5 rounded text-[9px] text-zinc-600 font-bold select-none">/</kbd> to search or <kbd className="keycap px-1.5 py-0.5 rounded text-[9px] text-zinc-600 font-bold select-none">Esc</kbd> to exit.</span>
          </p>
          <p className="mt-2 text-zinc-500 font-inter text-[10px] font-medium flex items-center justify-center gap-1 select-none">
            <span>MCQ Finder Engine © 2026. Developed by</span>
            <a 
              href="https://codemybd.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-orange-groq hover:underline font-bold inline-flex items-center gap-0.5"
            >
              Codemy Technologies <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </p>
        </div>

      </main>
    </div>
  );
}
