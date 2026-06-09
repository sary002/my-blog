export interface Project {
  id: string
  title: string
  description: string
  tags: string[]
  link: string
}

export interface Article {
  id: string
  title: string
  excerpt: string
  date: string
  readTime: string
  link: string
}

export interface ContactLink {
  label: string
  value: string
  href: string
}

export const projects: Project[] = [
  {
    id: '1',
    title: '个人博客系统',
    description: '基于 React 与 TypeScript 构建的现代化博客平台，支持 Markdown 写作与响应式阅读体验。',
    tags: ['React', 'TypeScript', 'Vite'],
    link: '#',
  },
  {
    id: '2',
    title: '任务管理工具',
    description: '简洁高效的任务看板应用，支持拖拽排序、标签分类与本地数据持久化。',
    tags: ['React', 'CSS', 'LocalStorage'],
    link: '#',
  },
  {
    id: '3',
    title: '天气仪表盘',
    description: '实时天气数据可视化面板，提供多城市切换与七日预报，界面清爽直观。',
    tags: ['API', 'Chart', 'UI'],
    link: '#',
  },
]

export const articles: Article[] = [
  {
    id: '1',
    title: '如何构建现代化的 React 应用',
    excerpt: '从项目初始化到组件设计，探索用 Vite + TypeScript 打造高性能前端应用的最佳实践。',
    date: '2026-05-20',
    readTime: '8 分钟',
    link: '#',
  },
  {
    id: '2',
    title: 'CSS 布局的艺术：从 Flexbox 到 Grid',
    excerpt: '深入理解现代 CSS 布局方案，掌握响应式设计的核心技巧与常见陷阱。',
    date: '2026-04-15',
    readTime: '6 分钟',
    link: '#',
  },
  {
    id: '3',
    title: 'TypeScript 类型系统进阶指南',
    excerpt: '泛型、条件类型与工具类型的实战应用，让你的代码更安全、更易维护。',
    date: '2026-03-08',
    readTime: '10 分钟',
    link: '#',
  },
]

export const contactLinks: ContactLink[] = [
  { label: '邮箱', value: 'hello@example.com', href: 'mailto:hello@example.com' },
  { label: 'GitHub', value: '@yourname', href: 'https://github.com' },
  { label: 'Twitter', value: '@yourname', href: 'https://twitter.com' },
]
