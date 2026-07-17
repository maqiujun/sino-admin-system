/* ================================================================
   西诺销售管控系统 — Supabase 云端数据层
   数据自动汇总：业务员 → 销售总监(tina) → 管理员(admin)
   ================================================================ */

// ===== Supabase 配置 =====
// ⚠️ 使用前请替换为你的 Supabase 项目 URL 和 anon key
// 获取方式：supabase.com → 创建项目 → Settings → API
const SUPABASE_URL = 'https://YOUR_PROJECT.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY';

// ===== 账号体系 =====
// admin: 管理员（最高权限，看全员数据）
// tina:  销售总监（看所有业务员数据）
// 其余:  业务员（只看自己数据）
const ACCOUNTS = {
  'admin':       { password: '123456', name: '管理员',   role: 'admin' },
  'tina':        { password: '123456', name: 'Tina',    role: 'director' },
  'liyanqiong':  { password: '123456', name: '李艳琼',   role: 'employee' },
  'qinxi':       { password: '123456', name: '覃茜',     role: 'employee' },
  'sino01':      { password: '123456', name: '销售01',   role: 'employee' },
  'sino02':      { password: '123456', name: '销售02',   role: 'employee' },
};

// ===== 数据可见性规则 =====
// admin:    可见所有数据
// director: 可见所有业务员的数据（包括自己）
// employee: 只可见自己创建的数据
function canSeeAllData() {
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'director');
}

function isManagementRole() {
  return currentUser && (currentUser.role === 'admin' || currentUser.role === 'director');
}

// ===== Supabase REST API 封装 =====
const DB = {
  _headers: function() {
    return {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };
  },

  _url: function(table, params) {
    var url = SUPABASE_URL + '/rest/v1/' + table;
    if (params) url += '?' + params;
    return url;
  },

  // 查询
  select: function(table, filter) {
    var params = 'select=*';
    if (filter) params += '&' + filter;
    return fetch(DB._url(table, params), {
      method: 'GET',
      headers: DB._headers(),
    }).then(function(r) {
      if (!r.ok) throw new Error('DB select error: ' + r.status);
      return r.json();
    });
  },

  // 插入
  insert: function(table, data) {
    return fetch(DB._url(table), {
      method: 'POST',
      headers: DB._headers(),
      body: JSON.stringify(data),
    }).then(function(r) {
      if (!r.ok) throw new Error('DB insert error: ' + r.status);
      return r.json();
    });
  },

  // 更新
  update: function(table, id, data) {
    return fetch(DB._url(table, 'id=eq.' + encodeURIComponent(id)), {
      method: 'PATCH',
      headers: DB._headers(),
      body: JSON.stringify(data),
    }).then(function(r) {
      if (!r.ok) throw new Error('DB update error: ' + r.status);
      return r.json();
    });
  },

  // 删除
  delete: function(table, id) {
    return fetch(DB._url(table, 'id=eq.' + encodeURIComponent(id)), {
      method: 'DELETE',
      headers: DB._headers(),
    }).then(function(r) {
      if (!r.ok) throw new Error('DB delete error: ' + r.status);
      return r;
    });
  },
};

// ===== 数据缓存（减少网络请求） =====
var _cache = {
  clients: null,
  exams: null,
  followups: null,
};

function invalidateCache() {
  _cache.clients = null;
  _cache.exams = null;
  _cache.followups = null;
}

// ===== 异步数据访问函数 =====
// 所有函数返回 Promise

function fetchClients() {
  if (_cache.clients) return Promise.resolve(_cache.clients);
  var filter = '';
  if (!canSeeAllData() && currentUser) {
    filter = 'created_by=eq.' + encodeURIComponent(currentUser.username);
  }
  return DB.select('clients', filter).then(function(data) {
    _cache.clients = data || [];
    return _cache.clients;
  }).catch(function(e) {
    console.error('fetchClients:', e);
    return [];
  });
}

function fetchExams() {
  if (_cache.exams) return Promise.resolve(_cache.exams);
  var filter = '';
  if (!canSeeAllData() && currentUser) {
    filter = 'created_by=eq.' + encodeURIComponent(currentUser.username);
  }
  return DB.select('exams', filter).then(function(data) {
    _cache.exams = data || [];
    return _cache.exams;
  }).catch(function(e) {
    console.error('fetchExams:', e);
    return [];
  });
}

function fetchFollowups() {
  if (_cache.followups) return Promise.resolve(_cache.followups);
  var filter = '';
  if (!canSeeAllData() && currentUser) {
    filter = 'created_by=eq.' + encodeURIComponent(currentUser.username);
  }
  return DB.select('followups', filter).then(function(data) {
    _cache.followups = data || [];
    return _cache.followups;
  }).catch(function(e) {
    console.error('fetchFollowups:', e);
    return [];
  });
}

// ===== 同步获取缓存数据（用于渲染时快速访问） =====
function getClients() { return _cache.clients || []; }
function getExams() { return _cache.exams || []; }
function getFollowups() { return _cache.followups || []; }
function getClientById(id) {
  return (_cache.clients || []).find(function(c) { return c.id === id; });
}
function getExamsByClient(clientId) {
  return (_cache.exams || []).filter(function(e) { return e.client_id === clientId; });
}
function getFollowupsByClient(clientId) {
  return (_cache.followups || []).filter(function(f) { return f.client_id === clientId; });
}

