/* ============================================================
   WORLD CUP SCOUT · v2 — 全套动效 + 搜索 + 官网链接
   ============================================================ */
let allPlayers = [];
let activeFilters = { role: null, league: null, age: 'all', special: null };

const bc = echarts.init(document.getElementById('bubbleChart'), null, { renderer: 'canvas' });
const rc = echarts.init(document.getElementById('radarChart'), null, { renderer: 'canvas' });
const ROLE_COLORS = {
  '前腰大脑':'#5B8DEF','禁区狐狸':'#FF6B35','回撤九号':'#00E676',
  '边路爆破手':'#FFD700','压迫工兵':'#FF69B4',
};
const fmt = (v) => (v ?? v === 0 ? (typeof v === 'number' ? v.toFixed(1) : v) : '—');
const fmtM = (v) => (v ? v.toFixed(1) + 'M' : '—');

// === 数字滚动 ===
function animateNum(el, target, suffix='') {
  if (!el) return;
  const dur = 800;
  const start = performance.now();
  const from = 0;
  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    // ease-out
    const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
    el.textContent = (typeof target === 'number' ? v.toFixed(1) : v) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// === 足球飞行动画 ===
function footballFly(x, y, callback) {
  const body = document.body;

  // 创建足球元素
  const ball = document.createElement('div');
  ball.textContent = '⚽';
  ball.style.cssText = `
    position: fixed; z-index: 9999; font-size: 32px; pointer-events: none;
    left: ${x}px; top: ${y}px; transition: none;
  `;
  body.appendChild(ball);

  // 目标位置 — 右下角靠近详情面板
  const targetX = window.innerWidth - 140;
  const targetY = window.innerHeight - 200;

  // 粒子容器
  const trail = document.createElement('div');
  trail.style.cssText = 'position:fixed;inset:0;z-index:9998;pointer-events:none';
  body.appendChild(trail);

  const startX = x, startY = y;
  const dx = targetX - startX, dy = targetY - startY;
  const dur = 700;
  const start = performance.now();

  function tick(now) {
    const p = Math.min((now - start) / dur, 1);
    // 抛物线
    const ex = startX + dx * p;
    const ey = startY + dy * p - 120 * Math.sin(p * Math.PI);
    const rot = p * 720;
    const scale = 1 - p * 0.4;
    ball.style.transform = `translate(${ex - startX}px, ${ey - startY}px) rotate(${rot}deg) scale(${scale})`;
    ball.style.opacity = 1 - p * 0.5;

    // 粒子轨迹
    if (p < 1 && Math.random() > 0.4) {
      const spark = document.createElement('span');
      spark.textContent = '✦';
      spark.style.cssText = `
        position:fixed;left:${ex + (Math.random()-0.5)*20}px;top:${ey + (Math.random()-0.5)*20}px;
        font-size:${8 + Math.random()*8}px;color:#C9A84C;opacity:${1 - p};pointer-events:none;
        transition:opacity 0.5s;
      `;
      trail.appendChild(spark);
      setTimeout(() => { spark.style.opacity = '0'; }, 50);
      setTimeout(() => spark.remove(), 600);
    }

    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      ball.remove();
      setTimeout(() => trail.remove(), 300);
      if (callback) callback();
    }
  }
  requestAnimationFrame(tick);
}

