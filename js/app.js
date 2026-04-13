const SITE_TAGLINE = "测测你的台女音乐人格是谁";

const { QUESTIONS, MAX_DIM_RAW_SUMS } = window.TWTI_QUESTIONS_BANK;

/** 各维原始分 ÷ 500（5 题×100）→ 0–100%，用于雷达与图例 */
function userDimRawToPercent(dimRawTotals) {
  return dimRawTotals.map((r) => {
    const mx = MAX_DIM_RAW_SUMS[0] || 500;
    return Math.max(0, Math.min(100, (Number(r) / mx) * 100));
  });
}

/** 四指标：态度、独立、疗愈、实验 */
const DIM_COUNT = 4;

/** 音乐光谱展示：将各维真实占比线性映射到 75%–95%（无固定歌手表时的回退） */
function spectrumDisplayPercents(basePercents) {
  const mapped = basePercents.map((p) => {
    const t = Math.max(0, Math.min(100, p)) / 100;
    return 75 + t * 20;
  });
  const lo = Math.min(...mapped);
  const hi = Math.max(...mapped);
  const span = hi - lo;
  if (span < 10) {
    return mapped.map((v, i) => {
      const nudge = [0, 6, 12, 18][i];
      return Math.round(Math.max(75, Math.min(95, v + nudge * 0.45)));
    });
  }
  return mapped.map((v) => Math.round(75 + ((v - lo) / span) * 20));
}

const ARTIST_ORDER_PUBLIC = [
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
];
/** 含隐藏位陈粒（仅当四指标均为档位 2 时出现） */
const ARTIST_ORDER = [...ARTIST_ORDER_PUBLIC, "chenli"];

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

/**
 * 结果页雷达与图例：与 ARTIST_PROFILE 同序（态度、独立、疗愈、实验）。
 * 档位 1 → 较低段（下限 75），档位 2 → 较高段；可与档位 2 显示值重叠。
 * 档位 1 的个数为 2 / 3 / 4 时，在赋分后对每个「1」依次上调：2 个各 +10；3 个 +8、+9、+10；4 个 +8、+9、+10、+10（均在约 8～10 区间内）。
 */
function spectrumDisplayPctFromProfile(profile) {
  const tier1Count = profile.filter((t) => t === 1).length;
  const low = [75, 77, 79, 81];
  const high = [86, 88, 91, 94];
  const bumpByTier1Count =
    tier1Count === 2 ? [10, 10] : tier1Count === 3 ? [8, 9, 10] : tier1Count === 4 ? [8, 9, 10, 10] : null;
  let li = 0;
  let hi = 0;
  let bi = 0;
  return profile.map((tier) => {
    if (tier === 1) {
      let v = low[li++];
      if (bumpByTier1Count) v += bumpByTier1Count[bi++];
      return v;
    }
    return high[hi++];
  });
}

const ARTIST_SPECTRUM_DISPLAY_PCT = Object.fromEntries(
  Object.keys(ARTIST_PROFILE).map((id) => [id, spectrumDisplayPctFromProfile(ARTIST_PROFILE[id])])
);

/** 每指标 5 题得分合计 125–500：125–300 → 档位 1；325–500 → 档位 2（301–324 归入档位 1） */
function tierFromBlockSum(sum) {
  const s = Number(sum);
  if (s < 325) return 1;
  return 2;
}

function dimsToTiers(rawTotals) {
  return rawTotals.map(tierFromBlockSum);
}

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

function scoreFractionInArtistRange(dimSums, artistId) {
  const sum = rawTotalScore(dimSums);
  const { min, max } = artistTotalScoreRange(artistId);
  if (max <= min) return 0.5;
  return Math.max(0, Math.min(1, (sum - min) / (max - min)));
}

function bucketIndexEven(t, n) {
  if (n <= 1) return 0;
  const t1 = Math.max(0, Math.min(1, t));
  return Math.min(n - 1, Math.round(t1 * (n - 1)));
}

/** 标为 megaHit 的共鸣句（常见大热单曲）在分桶命中时顺延到同列表中非 megaHit，降低神曲刷屏概率 */
function pickResonanceIndexPreferNonMegaHit(list, bucketIdx) {
  const n = list.length;
  if (n <= 1) return 0;
  let i = Math.max(0, Math.min(n - 1, bucketIdx));
  if (!list[i] || !list[i].megaHit) return i;
  for (let step = 1; step < n; step++) {
    const j = (i + step) % n;
    if (!list[j].megaHit) return j;
  }
  return i;
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

/** 结果页本命歌手：在公开池中均匀随机；四档全为 2 时仍为陈粒 */
function pickResultArtistRandom(userTiers) {
  if (userTiers.every((t) => t === 2)) return "chenli";
  const pool = ARTIST_ORDER_PUBLIC;
  return pool[Math.floor(Math.random() * pool.length)];
}
/** 网易云专辑 ID → 该专辑封面图（与 data 中 albums[].neteaseId 一一对应，避免仅用歌手默认图） */
const NETEASE_ALBUM_COVER = {

  "29562": "https://p1.music.126.net/8P1W00PwAVwLD_d-7vvxZw==/109951173007905115.jpg",
  "29561": "https://p1.music.126.net/rst0tkl1U7jSR6OBEfdKmg==/109951163531439512.jpg",
  "23176": "https://p1.music.126.net/0KfRz0SNX6rSbBWc39JIBw==/109951165644186954.jpg",
  "23196": "https://p1.music.126.net/uKIynn_d0rfZKPrO9tdEdw==/109951167188717023.jpg",
  "34780579": "https://p1.music.126.net/HQxTggMCB7AHUXN-ZFEtmA==/1371091013186741.jpg",
  "3098832": "https://p2.music.126.net/VuJFMbXzpAProbJPoXLv7g==/7721870161993398.jpg",
  "153227407": "https://p1.music.126.net/FATA8q3P9PfO5wDoWjTHUg==/109951167966156160.jpg",
  "32311": "https://p1.music.126.net/Baol42Xvto6rjRdj0aK_wg==/109951167778492613.jpg",
  "32314": "https://p1.music.126.net/LHXFlkc9SxczSSQZ_gGdfw==/109951168632695603.jpg",
  "21286": "https://p1.music.126.net/NbGB1_vTJ6jX4B2r_I-EvA==/109951172349668373.jpg",
  "21302": "https://p2.music.126.net/Mvv6oyi8XjVfAIk0Lg76aA==/109951165876268707.jpg",
  "21275": "https://p2.music.126.net/T6EwKjP4pIVAQiX17prmeQ==/109951163612079871.jpg",
  "37029433": "https://p1.music.126.net/lb0uSEy4nd6eQMv7hCbN0Q==/109951171530550836.jpg",
  "30449": "https://p2.music.126.net/VELPQFGHZADBbKY3LkJ-lg==/109951171530552686.jpg",
  "30451": "https://p1.music.126.net/0yXDZfMmWORBqtF9sM-Ulg==/109951163187412003.jpg",
  "30452": "https://p2.music.126.net/b1hZLgWA9ihXkivZeqo81g==/109951168296446353.jpg",
  "129362126": "https://p2.music.126.net/RwqmaJNBVr2PAccGWfMEVw==/109951166111591316.jpg",
  "83491330": "https://p1.music.126.net/URW2jcwPJzKagqtR1CFqpw==/109951164496670550.jpg",
  "35016103": "https://p1.music.126.net/pUVA3A7XBN2WwGNXSPz4Og==/109951165958860830.jpg",
  "83678773": "https://p1.music.126.net/Qby90z9IA2fG_3cwNFNXtw==/109951166629355850.jpg",
  "31321": "https://p2.music.126.net/Qt6sfLxRCscFZVXhbQ4bfg==/109951172020385959.jpg",
  "2379057": "https://p2.music.126.net/xgqaL3g1WV3r-y7SDGuDZA==/109951170708260156.jpg",
  "140436738": "https://p2.music.126.net/2_bfGl0Z9m91WIrJnH4WSQ==/109951167054111857.jpg",
  "121244488": "https://p2.music.126.net/oYFcHgy0yGClwJgvi1EzeA==/109951165609153153.jpg",
  "120821826": "https://p1.music.126.net/21NrbdVXrd4ICnmTFzObtQ==/109951164906345779.jpg",
  "74986004": "https://p2.music.126.net/GqgxWH0Ogr4fr25s3R01-Q==/109951163749065888.jpg",
  "21314": "https://p2.music.126.net/ZWjf4CUeVadg6o77iNNyxg==/109951168436811879.jpg",
  "3050109": "https://p1.music.126.net/a85NPcMqh7xkPxdJnXDs4Q==/109951167835927765.jpg",
  "74947015": "https://p2.music.126.net/FreJrZTi4r7dP9CgtSUENg==/109951169892903291.jpg",
  "34701277": "https://p1.music.126.net/N1dKedCtsENS59eY0JHUkQ==/109951166489364929.jpg",
  "3029971": "https://p1.music.126.net/zlmAeAt2XZLW3TYTfl5WRw==/109951166673339629.jpg",
  "36192725": "https://p1.music.126.net/VrM_no7PrJaZw2aHGwIU5A==/109951165285762066.jpg",
  "21272": "https://p1.music.126.net/MBBrmP2vNVWi1QusWFSucw==/109951171350837932.jpg",
  "81592484": "https://p1.music.126.net/zHwPKfM4gKHtQlYSJzTpYw==/109951164358664401.jpg",
  "74265934": "https://p1.music.126.net/BQIuhaCHDL2LU2J-ClSC8A==/109951171315962269.jpg",
  "99125939": "https://p2.music.126.net/gRMWUKU2ScajuiJDcAdX4Q==/109951165517115227.jpg",
  "3077547": "https://p2.music.126.net/DADVTS_jsjis6jv9TbUmlw==/3236962234128507.jpg",
  "2866458": "https://p2.music.126.net/Gpee5DivFIgNXyjCT57gXg==/109951164889837024.jpg",
  "142575869": "https://p1.music.126.net/W5qklsOwVwD_ILJpnCKLsA==/109951167208044048.jpg",
  "20834": "https://p2.music.126.net/lxXGBPPqNS6iNYJjr_4CTA==/109951164087833607.jpg",
  "2270070": "https://p2.music.126.net/dFKOswXRwbHdqtEEppxE5A==/109951165641462282.jpg",
  "131676223": "https://p2.music.126.net/Um5PpfGlfPZMJj81frDvRw==/109951166274970187.jpg",
  "21252": "https://p2.music.126.net/jJOaqlez9x5VofjgB7B_Bw==/109951166195459631.jpg",
  "21257": "https://p2.music.126.net/AryQmM2GgfCk4C9XfwV5uQ==/109951168271384367.jpg",
  "21250": "https://p2.music.126.net/5TTqb3sID_G-u2YOS2P0aA==/109951171536245206.jpg",
  "95902047": "https://p1.music.126.net/OjItC1KtO-Jg_lBVqsihkQ==/109951165341263996.jpg",
  "2704008": "https://p1.music.126.net/aPnwHIJECLpQCoSV-qm_qA==/109951163571315498.jpg",
  "29447": "https://p2.music.126.net/_o12jScXd17VO79VCsitbA==/109951163167534993.jpg",
  "32312": "https://p1.music.126.net/WMVdcUdA0XYzdj9Od4upyw==/109951167282574636.jpg",
  "121245961": "https://p2.music.126.net/NQy12zGCQw_Nsb-IEfqUKA==/109951165609179927.jpg",
  "21269": "https://p2.music.126.net/95lQqF62NHbO-h1r4J5epQ==/109951166117565237.jpg",
  "21276": "https://p2.music.126.net/9d2wwkv7BqdGZVHOAbHBVA==/109951169603869280.jpg",
};

function resolveAlbumCoverUrl(album, artist) {
  if (album && album.coverUrl) return album.coverUrl;
  const id = album && album.neteaseId;
  if (id && NETEASE_ALBUM_COVER[String(id)]) return NETEASE_ALBUM_COVER[String(id)];
  return (artist && artist.albumCoverUrl) || "";
}

/** 按用户四指标原始分总和在该歌手区间内归一化，均分映射到各张专辑 */
function pickAlbumMetaForNorm(artistId, dimSums) {
  const artist = ARTISTS[artistId];
  const albums = artist.albums || [];
  if (!albums.length) {
    return {
      title: artist.album,
      neteaseId: "",
      coverUrl: artist.albumCoverUrl || "",
    };
  }
  const t = scoreFractionInArtistRange(dimSums, artistId);
  const idx = bucketIndexEven(t, albums.length);
  const picked = albums[idx];
  return {
    title: picked.title,
    neteaseId: picked.neteaseId || "",
    coverUrl: resolveAlbumCoverUrl(picked, artist),
  };
}

/** 计分题共 20 道（每维 5 题）；已无专辑选择题 */
const DIM_QUESTION_TOTAL = 20;

function neteaseSongUrl(id) {
  if (!id) return "";
  return `https://music.163.com/song?id=${id}`;
}
function neteaseAlbumUrl(id) {
  if (!id) return "";
  return `https://music.163.com/album?id=${id}`;
}

function hashString(str) {
  let h = 0;
  const s = str || "";
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0;
  }
  return h;
}

