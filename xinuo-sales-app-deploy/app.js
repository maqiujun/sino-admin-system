/* ================================================================
   西诺销售管控系统 — 核心应用逻辑
   品牌体验现场交付 + 飞书CSV导出 + 销售跟进管理
   Supabase 云端数据汇总版
   ================================================================ */

// ===== Chip Options =====
const CHIP_OPTIONS = {
  industry: ['餐饮','教培','健身','美容/医美','汽车服务','百货/零售','地产/家居','其他'],
  stores:   ['单店','2-5家','5-10家','10家以上'],
  age:      ['1年以内','1-3年','3-5年','5年以上'],
  revenue:  ['50万以下','50-200万','200-500万','500万以上'],
  purpose:  ['初次认识','老客户回访','客户主动咨询','其他'],
  level:    ['A','B','C','D'],
  source:   ['陌拜','转介绍','老客户升级','其他'],
  status:   ['意向中','方案中','谈判中','已成交','已流失'],
  method:   ['电话','上门','微信'],
  result:   ['推进中','有进展','卡住','需支持'],
};

// ===== App State =====
let currentUser = null;
let currentStep = 1;
let currentClientId = null;
let examScores = {};
let examTextAnswers = {};
let examClientData = {};

// ===== Storage Key =====
const USER_KEY = 'xinuo_current_user';

// ================================================================
// LOGIN
// ================================================================
function doLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  if (!username) return toast('请输入账号');
  
  // 检查 Supabase 是否已配置
  if (!isSupabaseConfigured()) {
    return toast('系统未配置，请联系管理员');
  }
  
  const account = ACCOUNTS[username];
  if (!account) return toast('账号不存在');
  if (account.password !== password) return toast('密码错误');
  
  currentUser = { username, name: account.name, role: account.role || 'employee' };
  localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
  
  var el1 = document.getElementById('topbar-user');
  if (el1) el1.textContent = account.name;
  var el2 = document.getElementById('topbar-user-admin');
  if (el2) el2.textContent = account.name;
  var el3 = document.getElementById('topbar-user-director');
  if (el3) el3.textContent = account.name;
  
  // 加载云端数据后进入主页
  toast('正在加载数据...');
  loadAllData().then(function() {
    if (currentUser.role === 'admin') {
      showScreen('admin');
      toast('欢迎，' + account.name + ' (管理员)');
    } else if (currentUser.role === 'director') {
      showScreen('home');
      toast('欢迎，' + account.name + ' (销售总监)');
    } else {
      showScreen('home');
      toast('欢迎，' + account.name);
    }
  });
}

function doLogout() {
  if (!confirm('确定退出登录？')) return;
  currentUser = null;
  localStorage.removeItem(USER_KEY);
  _cache = { clients: null, exams: null, followups: null };
  showScreen('login');
}

function autoLogin() {
  const saved = localStorage.getItem(USER_KEY);
  if (saved) {
    currentUser = JSON.parse(saved);
    var el1 = document.getElementById('topbar-user');
    if (el1) el1.textContent = currentUser.name;
    var el2 = document.getElementById('topbar-user-admin');
    if (el2) el2.textContent = currentUser.name;
    var el3 = document.getElementById('topbar-user-director');
    if (el3) el3.textContent = currentUser.name;
    return true;
  }
  return false;
}

// ================================================================
// NAVIGATION
// ================================================================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.remove('active'); });
  var el = document.getElementById('screen-' + screenId);
  if (el) el.classList.add('active');

  var isMgmt = isManagementRole();
  var tabBarEmp = document.getElementById('tab-bar');
  var tabBarAdmin = document.getElementById('tab-bar-admin');
  var tabBarDirector = document.getElementById('tab-bar-director');

  if (screenId === 'exam' || screenId === 'login' || screenId === 'client-detail') {
    if (tabBarEmp) tabBarEmp.style.display = 'none';
    if (tabBarAdmin) tabBarAdmin.style.display = 'none';
    if (tabBarDirector) tabBarDirector.style.display = 'none';
  } else {
    if (currentUser && currentUser.role === 'admin') {
      if (tabBarEmp) tabBarEmp.style.display = 'none';
      if (tabBarAdmin) tabBarAdmin.style.display = 'flex';
      if (tabBarDirector) tabBarDirector.style.display = 'none';
    } else if (currentUser && currentUser.role === 'director') {
      if (tabBarEmp) tabBarEmp.style.display = 'none';
      if (tabBarAdmin) tabBarAdmin.style.display = 'none';
      if (tabBarDirector) tabBarDirector.style.display = 'flex';
    } else {
      if (tabBarEmp) tabBarEmp.style.display = 'flex';
      if (tabBarAdmin) tabBarAdmin.style.display = 'none';
      if (tabBarDirector) tabBarDirector.style.display = 'none';
    }
  }

  var steps = document.getElementById('steps');
  if (screenId === 'exam') {
    steps.style.display = 'flex';
  } else {
    steps.style.display = 'none';
  }

  // Update tab active state
  document.querySelectorAll('.tab-item').forEach(function(t) { t.classList.remove('active'); });
  var tabBarId = currentUser && currentUser.role === 'admin' ? '.tab-bar-admin' :
                 currentUser && currentUser.role === 'director' ? '.tab-bar-director' :
                 '.tab-bar-employee';
  var activeTab = document.querySelector(tabBarId + ' .tab-item[onclick*="' + screenId + '"]');
  if (activeTab) activeTab.classList.add('active');

  if (screenId === 'home') renderHome();
  else if (screenId === 'clients') renderClientList();
  else if (screenId === 'followups') renderFollowupList();
  else if (screenId === 'export') renderExportCenter();
  else if (screenId === 'admin') renderAdminDashboard();
}

function switchTab(tabName) {
  showScreen(tabName);
}

function confirmExitExam() {
  if (confirm('确定返回主页？当前体检数据将丢失。')) {
    resetExamState();
    showScreen('home');
  }
}

function finishExam() {
  resetExamState();
  showScreen('home');
  toast('体检已完成');
}

// ================================================================
// HOME PAGE
// ================================================================
function renderHome() {
  var clients = getClients();
  var exams = getExams();
  var followups = getFollowups();
  var todayStr = formatDate(new Date());
  var todayFollowups = followups.filter(function(f) { return f.followDate === todayStr || f.follow_date === todayStr; });
  var isAdmin = currentUser && currentUser.role === 'admin';
  var isDirector = currentUser && currentUser.role === 'director';
  var isMgmt = isManagementRole();

  // Welcome banner
  var banner = document.querySelector('.welcome-banner');
  if (banner) {
    if (isAdmin) { banner.classList.add('admin'); banner.classList.remove('director'); }
    else if (isDirector) { banner.classList.add('director'); banner.classList.remove('admin'); }
    else { banner.classList.remove('admin', 'director'); }
  }
  var wt = document.getElementById('welcome-text');
  var ws = document.getElementById('welcome-sub');
  var hour = new Date().getHours();
  var greet = hour < 6 ? '凌晨好' : hour < 12 ? '上午好' : hour < 18 ? '下午好' : '晚上好';
  if (wt) wt.textContent = greet + '，' + (currentUser ? currentUser.name : '');
  if (ws) {
    if (isAdmin) ws.textContent = '全员数据总览，掌控全局';
    else if (isDirector) ws.textContent = '团队业务数据，一目了然';
    else ws.textContent = '今天也是元气满满的一天~';
  }

  var statsHtml = '<div class="stat-card"><div class="stat-num">' + clients.length + '</div><div class="stat-label">客户</div></div>' +
    '<div class="stat-card"><div class="stat-num">' + exams.length + '</div><div class="stat-label">体检</div></div>' +
    '<div class="stat-card"><div class="stat-num">' + followups.length + '</div><div class="stat-label">跟进</div></div>' +
    '<div class="stat-card highlight"><div class="stat-num">' + todayFollowups.length + '</div><div class="stat-label">今日跟进</div></div>';
  document.getElementById('home-stats').innerHTML = statsHtml;

  // Home grid: 不同角色显示不同入口
  var gridHtml = '';
  if (isAdmin) {
    gridHtml += '<div class="home-card" onclick="switchTab(\'admin\')"><div class="home-card-icon">⚙️</div><div class="home-card-title">管理后台</div><div class="home-card-desc">员工管理与数据总览</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'clients\')"><div class="home-card-icon">👥</div><div class="home-card-title">所有客户</div><div class="home-card-desc">查看与编辑全员客户</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'followups\')"><div class="home-card-icon">📝</div><div class="home-card-title">所有跟进</div><div class="home-card-desc">全员销售跟进记录</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'export\')"><div class="home-card-icon">📤</div><div class="home-card-title">数据导出</div><div class="home-card-desc">飞书CSV导出</div></div>';
  } else if (isDirector) {
    gridHtml += '<div class="home-card" onclick="switchTab(\'clients\')"><div class="home-card-icon">👥</div><div class="home-card-title">团队客户</div><div class="home-card-desc">查看所有业务员客户</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'followups\')"><div class="home-card-icon">📝</div><div class="home-card-title">团队跟进</div><div class="home-card-desc">全员销售跟进记录</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'export\')"><div class="home-card-icon">📤</div><div class="home-card-title">数据导出</div><div class="home-card-desc">飞书CSV导出</div></div>';
    gridHtml += '<div class="home-card" onclick="startNewExam()"><div class="home-card-icon">📋</div><div class="home-card-title">新建体检</div><div class="home-card-desc">客户营销健康体检</div></div>';
  } else {
    gridHtml += '<div class="home-card" onclick="startNewExam()"><div class="home-card-icon">📋</div><div class="home-card-title">新建体检</div><div class="home-card-desc">客户营销健康体检</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'clients\')"><div class="home-card-icon">👥</div><div class="home-card-title">我的客户</div><div class="home-card-desc">客户资料与详情</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'followups\')"><div class="home-card-icon">📝</div><div class="home-card-title">我的跟进</div><div class="home-card-desc">销售跟进记录</div></div>';
    gridHtml += '<div class="home-card" onclick="switchTab(\'export\')"><div class="home-card-icon">📤</div><div class="home-card-title">数据导出</div><div class="home-card-desc">飞书CSV导出</div></div>';
  }
  document.getElementById('home-grid').innerHTML = gridHtml;
}

