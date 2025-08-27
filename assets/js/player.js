// assets/js/player.js
const PLAYLISTS_URL = '/data/playlists.json';
const playlistsContainer = document.getElementById('playlists');
const tracksContainer = document.getElementById('playlistTracks');
const videoPlayer = document.getElementById('videoPlayer');
const coverImg = document.getElementById('coverImg');

let currentPlaylist = null;
let currentTracks = [];
let currentIndex = 0;
let currentFormatIndex = 0;

async function loadPlaylists(){
  try{
    const r = await fetch(PLAYLISTS_URL);
    if(!r.ok) throw new Error('Failed loading playlists.json');
    const data = await r.json();
    renderPlaylistsList(data.playlists || []);
    if(data.playlists?.length) selectPlaylist(0, data.playlists[0]);
  }catch(err){
    playlistsContainer.innerHTML = `<div class="small">Error loading playlists: ${err.message}</div>`;
    console.error(err);
  }
}

function renderPlaylistsList(list){
  playlistsContainer.innerHTML = '';
  list.forEach((pl, idx) => {
    const div = document.createElement('div');
    div.className = 'playlist-card';
    div.innerHTML = `
      <h3>${escapeHtml(pl.title || 'Untitled playlist')}</h3>
      <div class="small">${escapeHtml(pl.url)}</div>
      <div style="margin-top:8px"><button data-idx="${idx}" class="btn-open">Open</button></div>
    `;
    playlistsContainer.appendChild(div);
    div.querySelector('.btn-open').addEventListener('click', ()=> selectPlaylist(idx, pl));
  });
}

async function selectPlaylist(idx, pl){
  currentPlaylist = pl;
  coverImg.src = pl.cover || 'assets/img/placeholder.jpg';
  tracksContainer.innerHTML = `<div class="small">Loading playlist…</div>`;

  try{
    const id = extractIdentifierFromUrl(pl.url);
    if(!id) throw new Error('Could not parse archive.org identifier');
    const meta = await fetchArchiveMetadata(id);

    const files = meta?.files || [];
    const videoFormats = ['.mp4','.mkv','.avi','.mov','.mpg','.mpeg','.ogv','.webm'];

    // Group by base name (ignore extension)
    const grouped = {};
    files.forEach(f => {
      const name = f.name || '';
      const lower = name.toLowerCase();
      if(!videoFormats.some(ext => lower.endsWith(ext))) return;
      const base = name.replace(/\.[^.]+$/, ''); // remove extension
      const urlBase = pl.url.replace('/details/','/download/').replace(/\/$/,'');
      const fileUrl = `${urlBase}/${encodeURIComponent(name)}`;

      if(!grouped[base]) grouped[base] = [];
      grouped[base].push({ 
        format: name.split('.').pop(), 
        fileUrl, 
        size: f.size 
      });
    });

    currentTracks = Object.entries(grouped).map(([base, formats]) => ({
      title: base,
      formats
    }));

    if(currentTracks.length === 0){
      tracksContainer.innerHTML = `<div class="small">No playable videos found.</div>`;
      return;
    }

    renderTracks();
    loadTrack(0,0);

  }catch(err){
    tracksContainer.innerHTML = `<div class="small">Error: ${err.message}</div>`;
    console.error(err);
  }
}

function renderTracks(){
  tracksContainer.innerHTML = '';
  currentTracks.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'track';
    el.dataset.index = i;

    let formatBtns = '';
    t.formats.forEach((f, fi) => {
      formatBtns += `<button class="fmt-btn" data-track="${i}" data-fmt="${fi}">${f.format}</button> `;
    });

    el.innerHTML = `
      <div class="meta">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="sub">Formats: ${formatBtns}</div>
      </div>
    `;

    el.querySelectorAll('.fmt-btn').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const ti = Number(e.target.dataset.track);
        const fi = Number(e.target.dataset.fmt);
        loadTrack(ti, fi);
      });
    });

    tracksContainer.appendChild(el);
  });
  highlightActive();
}

function loadTrack(trackIdx, fmtIdx=0){
  if(!currentTracks[trackIdx]) return;
  currentIndex = trackIdx;
  currentFormatIndex = fmtIdx;
  const track = currentTracks[trackIdx];
  const fmt = track.formats[fmtIdx];

  while(videoPlayer.firstChild) videoPlayer.removeChild(videoPlayer.firstChild);
  const source = document.createElement('source');
  source.src = fmt.fileUrl;
  videoPlayer.appendChild(source);

  videoPlayer.load();
  videoPlayer.play().catch(()=>{});
  highlightActive();
}

function highlightActive(){
  const els = tracksContainer.querySelectorAll('.track');
  els.forEach((el, idx) => {
    el.classList.toggle('active', idx === currentIndex);
  });
}

// helpers
async function fetchArchiveMetadata(identifier){
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Archive.org metadata fetch failed');
  return res.json();
}

function extractIdentifierFromUrl(url){
  try{
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if(idx >= 0 && parts[idx+1]) return parts[idx+1];
    return parts[parts.length-1];
  }catch{ return null; }
}

function escapeHtml(s=''){
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

loadPlaylists();