/** 仅保留属于指定本命专辑（网易云专辑 ID）的共鸣句；均已标注 albumNeteaseId 时严格过滤 */
function resonanceLyricsForResultAlbum(artist, albumNeteaseId) {
  const list = artist.resonanceLyrics || [];
  const want = String(albumNeteaseId || "");
  if (!want || !list.length) return list;
  const tagged = list.some((r) => r.albumNeteaseId);
  if (!tagged) return list;
  const hit = list.filter((r) => String(r.albumNeteaseId) === want);
  return hit.length ? hit : list;
}

function pickResonanceByAnswerPath(artistId, artist, dimSums, albumMeta) {
  const list = resonanceLyricsForResultAlbum(artist, albumMeta && albumMeta.neteaseId);
  if (!list || !list.length) {
    return { line: "", song: "", neteaseSongId: "" };
  }
  const t = scoreFractionInArtistRange(dimSums, artistId);
  const rawIdx = bucketIndexEven(t, list.length);
  const idx = pickResonanceIndexPreferNonMegaHit(list, rawIdx);
  return list[idx];
}

/** 推荐专辑：按与用户四指标相似度排序（排除本命），每个歌手只展示一张最契合专辑 */
function buildRecommendedAlbumRows(userTiers, dimSums, excludeArtistId, maxArtists) {
  const ranked = rankArtistsByProfileSimilarity(userTiers);
  const top = ranked
    .filter(({ id }) => id !== excludeArtistId)
    .slice(0, maxArtists || 3);
  return top.map(({ id }) => {
    const art = ARTISTS[id];
    const meta = pickAlbumMetaForNorm(id, dimSums);
    return {
      artistName: art.name,
      title: meta.title,
      neteaseId: meta.neteaseId,
    };
  });
}

