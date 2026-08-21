import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

// 発行されたFirebaseの設定
const firebaseConfig = {
  apiKey: "AIzaSyACouAvE-DdPRv-8hIpygvkTV9QnUPu_zE",
  authDomain: "chikuyo-volleyball.firebaseapp.com",
  projectId: "chikuyo-volleyball",
  storageBucket: "chikuyo-volleyball.firebasestorage.app",
  messagingSenderId: "387853329149",
  appId: "1:387853329149:web:98468f2a729a5acb1a1494"
};

let app, auth;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} catch (e) {
  console.log("Firebase initialization fallback.");
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('attendance');
  const schoolName = '筑陽学園';

  const [teacherEmails, setTeacherEmails] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_teacherEmails');
      return saved ? JSON.parse(saved) : ['teacher1@school.ed.jp', 'teacher2@school.ed.jp'];
    } catch (e) {
      return ['teacher1@school.ed.jp', 'teacher2@school.ed.jp'];
    }
  });

  const [members, setMembers] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_members');
      let initialMembers = saved ? JSON.parse(saved) : [
        { id: '1', name: '部員 太郎', furigana: 'ぶいん たろう', grade: '3', role: 'student', email: 'taro@school.ed.jp' },
        { id: '2', name: '佐藤 花子', furigana: 'さとう はなこ', grade: '2', role: 'student', email: 'hanako@school.ed.jp' },
        { id: '3', name: '鈴木 健', furigana: 'すずき けん', grade: '1', role: 'student', email: 'ken@school.ed.jp' },
      ];

      const lastCheckYear = localStorage.getItem('vn_grade_check_year');
      const now = new Date();
      const currentYear = now.getFullYear();
      const isAprilFirstOrLater = (now.getMonth() === 3 && now.getDate() >= 1) || now.getMonth() > 3;
      
      if (lastCheckYear !== String(currentYear) && isAprilFirstOrLater) {
        initialMembers = initialMembers.map(m => {
          let g = parseInt(m.grade, 10);
          if (!isNaN(g)) {
            if (g === 3) {
              return { ...m, grade: `卒業 (${currentYear - 1}年度卒業)` };
            } else if (g === 2) {
              return { ...m, grade: '3' };
            } else if (g === 1) {
              return { ...m, grade: '2' };
            }
          }
          return m;
        });
        localStorage.setItem('vn_grade_check_year', String(currentYear));
      }
      return initialMembers;
    } catch (e) {
      return [];
    }
  });

  const [attendance, setAttendance] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_attendance');
      return saved ? JSON.parse(saved) : {};
    } catch (e) { return {}; }
  });

  const [schedules, setSchedules] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_schedules');
      return saved ? JSON.parse(saved) : [
        { id: '1', date: '2026-06-15', title: '春季大会 予選', time: '09:00 - 15:00', type: 'tournament', location: '市民体育館', notes: '集合は朝8:30に現地集合です。弁当持参。' },
        { id: '2', date: '2026-06-18', title: '通常練習', time: '16:00 - 19:00', type: 'practice', location: '体育館', notes: '新戦術の確認を行います。' },
      ];
    } catch (e) { return []; }
  });

  const [practiceMenus, setPracticeMenus] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_practiceMenus');
      return saved ? JSON.parse(saved) : {
        '2026-06-18': { menu: '1. アップ・ストレッチ (20分)\n2. パス・レシーブ練習 (40分)\n3. スパイク・ブロック連携 (50分)\n4. 6vs6 紅白戦 (50分)' }
      };
    } catch (e) { return {}; }
  });

  const [activities, setActivities] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_activities');
      return saved ? JSON.parse(saved) : [
        { id: '1', userId: '1', userName: '部員 太郎', date: '2026-06-17', content: 'レシーブの足の運びを意識した。明日はブロックフォローを強化する。', comment: 'よく頑張りました。足の踏み込みを更に意識しよう。' }
      ];
    } catch (e) { return []; }
  });

  const [mediaList, setMediaList] = useState(() => {
    try {
      const saved = localStorage.getItem('vn_media');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      const savedUser = localStorage.getItem('vn_user');
      if (savedUser) setUser(JSON.parse(savedUser));
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const email = firebaseUser.email || 'user@school.ed.jp';
        const isTeacher = teacherEmails.includes(email) || email.includes('teacher');
        setUser({
          id: firebaseUser.uid,
          name: firebaseUser.displayName || (isTeacher ? 'バレー部 顧問 先生' : '部員 太郎'),
          email: email,
          role: isTeacher ? 'teacher' : 'student',
          grade: isTeacher ? '-' : '1',
          furigana: isTeacher ? 'こもん' : 'ぶいん たろう'
        });
      } else {
        const savedUser = localStorage.getItem('vn_user');
        if (savedUser) setUser(JSON.parse(savedUser));
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [teacherEmails]);

  useEffect(() => { 
    if (user) {
      try { localStorage.setItem('vn_user', JSON.stringify(user)); } catch (e) {}
    } else {
      try { localStorage.removeItem('vn_user'); } catch (e) {}
    }
  }, [user]);

  useEffect(() => { try { localStorage.setItem('vn_members', JSON.stringify(members)); } catch (e) {} }, [members]);
  useEffect(() => { try { localStorage.setItem('vn_attendance', JSON.stringify(attendance)); } catch (e) {} }, [attendance]);
  useEffect(() => { try { localStorage.setItem('vn_schedules', JSON.stringify(schedules)); } catch (e) {} }, [schedules]);
  useEffect(() => { try { localStorage.setItem('vn_practiceMenus', JSON.stringify(practiceMenus)); } catch (e) {} }, [practiceMenus]);
  useEffect(() => { try { localStorage.setItem('vn_activities', JSON.stringify(activities)); } catch (e) {} }, [activities]);
  useEffect(() => { try { localStorage.setItem('vn_media', JSON.stringify(mediaList)); } catch (e) {} }, [mediaList]);
  useEffect(() => { try { localStorage.setItem('vn_teacherEmails', JSON.stringify(teacherEmails)); } catch (e) {} }, [teacherEmails]);

  const handleGoogleLogin = async () => {
    if (auth) {
      try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return;
      } catch (err) {
        console.warn("Popup sign-in error/fallback.", err);
      }
    }
    // デモログインフォールバック
    const email = prompt("Googleアカウントのメールアドレスを入力してください:", "student@school.ed.jp");
    if (!email) return;
    const isTeacher = teacherEmails.includes(email) || email.includes('teacher');
    const name = prompt("氏名を入力してください:", isTeacher ? "顧問 先生" : "部員 花子");
    const furigana = isTeacher ? "こもん せんせい" : "ぶいん はなこ";
    const grade = isTeacher ? "-" : prompt("学年を入力してください (1〜3):", "1") || "1";

    const newUser = {
      id: 'usr_' + Date.now(),
      name: name || (isTeacher ? "顧問 先生" : "部員 花子"),
      email: email,
      role: isTeacher ? 'teacher' : 'student',
      grade,
      furigana
    };
    setUser(newUser);
    if (!isTeacher) {
      setMembers(prev => {
        if (!prev.some(m => m.email === email)) {
          return [...prev, { id: newUser.id, name: newUser.name, furigana: newUser.furigana, grade: newUser.grade, role: 'student', email: newUser.email }];
        }
        return prev;
      });
    }
  };

  const handleLogout = async () => {
    if (auth) {
      try { await signOut(auth); } catch (e) {}
    }
    setUser(null);
    localStorage.removeItem('vn_user');
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-300">Google認証を確認中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onGoogleLogin={handleGoogleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <header className="bg-indigo-700 text-white shadow-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center font-black text-xl shadow-inner">
            V
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-lg tracking-tight leading-tight">{schoolName}高校バレーボール部</h1>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="text-right hidden sm:block">
            <p className="text-xs font-bold">{user.name} ({user.role === 'teacher' ? '教師・顧問' : `${user.grade}年`})</p>
            <p className="text-[10px] text-indigo-200">{user.email}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="bg-indigo-800 hover:bg-indigo-900 text-white text-xs px-3 py-2 rounded-xl font-bold shadow transition"
          >
            ログアウト
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-slate-200 sticky top-14 z-20 overflow-x-auto shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex space-x-1 sm:space-x-4 min-w-max">
          {[
            { id: 'attendance', label: '部活 出欠確認' },
            { id: 'schedule', label: '予定表' },
            { id: 'practice', label: '練習メニュー' },
            { id: 'activity', label: '活動記録' },
            { id: 'media', label: '試合・練習の画像、動画' },
            { id: 'tactics', label: '戦術ボード' },
            ...(user.role === 'teacher' ? [{ id: 'members', label: '部員・卒業生管理' }] : [])
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-3 sm:px-4 text-xs sm:text-sm font-extrabold border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50'
                  : 'border-transparent text-slate-600 hover:text-indigo-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 overflow-y-auto">
        {activeTab === 'attendance' && <AttendanceModule user={user} members={members} attendance={attendance} setAttendance={setAttendance} />}
        {activeTab === 'schedule' && <ScheduleModule user={user} schedules={schedules} setSchedules={setSchedules} teacherEmails={teacherEmails} setTeacherEmails={setTeacherEmails} />}
        {activeTab === 'practice' && <PracticeModule user={user} practiceMenus={practiceMenus} setPracticeMenus={setPracticeMenus} />}
        {activeTab === 'activity' && <ActivityModule user={user} members={members} activities={activities} setActivities={setActivities} />}
        {activeTab === 'media' && <MediaModule user={user} mediaList={mediaList} setMediaList={setMediaList} />}
        {activeTab === 'tactics' && <TacticsModule />}
        {activeTab === 'members' && user.role === 'teacher' && <MembersModule members={members} setMembers={setMembers} activities={activities} />}
      </main>
    </div>
  );
}

function LoginScreen({ onGoogleLogin }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-100 space-y-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg shadow-indigo-500/30">
          V
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">筑陽学園高校バレーボール部</h1>
          <p className="text-xs text-slate-400 mt-1">公式ポータルシステム</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2 text-xs text-slate-600 font-medium">
          <p className="font-bold text-slate-700">🔐 Googleアカウントによる認証</p>
          <p>学校または個人のGoogleアカウントで安全にログインしてください。メールアドレスを元に生徒・教師が自動判別されます。</p>
        </div>

        <button 
          onClick={onGoogleLogin}
          className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white font-extrabold py-3.5 rounded-xl text-sm sm:text-base shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          Google アカウントでログイン
        </button>

        <p className="text-[11px] text-slate-400">
          ※ 毎年4月1日に自動で学年が進行します。
        </p>
      </div>
    </div>
  );
}

function AttendanceModule({ user, members, attendance, setAttendance }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  const activeMembers = members.filter(m => !m.grade || !m.grade.includes('卒業'));
  const todayAtt = attendance[selectedDate] || {};

  const handleStatusChange = (userId, status) => {
    setAttendance(prev => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [userId]: {
          status,
          reason: (prev[selectedDate]?.[userId]?.reason || '')
        }
      }
    }));
  };

  const handleReasonChange = (userId, reason) => {
    setAttendance(prev => ({
      ...prev,
      [selectedDate]: {
        ...(prev[selectedDate] || {}),
        [userId]: {
          status: prev[selectedDate]?.[userId]?.status || 'present',
          reason
        }
      }
    }));
  };

  const displayedMembers = user.role === 'student' ? activeMembers.filter(m => m.id === user.id) : activeMembers;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">部活 出欠確認</h2>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500 bg-slate-50 w-full sm:w-auto"
          />
        </div>
      </div>

      {user.role === 'teacher' && (
        <div className="bg-indigo-900 text-white p-4 sm:p-6 rounded-3xl shadow-md flex items-center justify-between">
          <div>
            <p className="text-xs text-indigo-200 font-bold uppercase tracking-wider">教師閲覧モード</p>
            <p className="text-sm sm:text-base font-bold mt-1">生徒の出欠状態および理由を確認できます（生徒は自分以外の出欠は見えません）。</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-600">
                <th className="p-4">学年 / 氏名</th>
                <th className="p-4">出欠状態</th>
                <th className="p-4">理由・備考 (遅刻/見学/欠席時)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {displayedMembers.map(m => {
                const isMe = user.role === 'student' && m.id === user.id;
                const record = todayAtt[m.id] || { status: 'present', reason: '' };
                const canEdit = user.role === 'teacher' ? false : isMe;

                return (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900">
                      <span className="inline-block w-8 text-xs font-bold bg-slate-100 text-slate-600 py-0.5 px-1.5 rounded mr-2 text-center">{m.grade}年</span>
                      {m.name}
                    </td>
                    <td className="p-4">
                      {canEdit ? (
                        <div className="flex gap-1.5 flex-wrap">
                          {[
                            { id: 'present', label: '出席', color: 'bg-emerald-600' },
                            { id: 'late', label: '遅刻', color: 'bg-amber-500' },
                            { id: 'excuse', label: '見学', color: 'bg-blue-500' },
                            { id: 'absent', label: '欠席', color: 'bg-rose-600' }
                          ].map(opt => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => handleStatusChange(m.id, opt.id)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                                record.status === opt.id ? `${opt.color} text-white shadow` : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${
                          record.status === 'present' ? 'bg-emerald-100 text-emerald-800' :
                          record.status === 'late' ? 'bg-amber-100 text-amber-800' :
                          record.status === 'excuse' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                        }`}>
                          {record.status === 'present' ? '出席' : record.status === 'late' ? '遅刻' : record.status === 'excuse' ? '見学' : '欠席'}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      {canEdit ? (
                        <input 
                          type="text"
                          value={record.reason}
                          onChange={(e) => handleReasonChange(m.id, e.target.value)}
                          placeholder="遅刻・見学・欠席の理由を入力"
                          className="w-full border-2 border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none focus:border-indigo-500"
                        />
                      ) : (
                        <span className="text-xs text-slate-600 font-medium">
                          {record.reason || <span className="text-slate-300">-</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScheduleModule({ user, schedules, setSchedules, teacherEmails, setTeacherEmails }) {
  const [currentYearMonth, setCurrentYearMonth] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() };
  });

  const [selectedDay, setSelectedDay] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('16:00 - 19:00');
  const [newType, setNewType] = useState('practice');
  const [newLocation, setNewLocation] = useState('体育館');
  const [newNotes, setNewNotes] = useState('');
  
  const [isEditingEmails, setIsEditingEmails] = useState(false);
  const [tempEmails, setTempEmails] = useState(teacherEmails.join(', '));

  const countdownList = useMemo(() => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return schedules
      .filter(s => s.type === 'tournament')
      .map(s => {
        const targetDate = new Date(s.date);
        targetDate.setHours(0,0,0,0);
        const diffTime = targetDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return { ...s, diffDays };
      })
      .filter(s => s.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays);
  }, [schedules]);

  const daysInMonth = new Date(currentYearMonth.year, currentYearMonth.month + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYearMonth.year, currentYearMonth.month, 1).getDay();

  const calendarDays = useMemo(() => {
    const arr = [];
    for (let i = 0; i < firstDayOfWeek; i++) { arr.push(null); }
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(currentYearMonth.month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      arr.push({ day: d, dateStr: `${currentYearMonth.year}-${mStr}-${dStr}` });
    }
    return arr;
  }, [currentYearMonth, daysInMonth, firstDayOfWeek]);

  const handleAddSchedule = (e) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;
    const item = {
      id: 'sch_' + Date.now(),
      title: newTitle.trim(),
      date: newDate,
      time: newTime,
      type: newType,
      location: newLocation,
      notes: newNotes.trim()
    };
    setSchedules(prev => [...prev, item]);
    setNewTitle('');
    setNewNotes('');
    setIsAdding(false);
  };

  const handleDeleteSchedule = (id) => {
    if (window.confirm('この予定を削除しますか？')) {
      setSchedules(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">予定表・カレンダー</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-indigo-50 text-indigo-800 text-xs font-bold px-3 py-2 rounded-xl border border-indigo-100 flex items-center gap-2">
            <span>顧問連絡先: {teacherEmails.join(', ')}</span>
            {user.role === 'teacher' && (
              <button 
                onClick={() => { setTempEmails(teacherEmails.join(', ')); setIsEditingEmails(true); }}
                className="bg-indigo-600 text-white text-[10px] px-2 py-0.5 rounded font-bold hover:bg-indigo-700"
              >
                変更
              </button>
            )}
          </div>
          {user.role === 'teacher' && (
            <button
              onClick={() => setIsAdding(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold shadow transition whitespace-nowrap"
            >
              + 予定・大会登録
            </button>
          )}
        </div>
      </div>

      {countdownList.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 sm:p-6 rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center font-black text-2xl">
              🏆
            </div>
            <div>
              <p className="text-xs font-bold text-amber-100 uppercase tracking-wider">大会カウントダウン</p>
              <h3 className="text-lg sm:text-xl font-black">{countdownList[0].title} まで</h3>
              <p className="text-xs text-amber-100">{countdownList[0].date} ({countdownList[0].location})</p>
            </div>
          </div>
          <div className="bg-white text-orange-600 px-6 py-3 rounded-2xl font-black text-xl sm:text-2xl shadow-inner">
            あと {countdownList[0].diffDays} 日
          </div>
        </div>
      )}

      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-base sm:text-lg font-black text-slate-900">
            {currentYearMonth.year}年 {currentYearMonth.month + 1}月
          </h3>
          <div className="flex gap-2">
            <button onClick={() => setCurrentYearMonth(p => p.month === 0 ? { year: p.year - 1, month: 11 } : { ...p, month: p.month - 1 })} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs">◀ 前月</button>
            <button onClick={() => setCurrentYearMonth(p => p.month === 11 ? { year: p.year + 1, month: 0 } : { ...p, month: p.month + 1 })} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl font-bold text-xs">次月 ▶</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center mb-2">
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div key={i} className={`text-xs font-extrabold py-1 ${i === 0 ? 'text-rose-500' : i === 6 ? 'text-indigo-500' : 'text-slate-500'}`}>{d}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((item, idx) => {
            if (!item) return <div key={idx} className="h-20 sm:h-24 bg-slate-50/50 rounded-2xl opacity-40"></div>;
            const daySchedules = schedules.filter(s => s.date === item.dateStr);
            const isToday = new Date().toISOString().split('T')[0] === item.dateStr;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDay(item.dateStr)}
                className={`h-20 sm:h-24 border-2 rounded-2xl p-1.5 sm:p-2 flex flex-col justify-between cursor-pointer transition hover:border-indigo-400 overflow-hidden ${
                  isToday ? 'border-indigo-600 bg-indigo-50/30' : 'border-slate-100 bg-white'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className={`text-xs font-black ${isToday ? 'bg-indigo-600 text-white w-5 h-5 rounded-full flex items-center justify-center' : 'text-slate-700'}`}>{item.day}</span>
                  {daySchedules.length > 0 && <span className="w-2 h-2 rounded-full bg-indigo-600"></span>}
                </div>
                <div className="space-y-1 overflow-y-auto max-h-12 text-[10px] font-bold">
                  {daySchedules.map(s => (
                    <div key={s.id} className={`p-1 rounded truncate ${s.type === 'tournament' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                      {s.title}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedDay && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-800">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-lg text-slate-900">{selectedDay} の予定</h3>
              <button onClick={() => setSelectedDay(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">✕</button>
            </div>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {schedules.filter(s => s.date === selectedDay).length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">この日の予定はありません。</p>
              ) : (
                schedules.filter(s => s.date === selectedDay).map(s => (
                  <div key={s.id} className="p-3 bg-slate-50 border border-slate-100 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 ${s.type === 'tournament' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'}`}>
                          {s.type === 'tournament' ? '大会' : '練習'}
                        </span>
                        <h4 className="font-black text-sm text-slate-900">{s.title}</h4>
                        <p className="text-xs text-slate-500">時間: {s.time} / 場所: {s.location}</p>
                      </div>
                      {user.role === 'teacher' && (
                        <button onClick={() => handleDeleteSchedule(s.id)} className="text-rose-500 hover:text-rose-700 text-xs font-bold p-2">削除</button>
                      )}
                    </div>
                    {s.notes && (
                      <div className="bg-indigo-50/60 p-2 rounded-xl border border-indigo-100 text-xs text-indigo-900 font-medium">
                        <span className="font-bold">備考・連絡事項:</span> {s.notes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            <button onClick={() => setSelectedDay(null)} className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs sm:text-sm">閉じる</button>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 text-slate-800">
            <h3 className="font-extrabold text-lg text-slate-900">予定・大会の登録</h3>
            <form onSubmit={handleAddSchedule} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">タイトル:</label>
                <input 
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="例: 県高校総体"
                  required
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">日付:</label>
                  <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">種類:</label>
                  <select value={newType} onChange={(e) => setNewType(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500 bg-white">
                    <option value="practice">練習</option>
                    <option value="tournament">大会 (カウントダウン対象)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">時間:</label>
                  <input type="text" value={newTime} onChange={(e) => setNewTime(e.target.value)} placeholder="09:00 - 15:00" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">場所:</label>
                  <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="体育館" className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">備考・連絡事項:</label>
                <textarea rows="2" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="持ち物、集合時間などの連絡事項..." className="w-full border-2 border-slate-200 rounded-xl p-3 text-xs font-bold focus:outline-none focus:border-indigo-500"></textarea>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm shadow-md">登録する</button>
                <button type="button" onClick={() => setIsAdding(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm">キャンセル</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditingEmails && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-slate-800">
            <h3 className="font-extrabold text-lg text-slate-900">教師連絡先の編集</h3>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">メールアドレス (カンマ区切りで複数可):</label>
              <input type="text" value={tempEmails} onChange={(e) => setTempEmails(e.target.value)} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
            </div>
            <div className="flex gap-2 pt-2">
              <button onClick={() => { setTeacherEmails(tempEmails.split(',').map(s => s.trim()).filter(Boolean)); setIsEditingEmails(false); }} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm shadow-md">保存する</button>
              <button onClick={() => setIsEditingEmails(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs sm:text-sm">キャンセル</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeModule({ user, practiceMenus, setPracticeMenus }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editMenuText, setEditMenuText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const currentMenu = practiceMenus[selectedDate]?.menu || 'この日の練習メニューはまだ登録されていません。';

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-lg sm:text-xl font-black text-slate-900">練習メニュー</h2></div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500 bg-slate-50 w-full sm:w-auto" />
        </div>
      </div>

      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-xl">{selectedDate} のメニュー</span>
          {user.role === 'teacher' && !isEditing && (
            <button onClick={() => { setEditMenuText(practiceMenus[selectedDate]?.menu || ''); setIsEditing(true); }} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold shadow transition">メニューを編集</button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-3">
            <textarea rows="8" value={editMenuText} onChange={(e) => setEditMenuText(e.target.value)} className="w-full border-2 border-slate-200 rounded-2xl p-4 text-sm font-bold focus:outline-none focus:border-indigo-500" placeholder="練習メニューを記載してください..."></textarea>
            <div className="flex gap-2">
              <button onClick={() => { setPracticeMenus(p => ({ ...p, [selectedDate]: { menu: editMenuText } })); setIsEditing(false); }} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow">保存する</button>
              <button onClick={() => setIsEditing(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2.5 rounded-xl text-xs sm:text-sm">キャンセル</button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-100 rounded-2xl p-6 whitespace-pre-line text-sm sm:text-base font-medium text-slate-800 leading-relaxed">
            {currentMenu}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityModule({ user, members, activities, setActivities }) {
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newContent, setNewContent] = useState('');
  const [teacherCommentInput, setTeacherCommentInput] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState('all');

  const handleAddActivity = (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const item = { id: 'act_' + Date.now(), userId: user.id, userName: user.name, date: newDate, content: newContent.trim(), comment: '' };
    setActivities(prev => [item, ...prev]);
    setNewContent('');
  };

  const activeMembers = members.filter(m => !m.grade || !m.grade.includes('卒業'));
  const displayedActivities = activities.filter(a => user.role === 'student' ? a.userId === user.id : (selectedStudentId === 'all' ? true : a.userId === selectedStudentId));

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-lg sm:text-xl font-black text-slate-900">活動記録</h2></div>
        {user.role === 'teacher' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-bold text-slate-600">生徒選択:</span>
            <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white">
              <option value="all">全員の記録を表示</option>
              {activeMembers.map(m => <option key={m.id} value={m.id}>{m.name} ({m.grade}年)</option>)}
            </select>
          </div>
        )}
      </div>

      {user.role === 'student' && (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-black text-slate-900 mb-4">新規活動記録の投稿</h3>
          <form onSubmit={handleAddActivity} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">日付:</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="w-full sm:w-auto border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500 bg-slate-50" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">記録内容・振り返り:</label>
              <textarea rows="3" value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="今日の練習で意識したこと、成果、課題など..." required className="w-full border-2 border-slate-200 rounded-2xl p-3 text-sm font-bold focus:outline-none focus:border-indigo-500"></textarea>
            </div>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm shadow transition">記録を投稿する</button>
          </form>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-base font-black text-slate-900">投稿された活動記録一覧</h3>
        {displayedActivities.length === 0 ? (
          <div className="bg-white p-8 rounded-3xl text-center border border-slate-100 text-slate-400 text-sm font-bold">記録がありません。</div>
        ) : (
          displayedActivities.map(act => (
            <div key={act.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-black flex items-center justify-center text-xs">{act.userName.slice(0, 1)}</span>
                  <div>
                    <h4 className="font-black text-sm text-slate-900">{act.userName}</h4>
                    <p className="text-[10px] text-slate-400">{act.date}</p>
                  </div>
                </div>
              </div>
              <p className="text-sm font-medium text-slate-800 bg-slate-50 p-4 rounded-2xl border border-slate-100">{act.content}</p>
              <div className="pt-2 border-t border-slate-100">
                {user.role === 'teacher' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-indigo-700">教師からのコメント:</label>
                    <div className="flex gap-2">
                      <input type="text" defaultValue={act.comment} onChange={(e) => setTeacherCommentInput(p => ({ ...p, [act.id]: e.target.value }))} placeholder="コメントを入力..." className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500" />
                      <button onClick={() => setActivities(prev => prev.map(a => a.id === act.id ? { ...a, comment: teacherCommentInput[act.id] ?? a.comment } : a))} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow">送信</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-indigo-700">教師からのコメント:</span>
                    <p className="text-xs font-medium text-slate-700 bg-indigo-50/50 p-3 rounded-xl mt-1 border border-indigo-100">{act.comment || 'まだコメントはありません。'}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function MediaModule({ user, mediaList, setMediaList }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('image');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズが5MBを超えています。大きな動画はYouTube等のリンクをご利用ください。");
    }
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const fileDataUrl = uploadEvent.target.result;
      const newItem = {
        id: 'med_' + Date.now(),
        title: title.trim() || file.name,
        url: fileDataUrl,
        type: file.type.startsWith('video') ? 'video' : 'image',
        uploader: user.name,
        date: new Date().toISOString().split('T')[0]
      };
      setMediaList(prev => [newItem, ...prev]);
      setTitle('');
    };
    reader.readAsDataURL(file);
  };

  const handleAddUrlMedia = (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    const newItem = { id: 'med_' + Date.now(), title: title.trim(), url: url.trim(), type, uploader: user.name, date: new Date().toISOString().split('T')[0] };
    setMediaList(prev => [newItem, ...prev]);
    setTitle('');
    setUrl('');
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
        <h2 className="text-lg sm:text-xl font-black text-slate-900 mb-4">試合・練習の画像、動画</h2>
        <div className="bg-slate-50 p-4 sm:p-6 rounded-2xl border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-900">メディアのアップロード (上限約5MB)</h3>
          <form onSubmit={handleAddUrlMedia} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">タイトル:</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 春高予選 決勝戦ハイライト" required className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">端末からファイル選択 (5MB以下):</label>
                <input type="file" accept="image/*,video/*" onChange={handleFileUpload} className="w-full text-xs font-bold text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" />
              </div>
            </div>
            <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-600 mb-1">または外部URL (YouTube等):</label>
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:outline-none focus:border-indigo-500" />
              </div>
              <div className="flex gap-2">
                <select value={type} onChange={(e) => setType(e.target.value)} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold bg-white">
                  <option value="image">画像</option>
                  <option value="video">動画</option>
                </select>
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2 rounded-xl text-xs shadow whitespace-nowrap">URL追加</button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {mediaList.length === 0 ? (
          <div className="col-span-full bg-white p-8 rounded-3xl text-center border border-slate-100 text-slate-400 text-sm font-bold">アップロードされたメディアはありません。</div>
        ) : (
          mediaList.map(item => (
            <div key={item.id} className="bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 flex flex-col justify-between">
              <div className="p-3 bg-slate-900 text-white flex justify-between items-center">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.type === 'video' ? 'bg-rose-600' : 'bg-emerald-600'}`}>{item.type === 'video' ? '動画' : '画像'}</span>
                <span className="text-[10px] text-slate-400">{item.date}</span>
              </div>
              {item.url.startsWith('data:') && item.type === 'image' ? (
                <div className="w-full h-40 bg-slate-100 overflow-hidden flex items-center justify-center">
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                </div>
              ) : item.url.startsWith('data:') && item.type === 'video' ? (
                <div className="w-full h-40 bg-slate-100 overflow-hidden flex items-center justify-center">
                  <video src={item.url} controls className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="font-black text-sm text-slate-900">{item.title}</h4>
                  <p className="text-[10px] text-slate-400">投稿者: {item.uploader}</p>
                </div>
                <a href={item.url} target="_blank" rel="noopener noreferrer" className="block text-center bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 rounded-xl text-xs transition mt-2">メディアを開く ↗</a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function TacticsModule() {
  const initialPlayers = [
    { id: 'p_op', name: 'OP', number: '4', x: 18, y: 20, team: 'us' },
    { id: 'p_mb2', name: 'MB2', number: '6', x: 18, y: 50, team: 'us' },
    { id: 'p_oh2', name: 'OH2', number: '5', x: 18, y: 80, team: 'us' },
    { id: 'p_oh1', name: 'OH1', number: '2', x: 35, y: 20, team: 'us' },
    { id: 'p_mb1', name: 'MB1', number: '3', x: 35, y: 50, team: 'us' },
    { id: 'p_s', name: 'S', number: '1', x: 35, y: 80, team: 'us' },
    { id: 'op_s', name: '相手S', number: '1', x: 65, y: 20, team: 'them' },
    { id: 'op_mb1', name: '相手MB1', number: '3', x: 65, y: 50, team: 'them' },
    { id: 'op_oh1', name: '相手OH1', number: '2', x: 65, y: 80, team: 'them' },
    { id: 'op_oh2', name: '相手OH2', number: '5', x: 82, y: 20, team: 'them' },
    { id: 'op_mb2', name: '相手MB2', number: '6', x: 82, y: 50, team: 'them' },
    { id: 'op_op', name: '相手OP', number: '4', x: 82, y: 80, team: 'them' },
  ];

  const [players, setPlayers] = useState(initialPlayers);
  const [draggingId, setDraggingId] = useState(null);
  const courtRef = useRef(null);

  const handlePointerDown = (id) => { setDraggingId(id); };

  const handlePointerMove = (e) => {
    if (!draggingId || !courtRef.current) return;
    const rect = courtRef.current.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    let x = ((clientX - rect.left) / rect.width) * 100;
    let y = ((clientY - rect.top) / rect.height) * 100;

    x = Math.max(5, Math.min(95, x));
    y = Math.max(5, Math.min(95, y));

    setPlayers(prev => prev.map(p => p.id === draggingId ? { ...p, x, y } : p));
  };

  const handlePointerUp = () => { setDraggingId(null); };

  const handleAddLibero = () => {
    let newPlayers = [...players];
    if (!newPlayers.some(p => p.id === 'us_lib')) {
      newPlayers.push({ id: 'us_lib', name: 'L(自)', number: 'L', x: 26, y: 92, team: 'us' });
    }
    if (!newPlayers.some(p => p.id === 'them_lib')) {
      newPlayers.push({ id: 'them_lib', name: '相手L', number: 'L', x: 74, y: 92, team: 'them' });
    }
    setPlayers(newPlayers);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-slate-900">戦術ボード</h2>
          <p className="text-xs text-slate-400 mt-1">自由にマーカーを動かせます</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button onClick={handleAddLibero} className="flex-1 sm:flex-none bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-4 py-2 rounded-xl text-xs transition">+ リベロを追加</button>
          <button onClick={() => setPlayers(initialPlayers)} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition">初期位置に戻す</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col items-center">
          <div 
            ref={courtRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            className="relative w-full aspect-[16/10] bg-orange-600 rounded-2xl shadow-inner overflow-hidden border-4 border-white select-none touch-none"
          >
            <div className="absolute top-0 bottom-0 left-1/2 w-1.5 bg-white/90 transform -translate-x-1/2 shadow"></div>
            <div className="absolute top-0 bottom-0 left-1/4 w-0.5 bg-white/60"></div>
            <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-white/60"></div>

            {players.map(p => (
              <div
                key={p.id}
                onPointerDown={() => handlePointerDown(p.id)}
                onTouchStart={() => handlePointerDown(p.id)}
                style={{ left: `${p.x}%`, top: `${p.y}%` }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing flex flex-col items-center group z-10"
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-black text-white shadow-lg border-2 border-white transition transform group-hover:scale-110 ${p.team === 'us' ? 'bg-indigo-600' : 'bg-rose-600'}`}>
                  {p.number}
                </div>
                <span className="bg-slate-900/80 backdrop-blur-sm text-white text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full font-bold mt-1 whitespace-nowrap shadow">{p.name}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-3 text-center">※ マーカーをタッチまたはドラッグして自由にコート上で移動させることができます。</p>
        </div>

        <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-sm font-black text-slate-900">選手・ポジション名編集</h3>
          <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
            {players.map(p => (
              <div key={p.id} className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center font-black text-white text-xs ${p.team === 'us' ? 'bg-indigo-600' : 'bg-rose-600'}`}>{p.number}</span>
                <input type="text" value={p.name} onChange={(e) => { const val = e.target.value; setPlayers(prev => prev.map(item => item.id === p.id ? { ...item, name: val } : item)); }} className="flex-1 border-2 border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold focus:outline-none focus:border-indigo-500 bg-white" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function MembersModule({ members, setMembers, activities }) {
  const [memberTab, setMemberTab] = useState('active');

  const activeMembers = members.filter(m => !m.grade || !m.grade.includes('卒業'));
  const graduateMembers = members.filter(m => m.grade && m.grade.includes('卒業'));

  const handleToggleGraduation = (id) => {
    setMembers(prev => prev.map(m => {
      if (m.id === id) {
        if (m.grade && m.grade.includes('卒業')) {
          return { ...m, grade: '3' };
        } else {
          const yearInput = prompt("卒業年度を入力してください（例: 2026）:", String(new Date().getFullYear()));
          if (yearInput !== null) {
            return { ...m, grade: `卒業 (${yearInput.trim()}年度)` };
          }
        }
      }
      return m;
    }));
  };

  const handleDeleteMember = (id) => {
    if (window.confirm('この部員データを削除しますか？')) {
      setMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  const handleExportData = (member) => {
    const memberActivities = activities.filter(a => a.userId === member.id);
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ member, activities: memberActivities }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `${member.name}_活動記録データ.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const displayedMembersList = memberTab === 'active' ? activeMembers : graduateMembers;

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div><h2 className="text-lg sm:text-xl font-black text-slate-900">部員・卒業生管理</h2></div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
          <button onClick={() => setMemberTab('active')} className={`py-2 px-4 text-xs font-extrabold rounded-xl transition ${memberTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>現役部員 ({activeMembers.length})</button>
          <button onClick={() => setMemberTab('graduates')} className={`py-2 px-4 text-xs font-extrabold rounded-xl transition ${memberTab === 'graduates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>OB・卒業生 ({graduateMembers.length})</button>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-600">
                <th className="p-4">学年・卒業年度</th>
                <th className="p-4">氏名 (フリガナ)</th>
                <th className="p-4">メールアドレス</th>
                <th className="p-4">ステータス</th>
                <th className="p-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {displayedMembersList.length === 0 ? (
                <tr>
                  <td colSpan="5" className="p-8 text-center text-slate-400 font-bold text-xs">部員データはありません。</td>
                </tr>
              ) : (
                displayedMembersList.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50/50 transition">
                    <td className="p-4 font-bold text-slate-900">
                      <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${m.grade && m.grade.includes('卒業') ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {m.grade && m.grade.includes('卒業') ? m.grade : `${m.grade}年`}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="font-black text-slate-900">{m.name}</div>
                      <div className="text-xs text-slate-400">{m.furigana}</div>
                    </td>
                    <td className="p-4 text-xs font-medium text-slate-600">{m.email}</td>
                    <td className="p-4">
                      <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${m.grade && m.grade.includes('卒業') ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                        {m.grade && m.grade.includes('卒業') ? '卒部・OBOG' : '現役部員'}
                      </span>
                    </td>
                    <td className="p-4 text-right space-x-2">
                      <button onClick={() => handleExportData(m)} className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-xl text-xs transition">データ書出し</button>
                      <button onClick={() => handleToggleGraduation(m.id)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition">
                        {m.grade && m.grade.includes('卒業') ? '現役復帰' : '卒部にする'}
                      </button>
                      <button onClick={() => handleDeleteMember(m.id)} className="text-rose-500 hover:text-rose-700 font-bold text-xs p-1.5">削除</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
