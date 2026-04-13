#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BAK = ROOT / "js" / "app.js.bak"
OUT = ROOT / "js" / "app.js"
CORE = ROOT / "scripts" / "twst_core.js"
QUESTIONS = ROOT / "scripts" / "twst_questions.js"

PROFILES = {
    "anpu": (2, 2, 2, 1),
    "cheer": (1, 2, 2, 2),
    "lala": (2, 2, 1, 1),
    "tanya": (1, 1, 1, 2),
    "waa": (1, 2, 1, 2),
    "eve": (2, 1, 1, 1),
    "sandee": (2, 1, 1, 2),
    "fanxiaoxuan": (2, 1, 2, 1),
    "shiqi": (2, 1, 2, 2),
    "ennong": (1, 2, 1, 1),
    "jolin": (1, 1, 1, 1),
    "hebe": (2, 2, 1, 2),
    "rainie": (1, 1, 2, 2),
    "cyndi": (1, 1, 2, 1),
    "alin": (1, 2, 2, 1),
    "chenli": (2, 2, 2, 2),
}
ORDER = list(PROFILES.keys())

NETEASE_EXTRA = """
  "29562": "https://p1.music.126.net/8P1W00PwAVwLD_d-7vvxZw==/109951173007905115.jpg",
  "29561": "https://p1.music.126.net/rst0tkl1U7jSR6OBEfdKmg==/109951163531439512.jpg",
  "23176": "https://p1.music.126.net/0KfRz0SNX6rSbBWc39JIBw==/109951165644186954.jpg",
  "23196": "https://p1.music.126.net/uKIynn_d0rfZKPrO9tdEdw==/109951167188717023.jpg",
  "34780579": "https://p1.music.126.net/HQxTggMCB7AHUXN-ZFEtmA==/1371091013186741.jpg",
  "3098832": "https://p2.music.126.net/VuJFMbXzpAProbJPoXLv7g==/7721870161993398.jpg",
"""

PICK_ALBUM = r"""/** 按用户四档与专辑 dims（同 1/2 档）选专辑 */
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
  const userTiers = dimsToTiers(dimSums);
  const userV = tiersToScoreVec(userTiers);
  const neutral = [1, 1, 1, 1];
  const scored = albums.map((al) => {
    const d = al.dims && al.dims.length === 4 ? al.dims : neutral;
    const av = d.map((x) => Number(x) * 50);
    return { al, sim: cosineSimNorm(userV, av) };
  });
  scored.sort((a, b) => b.sim - a.sim);
  const bestSim = scored[0].sim;
  const ties = scored.filter((x) => Math.abs(x.sim - bestSim) < 1e-9);
  let h = hashString(artistId);
  (answerHistory || []).forEach((entry, qi) => {
    h = (h * 31 + qi) >>> 0;
    h = (h ^ hashString(entry.opt && entry.opt.text)) >>> 0;
  });
  const picked = ties[h % ties.length].al;
  return {
    title: picked.title,
    neteaseId: picked.neteaseId || "",
    coverUrl: resolveAlbumCoverUrl(picked, artist),
  };
}

function pickAlbumForResult(artistId, dimSums) {
  return pickAlbumMetaForNorm(artistId, dimSums);
}
"""

