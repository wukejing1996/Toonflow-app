# 可爱动物角色衍生（服饰/配件/表情）生成 · 约束手册

---

## 一、叠加原则

1. **脸型不变** — 眼睛大小、鼻口位置、头部轮廓必须保持一致。
2. **比例不变** — 大头小身比例不改，四视图一致。
3. **逐层可控** — 仅叠加“表情/服饰/配件/花纹点缀”，方便替换。
4. **可爱优先** — 配件与服饰必须童趣、柔和，不做成人化时尚或硬核装备。

---

## 二、叠加层级

| 层级 | 内容 | 说明 |
|---|---|---|
| L0 | 底模 | 基础动物形象，不修改 |
| L1 | 表情 | 微笑/惊喜/害羞/困倦（清晰可读） |
| L2 | 花纹/毛色点缀 | 小面积点缀，避免复杂纹理 |
| L3 | 服饰 | 围巾、背带裤、小披风、毛衣（柔和材质） |
| L4 | 配件 | 帽子、蝴蝶结、小背包、小铃铛 |

---

## 三、提示词模板（img2img 口径）

```
Use the reference cute animal character as base (img2img).
Keep identical: head shape, facial features, proportions.
Only add: expression + outfit + small accessories.

2D cartoon cute animal, clean line art, soft pastel colors,
simple shading, soft shadow,
【L1 expression】{smile / surprised / shy / sleepy},
【L3 outfit】{scarf / overalls / small cape / sweater},
【L4 accessories】{hat / bow / tiny backpack / bell},
plain light background,
high resolution, crisp lines,
no text, no watermark
```

---

## 四、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 面部特征与比例必须保持与底模一致 |
| R2 | 服饰/配件必须可爱童趣、柔和配色 |
| R3 | 仍保持干净线稿 + 粉彩色块 + 轻阴影 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 加入写实材质与照片级光影 |
| X2 | 加入重型武器/硬核机甲装备 |
| X3 | 霓虹赛博朋克发光堆砌 |

