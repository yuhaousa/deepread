// 中文文本工具：归一化、最长公共子串（用于护栏的“复述原文”检测）。

const PUNCT = /[\s，。、；：？！“”‘’（）《》〈〉【】…—\-,.;:?!"'()[\]{}<>·~`@#$%^&*_+=|\\/]/g;

/** 去掉空白与标点，统一全角数字与字母，便于匹配 */
export function normalize(text: string): string {
  return text
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(PUNCT, "")
    .toLowerCase();
}

/** 两个字符串的最长公共子串长度（动态规划，O(n·m)，用于几百字以内的短文本） */
export function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  let prev = new Array<number>(b.length + 1).fill(0);
  let best = 0;
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0);
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        cur[j] = prev[j - 1] + 1;
        if (cur[j] > best) best = cur[j];
      }
    }
    prev = cur;
  }
  return best;
}

/** 把段落切成句子（保留句末标点） */
export function splitSentences(paragraph: string): string[] {
  return paragraph.split(/(?<=[。！？])/).filter(Boolean);
}

/** 从模型输出中取出第一个 JSON 对象 */
export function extractJson<T = unknown>(text: string): T | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
