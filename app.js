// ── 学校のGmailドメイン設定 ─────────────────────────────────────────────────
const SCHOOL_DOMAIN = '';

// ── Firebase 設定 ───────────────────────────────────────────────────────────
// 手順:
//  1. https://console.firebase.google.com/ でプロジェクト作成
//  2. 「Realtime Database」を「テストモード」で有効化
//  3. プロジェクトの設定 → マイアプリ → Web(</>)アプリ追加 → config をコピーして貼り付け
const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  databaseURL: "",   // ← 必須: https://YOUR-PROJECT-default-rtdb.firebaseio.com
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

const POST_MAX_LENGTH = 150;

const ICONS = [
  '🐱','🐶','🐰','🐻','🐼','🦊',
  '🐸','🐧','🦋','🦁','🐨','🐯',
  '🌸','🌻','🌙','⭐','🌈','🎀',
  '🎨','📸','🎮','🎸','⚽','🏀',
  '📚','💻','👑','💎','🔥','🌊'
];

const PRESET_TAGS = [
  '重要','公式','行事予定','時間割','教室変更',
  '提出物','課題・宿題','テスト対策','進路・受験','授業ノート',
  '部活連絡','試合速報','部員募集','委員会','生徒会',
  '落とし物','譲ります','学食・購買','悩み相談','アンケート',
  '文化祭','体育祭','有志募集','自己紹介','雑談',
  '趣味・創作','放課後','ニュース','運営への要望','募集終了'
];

// ── Firebase DB ───────────────────────────────────────────────────────────
let _db = null;
function db() {
  if (_db) return _db;
  try {
    if (!FIREBASE_CONFIG.databaseURL) return null;
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.database();
  } catch(e) { console.error('Firebase init error:', e); }
  return _db;
}

// ── Utils ─────────────────────────────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).substr(2,5); }
function esc(s) {
  return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function timeAgo(d) {
  const diff = Date.now() - new Date(d);
  if (diff < 60000)    return '今さっき';
  if (diff < 3600000)  return `${Math.floor(diff/60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}時間前`;
  const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()}`;
}

function tagStyle(tag) {
  const colors = {
    '重要':       '#FEE2E2,#DC2626', '公式':       '#DBEAFE,#1D4ED8',
    '行事予定':   '#D1FAE5,#065F46', '時間割':     '#D1FAE5,#065F46',
    '教室変更':   '#FEF3C7,#92400E', '提出物':     '#FEF3C7,#92400E',
    '課題・宿題': '#FEF3C7,#92400E', 'テスト対策': '#FCE7F3,#9D174D',
    '進路・受験': '#FCE7F3,#9D174D', '授業ノート': '#EEF2FF,#3730A3',
    '部活連絡':   '#FFEDD5,#9A3412', '試合速報':   '#FFEDD5,#9A3412',
    '部員募集':   '#FFEDD5,#9A3412', '委員会':     '#F0FDF4,#166534',
    '生徒会':     '#F0FDF4,#166534', '落とし物':   '#FFFBEB,#92400E',
    '譲ります':   '#FFFBEB,#92400E', '学食・購買': '#FFF7ED,#C2410C',
    '悩み相談':   '#FDF2F8,#9D174D', 'アンケート': '#F5F3FF,#5B21B6',
    '文化祭':     '#F3E8FF,#6B21A8', '体育祭':     '#EDE9FE,#5B21B6',
    '有志募集':   '#F3E8FF,#6B21A8', '自己紹介':   '#E0F2FE,#0369A1',
    '雑談':       '#F9FAFB,#374151', '趣味・創作': '#F0F9FF,#0284C7',
    '放課後':     '#FEF2F2,#B91C1C', 'ニュース':   '#EFF6FF,#1D4ED8',
    '運営への要望':'#F1F5F9,#475569', '募集終了':   '#F3F4F6,#6B7280'
  };
  const [bg,col] = (colors[tag]||'#F3F4F6,#374151').split(',');
  return `background:${bg};color:${col}`;
}
function tagChip(tag, clickable) {
  const s = tagStyle(tag);
  if (clickable) return `<a class="tag" href="index.html?tag=${encodeURIComponent(tag)}" style="${s}">#${esc(tag)}</a>`;
  return `<span class="tag" style="${s}">#${esc(tag)}</span>`;
}
function tagChipStop(tag) {
  const s = tagStyle(tag);
  return `<span class="tag tag-clickable" style="${s}" onclick="event.preventDefault();event.stopPropagation();location.href='index.html?tag=${encodeURIComponent(tag)}'">#${esc(tag)}</span>`;
}