// === 初始化 ===
(async function init() {
  try {
    const res = await fetch('/api/filters');
    const meta = await res.json();
    document.getElementById('totalCount').textContent = meta.total;
    document.getElementById('roleCount').textContent = meta.roles.length;

    // 角色 chips
    const rcEl = document.getElementById('roleFilters');
    rcEl.appendChild(chip('All', '', 'role'));
    meta.roles.forEach(r => rcEl.appendChild(chip(r, r, 'role')));

    // 联赛 chips — 五大联赛
    const TOP_LEAGUES = ['Premier League','LaLiga','Bundesliga','Serie A','Ligue 1'];
    const lc = document.getElementById('leagueFilters');
    lc.appendChild(chip('All', '', 'league'));
    TOP_LEAGUES.forEach(l => lc.appendChild(chip(l, l, 'league')));

    // 年龄 chips
    document.querySelectorAll('#ageFilters .chip').forEach(el => {
      el.onclick = () => toggleFilter('age', el.dataset.age);
    });
    // 特殊 chips — 加All选项
    const sc = document.getElementById('specialFilters');
    sc.innerHTML = ''; // 清空硬编码的
    sc.appendChild(chip('All', '', 'special'));
    sc.appendChild(chip('⚡ Overvalued', 'high溢价', 'special'));
    sc.appendChild(chip('🏅 Top 20', 'top20', 'special'));

    // 搜索
    document.getElementById('searchInput').addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q.length) { renderBubble(allPlayers); return; }
      const filtered = allPlayers.filter(p => p.name.toLowerCase().includes(q));
      renderBubble(filtered);
    });

    // 关闭详情
    document.getElementById('btnCloseDetail').onclick = closeDetail;
    document.getElementById('detailOverlay').onclick = closeDetail;
    document.getElementById('btnPdf').onclick = () => window.print();
    document.getElementById('btnExportAll').onclick = () => window.print();
    // ESC 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeDetail();
    });

    window.addEventListener('resize', () => { bc.resize(); rc.resize(); });

    await loadData();
    renderBubble(allPlayers);
  } catch(e) { console.error(e); }
})();

function chip(label, value, type) {
  const el = document.createElement('span');
  el.className = 'chip' + (value === '' ? ' active' : '');
  el.textContent = label;
  el.dataset[type] = value;
  el.onclick = () => toggleFilter(type, value);
  return el;
}

async function toggleFilter(type, value) {
  const prefix = type === 'role' ? '#roleFilters' : type === 'league' ? '#leagueFilters' : type === 'age' ? '#ageFilters' : '#specialFilters';
  document.querySelectorAll(`${prefix} .chip`).forEach(c => c.classList.remove('active'));
  activeFilters[type] = value === '' ? null : value;
  if (value) {
    document.querySelectorAll(`${prefix} .chip`).forEach(c => { if ((c.dataset[type]||'') === value) c.classList.add('active'); });
  } else {
    document.querySelector(`${prefix} .chip`).classList.add('active');
  }
  await loadData();
  // 筛选过渡：先渐隐，再渲染，再渐现
  const chart = document.getElementById('bubbleChart');
  chart.style.opacity = '0.3';
  chart.style.transition = 'opacity 0.15s';
  setTimeout(() => {
    renderBubble(allPlayers);
    chart.style.opacity = '1';
    chart.style.transition = 'opacity 0.3s';
  }, 150);
}

async function loadData() {
  const p = new URLSearchParams();
  if (activeFilters.role) p.set('role', activeFilters.role);
  if (activeFilters.league) p.set('league', activeFilters.league);
  const res = await fetch(`/api/players?${p}`);
  let data = await res.json();
  if (activeFilters.age === 'u21') data = data.filter(d => d.age < 21);
  else if (activeFilters.age === 'prime') data = data.filter(d => d.age >= 22 && d.age <= 27);
  else if (activeFilters.age === 'veteran') data = data.filter(d => d.age >= 28);
  if (activeFilters.special === 'high溢价') {
    data = data.filter(d => (d.Value_Exploitation_Index||0) >= 1.03);
    data.sort((a,b) => (b.Value_Exploitation_Index||0) - (a.Value_Exploitation_Index||0));
  } else if (activeFilters.special === 'top20') {
    data = data.sort((a,b) => b.apex_score - a.apex_score).slice(0, 20);
  }
  allPlayers = data;
  document.getElementById('totalCount').textContent = allPlayers.length;
}