const ARTISTS = {
  anpu: {
    name: "安溥",
    album: "多时期作品（含《亲爱的...我还不知道》《神的游戏》《9522》等）",
    albumCoverUrl:
      "https://p1.music.126.net/FATA8q3P9PfO5wDoWjTHUg==/109951167966156160.jpg",
    albums: [
      { title: "《9522》", neteaseId: "153227407", dims: [2, 2, 2, 1] },
      { title: "《神的游戏》", neteaseId: "32311", dims: [2, 2, 2, 1] },
      { title: "《城市》", neteaseId: "32312", dims: [2, 2, 2, 1] },
      { title: "《亲爱的...我还不知道》", neteaseId: "32314", dims: [2, 2, 2, 1] },
    ],
    resonanceLyrics: [
      {
        line: "在所有人事已非的景色里，我最喜欢你。",
        song: "《喜欢》",
        note: "时间流逝里仍想握紧的在意",
        neteaseSongId: "326719",
        albumNeteaseId: "32314",
      },
      {
        line: "去挥霍和珍惜是同一件事情。",
        song: "《关于我爱你》",
        note: "把矛盾活成一种诚实",
        neteaseSongId: "326705",
        albumNeteaseId: "32312",
      },
      {
        line: "亲爱的你想念我吗，亲爱的你，想念自己吗，最好的时光出现了吗。",
        song: "《最好的时光》",
        note: "与过去和未来的自己和解",
        neteaseSongId: "1989506149",
        albumNeteaseId: "153227407",
      },
      {
        line: "是的，我有见过我的梦。",
        song: "《艳火》",
        note: "理想与执念在同一条路上",
        neteaseSongId: "326703",
        albumNeteaseId: "32311",
      },
      {
        line: "我拥有的都是侥幸啊，我失去的都是人生。",
        song: "《关于我爱你》",
        note: "把得失摊成一句坦白",
        neteaseSongId: "326705",
        albumNeteaseId: "32312",
      },
      {
        line: "当你不遗忘也不想曾经，我爱你。",
        song: "《关于我爱你》",
        note: "爱里时间感的拉扯",
        neteaseSongId: "326705",
        albumNeteaseId: "32312",
      },
      {
        line: "深深的话要浅浅地说，长长的路要挥霍地走。",
        song: "《儿歌》",
        note: "慢热里的温柔分寸",
        neteaseSongId: "326722",
        albumNeteaseId: "32314",
      },
      {
        line: "在时代在日夜在分岔里，你终会听见我。",
        song: "《城市》",
        note: "个体与城市的对话",
        neteaseSongId: "326712",
        albumNeteaseId: "32312",
      },
      {
        line: "沉没前清醒的爱人，在拥有爱的世纪里悲伤。",
        song: "《两者》",
        note: "关系里并肩的许诺",
        neteaseSongId: "326698",
        albumNeteaseId: "32311",
      },
    ],
    tagline: "把世界摊开读，慢热型哲学家。",
    traitsDetailed: `声线低回而富有叙事感，作品长期在「自我—他者—时代」之间来回叩问。创作上偏民谣与摇滚的融合，歌词信息密度高，常用长句与留白，让听众在反复聆听里慢慢对齐意义。现场表达真诚、敢言，音乐之外亦长期关注社会公平与多元处境，气质上接近「思想型歌者」：不急着讨好耳朵，更在意作品能否经得起时间。情感书写常带克制与距离感，却在关键时刻一击即心门。`,
    blurb:
      "一句歌词能在胸口过夜，就不必拿热闹把夜晚糊成壁纸。慢热不是冷感，是对自己的感受有洁癖：不演给围观，只跟自己对账。",
    inclusiveNote:
      "她的歌里常见对自由与平等的硬骨头：爱长什么样不由民政局定义，人也未必交得出「正常」这份作业。",
  },
  cheer: {
    name: "陈绮贞",
    album: "《华丽的冒险》",
    albumCoverUrl:
      "https://p1.music.126.net/NbGB1_vTJ6jX4B2r_I-EvA==/109951172349668373.jpg",
    albums: [
      { title: "《华丽的冒险》", neteaseId: "21286", dims: [1, 2, 2, 2] },
      { title: "《Groupies 吉他手》", neteaseId: "21302", dims: [1, 2, 2, 2] },
      { title: "《太阳》", neteaseId: "21275", dims: [1, 2, 2, 2] },
    ],
    resonanceLyrics: [
      {
        line: "你离开我，就是旅行的意义。",
        song: "《旅行的意义》",
        note: "把离开也写成一种温柔的确认",
        neteaseSongId: "209228",
        albumNeteaseId: "21286",
        megaHit: true,
      },
      {
        line: "我猜着你的心，要再一次确定，遥远的距离都是因为太过聪明。",
        song: "《太聪明》",
        note: "迂回与试探里的不安",
        neteaseSongId: "209397",
        albumNeteaseId: "21302",
      },
      {
        line: "我坐在夕阳里，看城市的衰弱。",
        song: "《鱼》",
        note: "独处时与一座城对视",
        neteaseSongId: "209115",
        albumNeteaseId: "21275",
      },
      {
        line: "我的心是一杯调和过的咖啡，怀念着往日淡薄的青草味。",
        song: "《小步舞曲》",
        note: "记忆里清淡的甜",
        neteaseSongId: "209400",
        albumNeteaseId: "21302",
      },
      {
        line: "你品尝了夜的巴黎，你踏过下雪的北京。",
        song: "《旅行的意义》",
        note: "收集风景也收集自己",
        neteaseSongId: "209228",
        albumNeteaseId: "21286",
        megaHit: true,
      },
      {
        line: "我坐在椅子上，看日出复活；我坐在夕阳里，看城市的衰弱。",
        song: "《鱼》",
        note: "一天里的情绪潮汐",
        neteaseSongId: "209115",
        albumNeteaseId: "21275",
      },
      {
        line: "倔强地，开花吧。",
        song: "《After 17》",
        note: "长大一瞬的自我允诺",
        neteaseSongId: "209314",
        albumNeteaseId: "21286",
      },
      {
        line: "我坐在椅子上，看日出复活。",
        song: "《鱼》",
        note: "安静等待天亮的心情",
        neteaseSongId: "209115",
        albumNeteaseId: "21275",
      },
    ],
    tagline: "吉他一响，文艺青年自动归位。",
    traitsDetailed: `「独立民谣」标签的代表人物之一：清澈嗓音、吉他编配为主，歌词像日记又像诗。主题多围绕孤独、旅行、恋爱里的细小情绪，把私人感受写成可被共享的语言。音乐动态未必张扬，却在气息与咬字上极讲究「呼吸感」。气质文艺、敏感，带点倔强的不合作：不追逐流水线甜歌，而坚持个人审美。听众粘性高，往往伴随青春记忆与长期陪伴。`,
    blurb:
      "吉他和留白给心事开天窗：跟主流节拍错位又怎样，偏按自己的呼吸走拍。敏感不是故障，是还没被收编的雷达。",
    inclusiveNote:
      "太多人在她歌里藏「不合拍」的心事——慢一点、怪一点，本来就不必向流水线道歉。",
  },
  lala: {
    name: "徐佳莹",
    album: "《心里学》",
    albumCoverUrl:
      "https://p1.music.126.net/lb0uSEy4nd6eQMv7hCbN0Q==/109951171530550836.jpg",
    albums: [
      { title: "《心里学》", neteaseId: "37029433", dims: [2, 2, 1, 1] },
      { title: "《LaLa首张创作专辑》", neteaseId: "30452", dims: [2, 2, 1, 1] },
      { title: "《理想人生》", neteaseId: "30449", dims: [2, 2, 1, 1] },
      { title: "《极限》", neteaseId: "30451", dims: [2, 2, 1, 1] },
    ],
    resonanceLyrics: [
      {
        line: "我身骑白马走三关，改换素衣回中原。",
        song: "《身骑白马》",
        note: "执念与等待里的戏剧感",
        neteaseSongId: "306664",
        albumNeteaseId: "30452",
        megaHit: true,
      },
      {
        line: "我不是一定要你回来，只是当又一个人看海。",
        song: "《失落沙洲》",
        note: "失去之后仍放不下的坦白",
        neteaseSongId: "306662",
        albumNeteaseId: "30452",
        megaHit: true,
      },
      {
        line: "愿你永远安康，愿你永远懂得飞翔。",
        song: "《言不由衷》",
        note: "体面告别里的心酸",
        neteaseSongId: "521749251",
        albumNeteaseId: "37029433",
      },
      {
        line: "在无关紧要的场合，都会想起这首歌，是因为你曾经哼唱着。",
        song: "《哼情歌》",
        note: "把轻快当作盔甲",
        neteaseSongId: "306668",
        albumNeteaseId: "30452",
      },
      {
        line: "一样的月光，怎么看得我越来越心慌。",
        song: "《一样的月光》",
        note: "熟悉场景里的陌生感",
        neteaseSongId: "306665",
        albumNeteaseId: "30452",
      },
      {
        line: "心里有事说不出来。",
        song: "《心里学》",
        note: "自我保护与渴望被懂",
        neteaseSongId: "526099073",
        albumNeteaseId: "37029433",
      },
      {
        line: "你敢不敢 说恨我 像爱我一样，发自内心的坚决。",
        song: "《你敢不敢》",
        note: "爱与恨里都要一句坦白",
        neteaseSongId: "306640",
        albumNeteaseId: "30449",
      },
      {
        line: "我的极限，就到这里；就算永远不能痊愈。",
        song: "《极限》",
        note: "承认边界也是一种清醒",
        neteaseSongId: "306650",
        albumNeteaseId: "30451",
      },
    ],
    tagline: "把纠结唱清楚，也把温柔唱进心里。",
    traitsDetailed: `创作歌手出身，旋律天赋突出，擅长把口语化的纠结写成极具记忆点的副歌。音色干净、转音自然，演绎上「轻触重击」：表面温柔，内里常有锋利的自我剖析。题材覆盖恋爱、家庭与自我成长，近年作品更偏心理层次与关系博弈。综艺与舞台经验丰富，但作品核心仍是「把复杂情绪唱得可被理解」。疗愈感来自共情，而非廉价的安慰。`,
    blurb:
      "关系里的暧昧与拉扯被你唱成具体伤口：要的是并肩，不是谁站高台教你做人。疗愈是同盟，不是施舍。",
    inclusiveNote:
      "她常写那种「想被听懂」的痒：被接住不等于被矫正，脆弱也可以很硬气。",
  },
  waa: {
    name: "魏如萱",
    album: "《HAVE A NICE DAY》",
    albumCoverUrl:
      "https://p2.music.126.net/RwqmaJNBVr2PAccGWfMEVw==/109951166111591316.jpg",
    albums: [
      { title: "《HAVE A NICE DAY》", neteaseId: "129362126", dims: [1, 2, 1, 2] },
      { title: "《藏着并不等于遗忘》", neteaseId: "83491330", dims: [1, 2, 1, 2] },
      { title: "《末路狂花》", neteaseId: "35016103", dims: [1, 2, 1, 2] },
    ],
    resonanceLyrics: [
      {
        line: "你啊你啊，你不懂我的好。",
        song: "《你啊你啊》",
        note: "亲密关系里「说了也白说」的委屈；网易云为专辑《末路狂花》录音室版",
        neteaseSongId: "440208470",
        albumNeteaseId: "35016103",
      },
      {
        line: "彼个所在，有我欲讲袂开的话。",
        song: "《彼个所在》",
        note: "乡愁与思念叠在同一句旋律里",
        neteaseSongId: "1404530800",
        albumNeteaseId: "83491330",
      },
      {
        line: "四月是适合说谎的日子，只说实话的人，后来都死在这短短三十日。",
        song: "《四月是适合说谎的日子》",
        note: "合作单曲；实体/主流发行以合作者专辑为准；网易云此版亦标注于《HAVE A NICE DAY》",
        neteaseSongId: "1838531847",
        albumNeteaseId: "129362126",
      },
      {
        line: "谁知道明天好还是不好。",
        song: "《HAVE A NICE DAY》",
        note: "用一句祝福把自己从泥里拔起来",
        neteaseSongId: "1817447929",
        albumNeteaseId: "129362126",
      },
      {
        line: "连我的笑容你都可以窃走。",
        song: "《窃笑》",
        note: "心事不想明说，只好用表情泄露",
        neteaseSongId: "1404531626",
        albumNeteaseId: "83491330",
      },
      {
        line: "Ophelia，你在水里还是岸上。",
        song: "《Ophelia》",
        note: "戏剧与梦境叠成的自言自语",
        neteaseSongId: "1404530797",
        albumNeteaseId: "83491330",
      },
      {
        line: "Don't cry Don't cry，明天会好的。",
        song: "《Don't cry Don't cry》",
        note: "哭完再把自己捡回来",
        neteaseSongId: "1404531623",
        albumNeteaseId: "83491330",
      },
    ],
    tagline: "古灵精怪的外壳，敏感真诚的核。",
    traitsDetailed: `声线可塑性极强，从梦幻到戏剧化都能驾驭；编曲上常融入电子、爵士与实验元素，作品「好听」与「好玩」并存。歌词视角跳跃、意象密集，擅长用幽默包裹失落，用荒诞承接敏感。舞台与主持经验让她更懂「表演性」：音乐不只是聆听，也是情境。整体气质古灵精怪，却常在玩笑后留下真实的孤独与温柔。`,
    blurb:
      "情绪允许拐弯：怪、夸张、脆弱可以同框。世界批发「正常」套餐，你偏把不合时宜的真心焊进自己的语法——别扭就别扭，别指望你配合演出。",
    inclusiveNote:
      "怪诞、欲望、崩溃在她歌里能同台；比起「像谁都对」，你更信那种不体面的真。",
  },
  rainie: {
    name: "杨丞琳",
    album: "《删·拾 以后》",
    albumCoverUrl:
      "https://p1.music.126.net/Qby90z9IA2fG_3cwNFNXtw==/109951166629355850.jpg",
    albums: [
      { title: "《删·拾 以后》", neteaseId: "83678773", dims: [1, 1, 2, 2] },
      { title: "《雨爱》", neteaseId: "31321", dims: [1, 1, 2, 2] },
      { title: "《半熟宣言》", neteaseId: "2379057", dims: [1, 1, 2, 2] },
    ],
    resonanceLyrics: [
      {
        line: "雨爱的秘密，能一直延续。",
        song: "《雨爱》",
        note: "收录于《雨爱》",
        neteaseSongId: "316100",
        albumNeteaseId: "31321",
        megaHit: true,
      },
      {
        line: "不能握的手，从此匿名的朋友。",
        song: "《匿名的好友》",
        note: "收录于《雨爱》；网易云专辑版 song id 316108",
        neteaseSongId: "316108",
        albumNeteaseId: "31321",
        megaHit: true,
      },
      {
        line: "你带着可以折叠的爱情，我在等不会变形的真心。",
        song: "《折叠式爱情》",
        note: "收录于《雨爱》",
        neteaseSongId: "316106",
        albumNeteaseId: "31321",
      },
      {
        line: "带我走，到遥远的以后，带走我，一个人自转的寂寞。",
        song: "《带我走》",
        note: "收录于《半熟宣言》；网易云专辑版 song id 26082345（勿与杨乃文《不要告别》316086 等 ID 混用）",
        neteaseSongId: "26082345",
        albumNeteaseId: "2379057",
        megaHit: true,
      },
      {
        line: "过程不需要导演，庆祝的烟花没出现。",
        song: "《半熟宣言》",
        note: "收录于《半熟宣言》",
        neteaseSongId: "26082349",
        albumNeteaseId: "2379057",
      },
    ],
    tagline: "甜过，也狠过，成长型女主。",
    traitsDetailed: `偶像出身但持续转型为「唱跳与抒情并重」的成熟歌手。早期作品偏甜爱与偶像剧气质，中后期更强调声线厚度与叙事张力，专辑概念也更完整。擅长演绎痛彻与释怀并存的抒情曲，舞台表现稳定，语感贴近口语。公众形象与作品同步成长：从「可爱」标签走向「把故事唱清楚」的女歌手路线。`,
    blurb:
      "甜与狠都写进履历：偶像剧教你笑，歌里才准你拆台。再顺的剧本也不如自己写的狼狈——至少那是真的。",
    inclusiveNote:
      "成长叙事里常见边界：爱可以收伞，也可以翻脸，不必为「好女孩」交租。",
  },
  ennong: {
    name: "郑宜农",
    album: "《水逆》",
    albumCoverUrl:
      "https://p1.music.126.net/2_bfGl0Z9m91WIrJnH4WSQ==/109951167054111857.jpg",
    albums: [
      { title: "《水逆》", neteaseId: "140436738", dims: [1, 2, 1, 1] },
      { title: "《给天王星》", neteaseId: "121244488", dims: [1, 2, 1, 1] },
      { title: "《海王星》", neteaseId: "120821826", dims: [1, 2, 1, 1] },
      { title: "《人生很难》", neteaseId: "121245961", dims: [1, 2, 1, 1] },
    ],
    resonanceLyrics: [
      {
        line: "但是无人知晓，这就是你的坚强。",
        song: "《新世纪的女儿》",
        note: "不被看见的力气也值得被承认",
        neteaseSongId: "1920622019",
        albumNeteaseId: "140436738",
      },
      {
        line: "正要开口，却忘了如何发出有意义的声音。",
        song: "《人如何学会语言》",
        note: "沟通的渴望与失语之间的缝隙（台语原作意象，摘句意译）",
        neteaseSongId: "1920623028",
        albumNeteaseId: "140436738",
      },
      {
        line: "天已经要光，你还毋愿放。",
        song: "《天已经要光》",
        note: "长夜将尽却仍放不下的拉扯",
        neteaseSongId: "1920623030",
        albumNeteaseId: "140436738",
      },
      {
        line: "咱展翼亲像初生的鸟仔，用全身的力气。",
        song: "《人如何学会语言》",
        note: "学说话的第一步，像学飞",
        neteaseSongId: "1920623028",
        albumNeteaseId: "140436738",
      },
      {
        line: "但是你捧着玉仔做的心。",
        song: "《玉仔的心》",
        note: "在城市里仍握紧的柔软",
        neteaseSongId: "1809746620",
        albumNeteaseId: "121244488",
      },
      {
        line: "毋一定这就是咱上好的距离。",
        song: "《最好的距离》",
        note: "靠近与留白之间，慢慢试出来的分寸",
        neteaseSongId: "1920623031",
        albumNeteaseId: "140436738",
      },
      {
        line: "又是孤身的乌暗暝，人去楼空，心事茫茫。",
        song: "《街仔路雨落袂停》",
        note: "雨巷夜景里，思慕与寄望叠在一起",
        neteaseSongId: "1809750825",
        albumNeteaseId: "121244488",
      },
      {
        line: "啊，人生很难，越过遗憾的故事。",
        song: "《人生很难》",
        note: "承认难走，仍想轻轻托住谁",
        neteaseSongId: "1809755469",
        albumNeteaseId: "121245961",
      },
    ],
    tagline: "温柔地反骨，台语系灵魂诗人。",
    traitsDetailed: `创作横跨华语与台语，文字锋利却常包裹在柔和的旋律里。关注身份、土地与日常政治感，但更落点在「具体的人」：弱者、边缘者、沉默的大多数。音乐气质偏独立摇滚与民谣的交界，现场能量集中，歌词信息量大。真诚、直白、少矫饰，适合愿意认真听字的听众。`,
    blurb:
      "边缘不是素材，是具体的人与具体的痛。温柔带刺，不向结构性冷漠批发正能量。",
    inclusiveNote:
      "她的词里弱者有脸有名：同盟从平视开始，不是谁居高临下的施舍。",
  },
  jolin: {
    name: "蔡依林",
    album: "《Ugly Beauty》",
    albumCoverUrl:
      "https://p1.music.126.net/GqgxWH0Ogr4fr25s3R01-Q==/109951163749065888.jpg",
    albums: [
      { title: "《UGLY BEAUTY》", neteaseId: "74986004", dims: [1, 1, 1, 1] },
      { title: "《MUSE》", neteaseId: "21314", dims: [1, 1, 1, 1] },
      { title: "《呸》", neteaseId: "3050109", dims: [1, 1, 1, 1] },
    ],
    resonanceLyrics: [
      {
        line: "最好的报复是美丽，最美的盛开是反击。",
        song: "《玫瑰少年》",
        note: "收录于《UGLY BEAUTY》",
        neteaseSongId: "1335640448",
        albumNeteaseId: "74986004",
      },
      {
        line: "看不见我的美，是你瞎了眼。",
        song: "《怪美的》",
        note: "收录于《UGLY BEAUTY》",
        neteaseSongId: "1335639971",
        albumNeteaseId: "74986004",
      },
      {
        line: "如果我没有伤口，又何必担忧勇气会出走。",
        song: "《如果我没有伤口》",
        note: "收录于《UGLY BEAUTY》",
        neteaseSongId: "1335640447",
        albumNeteaseId: "74986004",
      },
      {
        line: "我用别人的爱，定义存在，怕生命空白。",
        song: "《我》",
        note: "收录于《MUSE》",
        neteaseSongId: "209529",
        albumNeteaseId: "21314",
      },
      {
        line: "大艺术家，你凝视自己的样子，很入迷。",
        song: "《大艺术家》",
        note: "收录于《MUSE》",
        neteaseSongId: "209506",
        albumNeteaseId: "21314",
      },
      {
        line: "什么都喜欢，什么都会。",
        song: "《PLAY 我呸》",
        note: "收录于《呸》",
        neteaseSongId: "29572738",
        albumNeteaseId: "3050109",
      },
    ],
    tagline: "把身体与议题唱进流行，舞台即态度。",
    traitsDetailed: `华语流行乐坛最具「概念专辑」意识的歌手之一：舞曲、电子与视觉艺术高度整合，长期探讨身体、焦虑、偏见与自我认同。演唱上咬字利落、节奏精准，舞台制作标准极高。作品常把社会议题转译成可传播的流行语言，兼具商业性与表达欲。气质强势、专业、迭代快，是典型的「把流行当方法」的艺术家。`,
    blurb:
      "概念要完整、刀口要向内：流行对你不是流水线，是把身体、偏见与骄傲硬塞进更多人耳朵——甜水灌不饱你，你只服带血的完成度。",
    inclusiveNote:
      "《玫瑰少年》把校园与偏见撕开给所有人看：差异不是待修故障，该改的是目光。",
  },
  eve: {
    name: "艾怡良",
    album: "《垂直活着，水平留恋着》",
    albumCoverUrl:
      "https://p1.music.126.net/FreJrZTi4r7dP9CgtSUENg==/109951169892903291.jpg",
    albums: [
      { title: "《垂直活着，水平留恋着》", neteaseId: "74947015", dims: [2, 1, 1, 1] },
      { title: "《说 艾怡良》", neteaseId: "34701277", dims: [2, 1, 1, 1] },
      { title: "《大人情歌》", neteaseId: "3029971", dims: [2, 1, 1, 1] },
    ],
    resonanceLyrics: [
      {
        line: "垂直活着，水平留恋着。",
        song: "《Forever Young》",
        note: "在坠落与不舍之间找平衡",
        neteaseSongId: "1332662900",
        albumNeteaseId: "74947015",
      },
      {
        line: "你的过往，我停滞，减掉自己；从来没人能完美阐述，得到总和。",
        song: "《我们的总和》",
        note: "用算式比喻感情里的进退与自我消耗",
        neteaseSongId: "412911648",
        albumNeteaseId: "34701277",
      },
      {
        line: "我已经把我自己放在你那里，一去不返。",
        song: "《给朱利安》",
        note: "在关系里交出去的，从来不只是时间",
        neteaseSongId: "1334667445",
        albumNeteaseId: "74947015",
      },
      {
        line: "拍着口袋里空头支票，顶着颗二手的脑袋。",
        song: "《空头支票》",
        note: "承诺落空时仍想相信的那张纸",
        neteaseSongId: "414980317",
        albumNeteaseId: "34701277",
      },
      {
        line: "那一片杜鹃花海开得太奔放，虽然已不是它的花季。",
        song: "《拼图》",
        note: "遗憾与拼凑里的爱（Lost Piece），收录于《说 艾怡良》",
        neteaseSongId: "414980316",
        albumNeteaseId: "34701277",
      },
      {
        line: "下午三点的操场好冷淡，脏兮兮的小孩还没来。",
        song: "《夜晚出生的小孩》",
        note: "敏感体质在人群里的偏移",
        neteaseSongId: "1334667449",
        albumNeteaseId: "74947015",
      },
      {
        line: "So坏 So right，就是见怪不怪，男坏女爱。",
        song: "《坏》",
        note: "大人情歌里带点野性的恋爱姿态",
        neteaseSongId: "29535929",
        albumNeteaseId: "3029971",
      },
    ],
    tagline: "都市伤痕文学一级选手。",
    traitsDetailed: `创作极具电影感与小说感，歌词常是独白、对话与场景切换，情绪浓度高但句子漂亮。嗓音磁性、略带沙哑，擅长「把狼狈唱得高级」。题材多写都市男女的拉扯、遗憾与自我欺骗，文字密度高，适合反复咀嚼。金曲奖认可度高，属于「作者型流行」：旋律服务叙事，叙事又反哺记忆点。`,
    blurb:
      "都市夜里的狼狈被你写成高级狼狈：烂摊子不必伪装洒脱，烂也可以烂得很漂亮。情绪满格，句子照样准。",
    inclusiveNote:
      "她写爱与自欺，也写关系里的丑态：破碎不必先抛光，才配被写进歌。",
  },
  sandee: {
    name: "陈珊妮",
    album: "《战神卡尔迪亚》",
    albumCoverUrl:
      "https://p2.music.126.net/VrM_no7PrJaZw2aHGwIU5A==/109951165285762066.jpg",
    albums: [
      { title: "《战神卡尔迪亚》", neteaseId: "36192725", dims: [2, 1, 1, 2] },
      { title: "《如果有一件事是重要的》", neteaseId: "21272", dims: [2, 1, 1, 2] },
      { title: "《双陈记》", neteaseId: "21269", dims: [2, 1, 1, 2] },
      { title: "《Juvenile A》", neteaseId: "81592484", dims: [2, 1, 1, 2] },
    ],
    resonanceLyrics: [
      {
        line: "如果有一件事是重要的，那就是对与错的总和。",
        song: "《如果有一件事是重要的》",
        note: "收录于《如果有一件事是重要的》",
        neteaseSongId: "209048",
        albumNeteaseId: "21272",
      },
      {
        line: "极大的时代爱是极微的拥有。",
        song: "《战神卡尔迪亚》",
        note: "收录于《战神卡尔迪亚》",
        neteaseSongId: "506986736",
        albumNeteaseId: "36192725",
      },
      {
        line: "这是最好的时代？这是最坏的时代！",
        song: "《双陈记》",
        note: "收录于同名专辑《双陈记》",
        neteaseSongId: "209032",
        albumNeteaseId: "21269",
      },
      {
        line: "你可还记得旧照片里逼真的自己。",
        song: "《恐怖谷》",
        note: "收录于《Juvenile A》",
        neteaseSongId: "1390480245",
        albumNeteaseId: "81592484",
      },
      {
        line: "你正伟大的重现，经典丧尸电影。",
        song: "《你要去哪里》",
        note: "收录于《Juvenile A》",
        neteaseSongId: "1386200220",
        albumNeteaseId: "81592484",
      },
    ],
    tagline: "冷感电子，人间清醒。",
    traitsDetailed: `制作人思维极强的创作歌手，作品长期探索电子、另类流行与文本实验。声线冷静、克制，常用反讽与隐喻构建叙事，拒绝廉价的情绪投喂。对产业与审美有鲜明态度，歌词常带批判性与知识分子趣味。整体气质「冷、准、狠」，适合喜欢听编曲细节与语言游戏的听众。`,
    blurb:
      "编曲要有骨、词里要有刺：廉价煽情和刻板印象一律拒收，宁可冷感里抠真实——流行可以很刻薄，边缘人也配拥有自己的语法。",
    inclusiveNote:
      "她的作品像冷眼手术刀：戳穿套路，也给异类与不合时宜留一点体面。",
  },
  shiqi: {
    name: "孙盛希",
    album: "《希游记》",
    albumCoverUrl:
      "https://p2.music.126.net/BQIuhaCHDL2LU2J-ClSC8A==/109951171315962269.jpg",
    albums: [
      { title: "《希游记》", neteaseId: "74265934", dims: [2, 1, 2, 2] },
      { title: "《出没地带》", neteaseId: "99125939", dims: [2, 1, 2, 2] },
      { title: "《Girls》", neteaseId: "2866458", dims: [2, 1, 2, 2] },
    ],
    resonanceLyrics: [
      {
        line: "也许是我少一点天份。",
        song: "《少一点天份》",
        note: "爱而不得时的自我怀疑与和解；该曲为歌名非专辑名，最早收录于首张专辑《Girls》；网易云此曲多见同名数位单曲/EP",
        neteaseSongId: "29790225",
        albumNeteaseId: "2866458",
      },
      {
        line: "离开，我只想离开，这一座城市找不到欢笑，都只是假笑。",
        song: "《梦游》",
        note: "在忙碌与表演里辨认真实情绪",
        neteaseSongId: "1323301864",
        albumNeteaseId: "74265934",
      },
      {
        line: "你那头几点钟，天亮了，夜晚却锁着不走。",
        song: "《你那边几点》",
        note: "时差与想念把一分钟拉长",
        neteaseSongId: "1323304922",
        albumNeteaseId: "74265934",
      },
      {
        line: "毫无征兆，或线索。",
        song: "《潜伏期》",
        note: "爱像病原体，入侵日常才发觉",
        neteaseSongId: "1500379460",
        albumNeteaseId: "99125939",
      },
      {
        line: "从某月某日爱上了，看起来坏坏的你。",
        song: "《暧》",
        note: "上一张专辑里悬而未决的心跳",
        neteaseSongId: "1323303867",
        albumNeteaseId: "74265934",
      },
      {
        line: "我站在街角等绿灯变亮，一个人走路突然好宽敞。",
        song: "《不要让我后悔》",
        note: "Chill R&B 里最后一次坦白",
        neteaseSongId: "1500377533",
        albumNeteaseId: "99125939",
      },
      {
        line: "丢了吧，空了吗，别对我失望。",
        song: "《查无此曲》",
        note: "黑洞般的私密情绪",
        neteaseSongId: "1500377534",
        albumNeteaseId: "99125939",
      },
      {
        line: "于是呢，你不再把自己放进来，期待的不存在。",
        song: "《于是呢》",
        note: "专辑收尾，与自己和解前的自问",
        neteaseSongId: "1500379446",
        albumNeteaseId: "99125939",
      },
      {
        line: "Give it to me，留了记号在身上。",
        song: "《Give It to Me》",
        note: "欲望不必拐弯抹角",
        neteaseSongId: "1499779883",
        albumNeteaseId: "99125939",
      },
    ],
    tagline: "R&B 灵魂，都市夜行动物。",
    traitsDetailed: `R&B / Neo-Soul 路线清晰，强调律动、音色质感与即兴感。作品常带都市夜晚的氛围：暧昧、疏离、克制的热烈。演唱上真假音转换与节奏切分是标志，编曲偏现代制作。气质国际化、时尚，适合追求「听感高级」与氛围驱动的听众。`,
    blurb:
      "鼓点和呼吸里养暧昧：不必急着给欲望上户口，距离可以是自保，热烈也可以只给对的人看。",
    inclusiveNote:
      "都市情感本来就不非黑即白：迂回、欲言又止，都是另一种不肯将就。",
  },
  alin: {
    name: "黄丽玲 A-Lin",
    album: "《LINK》",
    albumCoverUrl:
      "https://p2.music.126.net/W5qklsOwVwD_ILJpnCKLsA==/109951167208044048.jpg",
    albums: [
      { title: "《LINK》", neteaseId: "142575869", dims: [1, 2, 2, 1] },
      { title: "《寂寞不痛》", neteaseId: "20834", dims: [1, 2, 2, 1] },
      { title: "《幸福了 然后呢》", neteaseId: "2270070", dims: [1, 2, 2, 1] },
    ],
    resonanceLyrics: [
      {
        line: "给我一个理由忘记，那么爱我的你。",
        song: "《给我一个理由忘记》",
        note: "收录于《寂寞不痛》",
        neteaseSongId: "205342",
        albumNeteaseId: "20834",
      },
      {
        line: "幸福了，然后呢？",
        song: "《幸福了 然后呢》",
        note: "收录于《幸福了 然后呢》",
        neteaseSongId: "25657348",
        albumNeteaseId: "2270070",
      },
      {
        line: "今晚你想念的人是不是我，是不是我。",
        song: "《今晚你想念的人是不是我》",
        note: "收录于《寂寞不痛》",
        neteaseSongId: "205413",
        albumNeteaseId: "20834",
      },
      {
        line: "好朋友的祝福，我收到了，也转身了。",
        song: "《好朋友的祝福》",
        note: "收录于《幸福了 然后呢》",
        neteaseSongId: "25657354",
        albumNeteaseId: "2270070",
      },
      {
        line: "我们不讨论的关系，很接近却不是爱情。",
        song: "《挚友》",
        note: "收录于《LINK》",
        neteaseSongId: "1932627926",
        albumNeteaseId: "142575869",
      },
      {
        line: "Na i safofofoay a radiw（一起来唱歌）。",
        song: "《ROMADIW》",
        note: "收录于《LINK》",
        neteaseSongId: "1932627921",
        albumNeteaseId: "142575869",
      },
    ],
    tagline: "力量型抒情，唱到心里去。",
    traitsDetailed: `以力量与共鸣见长的抒情歌手，音色饱满、气息扎实，擅长大歌与情绪峰值段落。演绎偏「戏剧化但不浮夸」，能把痛与释怀同时推到听众胸口。题材多围绕爱与离别，亦尝试多元曲风与跨界合作。现场感染力强，是典型的「把情绪唱开」的歌手类型。`,
    blurb:
      "要的是被唱穿的那种爽感：高音与眼泪不是作秀，是「听见我」的硬诉求——大情绪也值得占满空间：酷儿式的痛快与脆弱，都值得被听完、被接住，不必把自己收成「好消化」的样子。",
    inclusiveNote:
      "她把喉咙当扩音器：痛与释怀都可以很大声，不必为「懂事」打折。",
  },
  tanya: {
    name: "蔡健雅",
    album: "《Depart》",
    albumCoverUrl:
      "https://p1.music.126.net/Um5PpfGlfPZMJj81frDvRw==/109951166274970187.jpg",
    albums: [
      { title: "《DEPART》", neteaseId: "131676223", dims: [1, 1, 1, 2] },
      { title: "《Goodbye & Hello》", neteaseId: "21257", dims: [1, 1, 1, 2] },
      { title: "《若你碰到他》", neteaseId: "21252", dims: [1, 1, 1, 2] },
      { title: "《说到爱》", neteaseId: "21250", dims: [1, 1, 1, 2] },
    ],
    resonanceLyrics: [
      {
        line: "学会认真，学会忠诚，适者才能生存。",
        song: "《达尔文》",
        note: "收录于《Goodbye & Hello》",
        neteaseSongId: "208933",
        albumNeteaseId: "21257",
      },
      {
        line: "其实很简单，其实很自然，两个人的爱由两人分担。",
        song: "《空白格》",
        note: "收录于《Goodbye & Hello》",
        neteaseSongId: "208938",
        albumNeteaseId: "21257",
      },
      {
        line: "我不难过了，甚至真心希望你能幸福。",
        song: "《陌生人》",
        note: "收录于同名专辑《陌生人》（网易云此版；录音室版亦常见于《Goodbye & Hello》）",
        neteaseSongId: "209121",
        albumNeteaseId: "21276",
      },
      {
        line: "爱沿着抛物线，过了最高点，只能往下掉。",
        song: "《抛物线》",
        note: "收录于《若你碰到他》（网易云此版）",
        neteaseSongId: "208901",
        albumNeteaseId: "21252",
      },
      {
        line: "说到爱，如果只能说，不能抱紧，算不算一种残忍。",
        song: "《说到爱》",
        note: "收录于《说到爱》",
        neteaseSongId: "208884",
        albumNeteaseId: "21250",
      },
      {
        line: "不是因为怕孤独，才相处；任心跳放肆地翩翩飞舞，让浪漫作主。",
        song: "《让浪漫作主》",
        note: "收录于《DEPART》",
        neteaseSongId: "1868851806",
        albumNeteaseId: "131676223",
      },
      {
        line: "眼前的路看似有点模糊，我看不清楚；我甩不掉心中那份绝望，该死的绝望。",
        song: "《Bluebirds》",
        note: "收录于《DEPART》",
        neteaseSongId: "1868850854",
        albumNeteaseId: "131676223",
      },
    ],
    tagline: "极简吉他，都市孤独学大师。",
    traitsDetailed: `创作型歌手与制作人，吉他民谣与都市抒情并行，作品气质克制、干净、偏冷。歌词擅长用简单句刺中复杂处境：孤独、分手、成长与自我对话。旋律线条流畅但不滥情，常有「留白」让听众自行填入经历。多次金曲奖肯定，属于「越听越像自己」的类型。`,
    blurb:
      "复杂生活唱得很轻，轻里藏针：留白不是冷淡，是给伤口留通风口。爱若只剩一种模板，宁可不要。",
    inclusiveNote:
      "她的歌常给独行者一句冷笑话式的确认：一个人走不丢人，合群才有时是慢性中毒。",
  },
  hebe: {
    name: "田馥甄",
    album: "《无人知晓》",
    albumCoverUrl:
      "https://p2.music.126.net/OjItC1KtO-Jg_lBVqsihkQ==/109951165341263996.jpg",
    albums: [
      { title: "《无人知晓》", neteaseId: "95902047", dims: [2, 2, 1, 2] },
      { title: "《渺小》", neteaseId: "2704008", dims: [2, 2, 1, 2] },
      { title: "《To Hebe》", neteaseId: "29447", dims: [2, 2, 1, 2] },
    ],
    resonanceLyrics: [
      {
        line: "难以昭告世界，爱上你多优越，无人知晓，可不可怜。",
        song: "《无人知晓》",
        note: "收录于《无人知晓》",
        neteaseSongId: "1481929839",
        albumNeteaseId: "95902047",
      },
      {
        line: "我把我的灵魂送给你，或是一首歌，带你潜进深海里。",
        song: "《或是一首歌》",
        note: "收录于《无人知晓》",
        neteaseSongId: "1472606824",
        albumNeteaseId: "95902047",
      },
      {
        line: "黄昏宣告着，今天已死亡。",
        song: "《悬日》",
        note: "收录于《无人知晓》",
        neteaseSongId: "1416387774",
        albumNeteaseId: "95902047",
      },
      {
        line: "可以只睡觉吗，不做成什么梦。",
        song: "《皆可》",
        note: "收录于《无人知晓》",
        neteaseSongId: "1454447163",
        albumNeteaseId: "95902047",
      },
      {
        line: "我都寂寞多久了还是没好，感觉全世界都在窃窃嘲笑我的骄傲。",
        song: "《你就不要想起我》",
        note: "收录于《渺小》",
        neteaseSongId: "28018075",
        albumNeteaseId: "2704008",
      },
      {
        line: "原来最暗的天空，总有最闪烁的星星。",
        song: "《渺小》",
        note: "收录于《渺小》",
        neteaseSongId: "27968284",
        albumNeteaseId: "2704008",
      },
      {
        line: "谁无聊拿放大镜看风景累不累，却忘记了看清楚自己是谁。",
        song: "《不醉不会》",
        note: "收录于《渺小》",
        neteaseSongId: "28018072",
        albumNeteaseId: "2704008",
      },
      {
        line: "还是原来那个我，不过流眼泪更多。",
        song: "《寂寞寂寞就好》",
        note: "收录于《To Hebe》",
        neteaseSongId: "296885",
        albumNeteaseId: "29447",
      },
      {
        line: "我想我不会爱你，因为我不想，失去自己。",
        song: "《我想我不会爱你》",
        note: "收录于《To Hebe》",
        neteaseSongId: "296883",
        albumNeteaseId: "29447",
      },
    ],
    tagline: "冷面甜嗓，疏离感天花板。",
    traitsDetailed: `音色清冷、透亮，擅长以「轻」的方式处理「重」的情绪。作品偏文艺流行与独立气质，歌词常写秘密、距离、不可得与内心戏。演唱上气声与语感细腻，整体形象低调，却把个人审美贯彻在选曲与视觉里。适合喜欢「疏离感」与内在独白的听众。`,
    blurb:
      "重的心事塞进轻的声线：难以昭告的秘密，偏用气声说出口——疏离是护甲，不是冷漠；不合群就不合群。",
    inclusiveNote:
      "许多渴望只敢小声承认：也值得被听懂，不必先变「阳光」才配开口。",
  },
  fanxiaoxuan: {
    name: "范晓萱",
    album: "《Darling》",
    albumCoverUrl:
      "https://p1.music.126.net/0KfRz0SNX6rSbBWc39JIBw==/109951165644186954.jpg",
    albums: [
      {
        title: "《Darling》",
        neteaseId: "23176",
        dims: [2, 1, 2, 1],
        coverUrl: "https://p1.music.126.net/0KfRz0SNX6rSbBWc39JIBw==/109951165644186954.jpg",
      },
      {
        title: "《Rain》",
        neteaseId: "23196",
        dims: [2, 1, 2, 1],
        coverUrl: "https://p1.music.126.net/uKIynn_d0rfZKPrO9tdEdw==/109951167188717023.jpg",
      },
    ],
    resonanceLyrics: [
      {
        line: "如果你爱我，你会来找我，你会知道我快不能活。",
        song: "《氧气》(O2 有氧版)",
        note: "此句为 O2 有氧版歌词；首版亦见于《好萱写》等；网易云：Darling 专辑",
        neteaseSongId: "230407",
        albumNeteaseId: "23176",
      },
      {
        line: "如果你爱我，你会来救我，空气很稀薄，因为寂寞。",
        song: "《氧气》(O1 缺氧版)",
        note: "此句为 O1 缺氧版歌词；网易云：Darling 专辑",
        neteaseSongId: "230402",
        albumNeteaseId: "23176",
      },
    ],
    tagline: "音乐小魔女，甜与怪诞都成立。",
    traitsDetailed: `从儿歌到摇滚与电子，声线与创作跨度极大；情歌与自我表达都锋利而真实。`,
    blurb:
      "甜与怪诞同屏又怎样：在「被期待的样子」外留一条旁轨，不迎合凝视，只认领自己的版本——千禧年小魔女早就在教这件事。",
    inclusiveNote:
      "可爱从不是单行道：锋利、古怪、阴郁，都可以是忠于自己的选法。",
  },
  cyndi: {
    name: "王心凌",
    album: "《爱你》",
    albumCoverUrl:
      "https://p1.music.126.net/8P1W00PwAVwLD_d-7vvxZw==/109951173007905115.jpg",
    albums: [
      { title: "《爱你》", neteaseId: "29562", dims: [1, 1, 2, 1] },
      { title: "《Honey》", neteaseId: "29561", dims: [1, 1, 2, 1] },
    ],
    resonanceLyrics: [
      {
        line: "如果你突然打了个喷嚏，那一定就是我在想你。",
        song: "《爱你》",
        note: "",
        neteaseSongId: "297839",
        albumNeteaseId: "29562",
        megaHit: true,
      },
      {
        line: "情话多说一点，想我就多看一眼。",
        song: "《爱你》",
        note: "",
        neteaseSongId: "297839",
        albumNeteaseId: "29562",
        megaHit: true,
      },
      {
        line: "第一次爱的人，他的坏他的好，却像胸口刺青，是永远的记号。",
        song: "《第一次爱的人》",
        note: "",
        neteaseSongId: "297845",
        albumNeteaseId: "29562",
      },
    ],
    tagline: "甜心教主，唱跳与情歌都刻在一代人记忆里。",
    traitsDetailed: `千禧华语流行与偶像剧金曲的代表声线之一，快歌与抒情都极具辨识度。`,
    blurb:
      "甜被你唱成一种攻击性：明亮、直接，甜不是示弱，是选了一种让人无话可说的活法——会照顾别人，也敢先照顾自己。",
    inclusiveNote: "甜可以是一种政治：不是讨人喜欢，是偏要在刻板里把自己的形状撑开。",
  },
  chenli: {
    name: "陈粒",
    album: "《小梦大半》",
    albumCoverUrl:
      "https://p1.music.126.net/HQxTggMCB7AHUXN-ZFEtmA==/1371091013186741.jpg",
    albums: [
      { title: "《小梦大半》", neteaseId: "34780579", dims: [2, 2, 2, 2] },
      { title: "《如也》", neteaseId: "3098832", dims: [2, 2, 2, 2] },
    ],
    resonanceLyrics: [
      {
        line: "对你的偏爱太过于明目张胆。",
        song: "《小半》",
        note: "",
        neteaseSongId: "421423806",
        albumNeteaseId: "34780579",
      },
      {
        line: "光落在你脸上，可爱一如往常。",
        song: "《光》",
        note: "",
        neteaseSongId: "30431364",
        albumNeteaseId: "3098832",
      },
      {
        line: "盼我疯魔还盼我孑孓不独活。",
        song: "《易燃易爆炸》",
        note: "",
        neteaseSongId: "30431376",
        albumNeteaseId: "3098832",
      },
    ],
    tagline: "独立唱作人，词曲一体，气质锋利又温柔。",
    traitsDetailed: `从民谣到独立流行，作品常带隐喻与情绪张力，现场与录音室都极具个人标签。`,
    blurb:
      "四档拉满才解锁：独立、疗愈、态度与向内生长不必互殴——别人争主流与边缘，你只管调自己的音量；像谁不像谁，随他们吵去。",
    inclusiveNote: "隐藏结局：四指标同档 2 时出现——像彩蛋，也像拒绝对号入座。",
  },

};