// ================================================================
// ADMIN DASHBOARD
// ================================================================
function renderAdminDashboard() {
  if (!currentUser || currentUser.role !== 'admin') {
    toast('无权访问管理后台');
    return showScreen('home');
  }

  var clients = getClients();
  var exams = getExams();
  var followups = getFollowups();
  var employees = Object.keys(ACCOUNTS).map(function(k) {
    return { username: k, name: ACCOUNTS[k].name, role: ACCOUNTS[k].role };
  });

  var todayStr = formatDate(new Date());
  var todayFollowups = followups.filter(function(f) {
    return (f.followDate || f.follow_date || '') === todayStr;
  });

  var overviewHtml =
    '<div class="admin-stat-card"><div class="admin-stat-num">' + employees.length + '</div><div class="admin-stat-label">员工总数</div></div>' +
    '<div class="admin-stat-card"><div class="admin-stat-num">' + clients.length + '</div><div class="admin-stat-label">客户总数</div></div>' +
    '<div class="admin-stat-card dark"><div class="admin-stat-num">' + exams.length + '</div><div class="admin-stat-label">体检总数</div></div>' +
    '<div class="admin-stat-card dark"><div class="admin-stat-num">' + followups.length + '</div><div class="admin-stat-label">跟进总数</div></div>';
  document.getElementById('admin-overview').innerHTML = overviewHtml;

  // 员工列表
  var empHtml = '';
  employees.forEach(function(emp) {
    var empClients = clients.filter(function(c) {
      return (c.salesPerson || c.sales_person || '') === emp.name;
    }).length;
    var empExams = exams.filter(function(e) {
      return (e.examiner || '') === emp.name;
    }).length;
    var empFollowups = followups.filter(function(f) {
      var c = getClientById(f.clientId || f.client_id);
      return c && ((c.salesPerson || c.sales_person || '') === emp.name);
    }).length;
    var roleLabel = emp.role === 'admin' ? '管理员' : emp.role === 'director' ? '总监' : '业务员';
    var isAdminEmp = emp.role === 'admin';
    var isDirectorEmp = emp.role === 'director';
    var initial = emp.name ? emp.name.charAt(0) : '?';
    empHtml += '<div class="employee-card">' +
      '<div class="employee-info">' +
      '<div class="employee-avatar' + (isAdminEmp ? ' admin' : isDirectorEmp ? ' director' : '') + '">' + initial + '</div>' +
      '<div><div class="employee-name">' + emp.name + ' <span class="role-badge ' + emp.role + '">' + roleLabel + '</span></div>' +
      '<div class="employee-role">@' + emp.username + '</div></div>' +
      '</div>' +
      '<div class="employee-stats">' +
      '<div><div class="es-num">' + empClients + '</div><div class="es-label">客户</div></div>' +
      '<div><div class="es-num">' + empExams + '</div><div class="es-label">体检</div></div>' +
      '<div><div class="es-num">' + empFollowups + '</div><div class="es-label">跟进</div></div>' +
      '</div></div>';
  });
  document.getElementById('employee-list').innerHTML = empHtml;

  // 数据汇总
  var gradeStats = { '健康': 0, '亚健康': 0, '生病': 0, '重病': 0 };
  exams.forEach(function(e) {
    var g = e.healthGrade || e.health_grade || '';
    if (gradeStats[g] !== undefined) gradeStats[g]++;
  });

  var statusStats = {};
  CHIP_OPTIONS.status.forEach(function(s) { statusStats[s] = 0; });
  clients.forEach(function(c) {
    var st = c.status || '意向中';
    if (statusStats[st] !== undefined) statusStats[st]++;
  });

  var sumHtml = '<div class="admin-data-row"><span class="ad-label">健康等级客户</span><span class="ad-value">' + gradeStats['健康'] + ' 人</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">亚健康等级</span><span class="ad-value">' + gradeStats['亚健康'] + ' 人</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">生病等级</span><span class="ad-value">' + gradeStats['生病'] + ' 人</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">重病等级</span><span class="ad-value">' + gradeStats['重病'] + ' 人</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">今日新增跟进</span><span class="ad-value">' + todayFollowups.length + ' 条</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">意向中客户</span><span class="ad-value">' + (statusStats['意向中'] || 0) + ' 人</span></div>' +
    '<div class="admin-data-row"><span class="ad-label">已成交客户</span><span class="ad-value">' + (statusStats['已成交'] || 0) + ' 人</span></div>';
  document.getElementById('admin-data-summary').innerHTML = sumHtml;

  // 导出按钮
  var expHtml = '<div class="admin-export-btns">' +
    '<button class="btn-primary btn-block" onclick="adminExportAll()">📊 一键导出全员数据 (CSV打包)</button>' +
    '<button class="btn-outline btn-block" onclick="exportAllExams()">导出全部体检结果</button>' +
    '<button class="btn-outline btn-block" onclick="exportAllClients()">导出全部客户资料</button>' +
    '<button class="btn-outline btn-block" onclick="exportAllFollowups()">导出全部跟进记录</button>' +
    '</div>' +
    '<p class="admin-export-note">💡 提示：数据已自动汇总到云端，导出CSV可直接导入飞书多维表格。</p>';
  document.getElementById('admin-export').innerHTML = expHtml;
}

function adminExportAll() {
  var clients = getClients();
  var exams = getExams();
  var followups = getFollowups();
  if (clients.length === 0 && exams.length === 0 && followups.length === 0) {
    return toast('暂无数据可导出');
  }
  if (exams.length > 0) downloadCSV('全员体检_' + formatDate(new Date()) + '.csv', generateExamsCSV(exams));
  setTimeout(function() {
    if (clients.length > 0) downloadCSV('全员客户_' + formatDate(new Date()) + '.csv', generateClientsCSV(clients));
  }, 300);
  setTimeout(function() {
    if (followups.length > 0) downloadCSV('全员跟进_' + formatDate(new Date()) + '.csv', generateFollowupsCSV(followups));
  }, 600);
  toast('正在导出 ' + (clients.length + exams.length + followups.length) + ' 条数据');
}

// ================================================================
// EXAM FLOW
// ================================================================
function startNewExam() {
  currentStep = 1;
  currentClientId = null;
  examScores = {};
  examTextAnswers = {};
  examClientData = {};
  resetClientForm();
  setExamStep(1);
  showScreen('exam');
}