function renderBubble(data) {
  const players = data || allPlayers;
  if (!players.length) { bc.showLoading(); return; }
  bc.hideLoading();

  const ageMax = {};
  players.forEach(p => {
    const a = Math.floor(p.age), s = p.apex_score||0;
    if (!ageMax[a] || s > ageMax[a]) ageMax[a] = s;
  });
  const ages = Object.keys(ageMax).map(Number).sort((a,b)=>a-b);
  const frontier = ages.map(a => [a, ageMax[a]]);

  const scatter = players.map(p => ({
    value: [p.age, p.apex_score, (p.bubble_size||10), (p.AI_True_Value||0)],
    name: p.name,
    itemStyle: { color: ROLE_COLORS[p['role_cn']] || '#5A5048' },
    _player: p,
  }));

  bc.setOption({
    backgroundColor:'transparent',
    tooltip:{
      trigger:'item', backgroundColor:'rgba(14,14,24,0.95)', borderColor:'#2A2830', borderWidth:1,
      textStyle:{color:'#CDC5B5',fontSize:12},
      formatter:(p) => {
        const d = p.data._player; if (!d) return '';
        return `<strong style="font-size:15px;color:#E8D5A3">${d.name}</strong><br/>
          <span style="color:#8A8070">${d['role_cn']}</span><br/><br/>
          Score: <strong>${fmt(d.apex_score)}</strong><br/>
          Value: ${fmtM(d.AI_True_Value)} · Premium: ${(d.Value_Exploitation_Index||0).toFixed(2)}`;
      }
    },
    grid:{left:'5%',right:'6%',top:'8%',bottom:'10%'},
    xAxis:{
      name:'Age', nameTextStyle:{color:'#5A5048',fontSize:12},
      min:16,max:36, axisLine:{lineStyle:{color:'#1E1E2A'}},
      axisLabel:{color:'#5A5048',fontSize:11},
      splitLine:{lineStyle:{color:'#1E1E2A',type:'dashed'}},
    },
    yAxis:{
      name:'Technical Score', nameTextStyle:{color:'#5A5048',fontSize:12},
      min:0,max:105, axisLine:{lineStyle:{color:'#1E1E2A'}},
      axisLabel:{color:'#5A5048',fontSize:11},
      splitLine:{lineStyle:{color:'#1E1E2A',type:'dashed'}},
    },
    series:[
      {
        type:'scatter', data:scatter,
        symbolSize:(v)=>Math.max(6,Math.min(42,v[2])),
        emphasis:{
          scale:1.5,
          itemStyle:{ borderColor:'#E8D5A3', borderWidth:2, shadowBlur:20, shadowColor:'rgba(201,168,76,0.4)' }
        },
        z:3,
      },
      {
        type:'line', data:frontier, smooth:true, symbol:'none',
        lineStyle:{ color:'#C9A84C', width:2, shadowBlur:12, shadowColor:'rgba(201,168,76,0.15)' },
        areaStyle:{ color:{ type:'linear', x:0, y:1, x2:0, y2:0,
          colorStops:[{offset:0,color:'rgba(201,168,76,0)'},{offset:0.8,color:'rgba(201,168,76,0.02)'},{offset:1,color:'rgba(201,168,76,0.06)'}] }},
        z:2, silent:true,
      },
    ],
  }, true);

  bc.off('click');
  bc.on('click', (p) => {
    if (!p.data?._player) return;
    // 获取泡泡屏幕位置
    const pos = bc.convertToPixel({seriesIndex:0}, [p.data._player.age, p.data._player.apex_score]);
    if (pos) {
      footballFly(pos[0], pos[1], () => showDetail(p.data._player));
    } else {
      showDetail(p.data._player);
    }
  });
}