const DIM_KEYS = ["态度", "独立", "疗愈", "实验"];

/**
 * 雷达图：四轴为各维「得分 / 理论满分」的 0–100%
 */
function drawRadar(svgEl, valuesPct) {
  const cx = 100;
  const cy = 100;
  const r = 72;
  const n = valuesPct.length;
  const angles = Array.from({ length: n }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / n);
  const pts = angles.map((a, i) => [
    cx + r * (valuesPct[i] / 100) * Math.cos(a),
    cy + r * (valuesPct[i] / 100) * Math.sin(a),
  ]);

  const grid = [0.25, 0.5, 0.75, 1].map((scale) => {
    const ring = angles.map((a) => [cx + r * scale * Math.cos(a), cy + r * scale * Math.sin(a)]);
    return `${ring.map((p) => p.join(",")).join(" ")} Z`;
  });

  let html = `<defs>
    <linearGradient id="radarFill" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#e879f9;stop-opacity:0.35" />
      <stop offset="100%" style="stop-color:#7dd3fc;stop-opacity:0.25" />
    </linearGradient>
  </defs>`;

  grid.forEach((d) => {
    html += `<polygon fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="0.5" points="${d}" />`;
  });

  angles.forEach((a) => {
    const x2 = cx + r * Math.cos(a);
    const y2 = cy + r * Math.sin(a);
    html += `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="rgba(255,255,255,0.1)" stroke-width="0.5" />`;
  });

  const polyPoints = pts.map((p) => p.join(",")).join(" ");
  html += `<polygon points="${polyPoints}" fill="url(#radarFill)" stroke="#e879f9" stroke-width="1.2" />`;

  angles.forEach((a, i) => {
    const x = cx + r * (valuesPct[i] / 100) * Math.cos(a);
    const y = cy + r * (valuesPct[i] / 100) * Math.sin(a);
    html += `<circle cx="${x}" cy="${y}" r="3" fill="#7dd3fc" />`;
  });

  DIM_KEYS.forEach((label, i) => {
    const a = angles[i];
    const lx = cx + (r + 18) * Math.cos(a);
    const ly = cy + (r + 18) * Math.sin(a);
    html += `<text x="${lx}" y="${ly}" fill="#9a8fa8" font-size="7" text-anchor="middle" dominant-baseline="middle">${label}</text>`;
  });

  svgEl.innerHTML = html;
}