function setExamStep(n) {
  currentStep = n;
  document.querySelectorAll('.step').forEach(function(el, i) {
    el.classList.remove('active', 'done');
    if (i + 1 < n) el.classList.add('done');
    if (i + 1 === n) el.classList.add('active');
  });
  document.querySelectorAll('.exam-page').forEach(function(p) { p.classList.remove('active'); });
  var pageId = n === 1 ? 'page-client' : n === 2 ? 'page-diagnosis' : 'page-result';
  document.getElementById(pageId).classList.add('active');

  if (n === 1) renderClientSelector();
  else if (n === 2) { renderDiagnosis(); checkSubmitReady(); }
  else if (n === 3) generateReport();
}

function renderClientSelector() {
  var clients = getClients();
  var container = document.getElementById('existing-clients');
  if (clients.length === 0) {
    container.innerHTML = '<p style="font-size:13px;color:#9ca3af;padding:8px 0;">暂无客户，请填写新客户信息</p>';
    return;
  }
  var html = '<div style="margin-bottom:8px;font-size:13px;color:#6b7280;font-weight:600;">或选择已有客户：</div>';
  html += '<div class="client-select-list">';
  clients.forEach(function(c) {
    var sel = currentClientId === c.id ? 'selected' : '';
    html += '<div class="client-select-item ' + sel + '" onclick="selectExistingClient(\'' + c.id + '\')">' +
      '<span class="client-select-name">' + (c.name || '') + '</span>' +
      '<span class="client-select-tag">' + (c.industry || '') + '</span></div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function selectExistingClient(id) {
  var client = getClientById(id);
  if (!client) return;
  currentClientId = id;
  document.getElementById('f-name').value = client.name || '';
  document.getElementById('f-location').value = client.location || client.address || '';
  document.getElementById('f-contact').value = client.contact || '';
  document.getElementById('f-phone').value = client.phone || '';
  document.getElementById('f-communities').value = client.communities || '';
  document.getElementById('f-elevators').value = client.elevators || '';
  document.getElementById('f-doors').value = client.doors || '';
  setChipSelected('chips-industry', client.industry);
  setChipSelected('chips-stores', client.stores);
  setChipSelected('chips-age', client.age);
  setChipSelected('chips-revenue', client.revenue);
  setChipSelected('chips-purpose', client.purpose);
  renderClientSelector();
  toast('已选择：' + client.name);
}

function setChipSelected(containerId, value) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.chip').forEach(function(c) {
    c.classList.toggle('selected', c.dataset.value === value);
  });
}

function goToDiagnosis() {
  examClientData = {
    name: document.getElementById('f-name').value.trim(),
    industry: getChipSelected('chips-industry'),
    stores: getChipSelected('chips-stores'),
    location: document.getElementById('f-location').value.trim(),
    age: getChipSelected('chips-age'),
    revenue: getChipSelected('chips-revenue'),
    contact: document.getElementById('f-contact').value.trim(),
    phone: document.getElementById('f-phone').value.trim(),
    purpose: getChipSelected('chips-purpose'),
    communities: document.getElementById('f-communities').value,
    elevators: document.getElementById('f-elevators').value,
    doors: document.getElementById('f-doors').value,
  };
  if (!examClientData.name) return toast('请填写客户名称');
  setExamStep(2);
}

// --- Diagnosis Rendering ---
function renderDiagnosis() {
  var container = document.getElementById('diagnosis-container');
  var html = '';
  DIAGNOSIS_DATA.forEach(function(dim) {
    html += '<div class="dimension-card incomplete" id="dim-' + dim.id + '">';
    html += '<div class="dim-header">';
    html += '<span class="dim-title">' + dim.title + ' <span class="dim-max">（满分' + dim.maxScore + '分）</span></span>';
    html += '<span class="dim-score" id="dim-score-' + dim.id + '">0 / ' + dim.maxScore + '</span>';
    html += '</div>';
    html += '<p style="font-size:12px;color:#9ca3af;margin-bottom:14px;">' + dim.desc + '</p>';

    dim.questions.forEach(function(q) {
      html += '<div class="question-item">';
      html += '<div class="question-text"><span class="question-num">' + q.num + '</span>';
      var typeLabels = { radio: '单选', checkbox: '多选', text: '填空', score: '评分' };
      var typeColors = { radio: '#F08519', checkbox: '#8E44AD', text: '#27AE60', score: '#F39C12' };
      html += '<span class="q-type-badge" style="background:' + typeColors[q.type] + '">' + typeLabels[q.type] + '</span>';
      html += q.text + '</div>';

      if (q.type === 'radio') {
        html += '<div class="radio-group">';
        q.options.forEach(function(opt) {
          html += '<label class="radio-option">';
          html += '<input type="radio" name="q-' + q.num + '" value="' + opt.value + '" onchange="setRadioScore(\'' + q.num + '\',' + opt.value + ')">';
          html += '<span class="radio-mark"></span>';
          html += '<span class="radio-label">' + opt.label + '</span>';
          html += '</label>';
        });
        html += '</div>';
      } else if (q.type === 'text') {
        html += '<div class="text-input-group">';
        html += '<input type="text" class="text-answer" id="text-' + q.num + '" placeholder="' + (q.placeholder || '请输入...') + '" oninput="updateTextAnswer(\'' + q.num + '\')">';
        html += '</div>';
      } else if (q.type === 'score') {
        html += '<div class="score-options" id="score-' + q.num + '">';
        for (var v = 1; v <= 5; v++) {
          html += '<button class="score-btn" data-q="' + q.num + '" data-v="' + v + '" onclick="setScore(\'' + q.num + '\',' + v + ')">' + v + '</button>';
        }
        html += '<span class="score-label">1=差 → 5=优</span>';
        if (q.hint) html += '<span class="score-hint">' + q.hint + '</span>';
        html += '</div>';
      }
      html += '</div>';
    });

    html += '<div class="dim-subtotal">';
    html += '<span class="dim-subtotal-label">小计（满分' + dim.maxScore + '）</span>';
    html += '<span class="dim-subtotal-value" id="dim-subtotal-' + dim.id + '">0 / ' + dim.maxScore + '</span>';
    html += '</div></div>';
  });
  container.innerHTML = html;

  // Restore scores
  Object.keys(examScores).forEach(function(q) {
    var dim = DIAGNOSIS_DATA.find(function(d) { return d.questions.some(function(qq) { return qq.num === q; }); });
    if (!dim) return;
    var question = dim.questions.find(function(qq) { return qq.num === q; });
    if (!question) return;
    if (question.type === 'radio') {
      var radio = document.querySelector('input[name="q-' + q + '"][value="' + examScores[q] + '"]');
      if (radio) radio.checked = true;
    } else if (question.type === 'score') {
      var btn = document.querySelector('.score-btn[data-q="' + q + '"][data-v="' + examScores[q] + '"]');
      if (btn) btn.classList.add('selected');
    }
  });
  Object.keys(examTextAnswers).forEach(function(q) {
    var input = document.getElementById('text-' + q);
    if (input) input.value = examTextAnswers[q];
  });
  updateAllDimScores();
}

function setRadioScore(qNum, value) {
  examScores[qNum] = value;
  updateAllDimScores();
  checkSubmitReady();
}
function updateTextAnswer(qNum) {
  var input = document.getElementById('text-' + qNum);
  examTextAnswers[qNum] = input.value;
}
function setScore(qNum, value) {
  examScores[qNum] = value;
  var container = document.getElementById('score-' + qNum);
  container.querySelectorAll('.score-btn').forEach(function(b) { b.classList.remove('selected'); });
  var btn = container.querySelector('.score-btn[data-v="' + value + '"]');
  if (btn) btn.classList.add('selected');
  updateAllDimScores();
  checkSubmitReady();
}

function updateAllDimScores() {
  DIAGNOSIS_DATA.forEach(function(dim) {
    var subtotal = 0, answered = 0, required = 0;
    dim.questions.forEach(function(q) {
      if (q.type === 'text') return;
      required++;
      if (examScores[q.num] !== undefined) { subtotal += examScores[q.num]; answered++; }
    });
    var el1 = document.getElementById('dim-score-' + dim.id);
    var el2 = document.getElementById('dim-subtotal-' + dim.id);
    if (el1) el1.textContent = subtotal + ' / ' + dim.maxScore;
    if (el2) el2.textContent = subtotal + ' / ' + dim.maxScore;
    var card = document.getElementById('dim-' + dim.id);
    if (card) {
      card.classList.remove('incomplete', 'complete');
      if (answered >= required) {
        card.classList.add('complete');
        if (el1) el1.classList.add('done');
      } else {
        card.classList.add('incomplete');
        if (el1) el1.classList.remove('done');
      }
    }
  });
}