// ── Current User (localStorage) ───────────────────────────────────────────
function getCurrentUser() { return JSON.parse(localStorage.getItem('pb_currentUser')||'null'); }
function _saveCurrentUser(u) { localStorage.setItem('pb_currentUser', JSON.stringify(u)); }
function logout() { localStorage.removeItem('pb_currentUser'); }

// ── Users (Firebase + memory cache) ──────────────────────────────────────
const _uc = {};

function getUserById(id) { return _uc[id] || null; }

function loadUser(id) {
  if (_uc[id]) return Promise.resolve(_uc[id]);
  const d = db();
  if (!d) return Promise.resolve(null);
  return d.ref(`users/${id}`).once('value').then(snap => {
    if (snap.val()) _uc[id] = snap.val();
    return _uc[id] || null;
  });
}

function _putUser(u) {
  if (!u) return;
  _uc[u.id] = u;
  db()?.ref(`users/${u.id}`).set(u);
}

function createUser(username, icon, bio, email) {
  const u = { id: genId(), username, icon, bio: bio||'', email: email||'', createdAt: new Date().toISOString() };
  _putUser(u);
  _saveCurrentUser(u);
  return u;
}

function updateCurrentUser(username, icon, bio, email) {
  const cur = getCurrentUser();
  if (!cur) return null;
  const u = { ...cur, username, icon, bio: bio??cur.bio??'', email: email??cur.email??'' };
  _putUser(u);
  _saveCurrentUser(u);
  return u;
}

// ── Posts ─────────────────────────────────────────────────────────────────
function listenPosts(cb) {
  const d = db();
  if (!d) { cb([]); return () => {}; }
  const ref = d.ref('posts').orderByChild('createdAt');
  const fn = snap => {
    const posts = [];
    snap.forEach(c => posts.unshift({ id: c.key, ...c.val() }));
    cb(posts);
  };
  ref.on('value', fn);
  return () => ref.off('value', fn);
}

function createPost(content, tags, image) {
  const user = getCurrentUser();
  const d = db();
  if (!d) return null;
  const ref = d.ref('posts').push();
  const post = {
    authorId: user.id, authorName: user.username, authorIcon: user.icon,
    content: content.slice(0, POST_MAX_LENGTH),
    tags: tags||[], image: image||null,
    likeCount: 0, commentCount: 0,
    createdAt: new Date().toISOString()
  };
  ref.set(post);
  return { id: ref.key, ...post };
}

function deletePost(postId, authorId) {
  const u = getCurrentUser();
  if (!u || u.id !== authorId) return;
  const d = db();
  if (!d) return;
  d.ref(`posts/${postId}`).remove();
  d.ref(`comments/${postId}`).remove();
  d.ref(`likes/${postId}`).remove();
}

function listenPost(postId, cb) {
  const d = db();
  if (!d) { cb(null); return () => {}; }
  const ref = d.ref(`posts/${postId}`);
  ref.on('value', snap => cb(snap.val() ? { id: snap.key, ...snap.val() } : null));
  return () => ref.off();
}

// ── Comments ──────────────────────────────────────────────────────────────
function listenComments(postId, cb) {
  const d = db();
  if (!d) { cb([]); return () => {}; }
  const ref = d.ref(`comments/${postId}`).orderByChild('createdAt');
  ref.on('value', snap => {
    const cmts = [];
    snap.forEach(c => cmts.push({ id: c.key, ...c.val() }));
    cb(cmts);
  });
  return () => ref.off();
}

