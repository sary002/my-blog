// Profession catalog for the AI Translator.
//
// Each profession has:
//   - id:      stable machine identifier (sent by the client, validated server-side)
//   - label:   display name shown in the UI
//   - context: short paragraph describing the profession's daily work; the AI
//              uses this to ground its analogies in things the reader
//              actually does, not generic "knowledge worker" stuff
//   - analogySeeds: comma-separated list of concrete tools/processes/roles
//                   the profession touches every day; gives the AI a strong
//                   analogy palette
//
// To add a profession, append an entry below. Frontend dropdown picks it up
// automatically via GET /professions. No client code changes needed.

export const PROFESSIONS = [
  {
    id: 'backend-dev',
    label: '后端开发',
    context: '你日常写 API、调数据库、看监控、修线上 bug。熟悉 HTTP、SQL、缓存、消息队列、部署链路。',
    analogySeeds: 'API 接口、数据库表、缓存命中、消息队列、日志、监控告警、限流、事务、索引、服务依赖',
  },
  {
    id: 'frontend-dev',
    label: '前端开发',
    context: '你日常画 UI、调交互、对接后端接口。熟悉组件、状态、样式、浏览器渲染、性能优化。',
    analogySeeds: '组件树、props/state、事件、生命周期、虚拟 DOM、CSS 样式、动画、请求、缓存、路由',
  },
  {
    id: 'product-manager',
    label: '产品经理',
    context: '你日常写 PRD、画原型、跟开发对需求、盯上线数据。关心用户价值、商业指标、优先级排序。',
    analogySeeds: '需求文档、原型图、用户故事、版本发布、数据看板、用户调研、A/B 测试、OKR、迭代节奏',
  },
  {
    id: 'teacher',
    label: '老师',
    context: '你日常备课、上课、批改作业、对学生个别辅导。关心知识传递、班级管理、教学效果。',
    analogySeeds: '教案、课件、作业、考试、课堂提问、学生分层、教学目标、家长会、学期计划、出题',
  },
  {
    id: 'chef',
    label: '厨师',
    context: '你日常备菜、烹饪、出品。熟悉食材、刀工、火候、调味、菜系搭配、厨房动线、出餐节奏。',
    analogySeeds: '食材、菜谱、火候、调味、刀工、出餐、备菜、试菜、菜单、厨房分工',
  },
  {
    id: 'sales',
    label: '销售',
    context: '你日常找客户、跟进商机、谈合同、促单、维护老客户。熟悉客户心理、谈判节奏、关单策略。',
    analogySeeds: '客户线索、商机阶段、报价、合同、跟进节奏、关单、续费、客户分层、CRM、销售漏斗',
  },
  {
    id: 'founder',
    label: '创业者',
    context: '你日常想方向、找人、找钱、跑业务、做决策。关心市场、团队、融资、产品、增长。',
    analogySeeds: '融资轮次、股权、商业模式、用户增长、招聘、跑道、产品迭代、竞品分析、现金流',
  },
]

export function findProfession(id) {
  return PROFESSIONS.find((p) => p.id === id)
}

export function listProfessions() {
  // Strip server-only fields (analogySeeds) before sending to client.
  return PROFESSIONS.map(({ id, label }) => ({ id, label }))
}

// Build the messages array for the upstream LLM in translator mode.
// system prompt is server-controlled — client never gets to set it,
// which is what keeps prompt injection out of this path.
export function buildTranslatorMessages(profession, concept) {
  return [
    {
      role: 'system',
      content: `你是「AI 职业翻译官」。把 AI 概念翻译成${profession.label}能秒懂的语言。

【受众】${profession.context}
【类比素材】${profession.analogySeeds}

按 6 个 ## 段输出，缺一不可：

## 一句话理解
≤30 字，不写「是/指」类空话，**不要重复概念名/英文/音标**（这些会单独显示）

## 职业映射
2-3 个${profession.label}熟悉的工具/流程/角色类比

## ASCII图解
5-12 行结构图，标清角色与流向

## Mermaid图
合法 Mermaid 代码，flowchart LR 或 sequenceDiagram，5-8 节点

## 真实案例
1-2 句：${profession.label}的真实工作场景里用上这概念的例子

## 学习建议
3 条由浅入深的学习路径，从今天能做的开始

【规则】
- 不用 AI 黑话；用${profession.label}听得懂的类比
- 概念对${profession.label}太基础时，上升一层重新框定，不重复常识
- 总长 ≤800 字`,
    },
    {
      role: 'user',
      content: `概念：${concept}`,
    },
  ]
}