function showScreen(id) {
  ["screen-intro", "screen-quiz", "screen-loading", "screen-result"].forEach((sid) => {
    const el = document.getElementById(sid);
    if (el) el.classList.toggle("hidden", sid !== id);
  });
}

let currentIndex = 0;
const dimTotals = [0, 0, 0, 0];
const answerHistory = [];

let lastResultId = "anpu";
let lastResultAlbum = { title: "", neteaseId: "", coverUrl: "" };
let lastHeroResonance = { line: "", song: "", neteaseSongId: "" };
/** 与结果页雷达一致（音乐光谱约 75%–95%），供分享海报使用 */
let lastPortraitJitteredPercents = [0, 0, 0, 0];

/** 去掉题干前连续出现的「【…】」标签，不展示在页面上 */
function stripLeadingQuestionTags(text) {
  let s = text || "";
  while (/^【[^】]*】/.test(s)) {
    s = s.replace(/^【[^】]*】\s*/, "");
  }
  return s.trim();
}

/**
 * 每题选项顺序随机打乱（由题号+题干种子决定，返回上一题时顺序不变）。
 * 每个选项对象随整项移动，opt.points（0/25/75/100）与 opt.text 绑定不变；
 * 界面 A–D 仅表示当前由上到下的位置，同一文案/同一分值的路径与计分一致。
 */
