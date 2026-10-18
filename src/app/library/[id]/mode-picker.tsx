"use client";
// 选择学习方式后开始训练：四种 AI 导师角色，材料默认的角色标为推荐。

import { useState } from "react";
import { LEARNING_MODES, MODE_SPECS, type LearningMode } from "@/lib/modes";
import { STEP_LABEL } from "@/lib/domain";
import { StartButton } from "../../start-button";

export function ModePicker({ passageId, recommended, label }: { passageId: string; recommended: LearningMode; label: string }) {
  const [mode, setMode] = useState<LearningMode>(recommended);
  return (
    <div className="mode-picker">
      <div className="mode-grid" role="radiogroup" aria-label="选择学习方式">
        {LEARNING_MODES.map((m) => {
          const s = MODE_SPECS[m];
          return (
            <label key={m} className={`mode-card${mode === m ? " on" : ""}`}>
              <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} />
              <b>
                {s.label}
                {m === recommended && <span className="tag g">推荐</span>}
              </b>
              <small>{s.tagline}</small>
              <span>{s.description}</span>
              <span className="note">重点：{s.focus.map((f) => STEP_LABEL[f]).join("、")}</span>
            </label>
          );
        })}
      </div>
      <StartButton passageId={passageId} mode={mode} label={`${label} · ${MODE_SPECS[mode].label}`} />
    </div>
  );
}