NEW_ARTISTS = r"""
  fanxiaoxuan: {
    name: "范晓萱",
    album: "《Darling》",
    albumCoverUrl:
      "https://p1.music.126.net/0KfRz0SNX6rSbBWc39JIBw==/109951165644186954.jpg",
    albums: [
      { title: "《Darling》", neteaseId: "23176", dims: [1, 2, 2, 2] },
      { title: "《Rain》", neteaseId: "23196", dims: [1, 2, 2, 2] },
    ],
    resonanceLyrics: [
      {
        line: "如果你爱我，你会来找我，你会知道我快不能活。",
        song: "《氧气》",
        note: "O2 有氧版",
        neteaseSongId: "230407",
      },
      {
        line: "我们这样的女孩子，需要一点氧气。",
        song: "《氧气》",
        note: "",
        neteaseSongId: "230407",
      },
    ],
    tagline: "音乐小魔女，甜与怪诞都成立。",
    traitsDetailed: `从儿歌到摇滚与电子，声线与创作跨度极大；情歌与自我表达都锋利而真实。`,
    blurb: "甜感与锋芒可以同屏：你习惯在「被期待的样子」之外，为自己留一条旁轨——不迎合凝视，只认领自己的版本；这种自我命名感，与千禧年前后那条「小魔女」路径遥相呼应。",
    inclusiveNote: "可爱从不是单行道：锋利与柔软，都可以是忠于自己的选法。",
  },
  cyndi: {
    name: "王心凌",
    album: "《爱你》",
    albumCoverUrl:
      "https://p1.music.126.net/8P1W00PwAVwLD_d-7vvxZw==/109951173007905115.jpg",
    albums: [
      { title: "《爱你》", neteaseId: "29562", dims: [2, 2, 1, 2] },
      { title: "《Honey》", neteaseId: "29561", dims: [2, 2, 1, 2] },
    ],
    resonanceLyrics: [
      {
        line: "如果你突然打了个喷嚏，那一定就是我在想你。",
        song: "《爱你》",
        note: "",
        neteaseSongId: "297839",
      },
      {
        line: "情话多说一点，想我就多看一眼。",
        song: "《爱你》",
        note: "",
        neteaseSongId: "297839",
      },
      {
        line: "第一次爱的人，他的坏他的好，却像胸口刺青，是永远的记号。",
        song: "《第一次爱的人》",
        note: "",
        neteaseSongId: "1953017440",
      },
    ],
    tagline: "甜心教主，唱跳与情歌都刻在一代人记忆里。",
    traitsDetailed: `千禧华语流行与偶像剧金曲的代表声线之一，快歌与抒情都极具辨识度。`,
    blurb: "你把态度唱成一种力量：明亮、直接，甜也可以是一种坚定的选择——很会照顾别人，也记得照顾自己。",
    inclusiveNote: "甜不是肤浅：它是一种选择与练习。",
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
      },
      {
        line: "光落在你脸上，可爱一如往常。",
        song: "《光》",
        note: "",
        neteaseSongId: "30431364",
      },
      {
        line: "盼我疯魔还盼我孑孓不独活。",
        song: "《易燃易爆炸》",
        note: "",
        neteaseSongId: "30431376",
      },
    ],
    tagline: "独立唱作人，词曲一体，气质锋利又温柔。",
    traitsDetailed: `从民谣到独立流行，作品常带隐喻与情绪张力，现场与录音室都极具个人标签。`,
    blurb: "四档同满时才会出现的这一种读法：独立、疗愈、态度与向内生长的那部分你，不必互相拆台——别人争主流与边缘，你只是在调自己的音量，把「像谁」还给标签，把生活留给自己。",
    inclusiveNote: "隐藏结局：当四指标均落在档位 2 时出现。",
  },
"""


def patch_artist_dims(text: str) -> str:
    for aid in ORDER:
        t = PROFILES[aid]
        dims_str = f"dims: [{t[0]}, {t[1]}, {t[2]}, {t[3]}]"
        start_pat = rf"^  {re.escape(aid)}: \{{\n"
        m = re.search(start_pat, text, re.M)
        if not m:
            raise SystemExit(f"missing artist block {aid}")
        start = m.start()
        rest = text[start:]
        next_m = re.search(r"^  [a-z]+: \{\n", rest[10:], re.M)
        end_rel = next_m.start() + 10 if next_m else len(rest)
        block = rest[:end_rel]
        block_new = re.sub(r"dims: \[[^\]]+\]", dims_str, block)
        text = text[:start] + block_new + text[start + end_rel :]
    return text


def insert_new_artists(text: str) -> str:
    needle = '    inclusiveNote:\n      "许多心事不必喧哗：安静地被唱出来，也是一种被理解的方式。",\n  },\n};'
    if needle not in text:
        raise SystemExit("hebe closing needle not found")
    ins = (
        '    inclusiveNote:\n      "许多心事不必喧哗：安静地被唱出来，也是一种被理解的方式。",\n  },'
        + NEW_ARTISTS
        + "\n};"
    )
    return text.replace(needle, ins, 1)


def patch_segment_netease_and_album(seg: str) -> str:
    seg = seg.replace(
        "const NETEASE_ALBUM_COVER = {\n",
        "const NETEASE_ALBUM_COVER = {\n" + NETEASE_EXTRA,
        1,
    )
    s = seg.find("/** 按用户六维与专辑 dims")
    e = seg.find("function neteaseSongUrl", s)
    if s < 0 or e < 0:
        raise SystemExit("pickAlbum block not found")
    seg = seg[:s] + PICK_ALBUM + "\n\n" + seg[e:]
    seg = seg.replace(
        "h = (h * 31 + Math.round((entry.weight || 1) * 1000)) >>> 0;",
        "h = (h * 31 + Math.round(entry.points || entry.opt?.points || 25)) >>> 0;",
    )
    seg = seg.replace(
        "function buildRecommendedAlbumRows(userNorm, excludeArtistId, maxArtists) {\n  const ranked = rankArtistsByProfileSimilarity(userNorm);",
        "function buildRecommendedAlbumRows(userTiers, excludeArtistId, maxArtists) {\n  const ranked = rankArtistsByProfileSimilarity(userTiers);",
    )
    seg = seg.replace(
        "const meta = pickAlbumMetaForNorm(id, userNorm);",
        "const meta = pickAlbumMetaForNorm(id, userTiers);",
    )
    return seg