function shuffleOptionsDeterministic(options, qIndex, qText) {
  const arr = options.slice();
  let seed = hashString(String(qIndex) + "\0" + (qText || ""));
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    const j = seed % (i + 1);
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function renderQuestion() {
  const q = QUESTIONS[currentIndex];
  document.getElementById("q-current").textContent = String(currentIndex + 1);
  document.getElementById("q-total").textContent = String(QUESTIONS.length);

  const stem = stripLeadingQuestionTags(q.q);
  const options = shuffleOptionsDeterministic(q.options, currentIndex, stem);
  const qText = stem;
  document.getElementById("question-text").textContent = stripLeadingQuestionTags(qText);
  const pct = ((currentIndex + 1) / QUESTIONS.length) * 100;
  document.getElementById("progress-bar").style.width = `${pct}%`;

  const ul = document.getElementById("options-list");
  ul.innerHTML = "";
  options.forEach((opt, i) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    const key = String.fromCharCode(65 + i);
    const keySpan = document.createElement("span");
    keySpan.className = "option-key";
    keySpan.textContent = `${key}.`;
    const textSpan = document.createElement("span");
    textSpan.className = "option-text";
    textSpan.textContent = opt.text;
    btn.appendChild(keySpan);
    btn.appendChild(textSpan);
    btn.setAttribute("aria-label", `选项 ${key}：${opt.text}`);
    btn.addEventListener("click", () => onSelect(opt));
    li.appendChild(btn);
    ul.appendChild(li);
  });

  const prevBtn = document.getElementById("btn-prev");
  if (prevBtn) prevBtn.disabled = currentIndex === 0;
}

