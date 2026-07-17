-- ================================================================
-- 西诺销售管控系统 — Supabase 建表脚本
-- 在 Supabase Dashboard → SQL Editor 中执行此脚本
-- ================================================================

-- 1. 客户资料表
CREATE TABLE IF NOT EXISTS clients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry TEXT DEFAULT '',
  stores TEXT DEFAULT '',
  location TEXT DEFAULT '',
  age TEXT DEFAULT '',
  revenue TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  purpose TEXT DEFAULT '',
  communities TEXT DEFAULT '',
  elevators TEXT DEFAULT '',
  doors TEXT DEFAULT '',
  level TEXT DEFAULT '',
  address TEXT DEFAULT '',
  sales_person TEXT DEFAULT '',
  sales_manager TEXT DEFAULT '',
  status TEXT DEFAULT '意向中',
  source TEXT DEFAULT '',
  remark TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT ''
);

-- 2. 体检结果表
CREATE TABLE IF NOT EXISTS exams (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT DEFAULT '',
  exam_date TEXT DEFAULT '',
  dim_scores TEXT DEFAULT '{}',
  total_score INTEGER DEFAULT 0,
  health_grade TEXT DEFAULT '',
  core_findings TEXT DEFAULT '',
  recommended_product TEXT DEFAULT '',
  scores TEXT DEFAULT '{}',
  text_answers TEXT DEFAULT '{}',
  examiner TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT ''
);

-- 3. 跟进记录表
CREATE TABLE IF NOT EXISTS followups (
  id TEXT PRIMARY KEY,
  client_id TEXT,
  client_name TEXT DEFAULT '',
  follow_date TEXT DEFAULT '',
  method TEXT DEFAULT '',
  detail TEXT DEFAULT '',
  result TEXT DEFAULT '',
  next_action TEXT DEFAULT '',
  next_date TEXT DEFAULT '',
  need_help TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT ''
);

-- 4. 启用行级安全 (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE followups ENABLE ROW LEVEL SECURITY;

-- 5. 策略：anon角色可以读写所有表（前端控制数据可见性）
CREATE POLICY "anon_all_clients" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_exams" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_followups" ON followups FOR ALL USING (true) WITH CHECK (true);

-- 6. 创建索引（加速查询）
CREATE INDEX IF NOT EXISTS idx_clients_created_by ON clients(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_created_by ON exams(created_by);
CREATE INDEX IF NOT EXISTS idx_exams_client_id ON exams(client_id);
CREATE INDEX IF NOT EXISTS idx_followups_created_by ON followups(created_by);
CREATE INDEX IF NOT EXISTS idx_followups_client_id ON followups(client_id);
