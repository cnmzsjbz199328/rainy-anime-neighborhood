// W4 sample section: the pure placement plan (no THREE, no DOM), driven only by world.js and a fixed seed.
// Corridor coordinates: u = metres east of the meridian lon -0.5 (measured on the local parallel), v = metres south of the town patch's
// south edge (lat -29.204) along that meridian. The corridor is 24 m wide (u in [-12, 12]) and 62.2 m long (v in [0, 62.2]); roads and
// the boardwalk follow world.js's roadNetwork and may leave it. See docs/world/W4_SPEC.md.
(function (global) {
'use strict';
const R = 90, D = Math.PI / 180, LON0 = -0.5, SEED = 4004;
// The plan box of each template that stands on the ground (flora.js, model metres = true metres: x0, x1, z0, z1 of its local x and z; the rails of a fence, a log,
// a fallen rack or sign reach out to one side of the origin). The CR01 cull below takes the whole box; section.js checks every listed box against the built geometry.
const FOOTPRINT = { seedling: [-0.03, 0.03, -0.03, 0.08], tuft: [-0.11, 0.13, -0.18, 0.31], flower: [-0.1, 0.11, -0.1, 0.1], weed: [-0.18, 0.19, -0.16, 0.55], shrubLow: [-0.59, 0.55, -0.56, 0.63],
  shrub: [-0.77, 0.87, -0.8, 0.74], fern: [-0.16, 0.16, -0.1, 0.71], rock: [-0.6, 0.6, -0.43, 0.43], rockBig: [-1.04, 1.17, -0.96, 0.92], mossRock: [-0.6, 0.48, -0.55, 0.59], reefRock: [-0.99, 0.99, -0.84, 0.84],
  weedShadow: [-0.89, 0.89, -0.57, 0.63], tetra: [-0.59, 0.59, -0.58, 0.59], cairn: [-0.32, 0.36, -0.35, 0.38], stonePost: [-0.11, 0.11, -0.11, 0.11], logMoss: [-4.5, 0.9, -0.22, 0.22], drift: [-3.45, 0.14, -0.13, 1.04],
  rack: [-3.9, 1.32, -0.12, 0.1], rackFallen: [-3.8, 0.42, -0.04, 1.09], scarecrow: [-1.95, 0.35, -0.35, 0.35], hutFarm: [-1.35, 1.35, -1.05, 1.05], hutRusty: [-1.34, 1.34, -1.05, 1.05], oldMachine: [-1.56, 1.15, -0.91, 0.85],
  barrier: [-1, 1, -0.03, 0.03], signFallen: [-3.2, 0.13, -0.2, 0.4], guardrail: [-1, 1, -0.04, 0.04], guardrailMetal: [-1, 1, -0.04, 0.04], fenceBamboo: [-3, 0.94, -0.03, 0.06], pole: [-0.95, 0.95, -0.15, 0.15],
  mirror: [-0.25, 0.44, -0.04, 0.08], signRound: [-0.31, 0.31, -0.04, 0.1], signBus: [-0.25, 0.25, -0.04, 0.04], vending: [-0.53, 0.53, -0.44, 0.44], lantern: [-0.25, 0.25, -0.25, 0.25], torii: [-1.46, 1.46, -0.18, 0.18],
  mossStep: [-0.75, 0.75, -1.2, 0.18], seaMark: [-0.16, 0.16, -0.05, 0.06] };
// Complete local plan bounds for world instances, taken from the actual flora templates. The W4 section keeps its own curated boxes above.
const LANDCOVER_FOOTPRINT = { ...FOOTPRINT,
  treeRound: [-1.8024, 2.0137, -1.6891, 1.5727], cedar: [-1.7, 1.7, -1.7, 1.7], pine: [-2.5699, 2.7574, -1.8934, 1.7876], bamboo: [-1.3497, 1.4403, -1.3758, 1.1737],
  dryShrub: [-0.2037, 0.1702, -0.1946, 0.4555], iceBlock: [-0.6102, 0.9608, -0.5565, 0.6039], lichenPatch: [-0.5362, 0.5362, -0.3964, 0.44], log: [-4.8, 0.2435, -0.2, 0.2], rockPillar: [-0.35, 0.39, -0.3295, 0.2995], ventCone: [-0.9651, 0.9651, -0.9209, 0.98], tubeHole: [-1.78, 1.78, -1.6929, 1.6929], teaRow: [-0.5, 0.5, -1, 1] };
const mulberry = seed => { let s = seed | 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };

function plan(W) {
  const LAT0 = -W.TOWN_PATCH.latMax, rnd = mulberry(SEED);
  const toLL = (u, v) => { const lat = LAT0 - v / (R * D); return [LON0 + u / (R * Math.cos(lat * D)) / D, lat]; };
  const toUV = (lon, lat) => ({ u: (lon - LON0) * D * R * Math.cos(lat * D), v: (LAT0 - lat) * D * R });
  const uniform = (a, b) => a + (b - a) * rnd(), pick = arr => arr[Math.floor(rnd() * arr.length)];
  const zoneAt = (u, v) => { const [lon, lat] = toLL(u, v); return W.regionAt(lon, lat); };
  const altAt = (u, v) => { const [lon, lat] = toLL(u, v); return W.height(lon, lat); };
  const coastAt = (u, v) => { const [lon, lat] = toLL(u, v); return W.coastDistance(lon, lat); };

  // ---- the roads of the section: dense centre lines in (u, v)
  const ringEdges = W.roadNetwork.edges.filter(e => e.id.startsWith('RN04-')).map(e => e.id);
  const roadEdges = [...W.roadNetwork.m01South, ...ringEdges, 'RN11-01']; // M01 south, the full CR01 ring and the RN11 boardwalk
  const roads = {};
  for (const id of roadEdges) {
    const e = W.roadNetwork.edges.find(q => q.id === id), S = W.roadNetwork.samplePath(e, 0.5);
    roads[id] = { id, class: e.class, spans: e.spans, length: W.roadNetwork.edgeLength(e), pts: S.map(p => ({ ...p, ...toUV(p.lon, p.lat) })) };
  }
  const roadHalf = { RD03: 2.25 + 0.6, RD04: 2.75 + 0.5, RD05: 1.5 + 0.5, RD07: 1.0 + 0.4 };   // paved half width + margin that stays clear of props
  const roadDist = (u, v) => { let best = Infinity, cls = null; for (const r of Object.values(roads)) for (let i = 0; i < r.pts.length; i += 2) { const p = r.pts[i], d = Math.hypot(p.u - u, p.v - v) - roadHalf[r.class]; if (d < best) { best = d; cls = r.class; } } return { d: best, cls }; };
  const nearRoad = (u, v, extra = 0) => roadDist(u, v).d < extra;
  // beside a road: point at arc length s, lateral offset (positive = right when walking along the edge), plus the road tangent yaw
  const beside = (id, s, off) => {
    const r = roads[id], i = Math.max(1, Math.min(r.pts.length - 2, Math.round(s / 0.5))), a = r.pts[i - 1], b = r.pts[i + 1];
    let tu = b.u - a.u, tv = b.v - a.v; const tl = Math.hypot(tu, tv) || 1; tu /= tl; tv /= tl;
    return { u: r.pts[i].u - tv * off, v: r.pts[i].v + tu * off, yaw: Math.atan2(tu, tv), tu, tv };
  };

  // ---- placed things
  const items = {};            // type -> [{ u, v, yaw, s:[sx,sy,sz], tint, extra }]
  const occupied = [];         // {u, v, r}: objects of 0.5 m or more block everything; smaller ones (tufts, weeds, ferns, flowers) only keep their own spacing
  const smallOcc = {};
  const put = (type, u, v, o = {}) => {
    const [lon, lat] = toLL(u, v);
    const it = { type, u, v, lon, lat, yaw: o.yaw ?? uniform(0, Math.PI * 2), s: o.s || [1, 1, 1], tint: o.tint || [1, 1, 1], lean: o.lean || [0, 0], dy: o.dy || 0, clearance: o.clearance ?? o.r ?? 0.3 };
    (items[type] = items[type] || []).push(it);
    if (o.r) { if (o.r >= 0.5) occupied.push({ u, v, r: o.r }); else (smallOcc[type] = smallOcc[type] || []).push({ u, v, r: o.r }); }
    return it;
  };
  const free = (u, v, r, type) => occupied.every(o => Math.hypot(o.u - u, o.v - v) >= o.r + r) && (smallOcc[type] || []).every(o => Math.hypot(o.u - u, o.v - v) >= o.r + r);
  const tint = (a = 0.85, b = 1.12) => { const k = uniform(a, b), j = uniform(-0.04, 0.04); return [k + j, k, k - j]; };
  // dart-throwing scatter inside a region predicate
  const scatter = (type, n, box, ok, o = {}) => {
    let placed = 0, tries = 0;
    while (placed < n && tries < n * 60) {
      tries++;
      const u = uniform(box.u0, box.u1), v = uniform(box.v0, box.v1);
      if (!ok(u, v)) continue;
      if (o.r && !free(u, v, o.r, type)) continue;
      if (nearRoad(u, v, o.road ?? 0.3)) continue;
      const sc = o.scale ? uniform(o.scale[0], o.scale[1]) : 1;
      put(type, u, v, { yaw: o.yaw ?? uniform(0, Math.PI * 2), s: o.aspect ? [sc * o.aspect[0], sc * o.aspect[1], sc * o.aspect[2]] : [sc, sc, sc], tint: tint(o.tint?.[0], o.tint?.[1]), r: o.r, dy: o.dy });
      placed++;
    }
    return placed;
  };
  const land = (u, v) => altAt(u, v) > 0.35;
  const kindIs = (...k) => (u, v) => k.includes(zoneAt(u, v).kind) && land(u, v);
  const inU = (u, lim = 12) => Math.abs(u) <= lim;
  const U = { u0: -12, u1: 12 };

  // ---- zone boundaries on the meridian lon -1 (the numbers of W4_SPEC section 2)
  const zones = [];
  { let prev = null; for (let v = 0; v <= 70; v += 0.05) { const [lon, lat] = toLL(-0.5 + 0, v); const r = W.regionAt(-1, LAT0 - v / (R * D)); if (r.id !== prev) { zones.push({ v: +v.toFixed(2), id: r.id, kind: r.kind, zone: r.zone }); prev = r.id; } } }
  const coastV = (() => { for (let v = 30; v < 62; v += 0.02) if (W.coastDistance(-1, LAT0 - v / (R * D)) <= 0) return v; return null; })();

// ---- TR01 roadside facilities for the sample section; the bamboo boundary fence is retired in W10d.
  // C01-S: keep the entrance furniture beyond the ring's full section and the turning mouth.
  // The two entrance lamps are road lamps: streetlights.js registers them at these sites (W10c); the sites stay reserved for the rest of the plan.
  const lampSites = [[-6.2, 12.5], [10.5, 13.2]].map(([u, v]) => { const [lon, lat] = toLL(u, v); occupied.push({ u, v, r: 0.6 }); return { u, v, lon, lat, clearance: 0.6 }; });
  put('signRound', 10.5, 16.0, { yaw: 0, r: 0.4 });
  put('signBus', 10.5, 19.0, { yaw: Math.PI, r: 0.4 });
  put('mirror', -6.2, 15.0, { yaw: Math.PI / 2, r: 0.4 });
  { const b = beside('RN02-07', 0.6, -6.5); put('vending', b.u, b.v, { yaw: b.yaw + Math.PI / 2, r: 1.0 }); }
  for (let v = 18; v <= 22; v += 2.0) put('guardrailMetal', -6.4, v, { yaw: Math.PI / 2, r: 1.0 });
  // old poles with wires: chain A heads south along the left side, chain B follows the road's right side
  const poleA = [[-8.0, 0.2, 0], [-7.4, 11.6, 0.03], [-6.2, 19.8, 0.14], [-5.2, 27.0, 0.38]], poleB = [[8.0, 0.2, 0.0], [10.0, 12.8, 0.08], [8.0, 21.0, 0.2]];
  const wires = [];
  for (const chain of [poleA, poleB]) {
    const placed = chain.map(([u, v, lean], i) => put('pole', u, v, { yaw: Math.PI / 2 + (i % 2 ? 0.2 : 0), lean: [lean * 0.4, lean], r: 0.5 }));
    for (let i = 0; i + 1 < placed.length; i++) wires.push({ a: placed[i], b: placed[i + 1], sag: 0.7 + i * 0.7 + (chain === poleA && i === 2 ? 1.4 : 0) });
  }

  // ---- BI05 paddies (v 4–13) and TR04 fallow fields (v 13–20.7): Voronoi plots on a fine grid
  const plots = { u0: -12, u1: 12, v0: 3.2, v1: 23.5, step: 0.25, seeds: [] };
  {
    const cellN = 3.0 / 1.0;
    // jittered seeds on a loose grid; cell size 7–9 m
    for (let u = -10.5; u <= 10.5; u += 7.2) for (let v = 6.0; v <= 22.5; v += 6.2) {
      const su = u + uniform(-2.2, 2.2), sv = v + uniform(-1.8, 1.8);
      const kind = sv < 13.3 ? (rnd() < 0.68 ? 'water' : 'dry') : 'fallow';
      plots.seeds.push({ u: su, v: sv, kind, id: plots.seeds.length });
    }
    void cellN;
  }
  const cellOf = (u, v) => { let b = 0, bd = Infinity, d2 = Infinity; plots.seeds.forEach((s, i) => { const d = Math.hypot(s.u - u, s.v - v); if (d < bd) { d2 = bd; bd = d; b = i; } else if (d < d2) d2 = d; }); return { id: b, d1: bd, d2 }; };
  // paddy furniture
  const inPlot = (u, v, kind) => { const c = cellOf(u, v); return plots.seeds[c.id].kind === kind && c.d2 - c.d1 > 1.0; };
  scatter('rack', 3, { u0: -11, u1: 11, v0: 5, v1: 12.5 }, (u, v) => land(u, v) && cellOf(u, v).d2 - cellOf(u, v).d1 < 0.6, { r: 1.6, road: 1.5, yaw: 0, scale: [1, 1] });
  put('scarecrow', 6.5, 8.6, { r: 0.8, yaw: 0.4 });
  put('hutFarm', -9.5, 8.2, { r: 2.0, yaw: 0.2 });
  // ridge weeds and a few flowers
  scatter('tuft', 36, { u0: -12, u1: 12, v0: 4, v1: 13.5 }, (u, v) => land(u, v) && cellOf(u, v).d2 - cellOf(u, v).d1 < 0.7, { r: 0.25, road: 0.4, scale: [0.9, 1.3] });
  scatter('flower', 14, { u0: -12, u1: 12, v0: 3, v1: 14 }, (u, v) => land(u, v) && cellOf(u, v).d2 - cellOf(u, v).d1 < 0.9, { r: 0.2, road: 0.4, scale: [0.9, 1.3] });
  // seedlings in the water plots on a loose grid
  for (let u = -11.7; u <= 11.7; u += 0.62) for (let v = 4.4; v <= 13.2; v += 0.62) {
    const uu = u + uniform(-0.12, 0.12), vv = v + uniform(-0.12, 0.12);
    if (!inPlot(uu, vv, 'water') || nearRoad(uu, vv, 0.4) || !land(uu, vv)) continue;
    put('seedling', uu, vv, { yaw: uniform(0, 6.28), s: [1, uniform(0.8, 1.2), 1], tint: tint(0.9, 1.1), dy: 0.0 });
  }
  // TR04: fallow fields gone to weeds, a rusty shed, a vine-covered machine, collapsed racks
  scatter('weed', 190, { u0: -12, u1: 12, v0: 13, v1: 22.5 }, (u, v) => land(u, v) && zoneAt(u, v).kind !== 'ruin', { r: 0.22, road: 0.5, scale: [0.9, 1.5] });
  scatter('shrubLow', 22, { u0: -12, u1: 12, v0: 14, v1: 22.5 }, (u, v) => land(u, v), { r: 0.6, road: 0.8, scale: [0.8, 1.4] });
  put('hutRusty', 7.3, 16.8, { r: 2.0, yaw: 2.6 });
  put('oldMachine', -6.8, 15.6, { r: 1.4, yaw: 0.9 });
  put('rackFallen', 4.7, 20.2, { r: 1.2, yaw: 0.5 }); put('rackFallen', -2.4, 19.6, { r: 1.2, yaw: 2.4 });
  // RD04 stage: faded barrier, fallen sign, rusty guard rail
  { const b = beside('RN06-02', 4.0, -3.2); put('barrier', b.u, b.v, { yaw: b.yaw + Math.PI / 2, r: 1.0 }); }
  { const b = beside('RN06-02', 6.4, 3.4); put('signFallen', b.u, b.v, { yaw: b.yaw, r: 0.8 }); }
  for (let s = 1.0; s <= 8.0; s += 2.0) { const b = beside('RN06-02', s, 3.3); put('guardrail', b.u, b.v, { yaw: b.yaw + Math.PI / 2, r: 0.8, lean: [0, (s % 4) * 0.01] }); }

  // ---- TR03 forest edge (v 17–26): shrubs, saplings, rocks, a log, the torii of LM04's entrance
  scatter('shrub', 30, { u0: -12, u1: 12, v0: 17, v1: 23.5 }, (u, v) => land(u, v), { r: 0.45, road: 0.7, scale: [0.8, 1.5] });
  scatter('treeRound', 5, { u0: -12, u1: 12, v0: 19, v1: 25 }, (u, v) => land(u, v) && zoneAt(u, v).kind !== 'forest', { r: 0.8, road: 1.2, scale: [0.45, 0.75] });   // saplings at the edge
  scatter('rock', 7, { u0: -12, u1: 12, v0: 18, v1: 27 }, land, { r: 0.45, road: 0.6, scale: [0.7, 1.4], aspect: [1, 1, 1] });
  put('logMoss', -5.0, 24.2, { r: 1.2, yaw: 0.6 });
  const ent = W.roadNetwork.nodeById['LM04-southeast'], eu = toUV(ent.lon, ent.lat);
  put('torii', eu.u - 2.4, eu.v - 0.5, { yaw: Math.PI / 2 + 0.2, r: 1.3 }); put('torii', eu.u - 5.0, eu.v - 1.1, { yaw: Math.PI / 2 + 0.25, r: 1.3, lean: [0, 0.05] });
  put('lantern', eu.u - 3.7, eu.v + 1.4, { yaw: 0.3, r: 0.4 }); put('lantern', eu.u - 3.7, eu.v - 2.2, { yaw: -0.3, r: 0.4 });
  put('mossStep', eu.u - 7.2, eu.v - 1.6, { yaw: Math.PI / 2 + 0.2, r: 1.0 });   // beyond the second torii, into the forest: off the road and the boardwalk
  put('stonePost', eu.u - 2.0, eu.v + 1.7, { r: 0.3 }); put('stonePost', eu.u - 2.0, eu.v - 2.2, { r: 0.3 });

  // ---- BI02 forest (v 20.7–30.9): four tree shapes, understory, logs and moss rocks; at most 0.27 trees per m2 (BI02 budget derivation)
  const forestOk = (u, v) => { const k = zoneAt(u, v).kind; return (k === 'forest' || (k === 'ruin' && v > 19)) && land(u, v); };   // LM04's ruin cap lies on the forest
  const treeMix = [['bamboo', 5, 0.9], ['pine', 6, 1.1], ['cedar', 10, 1.0], ['treeRound', 12, 1.0]];   // placed in this order so the rarer shapes are not crowded out
  let forestTrees = 0;
  for (const [type, count, r] of treeMix) forestTrees += scatter(type, count, { u0: -12, u1: 12, v0: 19.5, v1: 31.5 }, forestOk, { r, road: 1.4, scale: type === 'bamboo' ? [0.85, 1.15] : [0.8, 1.2] });
  scatter('shrub', 70, { u0: -12, u1: 12, v0: 20, v1: 31.5 }, forestOk, { r: 0.45, road: 0.8, scale: [0.7, 1.4] });
  scatter('fern', 95, { u0: -12, u1: 12, v0: 20, v1: 31.5 }, forestOk, { r: 0.3, road: 0.5, scale: [0.8, 1.4] });
  scatter('mossRock', 12, { u0: -12, u1: 12, v0: 20, v1: 31.5 }, forestOk, { r: 0.45, road: 0.7, scale: [0.7, 1.5] });
  scatter('logMoss', 2, { u0: -12, u1: 12, v0: 21, v1: 30 }, forestOk, { r: 1.4, road: 1.0 });
  scatter('stonePost', 2, { u0: -12, u1: 12, v0: 21, v1: 30 }, forestOk, { r: 0.3, road: 0.8, scale: [0.9, 1.3] });
  put('lantern', 4.6, 27.6, { r: 0.4, yaw: 0.6 });

  // ---- BI03 grass (v 30.9–40.8): tufts, flowers, rocks, a lone tree, a cairn, the windbreak pines at the coast
  const grassOk = (u, v) => zoneAt(u, v).kind === 'grassland' && altAt(u, v) > 0.5 && coastAt(u, v) > 3;
  scatter('tuft', 150, { u0: -12, u1: 12, v0: 30, v1: 41 }, grassOk, { r: 0.22, road: 0.5, scale: [0.9, 1.4] });
  scatter('flower', 26, { u0: -12, u1: 12, v0: 30, v1: 41 }, grassOk, { r: 0.2, road: 0.5, scale: [0.9, 1.3] });
  scatter('rock', 12, { u0: -12, u1: 12, v0: 31, v1: 41 }, (u, v) => land(u, v) && coastAt(u, v) > 1.5, { r: 0.45, road: 0.7, scale: [0.7, 1.6] });
  scatter('rockBig', 2, { u0: -12, u1: 12, v0: 33, v1: 40 }, (u, v) => land(u, v) && coastAt(u, v) > 3, { r: 1.0, road: 1.0, scale: [0.9, 1.3] });
  put('treeRound', -7.5, 34.5, { r: 1.5, yaw: 1.0, s: [1.1, 1.1, 1.1] });
  put('cairn', 3.4, 36.0, { r: 0.5 });
  scatter('pine', 4, { u0: -12, u1: 12, v0: 35, v1: 40 }, (u, v) => land(u, v) && coastAt(u, v) > 2 && coastAt(u, v) < 9, { r: 1.8, road: 1.6, scale: [0.9, 1.15] });

  // ---- TR02 coast: sand (terrain colour), driftwood, rocks, tetrapods, a sea mark; reef rocks and weed shadows in the shallows
  scatter('drift', 4, { u0: -12, u1: 12, v0: 38, v1: 42 }, (u, v) => coastAt(u, v) > 0.2 && coastAt(u, v) < 4, { r: 1.3, road: 1.0, scale: [0.8, 1.2] });
  scatter('rock', 12, { u0: -12, u1: 12, v0: 38, v1: 42.5 }, (u, v) => coastAt(u, v) > -0.2 && coastAt(u, v) < 5, { r: 0.45, road: 0.8, scale: [0.7, 1.7] });
  for (let i = 0; i < 7; i++) { const a = i * 0.9, ring = i % 2 ? 0.7 : 0.0; put('tetra', 8.0 + Math.cos(a) * 0.8 + ring, 40.8 + Math.sin(a) * 0.6 - 0.5 * (i % 3), { r: 0.55, yaw: a * 1.7, tint: tint(0.9, 1.05) }); }
  scatter('reefRock', 9, { u0: -12, u1: 12, v0: 41, v1: 52 }, (u, v) => coastAt(u, v) < -1.5 && altAt(u, v) < -0.05, { r: 1.0, road: 1.2, scale: [0.7, 1.5], dy: -0.15 });
  scatter('weedShadow', 12, { u0: -12, u1: 12, v0: 41, v1: 56 }, (u, v) => coastAt(u, v) < -1 && altAt(u, v) < -0.05, { r: 1.0, road: 1.0, scale: [0.8, 1.6], dy: 0 });
  put('seaMark', -2.0, 52.5, { r: 0.4 });

  // spacing check helper for the trees: reported to the checks
  const trees = ['treeRound', 'cedar', 'pine', 'bamboo'].reduce((s, t) => s + (items[t] || []).length, 0);
  // W4 furniture predates CR01. Cull anything whose complete ground footprint reaches the ring's full RD03 section or the C01-S turning mouth, including
  // scattered plants. The ring: in true metres in (u, v), the ring's south straight is the parallel of C01-S (CR01 is the square |x|, |z| = 54 of the flat
  // frame), so it is the line v = v(C01-S) right across the corridor (its corners begin at |x| = 46 m, well east and west of it) and v is true metres along
  // the meridian; its full section runs 3.55 m outside (south: the ditch side) to 2.75 m inside. The mouth: the clearance box round C01-S; every registered
  // corridor road uses its full section (roadkit.js FOOT, RD03 3.55 m on its ditch side taken on both sides; RD07 the boardwalk's placement half width).
  // The footprint is the template's own plan box (FOOTPRINT, turned by the yaw and scaled) and 0.15 m more
  // (the ground cut's 0.12 m pad: nothing stands over the cut's edge); a tree, whose crown may overhang, keeps its clearance circle + 0.5 m.
  // (CR01_HOUSE_GRASS_INTRUSION_PLAN.md: the ring test this replaces took town-frame metres, 0.84 true metres each at the ring, and only |x| <= 12 m of
  // a corridor that reaches x -15.0 m, and every test a clearance circle that misses the one-sided templates: the farm hut and the westmost seedlings
  // stood on the ring, a fallen rack reached into the full section of RN06-02.)
  const c01 = W.roadNetwork.nodeById['C01-S'], center = W.lonLatToTown(c01.lon, c01.lat), vRing = toUV(c01.lon, c01.lat).v, RING_FULL = [3.55, 2.75], MARGIN = 0.15, TREE = 0.5;
  // RD04's rendered grass profile reaches 3.6 m from the centreline even though its paved/shoulder footprint is 2.75 m;
  // keep corridor plants outside that visible edge as well, so the complete plant hull cannot touch the swept road profile.
  const fullHalf = { RD03: 3.55, RD04: 3.6, RD05: 1.55, RD07: roadHalf.RD07 };
  const outline = it => { const e = FOOTPRINT[it.type]; if (!e) return null; const c = Math.cos(it.yaw), s = Math.sin(it.yaw);
    return [[e[0], e[2]], [e[1], e[2]], [e[1], e[3]], [e[0], e[3]]].map(([x, z]) => [it.u + x * it.s[0] * c + z * it.s[2] * s, it.v - x * it.s[0] * s + z * it.s[2] * c]); };
  const polyDist = (P, u, v) => { let inside = false, d = Infinity; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[j], b = P[i], dx = b[0] - a[0], dv = b[1] - a[1], t = Math.max(0, Math.min(1, ((u - a[0]) * dx + (v - a[1]) * dv) / (dx * dx + dv * dv || 1)));
    d = Math.min(d, Math.hypot(u - a[0] - dx * t, v - a[1] - dv * t)); if ((a[1] > v) !== (b[1] > v) && u < a[0] + (v - a[1]) * dx / dv) inside = !inside; } return inside ? 0 : d; };
  const fullDist = it => { const P = outline(it), r0 = P ? 0 : it.clearance + TREE - MARGIN; let best = Infinity; for (const r of Object.values(roads)) for (const p of r.pts) best = Math.min(best, (P ? polyDist(P, p.u, p.v) : Math.hypot(p.u - it.u, p.v - it.v)) - r0 - fullHalf[r.class]); return best; };
  const removedAtRing = {};
  for (const [type, list] of Object.entries(items)) {
    items[type] = list.filter(it => {
      const P = outline(it), r0 = it.clearance + TREE - MARGIN, v0 = P ? Math.min(...P.map(q => q[1])) : it.v - r0, v1 = P ? Math.max(...P.map(q => q[1])) : it.v + r0;
      const p = W.lonLatToTown(it.lon, it.lat), radius = it.clearance + 0.5;
      const ring = v0 - MARGIN < vRing + RING_FULL[0] && v1 + MARGIN > vRing - RING_FULL[1];
      const mouth = Math.abs(p.z - center.z) <= 7 && Math.abs(p.x - center.x) < 4.4 + radius;
      const approach = fullDist(it) < MARGIN;
      const conflict = ring || mouth || approach;
      if (conflict) removedAtRing[type] = (removedAtRing[type] || 0) + 1;
      return !conflict;
    });
  }
  // The wire endpoints use the same item objects; drop any wire whose pole was culled.
  const keptPoles = new Set(items.pole || []);
  const safeWires = wires.filter(w => keptPoles.has(w.a) && keptPoles.has(w.b));
  return { corridor: { LON0, LAT0, uMin: -12, uMax: 12, vMax: 62.2, length: 59.5 }, toLL, toUV, zones, coastV, roads, roadDist, roadHalf, items, lampSites, plots, cellOf, wires: safeWires, removedAtRing, treeCount: trees, forestTrees, seed: SEED };
}

const PLAN = { plan, SEED, FOOTPRINT, LANDCOVER_FOOTPRINT };
if (typeof module !== 'undefined' && module.exports) module.exports = PLAN;
else global.SECTION_PLAN = PLAN;
})(typeof globalThis !== 'undefined' ? globalThis : this);
