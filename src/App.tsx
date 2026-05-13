/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  isSameDay, 
  isSameMonth,
  addDays,
  parseISO,
  setYear,
  isBefore,
  addMinutes,
  isAfter
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Calendar as CalendarIcon, 
  Clock, 
  Trash2, 
  Bell,
  Check,
  X,
  Menu,
  AlertTriangle,
  Moon,
  Settings as SettingsIcon,
  CheckCircle,
  Home,
  Star,
  Volume2,
  VolumeX,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

interface Task {
  id: string;
  title: string;
  time: string;
  date: string;
  completed: boolean;
  notifiedAt?: string;
}

interface AppSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  theme: 'dark' | 'light';
  snoozeTime: number;
}

export default function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentDate, setCurrentDate] = useState(setYear(new Date(), 2026));
  const [view, setView] = useState<'month' | 'day' | 'overdue' | 'completed' | 'settings'>('month');
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('naely_agenda_tasks_v2');
    return saved ? JSON.parse(saved) : [];
  });
  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('naely_agenda_settings');
    return saved ? JSON.parse(saved) : {
      soundEnabled: true,
      vibrationEnabled: true,
      theme: 'dark',
      snoozeTime: 10
    };
  });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeAlarm, setActiveAlarm] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({ title: '', time: '', date: format(new Date(), 'yyyy-MM-dd') });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // PWA Install Prompt
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // Persistence
  useEffect(() => {
    localStorage.setItem('naely_agenda_tasks_v2', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('naely_agenda_settings', JSON.stringify(settings));
  }, [settings]);

  // Initial Splash
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  // Alarm Logic - Check every second
  useEffect(() => {
    const checkAlarms = () => {
      if (!isLoggedIn) return;
      const now = new Date();
      const nowStr = format(now, 'HH:mm');
      const todayStr = format(now, 'yyyy-MM-dd');

      const triggeredTask = tasks.find(t => {
        if (t.completed) return false;
        const taskDateTime = parseISO(`${t.date}T${t.time}`);
        
        if (activeAlarm?.id === t.id) return false;

        // Current exact time match for today
        const isExactTime = t.date === todayStr && t.time === nowStr;
        
        // Auto-reminder for overdue every 30 mins
        const needsReminder = t.notifiedAt && isAfter(now, addMinutes(parseISO(t.notifiedAt), settings.snoozeTime * 3));
        
    // Initial trigger for overdue
    const isOverdueTrigger = isBefore(taskDateTime, now) && !t.notifiedAt;

    if (isExactTime || isOverdueTrigger || needsReminder) {
      // Internal notification simulation call
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: t.title })
      }).catch(err => console.error('Failed to notify backend', err));
      
      return true;
    }
    return false;
  });

      if (triggeredTask) {
        triggerAlarm(triggeredTask);
      }
    };

    const interval = setInterval(checkAlarms, 1000);
    return () => clearInterval(interval);
  }, [tasks, activeAlarm, isLoggedIn, settings]);

  const triggerAlarm = (task: Task) => {
    setActiveAlarm(task);
    
    // Voice
    const speech = new SpeechSynthesisUtterance();
    speech.text = `Atenção Naely! É hora de: ${task.title}`;
    speech.lang = 'pt-BR';
    speech.rate = 0.9;
    window.speechSynthesis.speak(speech);

    // Vibration
    if (settings.vibrationEnabled && 'vibrate' in navigator) {
      navigator.vibrate([500, 300, 500, 300, 500]);
    }

    // Sound
    if (settings.soundEnabled) {
      if (!audioRef.current) {
        audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/1010/1010-preview.mp3');
        audioRef.current.loop = true;
      }
      audioRef.current.play().catch(() => console.log('Interação do usuário necessária para som'));
    }
  };

  const stopAlarm = (taskId: string, conclude: boolean) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
    if ('vibrate' in navigator) navigator.vibrate(0);

    if (conclude) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, completed: true, notifiedAt: new Date().toISOString() } : t));
    } else {
      // Snooze: update notifiedAt to current time to trigger again after snooze interval
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, notifiedAt: new Date().toISOString() } : t));
    }
    setActiveAlarm(null);
  };

  const tasksForSelectedDay = useMemo(() => {
    return tasks.filter(t => isSameDay(parseISO(t.date), currentDate));
  }, [tasks, currentDate]);

  const overdueTasks = useMemo(() => {
    const now = new Date();
    return tasks.filter(t => {
      const taskDateTime = parseISO(`${t.date}T${t.time}`);
      return !t.completed && isBefore(taskDateTime, now);
    });
  }, [tasks]);

  const completedTasks = useMemo(() => tasks.filter(t => t.completed), [tasks]);

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskForm.title || !taskForm.time) return;

    const newTask: Task = {
      id: Math.random().toString(36).substr(2, 9),
      title: taskForm.title,
      time: taskForm.time,
      date: taskForm.date,
      completed: false
    };

    setTasks(prev => [...prev, newTask]);
    setIsModalOpen(false);
    setTaskForm({ title: '', time: '', date: format(currentDate, 'yyyy-MM-dd') });
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

  if (showSplash) {
    return (
      <motion.div 
        initial={{ opacity: 1 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center p-8"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.5, ease: "easeOut" }}
          className="text-center"
        >
          <div className="w-24 h-24 bg-rose rounded-[2.5rem] mb-6 mx-auto flex items-center justify-center shadow-[0_0_100px_rgba(255,143,163,0.3)]">
            <CalendarIcon size={40} className="text-black" />
          </div>
          <h1 className="font-serif text-5xl md:text-7xl text-rose tracking-tight">Agenda da Naely</h1>
          <p className="text-rose/40 font-mono tracking-[0.5em] mt-4 uppercase text-xs">Premium Experience</p>
        </motion.div>
      </motion.div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-8 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(255,143,163,0.15),transparent_50%)]"></div>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full relative z-10"
        >
          <Star className="text-rose/20 mx-auto mb-6" size={40} />
          <h1 className="font-serif text-6xl text-rose mb-4">Bem-vinda</h1>
          <p className="text-rose/60 font-light text-lg mb-12">Sua rotina transformada em sofisticação.</p>
          
          <div className="space-y-4">
            <button 
              onClick={() => setIsLoggedIn(true)}
              className="w-full bg-rose text-black font-black py-5 rounded-3xl text-xl premium-shadow hover:scale-[1.02] transition-all"
            >
              Entrar Agora
            </button>
            <button 
              onClick={() => setIsLoggedIn(true)}
              className="w-full glass-premium text-rose font-bold py-5 rounded-3xl text-xl hover:bg-rose/5 transition-all"
            >
              Criar Rotina
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-black text-rose-light flex flex-col md:flex-row overflow-hidden relative">
      <div className="md:hidden p-6 glass flex justify-between items-center z-50">
        <h1 className="font-serif text-3xl text-rose">Naely</h1>
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-rose p-2 glass rounded-2xl">
          <Menu size={24} />
        </button>
      </div>

      {/* Sidebar Nav */}
      <aside className={cn(
        "fixed md:relative inset-y-0 left-0 w-80 glass z-40 p-8 flex flex-col transition-all",
        !sidebarOpen && "hidden md:flex"
      )}>
        <div className="mb-12">
          <h1 className="font-serif text-4xl text-rose">Agenda</h1>
          <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-rose/30 mt-2">Executive Luxury</p>
        </div>

        <nav className="flex-1 space-y-4">
          <button 
            onClick={() => { setView('month'); setSidebarOpen(false); }}
            className={cn("w-full text-left p-5 rounded-3xl flex items-center gap-4 transition-all", view === 'month' ? "bg-rose/20 text-rose border border-rose/30" : "hover:bg-rose/5 text-rose/60")}
          >
            <Home size={22} /> Calendário
          </button>
          <button 
            onClick={() => { setView('day'); setSidebarOpen(false); }}
            className={cn("w-full text-left p-5 rounded-3xl flex items-center gap-4 transition-all", view === 'day' ? "bg-rose/20 text-rose border border-rose/30" : "hover:bg-rose/5 text-rose/60")}
          >
            <Clock size={22} /> Dia a Dia
          </button>
          <button 
            onClick={() => { setView('overdue'); setSidebarOpen(false); }}
            className={cn("w-full text-left p-5 rounded-3xl flex items-center justify-between transition-all", view === 'overdue' ? "bg-red-500/10 text-red-400 border border-red-500/20" : "hover:bg-rose/5 text-rose/60")}
          >
            <div className="flex items-center gap-4">
              <AlertTriangle size={22} /> Atrasadas
            </div>
            {overdueTasks.length > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full shadow-lg">
                {overdueTasks.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => { setView('completed'); setSidebarOpen(false); }}
            className={cn("w-full text-left p-5 rounded-3xl flex items-center gap-4 transition-all", view === 'completed' ? "bg-rose/20 text-rose border border-rose/30" : "hover:bg-rose/5 text-rose/60")}
          >
            <CheckCircle size={22} /> Concluídas
          </button>
          <button 
            onClick={() => { setView('settings'); setSidebarOpen(false); }}
            className={cn("w-full text-left p-5 rounded-3xl flex items-center gap-4 transition-all", view === 'settings' ? "bg-rose/20 text-rose border border-rose/30" : "hover:bg-rose/5 text-rose/60")}
          >
            <SettingsIcon size={22} /> Ajustes
          </button>
        </nav>

        <div className="mt-auto space-y-6">
          <button 
            onClick={() => setIsModalOpen(true)}
            className="w-full bg-rose text-black font-black py-5 rounded-[2rem] flex items-center justify-center gap-3 premium-shadow active:scale-95 transition-all shadow-[0_15px_40px_-10px_rgba(255,143,163,0.5)]"
          >
            <Plus size={28} /> Novo Plano
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 md:p-12 relative">
        <header className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <h2 className="text-[10px] font-mono text-rose/30 uppercase tracking-[0.5em] mb-3">
              {format(currentDate, 'EEEE, d MMM', { locale: ptBR })}
            </h2>
            <h3 className="font-serif text-6xl md:text-8xl text-rose capitalize leading-tight tracking-tight">
              {format(currentDate, 'MMMM', { locale: ptBR })}
            </h3>
          </motion.div>
          <div className="flex items-center glass rounded-full p-1.5 self-start shadow-xl">
            <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-4 hover:bg-rose/10 rounded-full transition-colors text-rose"><ChevronLeft size={28} /></button>
            <div className="px-8 font-mono text-lg tracking-[0.3em] text-rose font-black">2026</div>
            <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-4 hover:bg-rose/10 rounded-full transition-colors text-rose"><ChevronRight size={28} /></button>
          </div>
        </header>

        {view === 'month' && (
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-[3rem] overflow-hidden premium-shadow"
          >
            <div className="grid grid-cols-7 border-b border-rose/10 bg-rose/[0.02]">
              {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'].map((day) => (
                <div key={day} className="p-6 text-center text-[11px] font-mono text-rose/40 uppercase tracking-[0.3em] font-black">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {calendarDays.map((day) => {
                const dayTasks = tasks.filter(t => isSameDay(parseISO(t.date), day));
                const isSelected = isSameDay(day, currentDate);
                const isToday = isSameDay(day, new Date());
                
                return (
                  <div 
                    key={day.toString()}
                    onClick={() => { setCurrentDate(day); setView('day'); }}
                    className={cn(
                      "min-h-[140px] md:min-h-[190px] p-5 border-r border-b border-rose/[0.05] cursor-pointer hover:bg-rose/[0.04] transition-all relative group",
                      !isSameMonth(day, monthStart) && "opacity-10",
                      isSelected && "bg-rose/[0.06]"
                    )}
                  >
                    <span className={cn(
                      "text-xl font-light w-11 h-11 flex items-center justify-center rounded-full mb-3 transition-transform group-hover:scale-110",
                      isToday && "bg-rose text-black font-black shadow-[0_0_30px_rgba(255,143,163,0.5)]"
                    )}>
                      {format(day, 'd')}
                    </span>
                    <div className="space-y-2">
                      {dayTasks.slice(0, 2).map(task => (
                        <div key={task.id} className={cn(
                          "text-[10px] p-2 pr-3 truncate rounded-2xl border flex items-center gap-2",
                          task.completed ? "bg-rose/5 border-rose/5 text-rose/30" : "bg-rose/20 border-rose/20 text-rose font-bold"
                        )}>
                          <div className={cn("w-1.5 h-1.5 rounded-full", task.completed ? "bg-rose/20" : "bg-rose")}></div>
                          {task.time}
                        </div>
                      ))}
                      {dayTasks.length > 2 && (
                        <div className="text-[9px] text-rose/40 font-mono pl-2">
                           + {dayTasks.length - 2} MAIS
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {(view === 'day' || view === 'overdue' || view === 'completed') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-between mb-12">
              <h4 className="font-serif text-5xl md:text-7xl text-rose lowercase">
                {view === 'overdue' ? 'pendentes' : view === 'completed' ? 'concluídas' : format(currentDate, "d/MMMM", { locale: ptBR })}
              </h4>
              {view === 'day' && (
                <div className="flex gap-4">
                   <button onClick={() => setCurrentDate(addDays(currentDate, -1))} className="p-4 glass rounded-3xl hover:bg-rose/10 text-rose transition-all"><ChevronLeft size={28} /></button>
                   <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-4 glass rounded-3xl hover:bg-rose/10 text-rose transition-all"><ChevronRight size={28} /></button>
                </div>
              )}
            </div>

            <div className="space-y-5">
              {(view === 'overdue' ? overdueTasks : view === 'completed' ? completedTasks : tasksForSelectedDay).map(task => (
                <motion.div
                  key={task.id}
                  layout
                  className={cn(
                    "glass rounded-[2rem] p-8 flex items-center justify-between group border-l-[6px] relative overflow-hidden",
                    task.completed ? "border-rose/20 opacity-60" : "border-rose",
                    view === 'overdue' && !task.completed && "border-red-500 bg-red-500/[0.05]"
                  )}
                >
                  <div className="flex items-center gap-8">
                    <button 
                      onClick={() => setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: !t.completed, notifiedAt: !t.completed ? new Date().toISOString() : t.notifiedAt } : t))}
                      className={cn(
                        "w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all shadow-xl",
                        task.completed ? "bg-rose border-rose text-black" : "border-rose/30 hover:border-rose group-hover:scale-110"
                      )}
                    >
                      {task.completed && <Check size={28} />}
                    </button>
                    <div>
                      <div className="flex items-center gap-4 mb-2">
                        <span className="text-xs font-mono font-black text-rose uppercase tracking-[0.3em] bg-rose/10 px-3 py-1.5 rounded-xl">
                          {task.time}
                        </span>
                        {task.completed && <span className="text-[10px] font-mono text-rose/40 uppercase tracking-widest">Concluído</span>}
                      </div>
                      <h5 className={cn(
                        "text-3xl font-light tracking-tight transition-all",
                        task.completed ? "line-through text-rose/30" : "text-rose-light"
                      )}>
                        {task.title}
                      </h5>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => setTasks(prev => prev.filter(t => t.id !== task.id))}
                      className="p-5 hover:bg-red-500/10 rounded-[1.5rem] text-rose/10 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={24} />
                    </button>
                  </div>
                </motion.div>
              ))}
              
              {(view === 'day' && tasksForSelectedDay.length === 0) && (
                <div className="p-20 text-center glass rounded-[3rem] border-dashed border-2 border-rose/10">
                   <Clock className="mx-auto text-rose/10 mb-6" size={80} />
                   <p className="text-rose/30 font-serif text-3xl">Dia livre por aqui.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {view === 'settings' && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto glass rounded-[3rem] p-12 space-y-10"
          >
            <h4 className="font-serif text-4xl text-rose mb-10">Configurações</h4>
            
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-rose/10 rounded-2xl text-rose">
                    {settings.soundEnabled ? <Volume2 /> : <VolumeX />}
                  </div>
                  <div>
                    <p className="text-xl font-medium">Som de Notificação</p>
                    <p className="text-sm text-rose/40">Tocar alarme no horário</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSettings({...settings, soundEnabled: !settings.soundEnabled})}
                  className={cn("w-16 h-8 rounded-full transition-all relative flex items-center p-1", settings.soundEnabled ? "bg-rose" : "bg-white/10")}
                >
                  <div className={cn("w-6 h-6 bg-black rounded-full transition-all", settings.soundEnabled ? "translate-x-8" : "translate-x-0")}></div>
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-rose/10 rounded-2xl text-rose">
                    <Smartphone />
                  </div>
                  <div>
                    <p className="text-xl font-medium">Vibração</p>
                    <p className="text-sm text-rose/40">Vibrar ao disparar alarme</p>
                  </div>
                </div>
                <button 
                  onClick={() => setSettings({...settings, vibrationEnabled: !settings.vibrationEnabled})}
                  className={cn("w-16 h-8 rounded-full transition-all relative flex items-center p-1", settings.vibrationEnabled ? "bg-rose" : "bg-white/10")}
                >
                  <div className={cn("w-6 h-6 bg-black rounded-full transition-all", settings.vibrationEnabled ? "translate-x-8" : "translate-x-0")}></div>
                </button>
              </div>

              {deferredPrompt && (
                <div className="pt-6 border-t border-rose/10">
                  <button 
                    onClick={handleInstallClick}
                    className="w-full bg-rose/10 text-rose font-bold py-5 rounded-3xl flex items-center justify-center gap-3 hover:bg-rose/20 transition-all border border-rose/20"
                  >
                    <Plus size={20} /> Instalar Aplicativo na Tela de Início
                  </button>
                </div>
              )}

              <div className="pt-10 border-t border-rose/10">
                <button 
                   onClick={() => {
                     localStorage.clear();
                     window.location.reload();
                   }}
                   className="text-red-400 hover:text-red-500 text-sm font-bold flex items-center gap-2"
                >
                  <Trash2 size={16} /> Limpar Todos os Dados
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Full Screen Alarm Overlay */}
      <AnimatePresence>
        {activeAlarm && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-8 text-center"
          >
             <div className="absolute inset-0 bg-rose/[0.03] animate-pulse"></div>
            <motion.div
              animate={{ 
                scale: [1, 1.2, 1], 
                rotate: [0, 10, -10, 0],
                boxShadow: ["0 0 50px rgba(255,143,163,0.3)", "0 0 100px rgba(255,143,163,0.7)", "0 0 50px rgba(255,143,163,0.3)"]
              }}
              transition={{ repeat: Infinity, duration: 0.8 }}
              className="w-48 h-48 bg-rose rounded-[3.5rem] flex items-center justify-center mb-16 relative z-10"
            >
              <Bell size={90} className="text-black" />
            </motion.div>
            
            <h2 className="text-rose/40 font-mono tracking-[0.8em] uppercase mb-6 text-sm relative z-10">ALERTA PREMIUM</h2>
            <h3 className="font-serif text-7xl md:text-9xl text-rose mb-20 leading-tight relative z-10 drop-shadow-2xl">
              {activeAlarm.title}
            </h3>

            <div className="flex flex-col gap-8 w-full max-w-2xl relative z-10">
              <button 
                onClick={() => stopAlarm(activeAlarm.id, true)}
                className="w-full bg-rose text-black font-black py-10 rounded-[3rem] text-4xl shadow-[0_30px_60px_-15px_rgba(255,143,163,0.4)] hover:scale-[1.03] active:scale-95 transition-all"
              >
                CONCLUIR
              </button>
              <button 
                onClick={() => stopAlarm(activeAlarm.id, false)}
                className="w-full glass-premium border-2 border-rose/20 text-rose font-bold py-8 rounded-[3rem] text-2xl flex items-center justify-center gap-4 hover:bg-rose/5 transition-all"
              >
                <Moon size={32} /> ADIAR {settings.snoozeTime} MIN
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/95 backdrop-blur-2xl"
            />
            <motion.div 
              initial={{ opacity: 0, y: 50, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 50, scale: 0.9 }}
              className="relative w-full max-w-xl glass-premium rounded-[4rem] p-12 border border-rose/10 premium-shadow"
            >
              <div className="flex justify-between items-center mb-12">
                <h3 className="font-serif text-5xl text-rose">Plano</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-rose/20 hover:text-rose p-2"><X size={40} /></button>
              </div>

              <form onSubmit={handleAddTask} className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[11px] font-mono uppercase tracking-[0.4em] text-rose/30 block ml-2">Objetivo</label>
                  <input 
                    type="text" 
                    value={taskForm.title}
                    onChange={e => setTaskForm({ ...taskForm, title: e.target.value })}
                    placeholder="Minha próxima meta..."
                    className="w-full bg-rose/[0.03] border-b-2 border-rose/10 p-6 focus:outline-none focus:border-rose text-rose text-3xl font-light transition-all placeholder:text-rose/10"
                    autoFocus
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <label className="text-[11px] font-mono uppercase tracking-[0.4em] text-rose/30 block ml-2">Horário</label>
                    <input 
                      type="time" 
                      value={taskForm.time}
                      onChange={e => setTaskForm({ ...taskForm, time: e.target.value })}
                      className="w-full bg-rose/[0.03] border-b-2 border-rose/10 p-6 focus:outline-none focus:border-rose text-rose text-2xl [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-4">
                    <label className="text-[11px] font-mono uppercase tracking-[0.4em] text-rose/30 block ml-2">Data</label>
                    <input 
                      type="date" 
                      value={taskForm.date}
                      onChange={e => setTaskForm({ ...taskForm, date: e.target.value })}
                      className="w-full bg-rose/[0.03] border-b-2 border-rose/10 p-6 focus:outline-none focus:border-rose text-rose text-2xl [color-scheme:dark]"
                    />
                  </div>
                </div>

                <button type="submit" className="w-full bg-rose text-black font-black py-8 rounded-[2.5rem] text-2xl premium-shadow shadow-[0_20px_50px_rgba(255,143,163,0.3)] hover:scale-[1.02] active:scale-95 transition-all">
                  SALVAR ROTINA
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

