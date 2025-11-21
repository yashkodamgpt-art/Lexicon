
import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { motion } from 'framer-motion';
import { 
  BookOpen, Flame, Clock, Layers, Award, 
  TrendingUp, Calendar, PieChart, Hash, Zap, CheckCircle, Lightbulb
} from 'lucide-react';

const BADGES_CONFIG: Record<string, { name: string, desc: string, icon: any, color: string }> = {
  'bookworm': { name: 'Bookworm', desc: 'Read 10 books', icon: BookOpen, color: 'text-blue-400' },
  'on_fire': { name: 'On Fire', desc: '7-day streak', icon: Flame, color: 'text-orange-400' },
  'highlighter': { name: 'Highlighter', desc: '100 highlights', icon: Hash, color: 'text-yellow-400' },
  'thoughtful': { name: 'Thoughtful', desc: '50 notes created', icon: Zap, color: 'text-purple-400' },
  'completionist': { name: 'Completionist', desc: 'Finished 5 books', icon: CheckCircle, color: 'text-green-400' },
};

export const StatsView: React.FC = () => {
  const books = useLiveQuery(() => db.books.toArray());
  const sessions = useLiveQuery(() => db.readingSessions.toArray());
  const badges = useLiveQuery(() => db.badges.toArray());
  const highlights = useLiveQuery(() => db.highlights.toArray());

  // --- Calculations ---
  const stats = useMemo(() => {
    if (!books || !sessions || !highlights) return null;

    // Basic Counts
    const totalBooks = books.length;
    const finishedBooks = books.filter(b => Math.floor(b.progress) === 100).length;
    const inProgress = books.filter(b => b.progress > 0 && b.progress < 100).length;

    // Time
    const totalTimeMs = sessions.reduce((acc, s) => acc + s.duration, 0);
    const totalHours = Math.round(totalTimeMs / (1000 * 60 * 60));
    
    // Streak Calculation
    const sessionDates = [...new Set(sessions.map(s => new Date(s.startTime).toDateString()))];
    // Sort dates descending
    const sortedDates = sessionDates.map(d => new Date(d).getTime()).sort((a,b) => b-a);
    
    let streak = 0;
    if (sortedDates.length > 0) {
       const today = new Date().setHours(0,0,0,0);
       const lastRead = new Date(sortedDates[0]).setHours(0,0,0,0);
       
       // Check if read today or yesterday to maintain streak
       if (today - lastRead <= 86400000) {
          streak = 1;
          let currentDate = lastRead;
          for (let i = 1; i < sortedDates.length; i++) {
             const prevDate = new Date(sortedDates[i]).setHours(0,0,0,0);
             if (currentDate - prevDate === 86400000) { // 1 day diff
                streak++;
                currentDate = prevDate;
             } else if (currentDate - prevDate > 86400000) {
                break;
             }
          }
       }
    }

    // Heatmap Data (Last 365 days)
    const heatmapData: {date: string, count: number, intensity: number}[] = [];
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    for (let d = new Date(oneYearAgo); d <= today; d.setDate(d.getDate() + 1)) {
       const dateStr = d.toDateString();
       const daySessions = sessions.filter(s => new Date(s.startTime).toDateString() === dateStr);
       const duration = daySessions.reduce((acc, s) => acc + s.duration, 0);
       // Intensity 0-4 based on minutes read (0, 15, 30, 60, 120+)
       const mins = duration / 60000;
       let intensity = 0;
       if (mins > 0) intensity = 1;
       if (mins > 15) intensity = 2;
       if (mins > 45) intensity = 3;
       if (mins > 90) intensity = 4;
       
       heatmapData.push({ date: dateStr, count: daySessions.length, intensity });
    }

    // Last 30 Days Chart
    const last30Days = [];
    for (let i = 29; i >= 0; i--) {
       const d = new Date();
       d.setDate(d.getDate() - i);
       const dateStr = d.toDateString();
       const daySessions = sessions.filter(s => new Date(s.startTime).toDateString() === dateStr);
       const durationMins = Math.round(daySessions.reduce((acc, s) => acc + s.duration, 0) / 60000);
       last30Days.push({ label: d.getDate(), value: durationMins });
    }

    // Insights
    const insights = [];
    if (streak > 3) insights.push(`You're on a ${streak}-day reading streak! Keep it up! 🔥`);
    if (finishedBooks > 0) insights.push(`You've finished ${finishedBooks} books this year.`);
    const highlightCount = highlights.length;
    
    // Calculate most common color safely
    const colorCounts: Record<string, number> = {};
    let mostCommonColor = 'yellow';
    let maxCount = 0;
    
    if (highlights.length > 0) {
        highlights.forEach(h => {
            colorCounts[h.color] = (colorCounts[h.color] || 0) + 1;
            if (colorCounts[h.color] > maxCount) {
                maxCount = colorCounts[h.color];
                mostCommonColor = h.color;
            }
        });
    }

    if (highlightCount > 10) insights.push(`You highlight mostly in ${mostCommonColor}.`);

    return {
       totalBooks, finishedBooks, inProgress, totalHours, streak,
       heatmapData, last30Days, insights
    };
  }, [books, sessions, highlights]);

  const getIntensityClass = (intensity: number) => {
    switch(intensity) {
       case 0: return 'bg-white/5';
       case 1: return 'bg-blue-900/40';
       case 2: return 'bg-blue-700/60';
       case 3: return 'bg-blue-500/80';
       case 4: return 'bg-blue-400';
       default: return 'bg-white/5';
    }
  };

  if (!stats) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
       <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pb-32 md:pb-20">
      {/* Header */}
      <div className="glass border-b border-white/5 px-4 md:px-6 py-6 md:py-8 mb-8">
        <div className="max-w-7xl mx-auto">
           <h1 className="text-2xl md:text-3xl font-bold mb-2">Insights</h1>
           <p className="text-sm md:text-base text-zinc-400">Track your reading journey and habits.</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 space-y-6 md:space-y-8">
         
         {/* Overview Cards */}
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <StatsCard 
              icon={BookOpen} label="Total Books" value={stats.totalBooks} 
              subValue={`${stats.finishedBooks} finished`} color="text-blue-400" 
            />
            <StatsCard 
              icon={Clock} label="Reading Time" value={`${stats.totalHours}h`} 
              subValue="All time estimated" color="text-purple-400" 
            />
            <StatsCard 
              icon={Flame} label="Current Streak" value={`${stats.streak}`} 
              subValue="Consecutive days" color="text-orange-400" 
            />
            <StatsCard 
              icon={Layers} label="In Progress" value={stats.inProgress} 
              subValue="Books started" color="text-green-400" 
            />
         </div>

         {/* Activity Heatmap */}
         <div className="bg-[#111] border border-white/5 rounded-2xl p-4 md:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
               <h3 className="font-bold text-lg flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-zinc-400" /> Reading Activity
               </h3>
               <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500">
                  <span>Less</span>
                  <div className="flex gap-1">
                     <div className="w-3 h-3 rounded-sm bg-white/5" />
                     <div className="w-3 h-3 rounded-sm bg-blue-900/40" />
                     <div className="w-3 h-3 rounded-sm bg-blue-700/60" />
                     <div className="w-3 h-3 rounded-sm bg-blue-500/80" />
                     <div className="w-3 h-3 rounded-sm bg-blue-400" />
                  </div>
                  <span>More</span>
               </div>
            </div>
            <div className="flex flex-wrap gap-1 justify-center md:justify-start">
               {stats.heatmapData.map((day, i) => (
                  <div 
                     key={i}
                     className={`w-2 h-2 md:w-3 md:h-3 rounded-sm ${getIntensityClass(day.intensity)}`}
                     title={`${day.date}: ${day.count} sessions`}
                  />
               ))}
            </div>
         </div>

         {/* Charts & Insights Row */}
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Recent Activity Chart */}
            <div className="lg:col-span-2 bg-[#111] border border-white/5 rounded-2xl p-4 md:p-6">
               <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-zinc-400" /> Last 30 Days (Minutes)
               </h3>
               <div className="h-40 md:h-48 flex items-end justify-between gap-1 md:gap-2">
                  {stats.last30Days.map((day, i) => (
                     <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                        <div 
                           className="w-full bg-blue-500/20 rounded-t-sm transition-all duration-500 group-hover:bg-blue-500/50 relative"
                           style={{ height: `${Math.max(5, Math.min(100, (day.value / 120) * 100))}%` }}
                        >
                           <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black border border-white/10 px-2 py-1 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 hidden md:block">
                              {day.value} mins
                           </div>
                        </div>
                     </div>
                  ))}
               </div>
               <div className="flex justify-between mt-2 text-xs text-zinc-600">
                  <span>30 days ago</span>
                  <span>Today</span>
               </div>
            </div>

            {/* Smart Insights */}
            <div className="bg-[#111] border border-white/5 rounded-2xl p-4 md:p-6">
               <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-yellow-500" /> Smart Insights
               </h3>
               <div className="space-y-4">
                  {stats.insights.length > 0 ? stats.insights.map((text, i) => (
                     <div key={i} className="bg-white/5 rounded-xl p-4 text-sm border-l-2 border-blue-500">
                        {text}
                     </div>
                  )) : (
                     <p className="text-zinc-500 text-sm">Read more to generate insights!</p>
                  )}
                  <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-xl p-4 text-sm border border-white/5 mt-4">
                     <p className="font-bold mb-1 text-zinc-200">Did you know?</p>
                     <p className="text-zinc-400 text-xs">Reading for just 6 minutes a day can reduce stress levels by up to 68%.</p>
                  </div>
               </div>
            </div>
         </div>

         {/* Badges / Achievements */}
         <div className="bg-[#111] border border-white/5 rounded-2xl p-4 md:p-6 mb-12">
            <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
               <Award className="w-5 h-5 text-zinc-400" /> Achievements
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
               {Object.entries(BADGES_CONFIG).map(([id, config]) => {
                  const isEarned = badges?.some(b => b.id === id);
                  return (
                     <div 
                        key={id}
                        className={`p-4 rounded-xl border transition-all flex flex-col items-center text-center gap-3 ${
                           isEarned 
                              ? 'bg-white/5 border-white/10 shadow-lg shadow-black/20' 
                              : 'bg-transparent border-white/5 opacity-40 grayscale'
                        }`}
                     >
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center bg-black/50 ${config.color} ${isEarned ? 'ring-2 ring-current/20' : ''}`}>
                           <config.icon className="w-6 h-6" />
                        </div>
                        <div>
                           <h4 className="font-bold text-sm">{config.name}</h4>
                           <p className="text-[10px] text-zinc-500 mt-1">{config.desc}</p>
                        </div>
                        {isEarned && <div className="mt-1 px-2 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded-full uppercase font-bold tracking-wider">Unlocked</div>}
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
    </div>
  );
};

const StatsCard: React.FC<{ icon: any, label: string, value: string | number, subValue: string, color: string }> = ({ 
  icon: Icon, label, value, subValue, color 
}) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-[#111] border border-white/5 p-6 rounded-2xl flex items-start justify-between hover:bg-[#151515] transition-colors"
  >
    <div>
      <p className="text-zinc-500 text-xs uppercase tracking-wider font-bold mb-1">{label}</p>
      <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
      <p className="text-zinc-500 text-xs">{subValue}</p>
    </div>
    <div className={`p-3 rounded-xl bg-white/5 ${color}`}>
       <Icon className="w-6 h-6" />
    </div>
  </motion.div>
);
