const SITE_TAGLINE = "测测你的台女音乐人格是谁";

/** 四指标：态度、独立、疗愈、实验 */
const DIM_COUNT = 4;

const ARTIST_ORDER = [
  "anpu",
  "cheer",
  "lala",
  "tanya",
  "waa",
  "eve",
  "sandee",
  "fanxiaoxuan",
  "shiqi",
  "ennong",
  "jolin",
  "hebe",
  "rainie",
  "cyndi",
  "alin",
  "chenli",
];

/**
 * 歌手四档画像：每维为 1 或 2（见题后分档规则）
 * 顺序：态度、独立、疗愈、实验
 */
const ARTIST_PROFILE = {
  anpu: [2, 2, 2, 1],
  cheer: [1, 2, 2, 2],
  lala: [2, 2, 1, 1],
  tanya: [1, 1, 1, 2],
  waa: [1, 2, 1, 2],
  eve: [2, 1, 1, 1],
  sandee: [2, 1, 1, 2],
  fanxiaoxuan: [2, 1, 2, 1],
  shiqi: [2, 1, 2, 2],
  ennong: [1, 2, 1, 1],
  jolin: [1, 1, 1, 1],
  hebe: [2, 2, 1, 2],
  rainie: [1, 1, 2, 2],
  cyndi: [1, 1, 2, 1],
  alin: [1, 2, 2, 1],
  chenli: [2, 2, 2, 2],
};

/** 每维 5 题×100，原始分 125–500 直接分档 */
const MAX_DIM_RAW_SUMS = [500, 500, 500, 500];

/** 125–300 → 档位 1；325–500 → 档位 2（301–324→1） */
function tierFromBlockSum(sum) {
  const s = Number(sum);
  if (s < 325) return 1;
  return 2;
}

function dimsToTiers(rawTotals) {
  return rawTotals.map(tierFromBlockSum);
}

/** 该歌手四指标原始分总和的可能区间（每维 1→125–300，2→325–500） */
function artistTotalScoreRange(artistId) {
  const p = ARTIST_PROFILE[artistId];
  let min = 0;
  let max = 0;
  for (let i = 0; i < DIM_COUNT; i++) {
    if (p[i] === 1) {
      min += 125;
      max += 300;
    } else {
      min += 325;
      max += 500;
    }
  }
  return { min, max };
}

function rawTotalScore(dimSums) {
  return dimSums.reduce((a, b) => a + Number(b), 0);
}

/** 用户原始总分在该歌手区间内归一化到 [0,1] */
function scoreFractionInArtistRange(dimSums, artistId) {
  const sum = rawTotalScore(dimSums);
  const { min, max } = artistTotalScoreRange(artistId);
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (sum - min) / (max - min)));
}

/** 将 t∈[0,1] 均分到 n 个槽位（专辑或词句下标） */
function bucketIndexEven(t, n) {
  if (n <= 1) return 0;
  const t1 = Math.max(0, Math.min(1, t));
  return Math.min(n - 1, Math.round(t1 * (n - 1)));
}

function tierMatchSimilarity(userTiers, artistId) {
  const p = ARTIST_PROFILE[artistId];
  let m = 0;
  for (let i = 0; i < DIM_COUNT; i++) {
    if (userTiers[i] === p[i]) m += 1;
  }
  return m / DIM_COUNT;
}

function getArtistProfileSimilarityScores(userTiers) {
  const scores = {};
  ARTIST_ORDER.forEach((id) => {
    scores[id] = tierMatchSimilarity(userTiers, id);
  });
  return scores;
}

function rankArtistsByProfileSimilarity(userTiers) {
  return ARTIST_ORDER.map((id) => ({
    id,
    score: tierMatchSimilarity(userTiers, id),
  })).sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return ARTIST_ORDER.indexOf(a.id) - ARTIST_ORDER.indexOf(b.id);
  });
}

const ALBUM_QUESTION_INDEX = 20;

function answerHistoryBeforeAlbum() {
  return (answerHistory || []).filter((e) => e.qIndex < ALBUM_QUESTION_INDEX);
}

/** 与 app.js 一致：本命取 ARTIST_PROFILE 匹配度最高者 */
function pickResultArtistByProfile(userTiers) {
  const ranked = rankArtistsByProfileSimilarity(userTiers);
  return ranked[0].id;
}