function onSelect(opt) {
  const dimIndex = Math.floor(currentIndex / 5);
  const pts = Number(opt.points) || 0;
  dimTotals[dimIndex] += pts;
  answerHistory.push({ opt, qIndex: currentIndex, dimIndex, points: pts });

  currentIndex += 1;
  if (currentIndex >= QUESTIONS.length) {
    showScreen("screen-loading");
    window.setTimeout(showResult, 1600);
    return;
  }
  renderQuestion();
}

function goToPreviousQuestion() {
  if (currentIndex === 0) return;
  const last = answerHistory.pop();
  if (!last) return;
  if (typeof last.dimIndex === "number" && last.dimIndex >= 0 && last.points != null) {
    dimTotals[last.dimIndex] -= last.points;
  }
  currentIndex -= 1;
  renderQuestion();
}

function showResult() {
  const userTiers = dimsToTiers(dimTotals);

  const winnerId = pickResultArtistRandom(userTiers);
  lastResultId = winnerId;
  const artist = ARTISTS[winnerId];
  lastResultAlbum = pickAlbumMetaForNorm(winnerId, dimTotals);
  const coverFig = document.getElementById("result-album-cover-fig");
  const coverImg = document.getElementById("result-album-cover-img");
  const coverLink = document.getElementById("result-album-cover-link");
  if (coverFig && coverImg && coverLink) {
    const url = lastResultAlbum.coverUrl || artist.albumCoverUrl;
    if (url) {
      coverImg.src = url;
      coverImg.alt = `${artist.name}${lastResultAlbum.title}专辑封面`;
      if (lastResultAlbum.neteaseId) {
        coverLink.href = neteaseAlbumUrl(lastResultAlbum.neteaseId);
        coverLink.classList.remove("result-album-cover-link--nohref");
      } else {
        coverLink.href = "#";
        coverLink.classList.add("result-album-cover-link--nohref");
      }
      coverFig.hidden = false;
    } else {
      coverFig.hidden = true;
    }
  }

  const resultNameEl = document.getElementById("result-name");
  if (resultNameEl) {
    if (artist.hidden) {
      resultNameEl.innerHTML = `陈粒<span class="result-name-hidden-tag" aria-label="隐藏结局">（隐藏）</span>`;
    } else {
      resultNameEl.textContent = artist.name;
    }
  }
  document.getElementById("result-album").textContent = `本命专辑：${lastResultAlbum.title}`;
  lastHeroResonance = pickResonanceByAnswerPath(winnerId, artist, dimTotals, lastResultAlbum);
  const lyricLineEl = document.getElementById("result-album-lyric-line");
  const lyricSongEl = document.getElementById("result-album-lyric-song");
  if (lastHeroResonance && lastHeroResonance.line && lyricLineEl && lyricSongEl) {
    lyricLineEl.textContent = `「${lastHeroResonance.line}」`;
    lyricSongEl.textContent = lastHeroResonance.song ? `—— ${lastHeroResonance.song}` : "";
  } else if (lyricLineEl && lyricSongEl) {
    lyricLineEl.textContent = "";
    lyricSongEl.textContent = "";
  }
  document.getElementById("result-blurb").textContent = artist.blurb;

  const albumUl = document.getElementById("result-album-links");
  if (albumUl) {
    albumUl.innerHTML = "";
    buildRecommendedAlbumRows(userTiers, dimTotals, winnerId, 3).forEach((row) => {
      const li = document.createElement("li");
      li.className = "album-rec-item";
      if (row.neteaseId) {
        const link = document.createElement("a");
        link.href = neteaseAlbumUrl(row.neteaseId);
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = `${row.artistName} · ${row.title}`;
        li.appendChild(link);
      } else {
        li.textContent = `${row.artistName} · ${row.title}`;
      }
      albumUl.appendChild(li);
    });
  }

  const baseDimPct = userDimRawToPercent(dimTotals);
  const radarAxisPct = ARTIST_SPECTRUM_DISPLAY_PCT[winnerId]
    ? ARTIST_SPECTRUM_DISPLAY_PCT[winnerId].slice()
    : spectrumDisplayPercents(baseDimPct);
  lastPortraitJitteredPercents = radarAxisPct.slice();
  drawRadar(document.getElementById("radar-svg"), radarAxisPct);

  const leg = document.getElementById("radar-legend");
  leg.innerHTML = "";
  DIM_KEYS.forEach((label, i) => {
    const li = document.createElement("li");
    const pct = Math.round(radarAxisPct[i]);
    li.textContent = `${label} ${pct}%`;
    leg.appendChild(li);
  });

  const combinedScores = getArtistProfileSimilarityScores(userTiers);
  const rankedAll = ARTIST_ORDER.map((id) => ({ id, score: combinedScores[id] })).sort((a, b) => b.score - a.score);
  const top3 = rankedAll
    .filter(({ id }) => id !== winnerId && (winnerId === "chenli" || id !== "chenli"))
    .slice(0, 3);
  const min3 = top3.length ? Math.min(...top3.map((x) => x.score)) : 0;
  const max3 = top3.length ? Math.max(...top3.map((x) => x.score)) : 1;
  const range3 = max3 - min3;
  const top3Ul = document.getElementById("result-top3-list");
  if (top3Ul) {
    top3Ul.innerHTML = "";
    top3.forEach(({ id, score }, idx) => {
      const effRange = Math.max(range3, 0.12);
      const t = effRange > 0 ? (score - min3) / effRange : 0;
      const fromScore = 34 + 62 * Math.min(1, Math.max(0, t));
      const fromRank = [96, 74, 50][idx] ?? 46;
      const barPct = Math.round(0.42 * fromRank + 0.58 * fromScore);
      const overallRank = rankedAll.findIndex((x) => x.id === id) + 1;
      const li = document.createElement("li");
      li.className = "top3-item";
      const name = document.createElement("span");
      name.className = "top3-name";
      name.textContent = ARTISTS[id].name;
      const barWrap = document.createElement("span");
      barWrap.className = "top3-bar-wrap";
      const bar = document.createElement("span");
      bar.className = "top3-bar";
      bar.style.width = `${barPct}%`;
      barWrap.appendChild(bar);
      
      const rankEl = document.createElement("span");
      rankEl.className = "top3-rank";
      rankEl.textContent = `第 ${overallRank} 名`;

      li.appendChild(name);
      li.appendChild(barWrap);
      li.appendChild(rankEl);
      top3Ul.appendChild(li);
    });
  }

  showScreen("screen-result");
}

function resetQuiz() {
  for (let i = 0; i < dimTotals.length; i++) dimTotals[i] = 0;
  answerHistory.length = 0;
  currentIndex = 0;
  renderQuestion();
  showScreen("screen-quiz");
}

document.getElementById("btn-start").addEventListener("click", () => {
  resetQuiz();
});

document.getElementById("btn-prev").addEventListener("click", () => {
  goToPreviousQuestion();
});

document.getElementById("btn-retry").addEventListener("click", () => {
  resetQuiz();
});

function getPageUrl() {
  return typeof window !== "undefined" && window.location && window.location.href
    ? window.location.href.split("#")[0]
    : "";
}

