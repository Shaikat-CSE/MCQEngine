"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { 
  Sparkles, 
  Database, 
  BookOpen, 
  AlertCircle, 
  ChevronRight, 
  ArrowLeft,
  Calendar,
  FileText,
  Search,
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

const API_BASE = typeof process.env.NEXT_PUBLIC_API_URL !== "undefined" 
  ? process.env.NEXT_PUBLIC_API_URL 
  : "http://127.0.0.1:8000";

const formatFileName = (fileName: string) => {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, "");
  return nameWithoutExt.replace(/[_-]/g, " ");
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [backendStatus, setBackendStatus] = useState<{ connected: boolean; totalMcqs: number } | null>(null);

  useEffect(() => {
    fetchSubjects();
    fetchBackendStatus();
  }, []);

  const fetchSubjects = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/subjects`);
      if (res.ok) {
        const data: Subject[] = await res.json();
        setSubjects(data);
      }
    } catch (err) {
      console.error("Error fetching subjects:", err);
    } finally {
      setIsLoading(false);
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

  return (
    <div className="min-h-screen grid-bg radial-glow pb-20 relative bg-[#fafafa] text-zinc-800 antialiased select-none">
      
      {/* Background radial overlays */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[450px] radial-glow pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 right-0 h-[300px] radial-glow-bottom pointer-events-none -z-10" />

      {/* Top Header Navigation */}
      <header className="w-full py-4 md:py-5 px-4 md:px-8 flex justify-between items-center max-w-7xl mx-auto border-b border-zinc-200/60 backdrop-blur-md sticky top-0 z-40 bg-[#fafafa]/80 transition-all duration-300">
        <div className="flex items-center space-x-3 md:space-x-8">
          <Link href="/" className="flex items-center space-x-2.5 cursor-pointer group">
            <motion.div 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative w-9 h-9 md:w-10 md:h-10 transition-transform"
            >
              <img 
                src="/codemy-logo-light.png" 
                alt="Codemy Technologies Logo" 
                className="w-full h-full object-contain"
              />
            </motion.div>
            <span className="font-outfit font-extrabold text-lg md:text-2xl tracking-tight bg-gradient-to-r from-zinc-900 to-zinc-600 bg-clip-text text-transparent">
              Codemy <span className="text-orange-groq font-black">MCQ Bank</span>
            </span>
          </Link>

          <nav className="flex items-center space-x-1">
            <Link 
              href="/" 
              className="text-xs md:text-sm font-semibold font-outfit text-zinc-500 hover:text-zinc-800 px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl hover:bg-zinc-100 transition-all duration-200"
            >
              Search
            </Link>
            <Link 
              href="/subjects" 
              className="text-xs md:text-sm font-semibold font-outfit text-orange-groq px-2.5 py-1.5 md:px-3.5 md:py-2 rounded-xl bg-orange-groq/5 border border-orange-groq/10"
            >
              <span className="hidden sm:inline">Question </span>Banks
            </Link>
          </nav>
        </div>

        {/* Database Status Indicator */}
        <div className="flex items-center space-x-2 md:space-x-4">
          <AnimatePresence mode="wait">
            {backendStatus ? (
              backendStatus.connected ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center space-x-1.5 md:space-x-2 bg-emerald-500/10 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full border border-emerald-500/20 shadow-sm"
                >
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-500 relative flex items-center justify-center">
                    <span className="absolute w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-emerald-400 animate-ping" />
                  </div>
                  <span className="text-[10px] md:text-xs text-emerald-700 font-bold uppercase tracking-wider font-outfit">
                    <span className="hidden sm:inline">Active • </span>{backendStatus.totalMcqs.toLocaleString()} MCQs
                  </span>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center space-x-1.5 md:space-x-2 bg-red-500/10 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full border border-red-500/20 shadow-sm"
                >
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-red-500" />
                  <span className="text-[10px] md:text-xs text-red-700 font-bold uppercase tracking-wider font-outfit">Offline</span>
                </motion.div>
              )
            ) : (
              <div className="flex items-center space-x-1.5 bg-zinc-500/10 px-2.5 py-1 md:px-3.5 md:py-1.5 rounded-full border border-zinc-500/20 shadow-sm">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-zinc-400 animate-pulse" />
                <span className="text-[10px] md:text-xs text-zinc-500 font-bold uppercase tracking-wider font-outfit">Connecting...</span>
              </div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-5xl mx-auto px-6 mt-12">
        
        {/* Navigation Breadcrumb & Back button */}
        <div className="mb-8">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-orange-groq text-sm font-semibold font-outfit transition-colors group cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
            Back to Search Engine
          </Link>
        </div>

        {/* Title Group */}
        <div className="mb-12">
          <motion.div
            initial={{ opacity: 0, y: -15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="font-outfit text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-b from-zinc-950 to-zinc-600 bg-clip-text text-transparent mb-3.5 leading-none">
              Course Question Banks
            </h1>
            <p className="text-zinc-500 font-inter text-md md:text-lg font-medium max-w-2xl">
              Browse complete list of questions, filter by topic, search key terms, and locate answers for each specific subject.
            </p>
          </motion.div>
        </div>

        {/* Subjects Grid */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            
            {/* Loading skeleton state */}
            {isLoading && (
              <motion.div
                key="loading-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-60 rounded-3xl bg-white border border-zinc-200/60 animate-pulse shadow-sm p-6 flex flex-col justify-between" />
                ))}
              </motion.div>
            )}

            {/* Error state if backend status connected is false and zero subjects */}
            {!isLoading && subjects.length === 0 && (
              <motion.div
                key="empty-subjects"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full p-8 rounded-3xl glass-card flex flex-col items-center justify-center text-center py-20"
              >
                <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/10 text-red-500 mb-4 shadow-sm">
                  <AlertCircle className="w-8 h-8 opacity-75" />
                </div>
                <h3 className="text-xl font-outfit font-bold text-zinc-800 mb-1">No Question Banks Loaded</h3>
                <p className="text-sm text-zinc-500 font-inter max-w-md">
                  Ensure the API server is running and Excel sheets are uploaded to your backend <code className="bg-zinc-100 px-1 py-0.5 rounded text-[11px] font-mono">data/</code> directory.
                </p>
              </motion.div>
            )}

            {/* Main Cards Render */}
            {!isLoading && subjects.length > 0 && (
              <motion.div
                key="subjects-grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {subjects.map((sub, idx) => (
                  <motion.div
                    key={sub.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08, type: "spring", stiffness: 120, damping: 18 }}
                    className="glass-card glass-card-hover p-6 rounded-3xl flex flex-col justify-between relative overflow-hidden group border-zinc-200/80"
                  >
                    <div>
                      {/* Top Accent Gradient Icon */}
                      <div className="flex justify-between items-start mb-5">
                        <div className="w-12 h-12 rounded-2xl bg-orange-groq/5 border border-orange-500/10 text-orange-groq flex items-center justify-center shadow-inner group-hover:bg-orange-groq group-hover:text-white transition-colors duration-300">
                          <BookOpen className="w-5.5 h-5.5" />
                        </div>
                        <span className="text-[10px] bg-zinc-100 border border-zinc-200/80 px-2.5 py-1 rounded-full font-bold text-zinc-500 uppercase tracking-wider font-outfit">
                          Subject #{sub.id}
                        </span>
                      </div>

                      {/* Subject info */}
                      <h3 className="font-outfit font-black text-2xl text-zinc-900 group-hover:text-orange-groq transition-colors duration-300 mb-2">
                        {sub.name}
                      </h3>

                      <div className="flex items-center gap-1.5 text-zinc-500 text-xs mb-6 select-all font-inter">
                        <FileText className="w-3.5 h-3.5 text-orange-groq/60" />
                        <span className="truncate max-w-[280px] font-medium" title={sub.file_name}>
                          {formatFileName(sub.file_name)}
                        </span>
                      </div>
                    </div>

                    {/* Bottom stats and action row */}
                    <div className="flex justify-between items-center pt-4 border-t border-zinc-100 mt-2">
                      <div className="flex flex-col">
                        <span className="text-[9px] text-zinc-400 uppercase tracking-widest font-bold font-outfit">Total questions</span>
                        <span className="text-lg font-black text-zinc-800 font-mono">
                          {sub.question_count.toLocaleString()}
                        </span>
                      </div>

                      <Link 
                        href={`/subjects/${sub.id}`}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-zinc-900 hover:bg-orange-groq text-white text-xs font-bold font-outfit shadow-sm hover:shadow-md transition-all duration-300 group-hover:translate-x-0.5 cursor-pointer"
                      >
                        Browse Questions
                        <ChevronRight className="w-3.5 h-3.5 stroke-[2.5]" />
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer help guide */}
        <div className="w-full max-w-xl mx-auto text-center mt-20 text-[11px] text-zinc-400 select-none font-outfit font-semibold">
          <p className="flex items-center justify-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" /> 
            <span>Protip: Select any subject question bank to start practicing and testing your knowledge.</span>
          </p>
          <p className="mt-2 text-zinc-500 font-inter text-[10px] font-medium flex items-center justify-center gap-1 select-none">
            <span>Codemy MCQ Bank © 2026. Developed by</span>
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
