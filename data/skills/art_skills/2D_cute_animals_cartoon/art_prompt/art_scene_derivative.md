# 场景衍生（同场景变体）生成 · 约束手册

---

## 一、衍生原则

1. **结构不变** — 同一场景变体保持主要布局与元素位置一致。
2. **只改氛围** — 变体只允许改：时间段（清晨/午后/黄昏/夜晚灯光）、天气（晴/小雨/小雪）、节日装饰（小面积）。
3. **配色仍柔和** — 仍用粉彩/高明度色块，避免变成暗黑或高对比。

---

## 二、提示词模板（img2img 口径）

```
Use the reference environment as base (img2img).
Keep identical: layout, major props placement.
Only change: time of day / weather / small decorations.

2D cartoon storybook environment, clean line art,
soft pastel colors, simple shading, soft shadow,
warm and bright overall,
2x2 grid environment turnaround (front/right/back/left),
high resolution, crisp lines,
no text, no watermark
```

---

## 三、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 布局不变，仅做氛围与天气变体 |
| R2 | 仍保持粉彩色系与轻阴影 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 大幅改变建筑/树木布局 |
| X2 | 暗黑恐怖化或霓虹荧光化 |

