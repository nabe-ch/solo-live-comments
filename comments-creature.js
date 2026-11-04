// 生き物のうんちく（事実は research/ の独立確認を通ったものだけ）。話題のうんちくと、質問の答えに使う
for (const [name, text] of CREATURE_TRIVIA) {
  const line = `ちなみに${knowSay(name, text)}`;
  const rule = gameRules.find((r) => r.u.some((t) => t.startsWith(`ちなみに${name}の売値は`)));
  if (rule) rule.u.push(line);
  GENERIC.u.push(line);
}
