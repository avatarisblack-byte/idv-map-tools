/* =====================================================================
 * 刷点联动规则引擎 (RuleEngine)
 * ---------------------------------------------------------------------
 * 纯数据驱动：传入任意符合格式的地图 JSON 即自动生效，不硬编码任何地图。
 *
 * 输入地图数据结构：
 *   {
 *     mapName, bgImage, aspectW, aspectH,
 *     allPoints: [{ id, name, x, y }, ...],
 *     presets 或 groups: [{ id, name, points: [pointId, ...] }, ...]
 *   }
 *
 * 推导输出：
 *   1) alwaysSpawn   —— 必刷点：出现在 100% 组中的点位
 *   2) exclusion     —— 互斥矩阵：任意两点是否从未同组出现
 *   3) cooccurrence  —— 伴生/绑定：A 出现则 B 必现（B ∈ A 出现的每一组）
 *   4) filterGroups  —— 组合过滤：按「必须有 / 不能有」反向筛选仍成立的组
 * ===================================================================== */

export class RuleEngine {
  constructor(mapData) {
    this.build(mapData);
  }

  build(mapData) {
    this.mapName = mapData.mapName || '';
    this.points = mapData.allPoints || [];
    this.pointMap = new Map(this.points.map(p => [p.id, p]));
    this.pointIds = this.points.map(p => p.id);

    // 兼容 presets / groups 两种命名
    const rawGroups = mapData.groups || mapData.presets || [];
    this.groups = rawGroups.map((g, i) => ({
      id: g.id || ('group' + (i + 1)),
      name: g.name || ('第' + (i + 1) + '组'),
      points: new Set(g.points || [])
    }));
    this.groupCount = this.groups.length;

    // 点位 -> 所在组集合（用于快速反查）
    this.pointGroups = new Map(this.pointIds.map(id => [id, new Set()]));
    for (const g of this.groups) {
      for (const pid of g.points) {
        if (this.pointGroups.has(pid)) this.pointGroups.get(pid).add(g.id);
      }
    }

    /* 1) 必刷点：出现在全部组 */
    this.alwaysSpawn = new Set(
      this.pointIds.filter(id => this.groups.every(g => g.points.has(id)))
    );

    /* 2) 互斥矩阵：任意两点从未同组出现 */
    this.exclusion = new Map(this.pointIds.map(id => [id, new Set()]));
    for (let i = 0; i < this.pointIds.length; i++) {
      const a = this.pointIds[i];
      for (let j = i + 1; j < this.pointIds.length; j++) {
        const b = this.pointIds[j];
        let cooccur = false;
        for (const g of this.groups) {
          if (g.points.has(a) && g.points.has(b)) { cooccur = true; break; }
        }
        if (!cooccur) {
          this.exclusion.get(a).add(b);
          this.exclusion.get(b).add(a);
        }
      }
    }

    /* 3) 伴生/绑定：A 出现则 B 必现 */
    this.cooccurrence = new Map(this.pointIds.map(id => [id, new Set()]));
    for (const a of this.pointIds) {
      if (this.pointGroups.get(a).size === 0) continue; // 孤立点无伴生
      for (const b of this.pointIds) {
        if (b === a) continue;
        let always = true;
        for (const g of this.groups) {
          if (g.points.has(a) && !g.points.has(b)) { always = false; break; }
        }
        if (always) this.cooccurrence.get(a).add(b);
      }
    }

    /* 统计信息（便于 UI 展示） */
    let exPairs = 0;
    for (const s of this.exclusion.values()) exPairs += s.size;
    let coPairs = 0;
    for (const s of this.cooccurrence.values()) coPairs += s.size;
    this.stats = {
      pointCount: this.pointIds.length,
      groupCount: this.groupCount,
      alwaysSpawnCount: this.alwaysSpawn.size,
      exclusionPairCount: exPairs / 2,
      cooccurrencePairCount: coPairs
    };
  }

  /* 4) 组合过滤：selected = 必须包含；excluded = 必须不包含 */
  filterGroups(selectedIds = [], excludedIds = []) {
    const sel = new Set(selectedIds);
    const excl = new Set(excludedIds);
    return this.groups.filter(g => {
      for (const id of sel) if (!g.points.has(id)) return false;
      for (const id of excl) if (g.points.has(id)) return false;
      return true;
    });
  }

  /* ---- 便捷查询 ---- */
  groupsOf(id) { return this.groups.filter(g => g.points.has(id)); }
  groupNamesOf(id) { return this.groupsOf(id).map(g => g.name); }
  isAlwaysSpawn(id) { return this.alwaysSpawn.has(id); }
  exclusionsOf(id) { return this.exclusion.get(id) || new Set(); }
  companionsOf(id) { return this.cooccurrence.get(id) || new Set(); }
}
