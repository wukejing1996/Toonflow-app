# 自然道具/痕迹衍生（同类变体）生成 · 约束手册

---

## 一、衍生原则

1. **类别不变** — 同类对象变体（不同羽毛角度/不同足迹清晰度/不同树皮纹理局部）。
2. **只改可解释条件** — 光线（阴天/晴天/逆光）、湿度（雨后更亮）、拍摄距离（微距更近）。
3. **真实摄影语言一致** — 自然光、真实景深与质感不变。

---

## 二、提示词模板（img2img 口径）

```
Use the reference macro photo as base (img2img).
Keep identical: object category and realistic texture.
Only change: angle / lighting / moisture state.

photorealistic nature macro photography,
natural light, realistic texture, high detail,
shallow depth of field, bokeh,
no cartoon, no illustration, no CGI
```

---

## 三、约束规则

### 必守

| 编号 | 规则 |
|---|---|
| R1 | 真实材质与微距细节必须保留 |
| R2 | 仅做光线/角度/湿度等可解释变体 |

### 严禁

| 编号 | 严禁 |
|---|---|
| X1 | 插画/卡通风 |
| X2 | 过度风格化滤镜 |