function checkSubmitReady() {
  var total = 0, answered = 0;
  DIAGNOSIS_DATA.forEach(function(dim) {
    dim.questions.forEach(function(q) {
      if (q.type === 'text') return;
      total++;
      if (examScores[q.num] !== undefined) answered++;
    });
  });
  var btn = document.getElementById('btn-submit');
  if (!btn) return;
  btn.disabled = answered < total;
  btn.textContent = answered >= total ? '查看体检报告' : '查看体检报告（已答 ' + answered + '/' + total + '）';
}

// --- Submit & Report ---
function submitDiagnosis() {
  var total = 0, answered = 0;
  DIAGNOSIS_DATA.forEach(function(dim) {
    dim.questions.forEach(function(q) {
      if (q.type === 'text') return;
      total++;
      if (examScores[q.num] !== undefined) answered++;
    });
  });
  if (answered < total) return toast('请完成全部必答题');

  var dimScores = {};
  DIAGNOSIS_DATA.forEach(function(dim) {
    var s = 0;
    dim.questions.forEach(function(q) {
      if (q.type === 'text') return;
      s += (examScores[q.num] || 0);
    });
    dimScores[dim.id] = s;
  });

  var totalScore = 0;
  Object.keys(dimScores).forEach(function(k) { totalScore += dimScores[k]; });
  var healthGrade = getHealthGrade(totalScore);

  var sorted = DIAGNOSIS_DATA.map(function(d) {
    return { id: d.id, title: d.title, maxScore: d.maxScore, score: dimScores[d.id], pct: dimScores[d.id] / d.maxScore };
  }).sort(function(a, b) { return a.pct - b.pct; });

  var weakest = sorted[0];
  var strongest = sorted[sorted.length - 1];
  var weakList = sorted.slice(0, 2).map(function(d) { return DIM_TO_FEISHU[d.id]; }).join('、');
  var coreFindings = DIM_TO_FEISHU[strongest.id] + '表现较好；待改善：' + weakList;
  var recommendedProduct = getRecommendedProduct(weakest.id);

  // Save client (async)
  var client = null;
  if (currentClientId) client = getClientById(currentClientId);

  var doSaveExam = function(savedClient) {
    var exam = {
      clientId: savedClient.id,
      clientName: savedClient.name,
      examDate: formatDate(new Date()),
      dimScores: dimScores,
      totalScore: totalScore,
      healthGrade: healthGrade,
      coreFindings: coreFindings,
      recommendedProduct: recommendedProduct,
      scores: Object.assign({}, examScores),
      textAnswers: Object.assign({}, examTextAnswers),
      examiner: currentUser ? currentUser.name : '',
    };

    saveExam(exam).then(function(savedExam) {
      if (savedExam) {
        window._lastExamId = savedExam.id;
        window._lastClientId = savedClient.id;
        setExamStep(3);
      } else {
        // 即使保存失败也展示报告（数据在本地缓存中）
        window._lastExamId = exam.id;
        window._lastClientId = savedClient.id;
        setExamStep(3);
      }
    });
  };

  if (!client) {
    client = {
      name: examClientData.name,
      industry: examClientData.industry,
      stores: examClientData.stores,
      location: examClientData.location,
      age: examClientData.age,
      revenue: examClientData.revenue,
      contact: examClientData.contact,
      phone: examClientData.phone,
      purpose: examClientData.purpose,
      communities: examClientData.communities,
      elevators: examClientData.elevators,
      doors: examClientData.doors,
      level: '',
      address: examClientData.location,
      salesPerson: currentUser ? currentUser.name : '',
      salesManager: '',
      status: '意向中',
      source: examClientData.purpose === '初次认识' ? '陌拜' : '其他',
      remark: '',
    };
    saveClient(client).then(function(savedClient) {
      if (savedClient) {
        currentClientId = savedClient.id;
        doSaveExam(savedClient);
      } else {
        toast('客户保存失败，请检查网络');
      }
    });
  } else {
    client.industry = examClientData.industry || client.industry;
    client.stores = examClientData.stores || client.stores;
    client.location = examClientData.location || client.location;
    client.contact = examClientData.contact || client.contact;
    client.phone = examClientData.phone || client.phone;
    client.communities = examClientData.communities || client.communities;
    client.elevators = examClientData.elevators || client.elevators;
    client.doors = examClientData.doors || client.doors;
    saveClient(client).then(function(savedClient) {
      doSaveExam(savedClient || client);
    });
  }
}

function generateReport() {
  var dimScores = {};
  var totalScore = 0;
  DIAGNOSIS_DATA.forEach(function(dim) {
    var s = 0;
    dim.questions.forEach(function(q) {
      if (q.type === 'text') return;
      s += (examScores[q.num] || 0);
    });
    dimScores[dim.id] = s;
    totalScore += s;
  });

  var maxTotal = 100;
  var healthGrade = getHealthGrade(totalScore);
  var gradeClass;
  if (totalScore >= 80) gradeClass = 'grade-healthy';
  else if (totalScore >= 60) gradeClass = 'grade-subhealth';
  else if (totalScore >= 40) gradeClass = 'grade-sick';
  else gradeClass = 'grade-severe';

  var sorted = DIAGNOSIS_DATA.map(function(d) {
    var score = dimScores[d.id];
    var pct = d.maxScore > 0 ? score / d.maxScore : 0;
    var rating;
    if (pct >= 0.84) rating = 'excellent';
    else if (pct >= 0.64) rating = 'good';
    else if (pct >= 0.44) rating = 'average';
    else rating = 'poor';
    return { id: d.id, title: d.title, maxScore: d.maxScore, score: score, pct: pct, rating: rating };
  }).sort(function(a, b) { return a.pct - b.pct; });

  var weakest = sorted[0];
  var strongest = sorted[sorted.length - 1];
  var advices = generateAdvice(sorted);

  var clientName = examClientData.name || '客户';
  var dateStr = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });

  var html = '';
  html += '<div class="result-header">';
  html += '<span class="result-grade ' + gradeClass + '">' + healthGrade + '</span>';
  html += '<div class="result-total-score">' + totalScore + '</div>';
  html += '<div class="result-total-label">营销健康度总分（满分' + maxTotal + '）</div>';
  html += '<div class="client-summary" style="margin-top:10px;">';
  html += '<strong>' + clientName + '</strong> ';
  if (examClientData.industry) html += '<span class="tag">' + examClientData.industry + '</span> ';
  if (examClientData.stores) html += '<span class="tag">' + examClientData.stores + '</span>';
  html += '<br>体检日期：' + dateStr + ' ｜ 体检人：' + (currentUser ? currentUser.name : '--');
  html += '</div></div>';

  html += '<div class="result-section"><h3>五维健康雷达</h3>';
  sorted.forEach(function(d) {
    var pct = Math.round(d.pct * 100);
    html += '<div class="dim-bar-row">';
    html += '<span class="dim-bar-label">' + d.title.replace('维度','维') + '</span>';
    html += '<div class="dim-bar-track"><div class="dim-bar-fill ' + d.rating + '" style="width:' + pct + '%"></div></div>';
    html += '<span class="dim-bar-score">' + d.score + '/' + d.maxScore + '</span>';
    html += '</div>';
  });
  html += '</div>';

  html += '<div class="result-section"><h3>核心发现</h3>';
  html += '<p style="font-size:14px;color:var(--gray-700);line-height:1.7;">';
  html += '<strong>最短板：</strong>' + weakest.title + '（' + weakest.score + '/' + weakest.maxScore + '分，仅' + Math.round(weakest.pct*100) + '%）<br>';
  html += '<strong>最长板：</strong>' + strongest.title + '（' + strongest.score + '/' + strongest.maxScore + '分，' + Math.round(strongest.pct*100) + '%）<br>';
  html += '<strong>诊断结论：</strong>' + getDiagnosisConclusion(healthGrade, weakest, strongest);
  html += '</p></div>';

  html += '<div class="result-section"><h3>立即执行建议</h3>';
  advices.forEach(function(a, i) {
    var cls = a.urgency === 'high' ? 'urgent' : a.urgency === 'low' ? 'good' : '';
    html += '<div class="advice-card ' + cls + '">';
    html += '<div style="display:flex;align-items:flex-start;gap:8px;">';
    html += '<span class="advice-num">' + (i+1) + '</span>';
    html += '<div><div class="advice-title">' + a.title + '</div>';
    html += '<div class="advice-desc">' + a.desc + '</div></div>';
    html += '</div></div>';
  });
  html += '</div>';

  html += '<div class="result-section export-section">';
  html += '<h3>飞书数据导出</h3>';
  html += '<p style="font-size:12px;color:#9ca3af;margin-bottom:12px;">数据已自动上传云端，也可导出CSV导入飞书</p>';
  html += '<button class="btn-primary btn-block" style="margin-bottom:10px;" onclick="exportCurrentExam()">导出体检结果CSV</button>';
  html += '<button class="btn-outline btn-block" style="margin-bottom:10px;" onclick="exportCurrentClient()">导出客户资料CSV</button>';
  html += '<button class="btn-outline btn-block" onclick="showAddFollowupModal()">立即添加跟进记录</button>';
  html += '</div>';

  html += '<div class="result-section"><h3>客户档案摘要</h3>';
  html += '<div class="client-summary" style="line-height:2;">';
  if (examClientData.industry) html += '<div>行业：<span class="tag">' + examClientData.industry + '</span></div>';
  if (examClientData.stores) html += '<div>规模：<span class="tag">' + examClientData.stores + '</span></div>';
  if (examClientData.location) html += '<div>位置：' + examClientData.location + '</div>';
  if (examClientData.contact) html += '<div>负责人：' + examClientData.contact + '</div>';
  if (examClientData.phone) html += '<div>联系：' + examClientData.phone + '</div>';
  if (examClientData.communities) html += '<div>西诺资源：周边' + examClientData.communities + '个小区 / ' + examClientData.elevators + '块电梯 / ' + examClientData.doors + '个门禁</div>';
  html += '</div></div>';

  html += '<div style="text-align:center;padding:16px;color:#9ca3af;font-size:12px;">';
  html += '西诺科技 · 营销健康体检系统<br>';
  html += '报告生成时间：' + new Date().toLocaleString('zh-CN');
  html += '</div>';

  document.getElementById('result-content').innerHTML = html;
}

