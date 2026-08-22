import React, { useState, useEffect, useMemo, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { 
  getFirestore, collection, doc, setDoc, getDoc, onSnapshot, deleteDoc 
} from 'firebase/firestore';

// Firebase設定値
const firebaseConfig = {
  apiKey: "AIzaSyCFFdgAH5nTA7s6kjKgBusrfEmdbe5p6-8",
  authDomain: "school-club-management-b01ad.firebaseapp.com",
  projectId: "school-club-management-b01ad",
  storageBucket: "school-club-management-b01ad.firebasestorage.app",
  messagingSenderId: "528860396983",
  appId: "1:528860396983:web:7421c10fc0f95cbfa33c32"
};

let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (e) {
  console.log("Firebase initialization fallback.", e);
}

const DEFAULT_TEACHER_EMAILS = [
  'goto638@g.chikuyogakuen.ed.jp',
  'fujimoto530@g.chikuyogakuen.ed.jp',
];

export default function App() {
  const [user, setUser] = useState(null);
  const [pendingAuthUser, setPendingAuthUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  const [activeTab, setActiveTab] = useState('attendance');
  const schoolName = '部活動管理';

  // クラウド上のデータ状態 (Firestoreリアルタイム同期)
  const [teacherEmails, setTeacherEmails] = useState(DEFAULT_TEACHER_EMAILS);
  const [members, setMembers] = useState([]);
  const [attendance, setAttendance] = useState({});
  const [schedules, setSchedules] = useState([]);
  const [practiceMenus, setPracticeMenus] = useState({});
  const [activities, setActivities] = useState([]);
  const [mediaList, setMediaList] = useState([]);

  // 1. 教師メールアドレス一覧のクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'settings', 'teachers'), (docSnap) => {
      if (docSnap.exists()) {
        setTeacherEmails(docSnap.data().emails || DEFAULT_TEACHER_EMAILS);
      } else {
        setDoc(doc(db, 'settings', 'teachers'), { emails: DEFAULT_TEACHER_EMAILS });
      }
    });
    return () => unsub();
  }, []);

  // 2. 部員（メンバー）データのクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'members'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setMembers(list);
    });
    return () => unsub();
  }, []);

  // 3. 出欠データのクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      const attMap = {};
      snapshot.docs.forEach(doc => {
        attMap[doc.id] = doc.data();
      });
      setAttendance(attMap);
    });
    return () => unsub();
  }, []);

  // 4. 予定表のクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'schedules'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      setSchedules(list);
    });
    return () => unsub();
  }, []);

  // 5. 練習メニューのクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'practice'), (snapshot) => {
      const menuMap = {};
      snapshot.docs.forEach(doc => {
        menuMap[doc.id] = doc.data();
      });
      setPracticeMenus(menuMap);
    });
    return () => unsub();
  }, []);

  // 6. 活動記録のクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'activities'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      list.sort((a, b) => b.id.localeCompare(a.id));
      setActivities(list);
    });
    return () => unsub();
  }, []);

  // 7. メディアのクラウド同期
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(collection(db, 'media'), (snapshot) => {
      const list = snapshot.docs.map(doc => doc.data());
      list.sort((a, b) => b.id.localeCompare(a.id));
      setMediaList(list);
    });
    return () => unsub();
  }, []);

  // 認証状態監視
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const email = (firebaseUser.email || '').toLowerCase().trim();
        const currentTeacherList = teacherEmails.map(e => e.toLowerCase().trim());
        const isTeacher = currentTeacherList.includes(email);

        // Firestoreからユーザー情報の存在確認
        const userDocRef = doc(db, 'members', firebaseUser.uid);
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const existingMember = userSnap.data();
          setUser({
            id: existingMember.id,
            name: existingMember.name,
            email: existingMember.email,
            role: isTeacher ? 'teacher' : 'student',
            grade: isTeacher ? '顧問' : existingMember.grade,
            furigana: isTeacher ? '' : existingMember.furigana
          });
        } else {
          // 未登録の場合は初回登録画面へ
          setPendingAuthUser({
            id: firebaseUser.uid,
            email: email,
            isTeacher: isTeacher
          });
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [teacherEmails]);

  // Googleログイン
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
  };

  const handleLogout = async () => {
    if (auth) {
      try { await signOut(auth); } catch (e) {}
    }
    setUser(null);
    setPendingAuthUser(null);
  };

  // 新規登録完了処理（クラウドへ保存）
  const handleRegistrationComplete = async (data) => {
    const newUser = {
      id: pendingAuthUser.id,
      name: data.name,
      email: pendingAuthUser.email,
      role: pendingAuthUser.isTeacher ? 'teacher' : 'student',
      grade: pendingAuthUser.isTeacher ? '顧問' : data.grade,
      furigana: pendingAuthUser.isTeacher ? '' : data.furigana
    };
    
    // Firestoreに保存
    await setDoc(doc(db, 'members', newUser.id), newUser);
    setUser(newUser);
    setPendingAuthUser(null);
  };

  const handleRegistrationCancel = async () => {
    if (auth) {
      try { await signOut(auth); } catch (e) {}
    }
    setPendingAuthUser(null);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-slate-300">クラウドデータ同期中...</p>
        </div>
      </div>
    );
  }

  // 新規ユーザー登録画面
  if (pendingAuthUser) {
    return (
      <RegistrationScreen 
        pendingAuthUser={pendingAuthUser} 
        onComplete={handleRegistrationComplete} 
        onCancel={handleRegistrationCancel} 
      />
    );
  }

  if (!user) {
    return <LoginScreen onGoogleLogin={handleGoogleLogin} schoolName={schoolName} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
      <header className="bg-indigo-700 text-white shadow-md sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center font-black text-xl shadow-inner">
            V
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-lg tracking-tight leading-tight">{schoolName}</h1>
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
            ...(user.role === 'teacher' ? [{ id: 'members', label: '部員・アカウント管理' }] : [])
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
        {activeTab === 'attendance' && <AttendanceModule user={user} members={members} attendance={attendance} teacherEmails={teacherEmails} />}
        {activeTab === 'schedule' && <ScheduleModule user={user} schedules={schedules} teacherEmails={teacherEmails} />}
        {activeTab === 'practice' && <PracticeModule user={user} practiceMenus={practiceMenus} />}
        {activeTab === 'activity' && <ActivityModule user={user} members={members} activities={activities} teacherEmails={teacherEmails} />}
        {activeTab === 'media' && <MediaModule user={user} mediaList={mediaList} />}
        {activeTab === 'tactics' && <TacticsModule />}
        {activeTab === 'members' && user.role === 'teacher' && (
          <MembersModule 
            user={user}
            setUser={setUser}
            members={members} 
            activities={activities} 
            teacherEmails={teacherEmails}
          />
        )}
      </main>
    </div>
  );
}

