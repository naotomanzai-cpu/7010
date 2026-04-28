const KEYS = {
  posts:       'pb_posts_v2',
  users:       'pb_users',
  currentUser: 'pb_currentUser',
  comments:    'pb_comments',
  likes:       'pb_likes_v2',
  messages:    'pb_messages'
};

// ── 学校のGmailドメイン設定 ───────────────────────────────────────────────
// 例: '@school.ed.jp' に変更すると、そのドメインのみ登録できます
const SCHOOL_DOMAIN = ''; // 空のままだと制限なし

const ICONS = [
  '🐱','🐶','🐰','🐻','🐼','🦊',
  '🐸','🐧','🦋','🦁','🐨','🐯',
  '🌸','🌻','🌙','⭐','🌈','🎀',
  '🎨','📸','🎮','🎸','⚽','🏀',
  '📚','💻','👑','💎','🔥','🌊'
];

function _getArr(key) { return JSON.parse(localStorage.getItem(key) || '[]'); }
function _setArr(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function _setOne(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
function genId() { return Math.random().toString(36).substr(2, 9); }

// ── Users ─────────────────────────────────────────────────────────────────
function getUsers()       { return _getArr(KEYS.users); }
function getCurrentUser() { return JSON.parse(localStorage.getItem(KEYS.currentUser) || 'null'); }
function getUserById(id)  { return getUsers().find(u => u.id === id) || null; }

function createUser(username, icon, bio) {
  const users = getUsers();
  const user  = { id: genId(), username, icon, bio: bio || '', createdAt: new Date().toISOString() };
  users.push(user);
  _setArr(KEYS.users, users);
  _setOne(KEYS.currentUser, user);
  return user;
}

function updateCurrentUser(username, icon, bio) {
  const cur = getCurrentUser();
  if (!cur) return null;
  const users   = getUsers();
  const idx     = users.findIndex(u => u.id === cur.id);
  const updated = { ...cur, username, icon, bio: bio !== undefined ? bio : (cur.bio || '') };
  if (idx !== -1) users[idx] = updated;
  _setArr(KEYS.users, users);
  _setOne(KEYS.currentUser, updated);
  return updated;
}

function logout() { localStorage.removeItem(KEYS.currentUser); }

// ── Posts ─────────────────────────────────────────────────────────────────
const POST_MAX_LENGTH = 150;
function getPosts()           { return _getArr(KEYS.posts); }
function getPostById(id)      { return getPosts().find(p => p.id === id) || null; }
function getPostsByUser(uid)  { return getPosts().filter(p => p.authorId === uid); }

function createPost(content, tags, image) {
  const user = getCurrentUser();
  const posts = getPosts();
  const post  = {
    id: genId(),
    authorId: user.id,
    content: content.slice(0, POST_MAX_LENGTH),
    tags: tags || [],
    image: image || null,
    createdAt: new Date().toISOString()
  };
  posts.unshift(post);
  _setArr(KEYS.posts, posts);
  return post;
}

// ── Comments ──────────────────────────────────────────────────────────────
function getComments(postId) { return _getArr(KEYS.comments).filter(c => c.postId === postId); }
function addComment(postId, content) {
  const user = getCurrentUser();
  const cmts = _getArr(KEYS.comments);
  cmts.push({ id: genId(), postId, authorId: user.id, content, createdAt: new Date().toISOString() });
  _setArr(KEYS.comments, cmts);
}

// ── Likes ─────────────────────────────────────────────────────────────────
function toggleLike(postId) {
  const user = getCurrentUser();
  if (!user) return false;
  let likes = _getArr(KEYS.likes);
  const key = `${user.id}_${postId}`;
  const idx = likes.indexOf(key);
  if (idx > -1) { likes.splice(idx, 1); _setArr(KEYS.likes, likes); return false; }
  else           { likes.push(key);     _setArr(KEYS.likes, likes); return true; }
}
function hasLiked(postId) {
  const user = getCurrentUser();
  if (!user) return false;
  return _getArr(KEYS.likes).includes(`${user.id}_${postId}`);
}
function getLikeCount(postId) { return _getArr(KEYS.likes).filter(k => k.endsWith(`_${postId}`)).length; }
function getPopularityScore(postId) { return getComments(postId).length + getLikeCount(postId); }

// ── Messages ──────────────────────────────────────────────────────────────
function getMessages(partnerId) {
  const user = getCurrentUser();
  if (!user) return [];
  return _getArr(KEYS.messages)
    .filter(m => (m.fromId === user.id && m.toId === partnerId) || (m.fromId === partnerId && m.toId === user.id))
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}
function getUnreadCount() {
  const user = getCurrentUser();
  if (!user) return 0;
  return _getArr(KEYS.messages).filter(m => m.toId === user.id && !m.read).length;
}
function sendMessage(toId, content) {
  const user = getCurrentUser();
  const all  = _getArr(KEYS.messages);
  const msg  = { id: genId(), fromId: user.id, toId, content, createdAt: new Date().toISOString(), read: false };
  all.push(msg);
  _setArr(KEYS.messages, all);
  return msg;
}
function markRead(fromId) {
  const user = getCurrentUser();
  const all  = _getArr(KEYS.messages);
  let changed = false;
  all.forEach(m => { if (m.fromId === fromId && m.toId === user.id && !m.read) { m.read = true; changed = true; } });
  if (changed) _setArr(KEYS.messages, all);
}
function getConversations() {
  const user = getCurrentUser();
  if (!user) return [];
  const partners = new Set();
  const convs = [];
  [..._getArr(KEYS.messages)]
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))
    .forEach(m => {
      let pId = m.fromId === user.id ? m.toId : (m.toId === user.id ? m.fromId : null);
      if (pId && !partners.has(pId)) { partners.add(pId); convs.push({ partnerId: pId, lastMessage: m }); }
    });
  return convs;
}