function buildSharePayload() {
  const artist = ARTISTS[lastResultId];
  const url = getPageUrl();
  const shareName = artist.hidden ? "陈粒（隐藏）" : artist.name;
  const title = `【TWTI】我的台女音乐人格测试结果是「${shareName}」`;
  const pick = lastHeroResonance;
  const songLink = pick.neteaseSongId ? neteaseSongUrl(pick.neteaseSongId) : "";
  const albumTitle = lastResultAlbum.title || artist.album;
  const body = `${title}
本命专辑：${albumTitle}
共鸣句：「${pick.line}」${pick.song}${songLink ? `\n网易云歌曲：${songLink}` : ""}

${SITE_TAGLINE}
链接：${url}

#台女音乐人格测试 #TWTI #音乐人格 #华语女声`;
  return { title, body, url, artist };
}

function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.left = "-9999px";
  document.body.appendChild(ta);
  ta.select();
  document.execCommand("copy");
  document.body.removeChild(ta);
  return Promise.resolve();
}

function toast(msg) {
  let el = document.getElementById("twti-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "twti-toast";
    el.className = "toast";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add("toast--show");
  window.clearTimeout(toast._t);
  toast._t = window.setTimeout(() => el.classList.remove("toast--show"), 2200);
}

function canvasBreakLines(ctx, text, maxWidth) {
  const chars = Array.from(text);
  const lines = [];
  let line = "";
  for (let n = 0; n < chars.length; n++) {
    const testLine = line + chars[n];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lines.push(line);
      line = chars[n];
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function canvasStrokeRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  ctx.stroke();
}

function isLocalDevUrl(url) {
  if (!url) return true;
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "[::1]";
  } catch {
    return true;
  }
}

const POSTER_COVER_SIZE = 360;
const POSTER_GAP_BEFORE_COVER = 28;
const POSTER_GAP_AFTER_COVER = 44;

/** Canvas 必须以全字库字体优先；勿把 system-ui 放首位，否则缺字会逐字回退，出现「黄丽」与「玲」字体不一致。 */
const POSTER_FONT_STACK = '"Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

async function ensurePosterFontsLoaded() {
  if (typeof document === "undefined" || !document.fonts) return;
  try {
    await document.fonts.ready;
    const loads = [
      '600 70px "Noto Sans SC"',
      '600 44px "Noto Sans SC"',
      'italic 32px "Noto Sans SC"',
      '34px "Noto Sans SC"',
      '30px "Noto Sans SC"',
      '26px "Noto Sans SC"',
      '24px "Noto Sans SC"',
      '20px "Noto Sans SC"',
    ];
    await Promise.all(loads.map((desc) => document.fonts.load(desc)));
  } catch (_) {
    /* 离线或拦截时仍尝试绘制 */
  }
}

function measureSharePosterBottomY(ctx, maxText, hasCover) {
  const url = getPageUrl();
  let cursorY = 108 + 58;
  if (hasCover) {
    cursorY += POSTER_GAP_BEFORE_COVER + POSTER_COVER_SIZE + POSTER_GAP_AFTER_COVER + 76 + 64;
  } else {
    cursorY += 92 + 76 + 64;
  }
  const posterLine = lastHeroResonance;
  ctx.font = `italic 32px ${POSTER_FONT_STACK}`;
  const lyricLines = canvasBreakLines(ctx, `「${posterLine.line}」`, maxText);
  const lyricLH = 44;
  for (let i = 0; i < lyricLines.length; i++) {
    cursorY += lyricLH;
  }
  cursorY += 36 + 56;
  const axisPct = lastPortraitJitteredPercents;
  const dimLine = DIM_KEYS.map((k, i) => `${k} ${Math.round(axisPct[i])}%`).join(" · ");
  ctx.font = `24px ${POSTER_FONT_STACK}`;
  const dimLines = canvasBreakLines(ctx, `光谱：${dimLine}`, maxText);
  const dimLH = 36;
  for (let i = 0; i < dimLines.length; i++) {
    cursorY += dimLH;
  }
  cursorY += 48;
  ctx.font = `20px ${POSTER_FONT_STACK}`;
  if (!isLocalDevUrl(url)) {
    const urlLines = canvasBreakLines(ctx, url, maxText);
    for (let i = 0; i < urlLines.length; i++) {
      cursorY += 30;
    }
  } else {
    cursorY += 24;
  }
  return cursorY + 44;
}

function loadAlbumCoverForPoster(url) {
  return new Promise((resolve) => {
    if (!url) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function posterRoundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawPosterAlbumCover(ctx, img, cx, top, size) {
  const x = cx - size / 2;
  const r = 18;
  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, top, size, size, r);
  } else {
    posterRoundRectPath(ctx, x, top, size, size, r);
  }
  ctx.clip();
  ctx.drawImage(img, x, top, size, size);
  ctx.restore();
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, top, size, size, r);
  } else {
    posterRoundRectPath(ctx, x, top, size, size, r);
  }
  ctx.stroke();
}

async function drawSharePoster() {
  await ensurePosterFontsLoaded();

  const W = 1080;
  const pad = 64;
  const cx = W / 2;
  const maxText = W - pad * 2;

  const artist = ARTISTS[lastResultId];
  const coverUrl = (lastResultAlbum && lastResultAlbum.coverUrl) || artist.albumCoverUrl;
  const coverImg = await loadAlbumCoverForPoster(coverUrl);
  const hasCover = !!coverImg;

  const measure = document.createElement("canvas");
  measure.width = W;
  measure.height = 120;
  const mctx = measure.getContext("2d");
  if (!mctx) return null;
  const bottomY = measureSharePosterBottomY(mctx, maxText, hasCover);
  const H = Math.min(1800, Math.max(560, bottomY));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, "#1a1520");
  grd.addColorStop(0.48, "#0f0e12");
  grd.addColorStop(1, "#2d1f3d");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  canvasStrokeRoundRect(ctx, 40, 40, W - 80, H - 80, 24);

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";

  const url = getPageUrl();

  let cursorY = 108;
  ctx.fillStyle = "#e879f9";
  ctx.font = `600 44px ${POSTER_FONT_STACK}`;
  ctx.fillText("TWTI", cx, cursorY);

  cursorY += 58;
  ctx.fillStyle = "#9a8fa8";
  ctx.font = `26px ${POSTER_FONT_STACK}`;
  ctx.fillText(SITE_TAGLINE, cx, cursorY);

  if (hasCover) {
    cursorY += POSTER_GAP_BEFORE_COVER;
    drawPosterAlbumCover(ctx, coverImg, cx, cursorY, POSTER_COVER_SIZE);
    cursorY += POSTER_COVER_SIZE + POSTER_GAP_AFTER_COVER;
  } else {
    cursorY += 92;
  }

  ctx.fillStyle = "#f4f0f8";
  if (artist.hidden) {
    const main = "陈粒";
    const tag = "（隐藏）";
    ctx.font = `600 70px ${POSTER_FONT_STACK}`;
    const w1 = ctx.measureText(main).width;
    ctx.font = `500 34px ${POSTER_FONT_STACK}`;
    const w2 = ctx.measureText(tag).width;
    const tw = w1 + w2;
    ctx.textAlign = "left";
    ctx.font = `600 70px ${POSTER_FONT_STACK}`;
    ctx.fillText(main, cx - tw / 2, cursorY);
    ctx.font = `500 34px ${POSTER_FONT_STACK}`;
    ctx.fillStyle = "#b8a8c8";
    ctx.fillText(tag, cx - tw / 2 + w1, cursorY + 5);
    ctx.textAlign = "center";
    ctx.fillStyle = "#f4f0f8";
  } else {
    ctx.font = `600 70px ${POSTER_FONT_STACK}`;
    ctx.fillText(artist.name, cx, cursorY);
  }

  cursorY += 76;
  ctx.fillStyle = "#7dd3fc";
  ctx.font = `34px ${POSTER_FONT_STACK}`;
  const posterAlbumTitle = (lastResultAlbum && lastResultAlbum.title) || artist.album;
  ctx.fillText(`本命专辑 ${posterAlbumTitle}`, cx, cursorY);

  cursorY += 64;
  ctx.fillStyle = "#d4c4e0";
  ctx.font = `italic 32px ${POSTER_FONT_STACK}`;
  const posterLine = lastHeroResonance;
  const lyricLines = canvasBreakLines(ctx, `「${posterLine.line}」`, maxText);
  const lyricLH = 44;
  lyricLines.forEach((ln) => {
    cursorY += lyricLH;
    ctx.fillText(ln, cx, cursorY);
  });

  cursorY += 36;
  ctx.fillStyle = "#9a8fa8";
  ctx.font = `30px ${POSTER_FONT_STACK}`;
  ctx.fillText(posterLine.song || "", cx, cursorY);

  cursorY += 56;
  ctx.fillStyle = "#8b7fa0";
  ctx.font = `24px ${POSTER_FONT_STACK}`;
  const axisPctPoster = lastPortraitJitteredPercents;
  const dimLine = DIM_KEYS.map((k, i) => `${k} ${Math.round(axisPctPoster[i])}%`).join(" · ");
  const dimLines = canvasBreakLines(ctx, `光谱：${dimLine}`, maxText);
  const dimLH = 36;
  dimLines.forEach((ln) => {
    cursorY += dimLH;
    ctx.fillText(ln, cx, cursorY);
  });

  cursorY += 48;
  ctx.fillStyle = "#6b5f8a";
  ctx.font = `20px ${POSTER_FONT_STACK}`;
  if (!isLocalDevUrl(url)) {
    const urlLines = canvasBreakLines(ctx, url, maxText);
    urlLines.forEach((ln) => {
      cursorY += 30;
      ctx.fillText(ln, cx, cursorY);
    });
  } else {
    ctx.fillText("本地预览", cx, cursorY);
  }

  return canvas;
}

async function savePosterToFile() {
  const canvas = await drawSharePoster();
  if (!canvas) {
    toast("生成图片失败");
    return;
  }
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        toast("导出失败");
        resolve();
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const al = (lastResultAlbum && lastResultAlbum.title) || "result";
      const safe = String(al).replace(/[《》\s]/g, "");
      a.download = `TWTI-${ARTISTS[lastResultId].name}-${safe}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast("已保存");
      resolve();
    }, "image/png");
  });
}

document.getElementById("btn-save-image").addEventListener("click", () => {
  savePosterToFile();
});

document.getElementById("btn-copy-share").addEventListener("click", () => {
  const { body } = buildSharePayload();
  copyText(body).then(() => toast("已复制"));
});