def patch_tail(tail: str) -> str:
    tail = tail.replace(
        "function addDim(acc, dims) {\n  for (let i = 0; i < acc.length; i++) acc[i] += Number(dims[i]);\n}\n\n/** 用户六维 raw（24 题后合计 240）直接用于匹配与展示 */\nfunction normalizeDims(raw) {\n  return raw.map((v) => Number(v));\n}\n\n",
        "",
    )
    tail = tail.replace(
        " * 该歌手六维画像（合计 240）：各维 ÷ 该歌手最强一维 × 100%。\n * 与「六维分点之和为 100%」的占比不同，六条百分比通常不相加为 100%，雷达最强维顶满格、整体不扁。\n */\nfunction dimScoresToArtistPeakPercent(profile240) {",
        " * 该歌手四档画像：各档 ÷ 该歌手最强档 × 100%（档为 1 或 2）。\n */\nfunction dimScoresToArtistPeakPercent(profile240) {",
    )
    tail = tail.replace(
        " * 雷达图：valuesPct 为六轴「相对该歌手峰值维」的 0–100\n",
        " * 雷达图：四轴相对该歌手峰值档的 0–100\n",
    )
    tail = tail.replace(
        "const dimTotals = [0, 0, 0, 0, 0, 0];",
        "const dimTotals = [0, 0, 0, 0];",
    )
    tail = tail.replace(
        "let lastNorm = [40, 40, 40, 40, 40, 40];",
        "let lastNorm = [1, 1, 1, 1];",
    )
    tail = tail.replace(
        """function onSelect(opt) {
  const dimMul = dimMulForQuestionIndex(currentIndex);
  const scaled = opt.dims.map((d, i) => Number(d) * dimMul[i]);
  const ten = scaleVectorToTotal(scaled, 10);
  addDim(dimTotals, ten);

  answerHistory.push({ opt, qIndex: currentIndex });""",
        """function onSelect(opt) {
  const dimIndex = Math.floor(currentIndex / 6);
  const pts = Number(opt.points);
  dimTotals[dimIndex] += pts;

  answerHistory.push({ opt, qIndex: currentIndex, dimIndex, points: pts });""",
    )
    tail = tail.replace(
        """function goToPreviousQuestion() {
  if (currentIndex === 0) return;
  const last = answerHistory.pop();
  if (!last) return;
  const qi = last.qIndex !== undefined ? last.qIndex : currentIndex - 1;
  const dimMul = dimMulForQuestionIndex(qi);
  const scaled = last.opt.dims.map((d, i) => Number(d) * dimMul[i]);
  const ten = scaleVectorToTotal(scaled, 10);
  for (let i = 0; i < dimTotals.length; i++) {
    dimTotals[i] -= ten[i];
  }
  currentIndex -= 1;
  renderQuestion();
}""",
        """function goToPreviousQuestion() {
  if (currentIndex === 0) return;
  const last = answerHistory.pop();
  if (!last) return;
  dimTotals[last.dimIndex] -= last.points;
  currentIndex -= 1;
  renderQuestion();
}""",
    )
    tail = tail.replace(
        """function showResult() {
  const userNorm = normalizeDims(dimTotals);

  const winnerId = pickArtistByProfileSimilarity(userNorm);
  lastResultId = winnerId;
  const artist = ARTISTS[winnerId];
  lastResultAlbum = pickAlbumForResult(winnerId, userNorm);
  lastNorm = ARTIST_PROFILE[winnerId].slice();""",
        """function showResult() {
  const userTiers = dimsToTiers(dimTotals);

  const winnerId = pickArtistByProfileSimilarity(userTiers);
  lastResultId = winnerId;
  const artist = ARTISTS[winnerId];
  lastResultAlbum = pickAlbumForResult(winnerId, dimTotals);
  lastNorm = ARTIST_PROFILE[winnerId].slice();""",
    )
    tail = tail.replace(
        "buildRecommendedAlbumRows(userNorm, winnerId, 3)",
        "buildRecommendedAlbumRows(userTiers, winnerId, 3)",
    )
    tail = tail.replace(
        """  const combinedScores = getArtistProfileSimilarityScores(userNorm);
  const rankedAll = ARTIST_ORDER.map((id) => ({ id, score: combinedScores[id] })).sort((a, b) => b.score - a.score);
  const top3 = rankedAll.filter(({ id }) => id !== winnerId).slice(0, 3);""",
        """  const combinedScores = getArtistProfileSimilarityScores(userTiers);
  const rankedAll = ARTIST_ORDER.map((id) => ({ id, score: combinedScores[id] })).sort((a, b) => b.score - a.score);
  const top3 = rankedAll
    .filter(({ id }) => id !== winnerId && (winnerId === "chenli" || id !== "chenli"))
    .slice(0, 3);""",
    )
    return tail


def main():
    bak = BAK.read_text(encoding="utf-8")
    core = CORE.read_text(encoding="utf-8")
    i = bak.index("/** 网易云专辑 ID")
    j = bak.index("const ARTISTS = {")
    k = bak.index("const DIM_KEYS =")
    m = bak.index("function addDim")

    seg = patch_segment_netease_and_album(bak[i:j])
    artists = bak[j:k]
    artists = patch_artist_dims(artists)
    artists = insert_new_artists(artists)
    questions = QUESTIONS.read_text(encoding="utf-8")
    tail = patch_tail(bak[m:])

    out = core + seg + artists + questions + tail
    OUT.write_text(out, encoding="utf-8")
    print("OK lines", len(out.splitlines()))


if __name__ == "__main__":
    main()