// ── Utils ─────────────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  if (diff < 60000)    return '今さっき';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}分前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const PRESET_TAGS = [
  '重要','公式','行事予定','時間割','教室変更',
  '提出物','課題・宿題','テスト対策','進路・受験','授業ノート',
  '部活連絡','試合速報','部員募集','委員会','生徒会',
  '落とし物','譲ります','学食・購買','悩み相談','アンケート',
  '文化祭','体育祭','有志募集','自己紹介','雑談',
  '趣味・創作','放課後','ニュース','運営への要望','募集終了'
];
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
  const [bg, col] = (colors[tag] || '#F3F4F6,#374151').split(',');
  return `background:${bg};color:${col}`;
}
function tagChip(tag, clickable) {
  const style = tagStyle(tag);
  if (clickable) return `<a class="tag" href="index.html?tag=${encodeURIComponent(tag)}" style="${style}">#${esc(tag)}</a>`;
  return `<span class="tag" style="${style}">#${esc(tag)}</span>`;
}
function tagChipStop(tag) {
  const style = tagStyle(tag);
  return `<span class="tag tag-clickable" style="${style}" onclick="event.preventDefault();event.stopPropagation();location.href='index.html?tag=${encodeURIComponent(tag)}'">#${esc(tag)}</span>`;
}

// ── Demo seed ─────────────────────────────────────────────────────────────
const DEMO_USER_ID = 'demo_sakura_001';
function seedDemoData() {
  if (localStorage.getItem('pb_demo_seeded_v1')) return;
  const demoUser = { id: DEMO_USER_ID, username: 'さくら', icon: '🌸', bio: 'シンギュラリティ高校2年B組です！写真部です📸', createdAt: new Date(Date.now()-86400000*5).toISOString() };
  const users = getUsers();
  if (!users.find(u => u.id === DEMO_USER_ID)) { users.push(demoUser); _setArr(KEYS.users, users); }
  const now = Date.now();
  const demoPosts = [
    { id:'demo_post_001', authorId:DEMO_USER_ID, content:'明日の体育祭、2年B組は赤チームです🎽 応援よろしく！', tags:['体育祭','行事予定'], image:null, createdAt:new Date(now-86400000*2).toISOString() },
    { id:'demo_post_002', authorId:DEMO_USER_ID, content:'数学のノートを落としてしまいました😭 拾ってくれた方いたらDMください！', tags:['落とし物','悩み相談'], image:null, createdAt:new Date(now-86400000).toISOString() },
    { id:'demo_post_003', authorId:DEMO_USER_ID, content:'写真部の展示やってます📸 中央廊下の掲示板に展示中！放課後ぜひ見に来てください〜', tags:['有志募集','放課後','趣味・創作'], image:null, createdAt:new Date(now-3600000*3).toISOString() }
  ];
  const posts = getPosts();
  demoPosts.forEach(p => { if (!posts.find(e => e.id === p.id)) posts.unshift(p); });
  _setArr(KEYS.posts, posts.sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)));
  localStorage.setItem('pb_demo_seeded_v1', '1');
}
function seedDemoMessage() {
  if (localStorage.getItem('pb_demo_msg_v1')) return;
  const user = getCurrentUser();
  if (!user) return;
  const all = _getArr(KEYS.messages);
  all.push({ id:'demo_msg_001', fromId:DEMO_USER_ID, toId:user.id, content:'はじめまして！さくらです🌸 よろしくね😊', createdAt:new Date(Date.now()-3600000*2).toISOString(), read:false });
  _setArr(KEYS.messages, all);
  localStorage.setItem('pb_demo_msg_v1', '1');
}