// === 显示详情 ===
function showDetail(d) {
  closeDetail();
  requestAnimationFrame(() => {
    document.getElementById('detailRole').textContent = d['role_cn']||'—';
    document.getElementById('detailName').textContent = d.name||'—';
    document.getElementById('detailNation').textContent = d.nationality_cn||'—';
    document.getElementById('detailClub').textContent = d.team_name||'—';
    document.getElementById('detailLeague').textContent = d.league_name||'—';
    document.getElementById('detailAge').textContent = d.age ? d.age + ' yrs' : '—';

    // 官网链接
    const linkEl = document.getElementById('clubLink');
    const player = d.name || '';
    if (player && player !== '—') {
      const searchQ = encodeURIComponent(player);
      linkEl.href = 'https://m.dongqiudi.com/search?q=' + searchQ;
      linkEl.textContent = '⚽ 懂球帝 · ' + player + ' →';
      linkEl.style.display = 'inline';
    } else {
      linkEl.style.display = 'none';
    }

    // KPI 数字滚动
    const score = d.apex_score;
    const val = d.AI_True_Value || 0;
    const prem = d.Value_Exploitation_Index || 0;
    const goals = d.goal || 0;

    const kpis = [
      { el: 'kpiScore', val: score, sfx: '' },
      { el: 'kpiValue', val: val, sfx: 'M' },
      { el: 'kpiPremium', val: prem, sfx: '' },
      { el: 'kpiGoals', val: goals, sfx: '' },
    ];
    kpis.forEach(k => {
      const el = document.getElementById(k.el);
      el.textContent = '0' + k.sfx;
      setTimeout(() => animateNum(el, k.val, k.sfx), 200);
    });

    // 高亮溢价
    const premEl = document.getElementById('kpiPremium');
    premEl.style.color = prem >= 1.03 ? '#C9A84C' : '#CDC5B5';

    // 雷达图 — 带旋转入场
    renderRadar(d);

    // 数据表
    const stats = [
      ['Goals', d.goal, ''], ['Assists', d.assist_total, ''],
      ['xG', fmt(d.xg), ''], ['Shots/90\'', fmt(d.shots_per_game), ''],
      ['Dribbles/90\'', fmt(d.dribble_won_per_game), ''],
      ['Key Passes/90\'', fmt(d.key_pass_per_game), ''],
      ['Passes/90\'', fmt(d.total_passes_per_game), ''],
      ['Shooting Eff.', fmt(d.shooting_efficiency), ''],
      ['Touch Lethality', fmt(d.touches_adjusted_lethality), ''],
      ['AI Value', fmtM(d.AI_True_Value), 'gold'],
      ['Base Value', fmtM(d.market_value_eur), ''],
      ['Premium Index', prem.toFixed(2), prem >= 1.03 ? 'gold' : ''],
    ];
    document.getElementById('detailStats').innerHTML = stats
      .map(s => `<div class="stat-row"><span class="label">${s[0]}</span><span class="value ${s[2]}">${s[1]}</span></div>`)
      .join('');

    document.getElementById('detailPanel').classList.remove('hidden');
  });
}

// === 雷达图（带旋转入场） ===
function renderRadar(d) {
  const maxG = Math.max(5, d.goal||1), maxX = Math.max(3, d.xg||1);
  const maxK = Math.max(1.5, d.key_pass_per_game||0.5), maxD = Math.max(1.5, d.dribble_won_per_game||0.5);
  const maxS = Math.max(2, d.shots_per_game||1), maxP = Math.max(15, d.total_passes_per_game||10);
  const opt = {
    backgroundColor:'transparent',
    radar:{
      indicator:[
        {name:'Goals',max:maxG},{name:'xG',max:maxX},{name:'Key Pass',max:maxK},
        {name:'Dribble',max:maxD},{name:'Shot',max:maxS},{name:'Pass',max:maxP},
      ],
      radius:'72%',
      axisName:{color:'#8A8070',fontSize:10},
      splitArea:{ areaStyle:{ color:['rgba(201,168,76,0.02)','rgba(201,168,76,0.04)','rgba(201,168,76,0.02)','rgba(201,168,76,0.04)'] }},
      axisLine:{lineStyle:{color:'#1E1E2A'}},
      splitLine:{lineStyle:{color:'#1A1A24'}},
    },
    series:[{
      type:'radar',
      animationDuration: 800,
      animationEasing: 'elasticOut',
      data:[{
        value:[d.goal||0, d.xg||0, d.key_pass_per_game||0, d.dribble_won_per_game||0, d.shots_per_game||0, d.total_passes_per_game||0],
        areaStyle:{color:'rgba(201,168,76,0.1)'},
        lineStyle:{color:'#C9A84C',width:2},
        itemStyle:{color:'#C9A84C'},
      }],
    }],
  };
  rc.setOption(opt, true);
}

