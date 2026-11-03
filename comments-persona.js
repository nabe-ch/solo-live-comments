// コメント主の性格：話し方が決まった常連の視聴者。name が表示名で、a=あおり、q=質問、d=話を広げる質問、h=ほめ（すべて作文）
const PERSONAS = [];
const persona = (name, lines) => PERSONAS.push({ name, a: [], q: [], d: [], h: [], ...lines });
