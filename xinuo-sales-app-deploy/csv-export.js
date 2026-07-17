/**
 * csv-export.js
 * 西诺销售管控系统 — CSV 导出模块
 *
 * 三种飞书表格格式：
 *   1. 体检结果表 (08-体检结果表.csv)
 *   2. 客户资料库 (01-客户资料库.csv)
 *   3. 跟进记录表 (02-跟进记录表.csv)
 *
 * 维度映射（内部维度 → 飞书字段）：
 *   品牌形象 → 维度二：形象 (maxScore=25)
 *   线下曝光 → 维度一：曝光 (maxScore=25)
 *   线上运营 → 维度四：线上 (maxScore=20)
 *   活动促销 → 维度三：活动 (maxScore=20)
 *   客户留存 → 维度五：转化 (maxScore=10)
 */

var CSVExporter = (function () {
  'use strict';

  var BOM = '\uFEFF';

  // 飞书体检结果表字段顺序（CRITICAL: 顺序不可变）
  var EXAM_FIELDS = [
    '客户名称', '体检日期',
    '品牌形象得分', '品牌形象评级',
    '线下曝光得分', '线下曝光评级',
    '线上运营得分', '线上运营评级',
    '活动促销得分', '活动促销评级',
    '客户留存得分', '客户留存评级',
    '总分', '健康评级',
    '核心发现', '推荐产品',
  ];

  // 飞书客户资料库字段顺序
  var CLIENT_FIELDS = [
    '客户名称', '所属行业', '客户等级', '联系人', '联系方式',
    '门店地址', '对接销售', '销售经理', '客户状态', '客户来源',
    '年营收规模', '备注',
  ];

  // 飞书跟进记录表字段顺序
  var FOLLOWUP_FIELDS = [
    '关联客户', '跟进日期', '跟进方式', '沟通详情',
    '跟进结果', '下一步动作', '下次跟进日期', '是否需要帮助',
  ];

  // 维度映射：飞书维度名 → { dimKey, maxScore }
  var DIMENSION_MAPPING = {
    '品牌形象': { dimKey: 'image', maxScore: 25 },
    '线下曝光': { dimKey: 'exposure', maxScore: 25 },
    '线上运营': { dimKey: 'online', maxScore: 20 },
    '活动促销': { dimKey: 'activity', maxScore: 20 },
    '客户留存': { dimKey: 'conversion', maxScore: 10 },
  };

  // 健康评级阈值（总分满分100）
  var GRADE_THRESHOLDS = [
    { min: 80, label: '健康' },
    { min: 60, label: '亚健康' },
    { min: 40, label: '生病' },
    { min: 0, label: '重症' },
  ];

  // 维度评级阈值（得分率）
  var DIM_GRADE_THRESHOLDS = [
    { min: 0.84, label: '优秀' },
    { min: 0.64, label: '良好' },
    { min: 0.44, label: '一般' },
    { min: 0, label: '急需改善' },
  ];

  // 推荐产品映射（最弱维度 → 产品推荐）
  var PRODUCT_RECOMMENDATIONS = {
    exposure: '电梯广告投放',
    image: '品牌视觉升级',
    activity: '营销活动策划',
    online: '线上运营代运营',
    conversion: '客户留存方案',
  };

  // 维度中文名映射（内部key → 中文名）
  var DIM_KEY_TO_NAME = {
    exposure: '线下曝光',
    image: '品牌形象',
    activity: '活动促销',
    online: '线上运营',
    conversion: '客户留存',
  };

  /**
   * 转义CSV字段：含逗号、引号、换行时用双引号包裹
   * @param {string} value - 字段值
   * @returns {string} 转义后的字段
   */
  function escapeCSVField(value) {
    if (value === null || value === undefined) {
      return '';
    }
    var str = String(value);
    if (str.indexOf(',') !== -1 || str.indexOf('"') !== -1 || str.indexOf('\n') !== -1 || str.indexOf('\r') !== -1) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  /**
   * 构建一行CSV
   * @param {Array} fields - 字段值数组
   * @returns {string} CSV行字符串
   */
  function buildCSVRow(fields) {
    return fields.map(escapeCSVField).join(',');
  }

  /**
   * 计算维度评级（得分率）
   * @param {number} score - 实际得分
   * @param {number} maxScore - 满分
   * @returns {string} 评级标签
   */
  function getDimGradeLabel(score, maxScore) {
    if (maxScore === 0) {
      return '—';
    }
    var pct = score / maxScore;
    for (var i = 0; i < DIM_GRADE_THRESHOLDS.length; i++) {
      if (pct >= DIM_GRADE_THRESHOLDS[i].min) {
        return DIM_GRADE_THRESHOLDS[i].label;
      }
    }
    return '急需改善';
  }

  /**
   * 计算健康评级（总分）
   * @param {number} totalScore - 总分（满分100）
   * @returns {string} 评级标签
   */
  function getHealthGradeLabel(totalScore) {
    for (var i = 0; i < GRADE_THRESHOLDS.length; i++) {
      if (totalScore >= GRADE_THRESHOLDS[i].min) {
        return GRADE_THRESHOLDS[i].label;
      }
    }
    return '重症';
  }

  /**
   * 生成核心发现文本
   * @param {Object} dimScores - 维度得分 { exposure, image, activity, online, conversion }
   * @returns {string} 核心发现描述
   */
  function generateCoreFindings(dimScores) {
    var dims = [
      { key: 'exposure', name: '线下曝光', score: dimScores.exposure || 0, max: 25 },
      { key: 'image', name: '品牌形象', score: dimScores.image || 0, max: 25 },
      { key: 'activity', name: '活动促销', score: dimScores.activity || 0, max: 20 },
      { key: 'online', name: '线上运营', score: dimScores.online || 0, max: 20 },
      { key: 'conversion', name: '客户留存', score: dimScores.conversion || 0, max: 10 },
    ];

    // 按得分率排序
    dims.sort(function (a, b) {
      return (a.score / a.max) - (b.score / b.max);
    });

    var weakest = dims[0];
    var strongest = dims[dims.length - 1];
    var weakDims = dims.filter(function (d) {
      return (d.score / d.max) < 0.44;
    }).map(function (d) {
      return d.name;
    });

    var findings = strongest.name + '表现较好';
    if (weakest.score / weakest.max < 0.44) {
      findings += '但' + weakest.name + '能力弱';
    } else {
      findings += '，' + weakest.name + '有待提升';
    }

    if (weakDims.length > 0) {
      findings += '；待改善：' + weakDims.join('、');
    }

    return findings;
  }

  /**
   * 根据最弱维度推荐产品
   * @param {Object} dimScores - 维度得分
   * @returns {string} 推荐产品
   */
  function getRecommendedProduct(dimScores) {
    var dims = [
      { key: 'exposure', score: dimScores.exposure || 0, max: 25 },
      { key: 'image', score: dimScores.image || 0, max: 25 },
      { key: 'activity', score: dimScores.activity || 0, max: 20 },
      { key: 'online', score: dimScores.online || 0, max: 20 },
      { key: 'conversion', score: dimScores.conversion || 0, max: 10 },
    ];

    dims.sort(function (a, b) {
      return (a.score / a.max) - (b.score / b.max);
    });

    return PRODUCT_RECOMMENDATIONS[dims[0].key] || '综合营销方案';
  }

  /**
   * 生成体检结果CSV字符串
   * @param {Array} exams - 体检记录数组
   * @returns {string} CSV内容（不含BOM）
   */
  function generateExamsCSV(exams) {
    var rows = [];
    rows.push(buildCSVRow(EXAM_FIELDS));

    for (var i = 0; i < exams.length; i++) {
      var exam = exams[i];
      var dimScores = exam.dimScores || {};

      // 按飞书字段顺序映射维度
      // app.js 中 dimScores 使用数字ID(1-5)作为key，也支持字符串key
      // 1=exposure, 2=image, 3=activity, 4=online, 5=conversion
      var imageScore = dimScores.image || dimScores[2] || dimScores['2'] || 0;
      var exposureScore = dimScores.exposure || dimScores[1] || dimScores['1'] || 0;
      var onlineScore = dimScores.online || dimScores[4] || dimScores['4'] || 0;
      var activityScore = dimScores.activity || dimScores[3] || dimScores['3'] || 0;
      var conversionScore = dimScores.conversion || dimScores[5] || dimScores['5'] || 0;

      var row = [
        exam.clientName || '',
        exam.examDate || '',
        imageScore,
        getDimGradeLabel(imageScore, 25),
        exposureScore,
        getDimGradeLabel(exposureScore, 25),
        onlineScore,
        getDimGradeLabel(onlineScore, 20),
        activityScore,
        getDimGradeLabel(activityScore, 20),
        conversionScore,
        getDimGradeLabel(conversionScore, 10),
        exam.totalScore || 0,
        exam.healthGrade || getHealthGradeLabel(exam.totalScore || 0),
        exam.coreFindings || generateCoreFindings(dimScores),
        exam.recommendedProduct || getRecommendedProduct(dimScores),
      ];
      rows.push(buildCSVRow(row));
    }

    return rows.join('\r\n');
  }

  /**
   * 生成客户资料CSV字符串
   * @param {Array} clients - 客户数组
   * @returns {string} CSV内容（不含BOM）
   */
  function generateClientsCSV(clients) {
    var rows = [];
    rows.push(buildCSVRow(CLIENT_FIELDS));

    for (var i = 0; i < clients.length; i++) {
      var c = clients[i];
      var row = [
        c.name || '',
        c.industry || '',
        c.level || '',
        c.contact || '',
        c.phone || '',
        c.address || '',
        c.salesPerson || '',
        c.salesManager || '',
        c.status || '',
        c.source || '',
        c.revenue || '',
        c.remark || '',
      ];
      rows.push(buildCSVRow(row));
    }

    return rows.join('\r\n');
  }

  /**
   * 生成跟进记录CSV字符串
   * @param {Array} followups - 跟进记录数组
   * @returns {string} CSV内容（不含BOM）
   */
  function generateFollowupsCSV(followups) {
    var rows = [];
    rows.push(buildCSVRow(FOLLOWUP_FIELDS));

    for (var i = 0; i < followups.length; i++) {
      var f = followups[i];
      var row = [
        f.clientName || '',
        f.followDate || '',
        f.method || '',
        f.detail || '',
        f.result || '',
        f.nextAction || '',
        f.nextDate || '',
        f.needHelp || '',
      ];
      rows.push(buildCSVRow(row));
    }

    return rows.join('\r\n');
  }

  /**
   * 下载CSV文件
   * @param {string} filename - 文件名
   * @param {string} content - CSV内容（不含BOM）
   */
  function downloadCSV(filename, content) {
    var csvContent = BOM + content;
    var blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // 释放URL对象
    setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 100);
  }

  /**
   * 导出体检结果CSV
   * @param {Array} exams - 体检记录数组
   */
  function exportExamsCSV(exams) {
    var content = generateExamsCSV(exams);
    downloadCSV('08-体检结果表.csv', content);
  }

  /**
   * 导出客户资料CSV
   * @param {Array} clients - 客户数组
   */
  function exportClientsCSV(clients) {
    var content = generateClientsCSV(clients);
    downloadCSV('01-客户资料库.csv', content);
  }

  /**
   * 导出跟进记录CSV
   * @param {Array} followups - 跟进记录数组
   */
  function exportFollowupsCSV(followups) {
    var content = generateFollowupsCSV(followups);
    downloadCSV('02-跟进记录表.csv', content);
  }

  // 暴露公共API
  return {
    BOM: BOM,
    EXAM_FIELDS: EXAM_FIELDS,
    CLIENT_FIELDS: CLIENT_FIELDS,
    FOLLOWUP_FIELDS: FOLLOWUP_FIELDS,
    DIMENSION_MAPPING: DIMENSION_MAPPING,
    PRODUCT_RECOMMENDATIONS: PRODUCT_RECOMMENDATIONS,
    escapeCSVField: escapeCSVField,
    buildCSVRow: buildCSVRow,
    getDimGradeLabel: getDimGradeLabel,
    getHealthGradeLabel: getHealthGradeLabel,
    generateCoreFindings: generateCoreFindings,
    getRecommendedProduct: getRecommendedProduct,
    generateExamsCSV: generateExamsCSV,
    generateClientsCSV: generateClientsCSV,
    generateFollowupsCSV: generateFollowupsCSV,
    downloadCSV: downloadCSV,
    exportExamsCSV: exportExamsCSV,
    exportClientsCSV: exportClientsCSV,
    exportFollowupsCSV: exportFollowupsCSV,
  };
})();

