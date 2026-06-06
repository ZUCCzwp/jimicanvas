export const IMAGE_TO_PROMPT_JSON_SCHEMA = {
  subject: '主体描述',
  scene: '场景/环境',
  style: '风格',
  composition: '构图',
  lighting: '光影',
  colorPalette: ['主色或配色 1', '主色或配色 2'],
  mood: '氛围/情绪',
  prompt: '完整中文生图提示词，可直接用于 AI 生图',
  negativePrompt: '中文负向提示词，列出应避免的元素',
};

export const VIDEO_TO_PROMPT_JSON_SCHEMA = {
  hookType: '前 2 秒钩子类型',
  narrativeStructure: '叙事结构',
  sceneBreakdown: [
    {
      index: 1,
      durationSec: 3,
      description: '场景描述',
      camera: '镜头语言',
    },
  ],
  visualStyle: '视觉风格',
  editingRhythm: '剪辑节奏',
  mood: '氛围/情绪',
  prompt: '完整中文生视频提示词，可直接用于 AI 生视频',
  shortPrompt: '精简中文生视频提示词',
  negativePrompt: '中文负向提示词，列出应避免的元素',
};

export const DEFAULT_IMAGE_TO_PROMPT_INSTRUCTION = `你是一位专业的 AI 生图提示词工程师。请分析用户提供的图片，并严格按以下 JSON 结构输出结果。

要求：
1. 所有字段内容必须使用中文（简体）。
2. 仔细识别主体、场景、风格、构图、光影、配色与氛围。
3. prompt 必须是可直接用于 AI 生图的完整中文提示词。
4. negativePrompt 用中文列出应避免的元素。
5. 只返回合法 JSON，不要用 markdown 代码块包裹，不要添加任何前后说明。

JSON 结构示例：
${JSON.stringify(IMAGE_TO_PROMPT_JSON_SCHEMA, null, 2)}`;

export const DEFAULT_VIDEO_TO_PROMPT_INSTRUCTION = `你是一位专业的 AI 生视频提示词工程师。请分析用户提供的视频，并严格按以下 JSON 结构输出结果。

要求：
1. 所有字段内容必须使用中文（简体）。
2. 识别视频的钩子、叙事结构、分镜、镜头语言、视觉风格、剪辑节奏与氛围。
3. sceneBreakdown 按时间顺序列出关键场景，durationSec 为估算秒数。
4. prompt 与 shortPrompt 必须是可直接用于 AI 生视频的中文提示词。
5. negativePrompt 用中文列出应避免的元素。
6. 只返回合法 JSON，不要用 markdown 代码块包裹，不要添加任何前后说明。

JSON 结构示例：
${JSON.stringify(VIDEO_TO_PROMPT_JSON_SCHEMA, null, 2)}`;

export function stripMarkdownJsonFence(text) {
  const value = String(text || '').trim();
  const fenced = value.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : value;
}

export function parseStructuredPromptJson(text) {
  const raw = stripMarkdownJsonFence(text);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

export function resolveStructuredPromptText(structured, keys = ['prompt', 'shortPrompt']) {
  if (!structured || typeof structured !== 'object') return '';

  for (const key of keys) {
    const value = String(structured[key] || '').trim();
    if (value) return value;
  }

  return '';
}

export function formatStructuredPromptResult(text, promptKeys = ['prompt', 'shortPrompt']) {
  const trimmed = String(text || '').trim();
  const structured = parseStructuredPromptJson(trimmed);
  if (!structured) {
    return {
      content: trimmed,
      prompt: trimmed,
      structured: null,
      locale: '',
    };
  }

  const prompt = resolveStructuredPromptText(structured, promptKeys) || trimmed;
  return {
    content: JSON.stringify(structured, null, 2),
    prompt,
    structured,
    locale: 'zh',
  };
}

export function buildStructuredTranslateInstruction(jsonText) {
  return `你是一位专业的 AI 提示词翻译专家。请将下面 JSON 中的所有中文文本值翻译为自然、专业的英文（适用于 AI 生图/生视频提示词）。

规则：
1. 保持 JSON 的键名与整体结构完全不变。
2. 递归翻译所有字符串值及数组、对象中的中文内容。
3. 不要翻译 JSON 键名。
4. 只返回合法 raw JSON，不要用 markdown 代码块包裹，不要添加任何说明。

JSON：
${jsonText}`;
}