function generateAdvice(sortedDims) {
  var templates = {
    1: [
      { title: '在周边3公里投放电梯广告', desc: '西诺覆盖柳州5大城区114个小区，日触达50万+居民。电梯广告是确定性最高的本地曝光方式。', urgency: 'high' },
      { title: '优化门头视觉吸引力', desc: '确保门头在30米外就能看清卖什么。用大字+亮色+品类关键词。', urgency: 'high' },
      { title: '跟周边商家做联合推广', desc: '找3-5家互补商家，互相放宣传物料。零成本获客。', urgency: 'medium' },
    ],
    2: [
      { title: '花200元请设计师优化LOGO', desc: '从淘宝/猪八戒找设计师，花200-500元做一个简洁专业的LOGO。', urgency: 'high' },
      { title: '统一所有门店物料', desc: '把门头、菜单、海报、名片全部换成统一配色和字体。', urgency: 'medium' },
      { title: '写一句话品牌介绍', desc: '用一句话介绍我们，贴在店里、放在朋友圈封面。', urgency: 'medium' },
    ],
    3: [
      { title: '做一个"首次体验价"活动', desc: '选一款引流产品做首次体验价，让新客先进门。', urgency: 'high' },
      { title: '利用节假日做主题促销', desc: '提前2周策划一个主题活动，一个海报+一个套餐即可。', urgency: 'medium' },
      { title: '建立活动效果追踪表', desc: '每次活动后记录：投入多少、来了多少新客、转化了多少复购。', urgency: 'medium' },
    ],
    4: [
      { title: '每天发1条抖音/朋友圈', desc: '手机拍摄即可，内容：店里场景、客户好评、新品预告。每天一条。', urgency: 'high' },
      { title: '开通大众点评/美团店铺', desc: '即使不投放，至少完善基础信息：营业时间、地址、电话、菜单。', urgency: 'high' },
      { title: '把老客户加到微信', desc: '每单消费结束时邀请加微信，慢慢建500人老客群。', urgency: 'medium' },
    ],
    5: [
      { title: '建立"到店即加微信"流程', desc: '培训员工：每个到店客人在结账时主动邀请加微信。目标加微率>60%。', urgency: 'high' },
      { title: '设置老客推荐奖励', desc: '让老客户带新客户来。老客是最便宜的获客渠道。', urgency: 'high' },
      { title: '每周发一次客户关怀消息', desc: '不是广告——就是简单问候或实用信息。让客户觉得你一直在。', urgency: 'medium' },
    ],
  };

  var advices = [];
  var used = {};
  var weakest = sortedDims[0];
  var secondWeakest = sortedDims[1];

  if (templates[weakest.id]) {
    advices.push(templates[weakest.id][0]);
    used[templates[weakest.id][0].title] = true;
  }
  if (secondWeakest && templates[secondWeakest.id] && advices.length < 3) {
    for (var i = 0; i < templates[secondWeakest.id].length; i++) {
      var pick = templates[secondWeakest.id][i];
      if (!used[pick.title]) { advices.push(pick); used[pick.title] = true; break; }
    }
  }
  if (advices.length < 3) {
    for (var j = 0; j < sortedDims.length; j++) {
      if (advices.length >= 3) break;
      var ts = templates[sortedDims[j].id];
      if (!ts) continue;
      for (var k = 0; k < ts.length; k++) {
        if (!used[ts[k].title]) { advices.push(ts[k]); used[ts[k].title] = true; break; }
      }
    }
  }
  return advices.slice(0, 3);
}

function getDiagnosisConclusion(grade, weakest, strongest) {
  if (grade === '健康') return '客户营销基础扎实，' + strongest.title + '表现突出。保持优势、补齐' + weakest.title + '短板即可。';
  if (grade === '亚健康') return '整体有一定基础但存在明显短板——' + weakest.title + '是拖后腿的关键。优先解决可在短期内显著提升。';
  if (grade === '生病') return '营销体系薄弱，多个维度需要系统建设。建议从' + weakest.title + '切入。';
  return '营销几乎从零开始，但提升空间巨大。建议从' + weakest.title + '做第一个突破口。';
}

// --- Export from exam ---
function exportCurrentExam() {
  var examId = window._lastExamId;
  if (!examId) return toast('未找到体检记录');
  var exam = getExams().find(function(e) { return e.id === examId; });
  if (!exam) return toast('未找到体检记录');
  var csv = generateExamsCSV([exam]);
  downloadCSV('体检结果_' + (exam.clientName || exam.client_name || '') + '_' + formatDate(new Date()) + '.csv', csv);
  toast('体检结果CSV已导出');
}

function exportCurrentClient() {
  var clientId = window._lastClientId;
  if (!clientId) return toast('未找到客户信息');
  var client = getClientById(clientId);
  if (!client) return toast('未找到客户信息');
  var csv = generateClientsCSV([client]);
  downloadCSV('客户资料_' + (client.name || '') + '_' + formatDate(new Date()) + '.csv', csv);
  toast('客户资料CSV已导出');
}

// ================================================================
// CLIENT MANAGEMENT
// ================================================================
function renderClientList() {
  var clients = getClients();
  var container = document.getElementById('client-list');
  if (clients.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无客户</p><p style="font-size:13px;color:#9ca3af;">点击右上角"新增客户"或从体检流程添加</p></div>';
    return;
  }
  var html = '';
  clients.forEach(function(c) {
    var statusClass = 'status-' + (c.status || '意向中');
    html += '<div class="list-card" onclick="showClientDetail(\'' + c.id + '\')">';
    html += '<div class="list-card-header">';
    html += '<span class="list-card-title">' + (c.name || '--') + '</span>';
    html += '<span class="list-card-tag ' + statusClass + '">' + (c.status || '意向中') + '</span>';
    html += '</div>';
    html += '<div class="list-card-body">';
    if (c.industry) html += '<span class="tag">' + c.industry + '</span>';
    if (c.level) html += '<span class="tag">等级' + c.level + '</span>';
    if (c.contact) html += '<span class="tag">' + c.contact + '</span>';
    var sp = c.salesPerson || c.sales_person || '';
    if (sp && isManagementRole()) html += '<span class="tag">' + sp + '</span>';
    html += '</div></div>';
  });
  container.innerHTML = html;
}