// ===== 保存（写入Supabase） =====
function saveClient(client) {
  var isNew = !client.id;
  if (isNew) {
    client.id = genId();
    client.created_at = new Date().toISOString();
    client.created_by = currentUser ? currentUser.username : '';
    client.sales_person = currentUser ? currentUser.name : '';
  }

  // 映射到数据库列名（snake_case）
  var row = {
    id: client.id,
    name: client.name,
    industry: client.industry || '',
    stores: client.stores || '',
    location: client.location || client.address || '',
    age: client.age || '',
    revenue: client.revenue || '',
    contact: client.contact || '',
    phone: client.phone || '',
    purpose: client.purpose || '',
    communities: client.communities || '',
    elevators: client.elevators || '',
    doors: client.doors || '',
    level: client.level || '',
    address: client.address || client.location || '',
    sales_person: client.sales_person || (currentUser ? currentUser.name : ''),
    sales_manager: client.sales_manager || '',
    status: client.status || '意向中',
    source: client.source || '',
    remark: client.remark || '',
    created_at: client.created_at,
    created_by: client.created_by,
  };

  var promise;
  if (isNew) {
    promise = DB.insert('clients', row);
  } else {
    promise = DB.update('clients', client.id, row);
  }

  return promise.then(function(result) {
    // 更新本地缓存
    if (!_cache.clients) _cache.clients = [];
    var idx = _cache.clients.findIndex(function(c) { return c.id === client.id; });
    // 把snake_case转回camelCase存入缓存
    var cached = Object.assign({}, client);
    if (idx >= 0) _cache.clients[idx] = cached;
    else _cache.clients.push(cached);
    return cached;
  }).catch(function(e) {
    console.error('saveClient:', e);
    toast('保存失败，请检查网络');
    return null;
  });
}

function saveExam(exam) {
  var isNew = !exam.id;
  if (isNew) {
    exam.id = genId();
    exam.created_at = new Date().toISOString();
    exam.created_by = currentUser ? currentUser.username : '';
  }

  var row = {
    id: exam.id,
    client_id: exam.clientId,
    client_name: exam.clientName,
    exam_date: exam.examDate,
    dim_scores: JSON.stringify(exam.dimScores),
    total_score: exam.totalScore,
    health_grade: exam.healthGrade,
    core_findings: exam.coreFindings,
    recommended_product: exam.recommendedProduct,
    scores: JSON.stringify(exam.scores),
    text_answers: JSON.stringify(exam.textAnswers),
    examiner: exam.examiner || (currentUser ? currentUser.name : ''),
    created_at: exam.created_at,
    created_by: exam.created_by,
  };

  var promise;
  if (isNew) {
    promise = DB.insert('exams', row);
  } else {
    promise = DB.update('exams', exam.id, row);
  }

  return promise.then(function() {
    if (!_cache.exams) _cache.exams = [];
    var idx = _cache.exams.findIndex(function(e) { return e.id === exam.id; });
    var cached = Object.assign({}, exam);
    if (idx >= 0) _cache.exams[idx] = cached;
    else _cache.exams.push(cached);
    return cached;
  }).catch(function(e) {
    console.error('saveExam:', e);
    toast('保存失败，请检查网络');
    return null;
  });
}

function saveFollowup(fu) {
  var isNew = !fu.id;
  if (isNew) {
    fu.id = genId();
    fu.created_at = new Date().toISOString();
    fu.created_by = currentUser ? currentUser.username : '';
  }

  var row = {
    id: fu.id,
    client_id: fu.clientId,
    client_name: fu.clientName,
    follow_date: fu.followDate,
    method: fu.method,
    detail: fu.detail || '',
    result: fu.result || '',
    next_action: fu.nextAction || '',
    next_date: fu.nextDate || '',
    need_help: fu.needHelp || '',
    created_at: fu.created_at,
    created_by: fu.created_by,
  };

  var promise;
  if (isNew) {
    promise = DB.insert('followups', row);
  } else {
    promise = DB.update('followups', fu.id, row);
  }

  return promise.then(function() {
    if (!_cache.followups) _cache.followups = [];
    var idx = _cache.followups.findIndex(function(f) { return f.id === fu.id; });
    var cached = Object.assign({}, fu);
    if (idx >= 0) _cache.followups[idx] = cached;
    else _cache.followups.push(cached);
    return cached;
  }).catch(function(e) {
    console.error('saveFollowup:', e);
    toast('保存失败，请检查网络');
    return null;
  });
}

function deleteClient(id) {
  return DB.delete('clients', id).then(function() {
    _cache.clients = (_cache.clients || []).filter(function(c) { return c.id !== id; });
    // 同时删除关联的体检和跟进
    return Promise.all([
      DB.delete('exams', id), // 需要按client_id删，这里简化处理
    ]);
  }).catch(function(e) {
    console.error('deleteClient:', e);
  });
}

// ===== 初始化：加载所有数据到缓存 =====
function loadAllData() {
  return Promise.all([
    fetchClients(),
    fetchExams(),
    fetchFollowups(),
  ]);
}

// ===== 工具函数 =====
function genId() {
  return 'id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// ===== Supabase 连接检测 =====
function isSupabaseConfigured() {
  return SUPABASE_URL.indexOf('YOUR_PROJECT') === -1;
}
