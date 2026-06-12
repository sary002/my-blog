// Concept metadata lookup: maps a user-typed AI/tech term to its English
// expansion and a phonetic hint. Lookup is case-insensitive for English
// acronyms and exact for Chinese terms.
//
// Phonetic is a rough hint, not strict IPA — good enough to read aloud once.
// Add entries as the user base grows. To add a new term, append a line.
//
// Falls back to null on miss; the UI then omits the metadata block.

const META = {
  // Common AI terms
  rag:            { english: 'Retrieval-Augmented Generation', phonetic: '/ræɡ/' },
  mcp:            { english: 'Model Context Protocol',         phonetic: '/ˌɛm ˌsiː ˈpiː/' },
  agent:          { english: 'Agent',                          phonetic: '/ˈeɪdʒənt/' },
  agents:         { english: 'Agents',                         phonetic: '/ˈeɪdʒənts/' },
  memory:         { english: 'Memory',                         phonetic: '/ˈmɛməri/' },
  prompt:         { english: 'Prompt',                         phonetic: '/prɒmpt/' },
  prompts:        { english: 'Prompts',                        phonetic: '/prɒmpts/' },
  workflow:       { english: 'Workflow',                       phonetic: '/ˈwɜːrkfloʊ/' },
  llm:            { english: 'Large Language Model',           phonetic: '/ˌɛl ˌɛl ˈɛm/' },
  embedding:      { english: 'Embedding',                      phonetic: '/ɪmˈbɛdɪŋ/' },
  embeddings:     { english: 'Embeddings',                     phonetic: '/ɪmˈbɛdɪŋz/' },
  token:          { english: 'Token',                          phonetic: '/ˈtoʊkən/' },
  tokens:         { english: 'Tokens',                         phonetic: '/ˈtoʊkənz/' },
  transformer:    { english: 'Transformer',                    phonetic: '/trænsˈfɔːrmər/' },
  'fine-tuning':  { english: 'Fine-Tuning',                    phonetic: '/ˌfaɪn ˈtjuːnɪŋ/' },
  finetuning:     { english: 'Fine-Tuning',                    phonetic: '/ˌfaɪn ˈtjuːnɪŋ/' },
  hallucination:  { english: 'Hallucination',                  phonetic: '/həˌluːsɪˈneɪʃən/' },
  'vector db':    { english: 'Vector Database',                phonetic: '/ˈvɛktər ˈdeɪtəbeɪs/' },
  'vector-db':    { english: 'Vector Database',                phonetic: '/ˈvɛktər ˈdeɪtəbeɪs/' },
  vectordb:       { english: 'Vector Database',                phonetic: '/ˈvɛktər ˈdeɪtəbeɪs/' },
  sse:            { english: 'Server-Sent Events',             phonetic: '/ˌɛs ˌɛs ˈiː/' },
  websocket:      { english: 'WebSocket',                      phonetic: '/ˈwɛbˌskɒkɪt/' },
  api:            { english: 'Application Programming Interface', phonetic: '/ˌeɪ piː ˈaɪ/' },
  rest:           { english: 'Representational State Transfer',  phonetic: '/rɛst/' },
  crud:           { english: 'Create, Read, Update, Delete',    phonetic: '/krʌd/' },
  ci:             { english: 'Continuous Integration',         phonetic: '/ˌsiː ˈaɪ/' },
  cd:             { english: 'Continuous Deployment',          phonetic: '/ˌsiː ˈdiː/' },

  // Chinese terms (also supported as exact-match keys)
  提示词:        { english: 'Prompt',                          phonetic: '/prɒmpt/' },
  智能体:        { english: 'Agent',                           phonetic: '/ˈeɪdʒənt/' },
  工作流:        { english: 'Workflow',                        phonetic: '/ˈwɜːrkfloʊ/' },
  记忆:          { english: 'Memory',                          phonetic: '/ˈmɛməri/' },
  向量数据库:    { english: 'Vector Database',                 phonetic: '/ˈvɛktər ˈdeɪtəbeɪs/' },
  嵌入:          { english: 'Embedding',                       phonetic: '/ɪmˈbɛdɪŋ/' },
  微调:          { english: 'Fine-Tuning',                     phonetic: '/ˌfaɪn ˈtjuːnɪŋ/' },
  检索增强生成:  { english: 'Retrieval-Augmented Generation',  phonetic: '/ræɡ/' },
  思维链:        { english: 'Chain of Thought',                phonetic: '/tʃeɪn əv θɔːt/' },
  上下文:        { english: 'Context',                         phonetic: '/ˈkɒntɛkst/' },
  函数调用:      { english: 'Function Calling',                phonetic: '/ˈfʌŋkʃən ˈkɔːlɪŋ/' },
}

export function lookupConceptMeta(concept) {
  if (!concept) return null
  const key = String(concept).trim().toLowerCase()
  if (META[key]) {
    return { name: concept.trim(), ...META[key] }
  }
  // Try without spaces / hyphens for things like "fine tuning"
  const compact = key.replace(/[\s-]+/g, '')
  for (const [k, v] of Object.entries(META)) {
    if (k.replace(/[\s-]+/g, '') === compact) {
      return { name: concept.trim(), ...v }
    }
  }
  return null
}
