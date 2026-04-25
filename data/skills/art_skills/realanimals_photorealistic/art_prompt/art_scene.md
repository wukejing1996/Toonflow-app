---
name: art_scene
description: 写实动物栖息地场景生成 · 约束手册
metaData: art_skills
---

# 写实动物栖息地场景生成 · 约束手册

---

## 一、场景原则

1. **栖息地真实** — 地貌、植被、气候与季节必须与动物匹配。
2. **自然光真实** — 以自然光为主（清晨/午后/黄昏/阴天/雨雪），避免人造棚拍感。
3. **空间层次** — 前景（草/枝叶）+ 中景（主体区域）+ 远景（山体/树林/天空）层次明确。
4. **纪录片观感** — 真实空气透视、真实雾气与天气，不做插画化。

---

## 二、常见栖息地类型

| 类型 | 核心元素 |
|---|---|
| 森林 | 树干苔藓、落叶层、灌木、光束穿林 |
| 草原 | 高草、地平线、远处树群、风吹草浪 |
| 雪原 | 雪面纹理、脚印、冷雾、远山 |
| 湿地/湖边 | 芦苇、浅水反光、泥滩、薄雾 |
| 海岸 | 礁石、海浪、海鸟、逆光水面 |

---

## 三、四视图环境设定（2×2 环视）

> 摄像机固定于场景中心点，分别朝前/后/左/右四个方向拍摄，形成 360° 环视。

| 位置 | 视图 | 视角方向 | 要求 | 提示词 |
|---|---|---|---|---|
| 左上 | 前视图 | 0° | 主体地貌与纵深可读 | front view, eye level |
| 右上 | 右视图 | 90° | 侧向延伸与植被结构 | right view, eye level |
| 左下 | 后视图 | 180° | 背面地貌与远景 | back view, eye level |
| 右下 | 左视图 | 270° | 左侧延伸与结构 | left view, eye level |

### 画面规范

| 项目 | 约束 |
|---|---|
| 布局 | 同一画面 2×2 网格：前 + 右 / 后 + 左 |
| 人物 | **严禁出现人物**；动物可选：场景资产默认不含动物 |
| 一致性 | 四视图天候、季节、植被类型一致 |
| 质感 | 地面纹理、植被细节真实可辨 |

---

## 四、提示词模板

```
photorealistic wildlife habitat environment,
natural landscape photography, documentary style,
realistic vegetation and terrain, atmospheric perspective,
natural light, realistic weather (fog / light rain / snow),
2x2 grid environment turnaround from the same center point:
front view + right view + back view + left view,
high detail, realistic colors, high resolution,
no people, no text, no watermark,
no illustration, no CGI
```

---

## 五、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 栖息地必须真实合理（季节/植被/地貌匹配） |
| R2 | 必须自然光与纪录片摄影观感 |
| R3 | 必须为 2×2 四视图环视且一致 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 插画/卡通/二次元 |
| X2 | 人造棚拍背景与强人造光 |
| X3 | 霓虹赛博朋克调色 |