function showClientDetail(id) {
  var client = getClientById(id);
  if (!client) return;
  var exams = getExamsByClient(id);
  var followups = getFollowupsByClient(id);

  var html = '<div class="detail-header">';
  html += '<button class="btn-back" onclick="switchTab(\'clients\')">← 返回</button>';
  html += '<h2>' + (client.name || '') + '</h2>';
  html += '<div class="detail-tags">';
  if (client.industry) html += '<span class="tag">' + client.industry + '</span>';
  if (client.level) html += '<span class="tag">等级' + client.level + '</span>';
  if (client.status) html += '<span class="tag">' + client.status + '</span>';
  html += '</div></div>';

  html += '<div class="result-section">';
  html += '<h3>基本信息</h3>';
  html += '<div class="info-grid">';
  if (client.contact) html += '<div class="info-item"><span class="info-label">联系人</span><span class="info-value">' + client.contact + '</span></div>';
  if (client.phone) html += '<div class="info-item"><span class="info-label">联系方式</span><span class="info-value">' + client.phone + '</span></div>';
  if (client.location || client.address) html += '<div class="info-item"><span class="info-label">门店地址</span><span class="info-value">' + (client.location || client.address) + '</span></div>';
  if (client.stores) html += '<div class="info-item"><span class="info-label">门店规模</span><span class="info-value">' + client.stores + '</span></div>';
  if (client.revenue) html += '<div class="info-item"><span class="info-label">年营收</span><span class="info-value">' + client.revenue + '</span></div>';
  if (client.source) html += '<div class="info-item"><span class="info-label">客户来源</span><span class="info-value">' + client.source + '</span></div>';
  var sp = client.salesPerson || client.sales_person || '';
  if (sp) html += '<div class="info-item"><span class="info-label">对接销售</span><span class="info-value">' + sp + '</span></div>';
  if (client.communities) html += '<div class="info-item"><span class="info-label">西诺资源</span><span class="info-value">' + client.communities + '小区/' + client.elevators + '电梯/' + client.doors + '门禁</span></div>';
  html += '</div>';
  if (client.remark) html += '<div style="margin-top:10px;font-size:13px;color:#6b7280;">备注：' + client.remark + '</div>';
  html += '</div>';

  // Exams
  html += '<div class="result-section">';
  html += '<h3>体检记录（' + exams.length + '）</h3>';
  if (exams.length === 0) {
    html += '<p style="font-size:13px;color:#9ca3af;">暂无体检记录</p>';
  } else {
    exams.forEach(function(e) {
      html += '<div class="exam-record-item" onclick="showExamResult(\'' + e.id + '\')">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
      html += '<span style="font-size:14px;font-weight:600;">' + (e.examDate || e.exam_date || '') + '</span>';
      html += '<span class="score-badge">' + (e.totalScore || e.total_score || 0) + '分 / ' + (e.healthGrade || e.health_grade || '') + '</span>';
      html += '</div>';
      html += '<div style="font-size:12px;color:#9ca3af;margin-top:4px;">' + (e.coreFindings || e.core_findings || '') + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Followups
  html += '<div class="result-section">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<h3 style="margin:0;">跟进记录（' + followups.length + '）</h3>';
  html += '<button class="btn-primary btn-small" onclick="showAddFollowupModal(\'' + client.id + '\')">+ 新增</button>';
  html += '</div>';
  if (followups.length === 0) {
    html += '<p style="font-size:13px;color:#9ca3af;">暂无跟进记录</p>';
  } else {
    followups.forEach(function(f) {
      var fDate = f.followDate || f.follow_date || '';
      var fMethod = f.method || '';
      var fResult = f.result || '';
      var fDetail = f.detail || '';
      var fNextDate = f.nextDate || f.next_date || '';
      var resultClass = (fResult === '卡住' || fResult === '需支持') ? 'tag-red' : (fResult === '有进展' ? 'tag-green' : 'tag-blue');
      html += '<div class="followup-item">';
      html += '<div style="display:flex;justify-content:space-between;">';
      html += '<span style="font-size:13px;font-weight:600;">' + fDate + ' · ' + fMethod + '</span>';
      html += '<span class="tag ' + resultClass + '">' + fResult + '</span>';
      html += '</div>';
      html += '<div style="font-size:13px;color:#6b7280;margin-top:4px;">' + fDetail + '</div>';
      if (fNextDate) html += '<div style="font-size:12px;color:#F39C12;margin-top:4px;">下次跟进：' + fNextDate + '</div>';
      html += '</div>';
    });
  }
  html += '</div>';

  // Actions
  html += '<div style="padding:12px 0;">';
  html += '<button class="btn-outline btn-block" style="margin-bottom:10px;" onclick="exportSingleClient(\'' + client.id + '\')">导出客户资料CSV</button>';
  html += '<button class="btn-outline btn-block" style="margin-bottom:10px;" onclick="exportClientExams(\'' + client.id + '\')">导出该客户体检CSV</button>';
  html += '<button class="btn-outline btn-block" style="margin-bottom:10px;" onclick="exportClientFollowups(\'' + client.id + '\')">导出该客户跟进CSV</button>';
  html += '<button class="btn-danger btn-block" onclick="deleteClientConfirm(\'' + client.id + '\')">删除客户</button>';
  html += '</div>';

  document.getElementById('client-detail-content').innerHTML = html;
  showScreen('client-detail');
}

function showExamResult(examId) {
  var exam = getExams().find(function(e) { return e.id === examId; });
  if (!exam) return;
  examScores = exam.scores ? (typeof exam.scores === 'string' ? JSON.parse(exam.scores) : exam.scores) : {};
  examTextAnswers = exam.textAnswers ? (typeof exam.textAnswers === 'string' ? JSON.parse(exam.textAnswers) : exam.textAnswers) : {};
  examClientData = { name: exam.clientName || exam.client_name || '' };
  window._lastExamId = exam.id;
  var client = getClientById(exam.clientId || exam.client_id);
  window._lastClientId = client ? client.id : null;
  if (client) {
    examClientData.industry = client.industry;
    examClientData.stores = client.stores;
    examClientData.location = client.location;
    examClientData.contact = client.contact;
    examClientData.phone = client.phone;
    examClientData.communities = client.communities;
    examClientData.elevators = client.elevators;
    examClientData.doors = client.doors;
  }
  showScreen('exam');
  setExamStep(3);
}

function showAddClientModal() {
  var html =
    '<div class="modal-content">' +
    '<h3 style="margin-bottom:16px;">新增客户</h3>' +
    '<div class="form-row"><label>客户名称 <span class="required">*</span></label><input type="text" id="nc-name" placeholder="如：XX餐饮公司"></div>' +
    '<div class="form-row"><label>所属行业</label><div class="chip-group" id="nc-industry"></div></div>' +
    '<div class="form-row"><label>客户等级</label><div class="chip-group" id="nc-level"></div></div>' +
    '<div class="form-row"><label>联系人</label><input type="text" id="nc-contact" placeholder="如：王总"></div>' +
    '<div class="form-row"><label>联系方式</label><input type="tel" id="nc-phone" placeholder="手机号"></div>' +
    '<div class="form-row"><label>门店地址</label><input type="text" id="nc-address" placeholder="详细地址"></div>' +
    '<div class="form-row"><label>客户来源</label><div class="chip-group" id="nc-source"></div></div>' +
    '<div class="form-row"><label>年营收规模</label><div class="chip-group" id="nc-revenue"></div></div>' +
    '<div class="form-row"><label>备注</label><input type="text" id="nc-remark" placeholder="选填"></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;">' +
    '<button class="btn-outline" style="flex:1;" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" style="flex:1;" onclick="submitNewClient()">保存</button>' +
    '</div></div>';
  showModal(html);
  renderChips('nc-industry', 'industry');
  renderChips('nc-level', 'level');
  renderChips('nc-source', 'source');
  renderChips('nc-revenue', 'revenue');
}

function submitNewClient() {
  var name = document.getElementById('nc-name').value.trim();
  if (!name) return toast('请填写客户名称');
  var client = {
    name: name,
    industry: getChipSelected('nc-industry'),
    level: getChipSelected('nc-level'),
    contact: document.getElementById('nc-contact').value.trim(),
    phone: document.getElementById('nc-phone').value.trim(),
    address: document.getElementById('nc-address').value.trim(),
    source: getChipSelected('nc-source'),
    revenue: getChipSelected('nc-revenue'),
    remark: document.getElementById('nc-remark').value.trim(),
    salesPerson: currentUser ? currentUser.name : '',
    salesManager: '',
    status: '意向中',
  };
  saveClient(client).then(function(saved) {
    if (saved) {
      closeModal();
      renderClientList();
      toast('客户已添加');
    }
  });
}

function deleteClientConfirm(id) {
  if (!confirm('确定删除该客户？相关体检和跟进记录也会被删除。')) return;
  deleteClient(id).then(function() {
    toast('客户已删除');
    switchTab('clients');
  });
}

// ================================================================
// FOLLOWUP MANAGEMENT
// ================================================================
function renderFollowupList() {
  var followups = getFollowups().sort(function(a, b) {
    var da = a.followDate || a.follow_date || '';
    var db = b.followDate || b.follow_date || '';
    return db.localeCompare(da);
  });
  var container = document.getElementById('followup-list');
  if (followups.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>暂无跟进记录</p><p style="font-size:13px;color:#9ca3af;">点击右上角"新增跟进"添加</p></div>';
    return;
  }
  var html = '';
  followups.forEach(function(f) {
    var fDate = f.followDate || f.follow_date || '';
    var fMethod = f.method || '';
    var fResult = f.result || '';
    var fDetail = f.detail || '';
    var fNextDate = f.nextDate || f.next_date || '';
    var fClientName = f.clientName || f.client_name || '';
    var resultClass = (fResult === '卡住' || fResult === '需支持') ? 'tag-red' : (fResult === '有进展' ? 'tag-green' : 'tag-blue');
    html += '<div class="list-card">';
    html += '<div class="list-card-header">';
    html += '<span class="list-card-title">' + (fClientName || '--') + '</span>';
    html += '<span class="tag ' + resultClass + '">' + fResult + '</span>';
    html += '</div>';
    html += '<div class="list-card-body">';
    html += '<span class="tag">' + fDate + '</span>';
    html += '<span class="tag">' + fMethod + '</span>';
    html += '</div>';
    if (fDetail) html += '<div style="font-size:13px;color:#6b7280;margin-top:6px;">' + fDetail + '</div>';
    if (fNextDate) html += '<div style="font-size:12px;color:#F39C12;margin-top:4px;">下次跟进：' + fNextDate + '</div>';
    html += '</div>';
  });
  container.innerHTML = html;
}

function showAddFollowupModal(presetClientId) {
  var clients = getClients();
  if (clients.length === 0) return toast('请先添加客户');

  var clientOptions = '<option value="">请选择客户</option>';
  clients.forEach(function(c) {
    var sel = presetClientId && presetClientId === c.id ? 'selected' : '';
    clientOptions += '<option value="' + c.id + '" ' + sel + '>' + (c.name || '') + '</option>';
  });

  var today = formatDate(new Date());
  var html =
    '<div class="modal-content">' +
    '<h3 style="margin-bottom:16px;">新增跟进记录</h3>' +
    '<div class="form-row"><label>关联客户 <span class="required">*</span></label><select id="nf-client" class="select-input">' + clientOptions + '</select></div>' +
    '<div class="form-row"><label>跟进日期</label><input type="date" id="nf-date" value="' + today + '"></div>' +
    '<div class="form-row"><label>跟进方式</label><div class="chip-group" id="nf-method"></div></div>' +
    '<div class="form-row"><label>沟通详情</label><textarea id="nf-detail" class="textarea-input" rows="3" placeholder="沟通内容摘要..."></textarea></div>' +
    '<div class="form-row"><label>跟进结果</label><div class="chip-group" id="nf-result"></div></div>' +
    '<div class="form-row"><label>下一步动作</label><input type="text" id="nf-next-action" placeholder="如：发送报价方案"></div>' +
    '<div class="form-row"><label>下次跟进日期</label><input type="date" id="nf-next-date"></div>' +
    '<div class="form-row"><label>是否需要帮助</label><input type="text" id="nf-help" placeholder="选填"></div>' +
    '<div style="display:flex;gap:10px;margin-top:16px;">' +
    '<button class="btn-outline" style="flex:1;" onclick="closeModal()">取消</button>' +
    '<button class="btn-primary" style="flex:1;" onclick="submitNewFollowup()">保存</button>' +
    '</div></div>';
  showModal(html);
  renderChips('nf-method', 'method');
  renderChips('nf-result', 'result');
}

function submitNewFollowup() {
  var clientId = document.getElementById('nf-client').value;
  if (!clientId) return toast('请选择客户');
  var client = getClientById(clientId);
  var fu = {
    clientId: clientId,
    clientName: client ? client.name : '',
    followDate: document.getElementById('nf-date').value,
    method: getChipSelected('nf-method'),
    detail: document.getElementById('nf-detail').value.trim(),
    result: getChipSelected('nf-result'),
    nextAction: document.getElementById('nf-next-action').value.trim(),
    nextDate: document.getElementById('nf-next-date').value,
    needHelp: document.getElementById('nf-help').value.trim(),
  };
  saveFollowup(fu).then(function(saved) {
    if (saved) {
      closeModal();
      var activeScreen = document.querySelector('.screen.active');
      if (activeScreen && activeScreen.id === 'screen-client-detail') {
        showClientDetail(clientId);
      } else {
        renderFollowupList();
      }
      toast('跟进记录已添加');
    }
  });
}

// ================================================================
// EXPORT CENTER
// ================================================================
function renderExportCenter() {
  var clients = getClients();
  var exams = getExams();
  var followups = getFollowups();

  var html = '';

  // Exams export
  html += '<div class="export-card">';
  html += '<div class="export-card-header"><h3>体检结果导出</h3><span class="export-count">' + exams.length + ' 条</span></div>';
  html += '<p class="export-desc">导出格式匹配飞书「08-体检结果表」，含5维度得分、评级、核心发现等</p>';
  if (exams.length > 0) {
    html += '<div class="export-list">';
    exams.forEach(function(e) {
      var cn = e.clientName || e.client_name || '';
      var ed = e.examDate || e.exam_date || '';
      var ts = e.totalScore || e.total_score || 0;
      html += '<label class="export-item"><input type="checkbox" value="' + e.id + '" class="cb-exam" checked><span>' + cn + ' - ' + ed + ' (' + ts + '分)</span></label>';
    });
    html += '</div>';
    html += '<div class="export-actions">';
    html += '<button class="btn-outline btn-small" onclick="toggleAll(\'cb-exam\')">全选/反选</button>';
    html += '<button class="btn-primary btn-small" onclick="exportSelectedExams()">导出选中</button>';
    html += '<button class="btn-outline btn-small" onclick="exportAllExams()">导出全部</button>';
    html += '</div>';
  } else {
    html += '<p style="font-size:13px;color:#9ca3af;padding:8px 0;">暂无体检记录</p>';
  }
  html += '</div>';

  // Clients export
  html += '<div class="export-card">';
  html += '<div class="export-card-header"><h3>客户资料导出</h3><span class="export-count">' + clients.length + ' 条</span></div>';
  html += '<p class="export-desc">导出格式匹配飞书「01-客户资料库」，含客户名称、行业、等级、联系方式等</p>';
  if (clients.length > 0) {
    html += '<div class="export-list">';
    clients.forEach(function(c) {
      html += '<label class="export-item"><input type="checkbox" value="' + c.id + '" class="cb-client" checked><span>' + (c.name || '') + ' (' + (c.industry || '未分类') + ')</span></label>';
    });
    html += '</div>';
    html += '<div class="export-actions">';
    html += '<button class="btn-outline btn-small" onclick="toggleAll(\'cb-client\')">全选/反选</button>';
    html += '<button class="btn-primary btn-small" onclick="exportSelectedClients()">导出选中</button>';
    html += '<button class="btn-outline btn-small" onclick="exportAllClients()">导出全部</button>';
    html += '</div>';
  } else {
    html += '<p style="font-size:13px;color:#9ca3af;padding:8px 0;">暂无客户</p>';
  }
  html += '</div>';

  // Followups export
  html += '<div class="export-card">';
  html += '<div class="export-card-header"><h3>跟进记录导出</h3><span class="export-count">' + followups.length + ' 条</span></div>';
  html += '<p class="export-desc">导出格式匹配飞书「02-跟进记录表」，含跟进日期、方式、结果等</p>';
  if (followups.length > 0) {
    html += '<div class="export-list">';
    followups.forEach(function(f) {
      var cn = f.clientName || f.client_name || '';
      var fd = f.followDate || f.follow_date || '';
      var fm = f.method || '';
      html += '<label class="export-item"><input type="checkbox" value="' + f.id + '" class="cb-followup" checked><span>' + cn + ' - ' + fd + ' (' + fm + ')</span></label>';
    });
    html += '</div>';
    html += '<div class="export-actions">';
    html += '<button class="btn-outline btn-small" onclick="toggleAll(\'cb-followup\')">全选/反选</button>';
    html += '<button class="btn-primary btn-small" onclick="exportSelectedFollowups()">导出选中</button>';
    html += '<button class="btn-outline btn-small" onclick="exportAllFollowups()">导出全部</button>';
    html += '</div>';
  } else {
    html += '<p style="font-size:13px;color:#9ca3af;padding:8px 0;">暂无跟进记录</p>';
  }
  html += '</div>';

  // Feishu guide
  html += '<div class="export-card feishu-guide">';
  html += '<h3 style="margin-bottom:10px;">数据已自动同步云端</h3>';
  html += '<p style="font-size:13px;color:#6b7280;line-height:1.8;">';
  html += '业务员录入的客户、体检、跟进数据已自动上传到云端数据库。<br>';
  html += '管理员和销售总监可实时查看全员数据，无需手动汇总。<br>';
  html += '如需导入飞书，点击上方导出按钮下载CSV即可。';
  html += '</p></div>';

  document.getElementById('export-content').innerHTML = html;
}

function toggleAll(className) {
  var checkboxes = document.querySelectorAll('.' + className);
  var allChecked = Array.from(checkboxes).every(function(cb) { return cb.checked; });
  checkboxes.forEach(function(cb) { cb.checked = !allChecked; });
}

function exportSelectedExams() {
  var ids = Array.from(document.querySelectorAll('.cb-exam:checked')).map(function(cb) { return cb.value; });
  if (ids.length === 0) return toast('请选择要导出的记录');
  var exams = getExams().filter(function(e) { return ids.includes(e.id); });
  downloadCSV('体检结果_' + formatDate(new Date()) + '.csv', generateExamsCSV(exams));
  toast('已导出 ' + exams.length + ' 条体检结果');
}
function exportAllExams() {
  var exams = getExams();
  if (exams.length === 0) return toast('暂无体检记录');
  downloadCSV('体检结果_全部_' + formatDate(new Date()) + '.csv', generateExamsCSV(exams));
  toast('已导出全部 ' + exams.length + ' 条');
}
function exportSelectedClients() {
  var ids = Array.from(document.querySelectorAll('.cb-client:checked')).map(function(cb) { return cb.value; });
  if (ids.length === 0) return toast('请选择要导出的客户');
  var clients = getClients().filter(function(c) { return ids.includes(c.id); });
  downloadCSV('客户资料_' + formatDate(new Date()) + '.csv', generateClientsCSV(clients));
  toast('已导出 ' + clients.length + ' 条客户资料');
}
function exportAllClients() {
  var clients = getClients();
  if (clients.length === 0) return toast('暂无客户');
  downloadCSV('客户资料_全部_' + formatDate(new Date()) + '.csv', generateClientsCSV(clients));
  toast('已导出全部 ' + clients.length + ' 条');
}
function exportSelectedFollowups() {
  var ids = Array.from(document.querySelectorAll('.cb-followup:checked')).map(function(cb) { return cb.value; });
  if (ids.length === 0) return toast('请选择要导出的记录');
  var followups = getFollowups().filter(function(f) { return ids.includes(f.id); });
  downloadCSV('跟进记录_' + formatDate(new Date()) + '.csv', generateFollowupsCSV(followups));
  toast('已导出 ' + followups.length + ' 条跟进记录');
}
function exportAllFollowups() {
  var followups = getFollowups();
  if (followups.length === 0) return toast('暂无跟进记录');
  downloadCSV('跟进记录_全部_' + formatDate(new Date()) + '.csv', generateFollowupsCSV(followups));
  toast('已导出全部 ' + followups.length + ' 条');
}
function exportSingleClient(id) {
  var client = getClientById(id);
  if (!client) return;
  downloadCSV('客户资料_' + (client.name || '') + '.csv', generateClientsCSV([client]));
  toast('客户资料已导出');
}
function exportClientExams(id) {
  var exams = getExamsByClient(id);
  if (exams.length === 0) return toast('该客户暂无体检记录');
  var client = getClientById(id);
  downloadCSV('体检结果_' + (client ? client.name : '') + '.csv', generateExamsCSV(exams));
  toast('已导出 ' + exams.length + ' 条体检结果');
}
function exportClientFollowups(id) {
  var followups = getFollowupsByClient(id);
  if (followups.length === 0) return toast('该客户暂无跟进记录');
  var client = getClientById(id);
  downloadCSV('跟进记录_' + (client ? client.name : '') + '.csv', generateFollowupsCSV(followups));
  toast('已导出 ' + followups.length + ' 条跟进记录');
}

// ================================================================
// CHIPS
// ================================================================
function renderChips(containerId, key) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';
  var options = CHIP_OPTIONS[key];
  if (!options) return;
  options.forEach(function(opt) {
    var chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = opt;
    chip.dataset.value = opt;
    chip.addEventListener('click', function() { toggleChip(chip); });
    container.appendChild(chip);
  });
}

function toggleChip(chip) {
  var container = chip.parentElement;
  container.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('selected'); });
  chip.classList.add('selected');
}

