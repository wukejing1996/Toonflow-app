# 写实动物衍生（同物种变体/姿态变化）生成 · 约束手册

---

## 一、衍生原则

1. **物种不变** — 仍是同一物种/同一只个体的合理变体（毛色差异、季节换毛、轻微体态变化）。
2. **不引入拟人设定** — 不加服装配饰，不做“角色化拟人”。
3. **只改可解释因素** — 姿态（站/走/卧/奔跑）、表情（警觉/放松）、环境光（清晨/黄昏）、季节（冬毛更厚）。
4. **摄影逻辑一致** — 焦距、景深与画面调性保持纪录片风格一致。

---

## 二、提示词模板（img2img 口径）

```
Use the reference animal image as base (img2img).
Keep identical: species identity, realistic anatomy, fur/feather realism.
Only change: pose / expression / time of day / seasonal coat.

photorealistic wildlife photography,
natural light, documentary style,
tack sharp eyes, detailed fur/feathers,
telephoto lens, shallow depth of field, bokeh,
realistic colors, high detail,
no cartoon, no illustration, no CGI
```

---

## 三、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 仅做可解释的姿态/光线/季节变体 |
| R2 | 必须保持写实解剖与毛发真实 |
| R3 | 纪录片摄影语言保持一致 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 拟人化（穿衣/站立像人/卡通表情） |
| X2 | 插画/二次元/3D 渲染风 |

