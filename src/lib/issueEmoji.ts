/**
 * 이슈 이모지.
 * AI 가 이슈를 만들 때 골라 저장하지만, 그 전에 만들어진 이슈나
 * 모델이 이상한 값을 준 경우를 위해 제목으로 추론하는 기본값을 둔다.
 */
const KEYWORD_EMOJI: Array<[RegExp, string]> = [
  [/홍수|호우|폭우|태풍|지진|산불|폭염|한파|가뭄|기후|날씨/, "🌧️"],
  [/사고|참사|붕괴|추락|화재|충돌|실종|사망|부상/, "🚨"],
  [/수사|검찰|경찰|기소|구속|영장|재판|판결|무죄|유죄|법원/, "⚖️"],
  [/선거|투표|공천|후보|출마|여론조사|지지율/, "🗳️"],
  [/국회|대통령|정부|장관|여당|야당|특검|정치|청와대|대통령실/, "🏛️"],
  [/예산|증시|주가|코스피|환율|금리|경제|물가|무역|관세|수출/, "📈"],
  [/부동산|아파트|전세|분양|주택|재건축/, "🏠"],
  [/외교|정상회담|북한|미국|중국|일본|유엔|국제|대사관/, "🌏"],
  [/파업|노조|노동|임금|고용|해고|채용/, "✊"],
  [/의료|병원|의사|간호|감염|백신|질병|코로나|건강/, "🏥"],
  [/학교|교육|대학|수능|학생|입시/, "🎓"],
  [/반도체|인공지능|AI|기술|과학|연구|우주|위성/, "🔬"],
  [/야구|축구|올림픽|선수|경기|월드컵|스포츠/, "⚽"],
  [/영화|드라마|가수|배우|아이돌|공연|문화|연예/, "🎬"],
  [/군|국방|훈련|미사일|무기|공항|기지/, "🪖"],
  [/교통|철도|지하철|버스|도로|항공/, "🚇"],
];

export function issueEmoji(issue: { emoji: string | null; title: string }): string {
  if (issue.emoji) return issue.emoji;
  for (const [pattern, emoji] of KEYWORD_EMOJI) {
    if (pattern.test(issue.title)) return emoji;
  }
  return "📰";
}

/** 이슈 점수를 사람이 읽는 온도 표현으로 바꾼다. */
export function issueHeat(score: number): { label: string; emoji: string; percent: number } {
  const percent = Math.max(4, Math.min(100, Math.round((score / 60) * 100)));
  if (score >= 40) return { label: "매우 뜨거움", emoji: "🔥", percent };
  if (score >= 25) return { label: "뜨거움", emoji: "🔥", percent };
  if (score >= 12) return { label: "활발함", emoji: "☀️", percent };
  if (score >= 5) return { label: "잔잔함", emoji: "🌤️", percent };
  return { label: "가라앉음", emoji: "🌙", percent };
}