function addComment(postId, content) {
  const u = getCurrentUser();
  const d = db();
  if (!d) return;
  d.ref(`comments/${postId}`).push({
    authorId: u.id, authorName: u.username, authorIcon: u.icon,
    content, createdAt: new Date().toISOString()
  });
  d.ref(`posts/${postId}/commentCount`).transaction(n => (n||0) + 1);
}

// ── Likes ─────────────────────────────────────────────────────────────────
function listenLikes(postId, cb) {
  const d = db();
  if (!d) { cb(0, false); return () => {}; }
  const ref = d.ref(`likes/${postId}`);
  ref.on('value', snap => {
    const u = getCurrentUser();
    cb(snap.numChildren(), u ? snap.hasChild(u.id) : false);
  });
  return () => ref.off();
}

function toggleLike(postId) {
  const u = getCurrentUser();
  if (!u) return;
  const d = db();
  if (!d) return;
  const ref = d.ref(`likes/${postId}/${u.id}`);
  ref.once('value').then(snap => {
    if (snap.exists()) {
      ref.remove();
      d.ref(`posts/${postId}/likeCount`).transaction(n => Math.max(0, (n||0) - 1));
      d.ref(`userLikes/${u.id}/${postId}`).remove();
    } else {
      ref.set(true);
      d.ref(`posts/${postId}/likeCount`).transaction(n => (n||0) + 1);
      d.ref(`userLikes/${u.id}/${postId}`).set(true);
    }
  });
}

function loadMyLikes(cb) {
  const u = getCurrentUser();
  if (!u) { cb({}); return; }
  const d = db();
  if (!d) { cb({}); return; }
  d.ref(`userLikes/${u.id}`).once('value').then(snap => cb(snap.val() || {}));
}

// ── Messages ──────────────────────────────────────────────────────────────
function _ck(a, b) { return [a, b].sort().join('__'); }

function listenMessages(partnerId, cb) {
  const u = getCurrentUser();
  if (!u) { cb([]); return () => {}; }
  const d = db();
  if (!d) { cb([]); return () => {}; }
  const ref = d.ref(`messages/${_ck(u.id, partnerId)}`).orderByChild('createdAt');
  ref.on('value', snap => {
    const msgs = [];
    snap.forEach(c => msgs.push({ id: c.key, ...c.val() }));
    cb(msgs);
  });
  return () => ref.off();
}

function sendMessage(toId, content) {
  const u = getCurrentUser();
  if (!u) return;
  const d = db();
  if (!d) return;
  const now = new Date().toISOString();
  d.ref(`messages/${_ck(u.id, toId)}`).push({
    fromId: u.id, fromName: u.username, fromIcon: u.icon,
    toId, content, createdAt: now, read: false
  });
  d.ref(`convs/${u.id}/${toId}`).set({ lastContent: content, updatedAt: now, unread: 0 });
  d.ref(`convs/${toId}/${u.id}`).transaction(cur => ({
    lastContent: content, updatedAt: now, unread: (cur?.unread||0) + 1
  }));
}

function markRead(partnerId) {
  const u = getCurrentUser();
  if (!u) return;
  db()?.ref(`convs/${u.id}/${partnerId}/unread`).set(0);
}

function listenConversations(cb) {
  const u = getCurrentUser();
  if (!u) { cb([]); return () => {}; }
  const d = db();
  if (!d) { cb([]); return () => {}; }
  const ref = d.ref(`convs/${u.id}`).orderByChild('updatedAt');
  ref.on('value', snap => {
    const convs = [];
    snap.forEach(c => convs.unshift({ partnerId: c.key, ...c.val() }));
    cb(convs);
  });
  return () => ref.off();
}

function listenUnread(cb) {
  const u = getCurrentUser();
  if (!u) { cb(0); return () => {}; }
  const d = db();
  if (!d) { cb(0); return () => {}; }
  const ref = d.ref(`convs/${u.id}`);
  ref.on('value', snap => {
    let n = 0;
    snap.forEach(c => { n += (c.val().unread||0); });
    cb(n);
  });
  return () => ref.off();
}