function getChipSelected(containerId) {
  var selected = document.querySelector('#' + containerId + ' .chip.selected');
  return selected ? selected.dataset.value : '';
}

// ================================================================
// MODAL
// ================================================================
function showModal(html) {
  var overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'modal-overlay';
    overlay.className = 'modal-overlay';
    document.body.appendChild(overlay);
  }
  overlay.innerHTML = '<div class="modal-scroll">' + html + '</div>';
  overlay.style.display = 'flex';
}

function closeModal() {
  var overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.style.display = 'none';
}

// ================================================================
// UTILS
// ================================================================
function toast(msg) {
  var t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timeout);
  t._timeout = setTimeout(function() { t.classList.remove('show'); }, 2000);
}

function formatDate(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var d = String(date.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + d;
}

function resetClientForm() {
  var el = document.getElementById('f-name'); if (el) el.value = '';
  el = document.getElementById('f-location'); if (el) el.value = '';
  el = document.getElementById('f-contact'); if (el) el.value = '';
  el = document.getElementById('f-phone'); if (el) el.value = '';
  el = document.getElementById('f-communities'); if (el) el.value = '';
  el = document.getElementById('f-elevators'); if (el) el.value = '';
  el = document.getElementById('f-doors'); if (el) el.value = '';
  document.querySelectorAll('#page-client .chip').forEach(function(c) { c.classList.remove('selected'); });
}

function resetExamState() {
  examScores = {};
  examTextAnswers = {};
  examClientData = {};
  currentClientId = null;
}

// ================================================================
// INIT
// ================================================================
document.addEventListener('DOMContentLoaded', function() {
  var pwdInput = document.getElementById('login-password');
  if (pwdInput) {
    pwdInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });
  }

  renderChips('chips-industry', 'industry');
  renderChips('chips-stores', 'stores');
  renderChips('chips-age', 'age');
  renderChips('chips-revenue', 'revenue');
  renderChips('chips-purpose', 'purpose');

  if (autoLogin()) {
    // 重新加载云端数据
    if (isSupabaseConfigured()) {
      toast('正在加载数据...');
      loadAllData().then(function() {
        if (currentUser.role === 'admin') showScreen('admin');
        else showScreen('home');
      });
    } else {
      // 未配置Supabase，显示提示
      var hint = document.getElementById('login-hint-extra');
      if (hint) hint.style.display = 'block';
      showScreen('login');
    }
  } else {
    // 检查是否已配置
    if (!isSupabaseConfigured()) {
      var hint = document.getElementById('login-hint-extra');
      if (hint) hint.style.display = 'block';
    }
    showScreen('login');
  }
});