function closeDetail() {
  document.getElementById('detailPanel').classList.add('hidden');
}

// =============================================================
// 音乐播放器 · 世界杯主题曲 (网易云音乐源)
// =============================================================
const WC_SONGS = [
  { title: 'The Time Of Our Lives', artist: 'Il Divo', year: '06', nid: '5178518' },
  { title: 'Waka Waka', artist: 'Shakira', year: '10', nid: '24485811' },
  { title: 'We Are One', artist: 'Pitbull × JLo', year: '14', nid: '28240407' },
  { title: 'Live It Up', artist: 'Nicky Jam × W.Smith', year: '18', nid: '567098860' },
  { title: 'Dreamers', artist: 'Jung Kook', year: '22', nid: '1999817550' },
];

let songIdx = 0;
let isPlaying = false;
const audio = document.getElementById('wcAudio');

function songUrl(idx) { return '/api/music/' + WC_SONGS[idx].nid; }

function updateSongDisplay() {
  const s = WC_SONGS[songIdx];
  document.getElementById('playerSong').textContent = s.title + ' · ' + s.artist;
  document.getElementById('playerYear').textContent = s.year;
}
function updatePlayerUI() { document.getElementById('playerToggle').textContent = isPlaying ? '⏸' : '▶'; }

function loadSong(idx) {
  songIdx = idx;
  updateSongDisplay();
  isPlaying = false;
  updatePlayerUI();

  // 清除旧的播放监听，避免冲突
  audio.removeEventListener('canplaythrough', autoPlayHandler);
  audio.pause();
  audio.src = songUrl(idx);
  audio.load();

  // 等加载完成后自动播放
  audio.addEventListener('canplaythrough', autoPlayHandler, { once: true });
}
function autoPlayHandler() {
  audio.play().then(() => {
    isPlaying = true;
    updatePlayerUI();
  }).catch(() => {});
}

function togglePlay() {
  if (!audio.src) { loadSong(0); return; }
  if (audio.paused) {
    if (audio.readyState < 2) {
      audio.play().catch(() => loadSong(songIdx));
    } else {
      audio.play().then(() => { isPlaying = true; updatePlayerUI(); }).catch(() => {});
    }
  } else {
    audio.pause(); isPlaying = false; updatePlayerUI();
  }
}
function playPrev() {
  const idx = (songIdx - 1 + WC_SONGS.length) % WC_SONGS.length;
  loadSong(idx);
}
function playNext() {
  const idx = (songIdx + 1) % WC_SONGS.length;
  loadSong(idx);
}

function togglePlay() {
  if (!audio.src) { loadSong(0); return; }
  if (audio.paused) {
    audio.play().then(() => { isPlaying = true; updatePlayerUI(); }).catch(() => {});
  } else {
    audio.pause(); isPlaying = false; updatePlayerUI();
  }
}
function playPrev() { loadSong((songIdx - 1 + WC_SONGS.length) % WC_SONGS.length); }
function playNext() { loadSong((songIdx + 1) % WC_SONGS.length); }

audio.addEventListener('ended', playNext);
audio.addEventListener('play', () => { isPlaying = true; updatePlayerUI(); });
audio.addEventListener('pause', () => { isPlaying = false; updatePlayerUI(); });
audio.addEventListener('error', (e) => { console.log('Audio error, reloading...'); });

document.getElementById('playerToggle').onclick = (e) => { e.stopPropagation(); togglePlay(); };
document.getElementById('playerPrev').onclick = (e) => { e.stopPropagation(); playPrev(); };
document.getElementById('playerNext').onclick = (e) => { e.stopPropagation(); playNext(); };
document.getElementById('playerBar').onclick = (e) => {
  if (!e.target.closest('.player-icon') && !e.target.closest('.player-prev') && !e.target.closest('.player-next'))
    togglePlay();
};