// 暴露到全局
if (typeof window !== 'undefined') {
  window.CSVExporter = CSVExporter;
  // 将 app.js 直接调用的函数暴露为全局函数（通过 CSVExporter 模块访问）
  window.generateExamsCSV = CSVExporter.generateExamsCSV;
  window.generateClientsCSV = CSVExporter.generateClientsCSV;
  window.generateFollowupsCSV = CSVExporter.generateFollowupsCSV;
  window.downloadCSV = CSVExporter.downloadCSV;
  window.getHealthGrade = CSVExporter.getHealthGradeLabel;
  window.getRecommendedProduct = function(dimIdOrKey) {
    // app.js 传入的可能是维度ID(1-5)或维度key
    var keyMap = { 1: 'exposure', 2: 'image', 3: 'activity', 4: 'online', 5: 'conversion' };
    var key = keyMap[dimIdOrKey] || dimIdOrKey;
    var recs = CSVExporter.PRODUCT_RECOMMENDATIONS;
    // PRODUCT_RECOMMENDATIONS 可能在模块返回对象中没有暴露，使用内部映射
    var fallback = {
      exposure: '电梯广告投放',
      image: '品牌视觉升级',
      activity: '营销活动策划',
      online: '线上运营代运营',
      conversion: '客户留存方案'
    };
    return (recs && recs[key]) || fallback[key] || '综合营销方案';
  };
  window.getDimGradeLabel = CSVExporter.getDimGradeLabel;
  window.generateCoreFindings = CSVExporter.generateCoreFindings;
}