// ======= 新規アカウント登録・確認画面コンポーネント =======
function RegistrationScreen({ pendingAuthUser, onComplete, onCancel }) {
  const [step, setStep] = useState('input');
  const [name, setName] = useState('');
  const [furigana, setFurigana] = useState('');
  const [grade, setGrade] = useState('1');

  const handleNext = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("氏名を入力してください。");
      return;
    }
    if (!pendingAuthUser.isTeacher && !furigana.trim()) {
      alert("ふりがなを入力してください。");
      return;
    }
    setStep('confirm');
  };

  const handleSubmit = () => {
    onComplete({
      name: name.trim(),
      furigana: pendingAuthUser.isTeacher ? '' : furigana.trim(),
      grade: pendingAuthUser.isTeacher ? '顧問' : grade
    });
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8 font-sans">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full border border-slate-100 space-y-6 text-slate-800">
        
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-500/30 mb-4">
            👤
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            {pendingAuthUser.isTeacher ? '新規教師アカウント登録' : '新規生徒アカウント登録'}
          </h2>
          <p className="text-xs text-slate-500 mt-1">{pendingAuthUser.email}</p>
        </div>

        {step === 'input' ? (
          <form onSubmit={handleNext} className="space-y-4">
            <div className={`border text-xs p-3 rounded-xl font-bold ${pendingAuthUser.isTeacher ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              初回ログインです。{pendingAuthUser.isTeacher ? '教師（顧問）' : '部活動'}用のアカウント情報を登録してください。
            </div>
            
            {!pendingAuthUser.isTeacher && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">学年 <span className="text-rose-500">*</span></label>
                <select 
                  value={grade} 
                  onChange={(e) => setGrade(e.target.value)} 
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500 bg-white"
                >
                  <option value="1">1年生</option>
                  <option value="2">2年生</option>
                  <option value="3">3年生</option>
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">氏名 <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                placeholder={pendingAuthUser.isTeacher ? "例: 後藤 陽斗" : "例: 部活 たろう"} 
                required 
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500" 
              />
            </div>

            {!pendingAuthUser.isTeacher && (
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">ふりがな <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={furigana} 
                  onChange={(e) => setFurigana(e.target.value)} 
                  placeholder="例: ぶかつ たろう" 
                  required 
                  className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold focus:outline-none focus:border-indigo-500" 
                />
              </div>
            )}

            <div className="pt-4 flex gap-3">
              <button 
                type="button" 
                onClick={onCancel} 
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm transition"
              >
                キャンセル
              </button>
              <button 
                type="submit" 
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl text-sm shadow-md transition"
              >
                確認画面へ
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400">学年・区分</p>
                <p className="text-sm font-black text-slate-900">{pendingAuthUser.isTeacher ? '顧問' : `${grade}年生`}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400">氏名</p>
                <p className="text-sm font-black text-slate-900">{name}</p>
              </div>
              {!pendingAuthUser.isTeacher && (
                <div>
                  <p className="text-[10px] font-bold text-slate-400">ふりがな</p>
                  <p className="text-sm font-black text-slate-900">{furigana}</p>
                </div>
              )}
            </div>

            <p className="text-xs font-bold text-center text-slate-600">この内容で登録します。よろしいですか？</p>

            <div className="pt-2 flex flex-col gap-2">
              <button 
                onClick={handleSubmit} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-md transition"
              >
                ✅ この内容で登録してログイン
              </button>
              <button 
                onClick={() => setStep('input')} 
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl text-sm transition"
              >
                戻って修正する
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ======= ログイン画面 =======
function LoginScreen({ onGoogleLogin, schoolName }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 px-4 py-8">
      <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-2xl max-w-md w-full text-center border border-slate-100 space-y-6">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-indigo-600 rounded-3xl mx-auto flex items-center justify-center text-white text-2xl sm:text-3xl font-black shadow-lg shadow-indigo-500/30">
          V
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">{schoolName}</h1>
          <p className="text-xs text-slate-400 mt-1">公式ポータルシステム</p>
        </div>

        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-left space-y-2 text-xs text-slate-600 font-medium">
          <p className="font-bold text-slate-700">🔐 Googleアカウントによる認証</p>
          <p>学校のGoogleアカウントで安全にログインしてください。</p>
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

function AttendanceModule({ user, members, attendance, teacherEmails }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);

  // 教師を除外し、生徒のみを表示
  const activeMembers = members.filter(m => {
    const isTeacher = teacherEmails.map(e => e.toLowerCase()).includes(m.email?.toLowerCase());
    const isGraduated = m.grade && m.grade.includes('卒業');
    return !isTeacher && !isGraduated;
  });

  const todayAtt = attendance[selectedDate] || {};

  const handleStatusChange = async (userId, status) => {
    const currentData = todayAtt[userId] || {};
    await setDoc(doc(db, 'attendance', selectedDate), {
      ...todayAtt,
      [userId]: {
        status,
        reason: currentData.reason || ''
      }
    });
  };

  const handleReasonChange = async (userId, reason) => {
    const currentData = todayAtt[userId] || {};
    await setDoc(doc(db, 'attendance', selectedDate), {
      ...todayAtt,
      [userId]: {
        status: currentData.status || 'present',
        reason
      }
    });
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
            <p className="text-sm sm:text-base font-bold mt-1">生徒の出欠状態および理由を確認できます。</p>
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
              {displayedMembers.length === 0 ? (
                <tr><td colSpan="3" className="p-6 text-center text-slate-400 font-bold text-xs">表示できる生徒がいません。</td></tr>
              ) : (
                displayedMembers.map(m => {
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
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScheduleModule({ user, schedules, teacherEmails }) {
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

  const handleAddSchedule = async (e) => {
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
    await setDoc(doc(db, 'schedules', item.id), item);
    setNewTitle('');
    setNewNotes('');
    setIsAdding(false);
  };

  const handleDeleteSchedule = async (id) => {
    if (window.confirm('この予定を削除しますか？')) {
      await deleteDoc(doc(db, 'schedules', id));
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
    </div>
  );
}

function PracticeModule({ user, practiceMenus }) {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [editMenuText, setEditMenuText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const currentMenu = practiceMenus[selectedDate]?.menu || 'この日の練習メニューはまだ登録されていません。';

  const handleSaveMenu = async () => {
    await setDoc(doc(db, 'practice', selectedDate), { menu: editMenuText });
    setIsEditing(false);
  };

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
              <button onClick={handleSaveMenu} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs sm:text-sm shadow">保存する</button>
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

function ActivityModule({ user, members, activities, teacherEmails }) {
  const [newDate, setNewDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [newContent, setNewContent] = useState('');
  const [teacherCommentInput, setTeacherCommentInput] = useState({});
  const [selectedStudentId, setSelectedStudentId] = useState('all');

  const handleAddActivity = async (e) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    const item = { id: 'act_' + Date.now(), userId: user.id, userName: user.name, date: newDate, content: newContent.trim(), comment: '' };
    await setDoc(doc(db, 'activities', item.id), item);
    setNewContent('');
  };

  const handleSaveComment = async (act) => {
    const commentText = teacherCommentInput[act.id] ?? act.comment;
    await setDoc(doc(db, 'activities', act.id), { ...act, comment: commentText });
  };

  // 現役生徒（教師でもなく、卒業生でもない生徒）のリスト
  const activeMembers = useMemo(() => {
    return members.filter(m => {
      const isTeacher = teacherEmails.map(e => e.toLowerCase()).includes(m.email?.toLowerCase());
      const isGraduated = m.grade && m.grade.includes('卒業');
      return !isTeacher && !isGraduated;
    });
  }, [members, teacherEmails]);

  // 現役生徒のIDセット
  const activeMemberIds = useMemo(() => {
    return new Set(activeMembers.map(m => m.id));
  }, [activeMembers]);

  // 表示する活動記録（卒業生のデータは残したまま非表示にフィルタリング）
  const displayedActivities = useMemo(() => {
    return activities.filter(a => {
      // 卒業生の活動記録は表示しない
      if (!activeMemberIds.has(a.userId)) return false;

      if (user.role === 'student') {
        return a.userId === user.id;
      } else {
        return selectedStudentId === 'all' ? true : a.userId === selectedStudentId;
      }
    });
  }, [activities, activeMemberIds, user, selectedStudentId]);

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
              <p className="text-sm font-medium text-slate-800 bg-slate-50 p-4 rounded-2xl border border-slate-100 whitespace-pre-line">{act.content}</p>
              <div className="pt-2 border-t border-slate-100">
                {user.role === 'teacher' ? (
                  <div className="space-y-2">
                    <label className="block text-xs font-bold text-indigo-700">教師からのコメント:</label>
                    <div className="flex gap-2">
                      <input type="text" defaultValue={act.comment} onChange={(e) => setTeacherCommentInput(p => ({ ...p, [act.id]: e.target.value }))} placeholder="コメントを入力..." className="flex-1 border-2 border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500" />
                      <button onClick={() => handleSaveComment(act)} className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow">送信</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="text-xs font-bold text-indigo-700">教師からのコメント:</span>
                    <p className="text-xs font-medium text-slate-700 bg-indigo-50/50 p-3 rounded-xl mt-1 border border-indigo-100 whitespace-pre-line">{act.comment || 'まだコメントはありません。'}</p>
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

function MediaModule({ user, mediaList }) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState('image');

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("ファイルサイズが5MBを超えています。大きな動画はYouTube等のリンクをご利用ください。");
      return;
    }
    const reader = new FileReader();
    reader.onload = async (uploadEvent) => {
      const fileDataUrl = uploadEvent.target.result;
      const newItem = {
        id: 'med_' + Date.now(),
        title: title.trim() || file.name,
        url: fileDataUrl,
        type: file.type.startsWith('video') ? 'video' : 'image',
        uploader: user.name,
        date: new Date().toISOString().split('T')[0]
      };
      await setDoc(doc(db, 'media', newItem.id), newItem);
      setTitle('');
    };
    reader.readAsDataURL(file);
  };

  const handleAddUrlMedia = async (e) => {
    e.preventDefault();
    if (!title.trim() || !url.trim()) return;
    const newItem = { id: 'med_' + Date.now(), title: title.trim(), url: url.trim(), type, uploader: user.name, date: new Date().toISOString().split('T')[0] };
    await setDoc(doc(db, 'media', newItem.id), newItem);
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

function MembersModule({ user, setUser, members, activities, teacherEmails }) {
  const [memberTab, setMemberTab] = useState('active');
  const [newTeacherEmail, setNewTeacherEmail] = useState('');

  const activeMembers = members.filter(m => !m.grade || !m.grade.includes('卒業'));
  const graduateMembers = members.filter(m => m.grade && m.grade.includes('卒業'));

  const handleAddTeacherEmail = async (e) => {
    e.preventDefault();
    if (!newTeacherEmail.trim()) return;
    const cleanEmail = newTeacherEmail.toLowerCase().trim();
    if (teacherEmails.map(e => e.toLowerCase()).includes(cleanEmail)) {
      alert("このメールアドレスは既に教師として登録されています。");
      return;
    }
    const updated = [...teacherEmails, cleanEmail];
    await setDoc(doc(db, 'settings', 'teachers'), { emails: updated });
    setNewTeacherEmail('');
    alert(`教師用アドレスに ${cleanEmail} を追加しました。`);
  };

  const handleRemoveTeacherEmail = async (emailToRemove) => {
    if (window.confirm(`「${emailToRemove}」の教師権限を取り消しますか？`)) {
      const updatedList = teacherEmails.filter(e => e.toLowerCase() !== emailToRemove.toLowerCase());
      await setDoc(doc(db, 'settings', 'teachers'), { emails: updatedList });
      
      if (user.email.toLowerCase() === emailToRemove.toLowerCase()) {
        setUser(prev => ({ ...prev, role: 'student', grade: '1' }));
      }
    }
  };

  const handleToggleUserRole = async (targetMember) => {
    const isCurrentlyTeacher = teacherEmails.map(e => e.toLowerCase()).includes(targetMember.email?.toLowerCase());

    if (isCurrentlyTeacher) {
      if (window.confirm(`「${targetMember.name}」の教師権限を剥奪して「生徒」に変更しますか？`)) {
        const updatedEmails = teacherEmails.filter(e => e.toLowerCase() !== targetMember.email.toLowerCase());
        await setDoc(doc(db, 'settings', 'teachers'), { emails: updatedEmails });
        await setDoc(doc(db, 'members', targetMember.id), { ...targetMember, role: 'student', grade: '1' });
        
        if (user.email.toLowerCase() === targetMember.email.toLowerCase()) {
          setUser(prev => ({ ...prev, role: 'student', grade: '1' }));
        }
      }
    } else {
      if (window.confirm(`「${targetMember.name}」を「教師・顧問」として登録しますか？`)) {
        const updatedEmails = [...teacherEmails, targetMember.email.toLowerCase()];
        await setDoc(doc(db, 'settings', 'teachers'), { emails: updatedEmails });
        await setDoc(doc(db, 'members', targetMember.id), { ...targetMember, role: 'teacher', grade: '顧問', furigana: '' });
      }
    }
  };

  const handleToggleGraduation = async (member) => {
    if (member.grade && member.grade.includes('卒業')) {
      await setDoc(doc(db, 'members', member.id), { ...member, grade: '3' });
    } else {
      const yearInput = prompt("卒業年度を入力してください（例: 2026）:", String(new Date().getFullYear()));
      if (yearInput !== null) {
        await setDoc(doc(db, 'members', member.id), { ...member, grade: `卒業 (${yearInput.trim()}年度)` });
      }
    }
  };

  const handleDeleteMember = async (id) => {
    if (window.confirm('このアカウントと、関連するすべての「活動記録」データを完全に削除しますか？\n（※この操作は元に戻せません）')) {
      // 1. メンバーを削除
      await deleteDoc(doc(db, 'members', id));
      // 2. 該当生徒の活動記録をすべて削除
      const targetActs = activities.filter(a => a.userId === id);
      for (const act of targetActs) {
        await deleteDoc(doc(db, 'activities', act.id));
      }
    }
  };

  const handleExportTextData = (member) => {
    const memberActivities = activities.filter(a => a.userId === member.id);
    
    let text = `【部活動 活動記録データ】\n`;
    text += `氏名: ${member.name} ${member.furigana ? `(${member.furigana})` : ''}\n`;
    text += `区分: ${member.grade}\n`;
    text += `=================================\n\n`;

    if (memberActivities.length === 0) {
      text += `※ 活動記録はありません。\n`;
    } else {
      memberActivities.forEach(act => {
        text += `■ 日付: ${act.date}\n`;
        text += `[記録内容・振り返り]\n${act.content}\n\n`;
        text += `[教師からのコメント]\n${act.comment || '（なし）'}\n`;
        text += `---------------------------------\n\n`;
      });
    }

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `${member.name}_活動記録.txt`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  };

  const displayedMembersList = memberTab === 'active' ? activeMembers : graduateMembers;

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-3xl shadow-lg border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base sm:text-lg font-black flex items-center gap-2">
              <span>🛡️</span> 教師（顧問）権限アカウントの管理
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              ここに登録されたGoogleアカウントのみが教師（管理者）としてログインできます。
            </p>
          </div>
        </div>

        <form onSubmit={handleAddTeacherEmail} className="flex flex-col sm:flex-row gap-2 pt-2">
          <input 
            type="email"
            value={newTeacherEmail}
            onChange={(e) => setNewTeacherEmail(e.target.value)}
            placeholder="追加する教師のGoogleメールアドレス (例: teacher@school.ed.jp)"
            className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-white/10 text-white placeholder-slate-400 border border-white/20 focus:outline-none focus:border-indigo-400"
          />
          <button 
            type="submit"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-5 py-2.5 rounded-xl text-xs shadow transition whitespace-nowrap"
          >
            + 教師アドレスを追加
          </button>
        </form>

        <div className="pt-3 border-t border-white/10">
          <p className="text-xs font-bold text-slate-300 mb-2">現在登録済みの教師アドレス:</p>
          <div className="flex flex-wrap gap-2">
            {teacherEmails.map((email) => (
              <div key={email} className="bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2">
                <span>{email}</span>
                <button 
                  type="button" 
                  onClick={() => handleRemoveTeacherEmail(email)}
                  className="text-rose-400 hover:text-rose-300 font-extrabold ml-1"
                  title="教師権限を削除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white p-4 sm:p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div><h2 className="text-lg sm:text-xl font-black text-slate-900">部員・登録アカウント一覧</h2></div>
          <div className="flex bg-slate-100 p-1 rounded-2xl">
            <button onClick={() => setMemberTab('active')} className={`py-2 px-4 text-xs font-extrabold rounded-xl transition ${memberTab === 'active' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>現役アカウント ({activeMembers.length})</button>
            <button onClick={() => setMemberTab('graduates')} className={`py-2 px-4 text-xs font-extrabold rounded-xl transition ${memberTab === 'graduates' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'}`}>OB・卒業生 ({graduateMembers.length})</button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-extrabold text-slate-600">
                  <th className="p-4">学年・区分</th>
                  <th className="p-4">氏名</th>
                  <th className="p-4">メールアドレス</th>
                  <th className="p-4">現在の権限</th>
                  <th className="p-4 text-right">操作・権限制御</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {displayedMembersList.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-slate-400 font-bold text-xs">登録データはありません。</td>
                  </tr>
                ) : (
                  displayedMembersList.map(m => {
                    const isTeacherAccount = teacherEmails.map(e => e.toLowerCase()).includes(m.email?.toLowerCase());

                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">
                          {isTeacherAccount ? (
                            <span className="inline-block px-3 py-1 rounded-xl text-xs font-bold bg-indigo-100 text-indigo-800">顧問</span>
                          ) : (
                            <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${m.grade && m.grade.includes('卒業') ? 'bg-slate-200 text-slate-700' : 'bg-emerald-100 text-emerald-800'}`}>
                              {m.grade && m.grade.includes('卒業') ? m.grade : `${m.grade}年`}
                            </span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-900">{m.name}</div>
                          {!isTeacherAccount && m.furigana && (
                            <div className="text-xs text-slate-400">{m.furigana}</div>
                          )}
                        </td>
                        <td className="p-4 text-xs font-medium text-slate-600">{m.email}</td>
                        <td className="p-4">
                          <span className={`inline-block px-3 py-1 rounded-xl text-xs font-bold ${isTeacherAccount ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {isTeacherAccount ? '教師・顧問' : '生徒'}
                          </span>
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button 
                            onClick={() => handleToggleUserRole(m)} 
                            className={`font-bold px-3 py-1.5 rounded-xl text-xs transition ${isTeacherAccount ? 'bg-amber-100 hover:bg-amber-200 text-amber-900' : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'}`}
                          >
                            {isTeacherAccount ? '生徒に変更' : '教師に変更'}
                          </button>
                          
                          {!isTeacherAccount && (
                            <>
                              <button onClick={() => handleExportTextData(m)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition">テキスト出力</button>
                              <button onClick={() => handleToggleGraduation(m)} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl text-xs transition">
                                {m.grade && m.grade.includes('卒業') ? '現役復帰' : '卒部にする'}
                              </button>
                            </>
                          )}
                          
                          <button onClick={() => handleDeleteMember(m.id)} className="text-rose-500 hover:text-rose-700 font-bold text-xs p-1.5">削除</button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
