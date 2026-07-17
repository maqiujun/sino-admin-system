/**
 * diagnosis-data.js
 * 西诺营销健康体检 - 5维度21题诊断题目数据
 *
 * 字段结构（与 app.js 对齐）：
 *   维度: { id, key, title, maxScore, desc, questions }
 *   题目: { num, text, type, maxScore, options, hint, placeholder }
 *   选项: { label, value }
 *
 * 维度 key 映射（与 csv-export.js 对齐）：
 *   1 -> exposure  (线下曝光, 25分)
 *   2 -> image     (品牌形象, 25分)
 *   3 -> activity  (活动促销, 20分)
 *   4 -> online    (线上运营, 20分)
 *   5 -> conversion(客户留存, 10分)
 */

var DIAGNOSIS_DATA = [
  // ========== 维度1：线下曝光（25分）==========
  {
    id: 1,
    key: 'exposure',
    title: '线下曝光',
    maxScore: 25,
    desc: '评估品牌在线下渠道的曝光覆盖和认知度',
    questions: [
      {
        num: '1-1',
        text: '社区广告投放情况',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无任何社区广告', value: 1 },
          { label: '偶尔投放传单', value: 2 },
          { label: '有电梯/门禁广告', value: 3 },
          { label: '多社区常态化投放', value: 4 },
          { label: '全域覆盖+精准投放', value: 5 },
        ],
      },
      {
        num: '1-2',
        text: '线上广告投放情况',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无线上广告', value: 1 },
          { label: '偶尔朋友圈推广', value: 2 },
          { label: '有投放信息流广告', value: 3 },
          { label: '多平台持续投放', value: 4 },
          { label: '精准定向+ROI优化', value: 5 },
        ],
      },
      {
        num: '1-3',
        text: '周边社区居民口碑认知度',
        type: 'score',
        maxScore: 5,
        hint: '1分=完全不了解，5分=家喻户晓',
      },
      {
        num: '1-4',
        text: '品牌在目标区域的知名度',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '几乎无人知晓', value: 1 },
          { label: '小范围有人知道', value: 2 },
          { label: '区域内有一定知名度', value: 3 },
          { label: '区域知名品牌', value: 4 },
          { label: '行业标杆品牌', value: 5 },
        ],
      },
      {
        num: '1-5',
        text: '与竞品相比的曝光优势',
        type: 'score',
        maxScore: 5,
        hint: '1分=远不如竞品，5分=明显领先竞品',
      },
    ],
  },

  // ========== 维度2：品牌形象（25分）==========
  {
    id: 2,
    key: 'image',
    title: '品牌形象',
    maxScore: 25,
    desc: '评估品牌视觉设计和整体形象的专业度',
    questions: [
      {
        num: '2-1',
        text: 'LOGO设计与专业度',
        type: 'score',
        maxScore: 5,
        hint: '1分=粗糙不专业，5分=精美有辨识度',
      },
      {
        num: '2-2',
        text: '门店品牌整体质感',
        type: 'score',
        maxScore: 5,
        hint: '1分=低端杂乱，5分=高端统一',
      },
      {
        num: '2-3',
        text: '物料视觉统一性',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '完全无统一规范', value: 1 },
          { label: '部分物料有设计', value: 2 },
          { label: '基本统一但执行不严', value: 3 },
          { label: '整体统一规范', value: 4 },
          { label: '完美VI体系执行', value: 5 },
        ],
      },
      {
        num: '2-4',
        text: '品牌形象老化程度',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '严重老化过时', value: 1 },
          { label: '略显陈旧', value: 2 },
          { label: '中规中矩', value: 3 },
          { label: '较为时尚现代', value: 4 },
          { label: '引领潮流前卫', value: 5 },
        ],
      },
      {
        num: '2-5',
        text: '品牌VI视觉辨识度',
        type: 'score',
        maxScore: 5,
        hint: '1分=毫无辨识度，5分=一眼可辨',
      },
    ],
  },

  // ========== 维度3：活动促销（20分）==========
  {
    id: 3,
    key: 'activity',
    title: '活动促销',
    maxScore: 20,
    desc: '评估促销活动频率、节日策划和会员运营能力',
    questions: [
      {
        num: '3-1',
        text: '促销活动频率',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '几乎无促销活动', value: 1 },
          { label: '偶尔节假日促销', value: 2 },
          { label: '每月有固定促销', value: 3 },
          { label: '双周节奏促销', value: 4 },
          { label: '常态化多元促销', value: 5 },
        ],
      },
      {
        num: '3-2',
        text: '节日主题活动策划',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无节日活动', value: 1 },
          { label: '简单应景装饰', value: 2 },
          { label: '有主题促销方案', value: 3 },
          { label: '多渠道联动活动', value: 4 },
          { label: '创意引爆型活动', value: 5 },
        ],
      },
      {
        num: '3-3',
        text: '会员体系建设',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无会员体系', value: 1 },
          { label: '简单积分制', value: 2 },
          { label: '有会员等级权益', value: 3 },
          { label: '精细化会员运营', value: 4 },
          { label: '全生命周期会员管理', value: 5 },
        ],
      },
      {
        num: '3-4',
        text: '新客吸引能力',
        type: 'score',
        maxScore: 5,
        hint: '1分=几乎无新客，5分=新客持续涌入',
      },
    ],
  },

  // ========== 维度4：线上运营（20分）==========
  {
    id: 4,
    key: 'online',
    title: '线上运营',
    maxScore: 20,
    desc: '评估线上内容运营、互动和电商渠道建设',
    questions: [
      {
        num: '4-1',
        text: '线上内容更新频率',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '长期不更新', value: 1 },
          { label: '月更或更少', value: 2 },
          { label: '周更1-2次', value: 3 },
          { label: '隔日更新', value: 4 },
          { label: '每日高频更新', value: 5 },
        ],
      },
      {
        num: '4-2',
        text: '线上内容质量',
        type: 'score',
        maxScore: 5,
        hint: '1分=粗糙随意，5分=专业精美',
      },
      {
        num: '4-3',
        text: '线上互动与粉丝活跃度',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无互动', value: 1 },
          { label: '偶有评论回复', value: 2 },
          { label: '有定期互动活动', value: 3 },
          { label: '社群活跃运营', value: 4 },
          { label: '高活跃粉丝生态', value: 5 },
        ],
      },
      {
        num: '4-4',
        text: '线上下单渠道建设',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '无线上下单渠道', value: 1 },
          { label: '有但不完善', value: 2 },
          { label: '有小程序/公众号商城', value: 3 },
          { label: '多平台电商覆盖', value: 4 },
          { label: '全渠道无缝体验', value: 5 },
        ],
      },
    ],
  },

  // ========== 维度5：客户转化与留存（10分）==========
  {
    id: 5,
    key: 'conversion',
    title: '客户留存',
    maxScore: 10,
    desc: '评估客户留存、复购和员工引导转化能力',
    questions: [
      {
        num: '5-1',
        text: '客户留存率',
        type: 'score',
        maxScore: 5,
        hint: '1分=流失严重，5分=高度忠诚',
      },
      {
        num: '5-2',
        text: '客户复购率',
        type: 'radio',
        maxScore: 5,
        options: [
          { label: '几乎无复购', value: 1 },
          { label: '偶尔有回头客', value: 2 },
          { label: '有一定复购率', value: 3 },
          { label: '复购率较高', value: 4 },
          { label: '高复购+转介绍', value: 5 },
        ],
      },
      {
        num: '5-3',
        text: '员工引导转化能力（描述现状）',
        type: 'text',
        maxScore: 0,
        placeholder: '请描述员工在接待、引导、促单环节的表现和问题',
      },
    ],
  },
];

// 维度ID到飞书维度名的映射
var DIM_TO_FEISHU = {
  1: '线下曝光',
  2: '品牌形象',
  3: '活动促销',
  4: '线上运营',
  5: '客户留存',
};

// 维度ID到推荐产品的映射
var DIM_RECOMMEND_PRODUCTS = {
  1: '电梯广告投放',
  2: '品牌视觉升级',
  3: '营销活动策划',
  4: '线上运营代运营',
  5: '客户留存方案',
};

// 暴露到全局
if (typeof window !== 'undefined') {
  window.DIAGNOSIS_DATA = DIAGNOSIS_DATA;
  window.DIM_TO_FEISHU = DIM_TO_FEISHU;
  window.DIM_RECOMMEND_PRODUCTS = DIM_RECOMMEND_PRODUCTS;
}
