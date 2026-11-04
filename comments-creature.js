// 生き物のうんちく（事実は research/ の独立確認を通ったものだけ）。話題のうんちくと、質問の答えに使う
for (const [name, text] of CREATURE_TRIVIA) {
  const line = `ちなみに${knowSay(name, text)}`;
  const rule = gameRules.find((r) => r.u.some((t) => t.startsWith(`ちなみに${name}の売値は`)));
  if (rule) rule.u.push(line);
  GENERIC.u.push(line);
}
// 生態も、生き物のうんちくとして使う
for (const [name, text] of ECOLOGY) {
  const line = `ちなみに${knowSay(name, text)}`;
  const rule = gameRules.find((r) => r.u.some((t) => t.startsWith(`ちなみに${name}の売値は`)));
  if (rule) rule.u.push(line);
  GENERIC.u.push(line);
}
// 話題のうんちくは、文に自分の主語があれば、そのまま使う（「ネコは、古代エジプトでは猫が」と重ねない）
const topicSay = ([name, text]) => (/^[^、]{1,16}?は/.test(text) && !/^(名前|鼻|耳|胃|卵|舌|角|体|袋|親)/.test(text) ? text : knowSay(name, text));
// 動物、果物、空、行事などの話題のうんちくも、ときどき流れる雑談に混ぜる
for (const row of TOPIC_TRIVIA) GENERIC.u.push(`ちなみに${topicSay(row)}`);
