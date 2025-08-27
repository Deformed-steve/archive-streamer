// assets/js/player.js
const PLAYLISTS_URL = '/data/playlists.json';
const playlistsContainer = document.getElementById('playlists');
const tracksContainer = document.getElementById('playlistTracks');
const videoPlayer = document.getElementById('videoPlayer');
const coverImg = document.getElementById('coverImg');

let currentPlaylist = null;
let currentTracks = [];
let currentIndex = 0;

async function loadPlaylists(){
  try{
    const r = await fetch(PLAYLISTS_URL);
    if(!r.ok) throw new Error('Failed loading playlists.json');
    const data = await r.json();
    renderPlaylistsList(data.playlists || []);
    // auto-load first playlist
    if(data.playlists && data.playlists.length) selectPlaylist(0, data.playlists[0]);
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
  tracksContainer.innerHTML = `<div class="small">Loading playlist from Archive.org…</div>`;
  try{
    const id = extractIdentifierFromUrl(pl.url);
    if(!id) throw new Error('Could not parse archive.org identifier from URL');
    const meta = await fetchArchiveMetadata(id);
    const files = meta?.files || [];
    // pick video files: mp4, webm, ogv
    const videoFiles = files.filter(f => {
      const n = (f.name || '').toLowerCase();
      return n.endsWith('.mp4') || n.endsWith('.webm') || n.endsWith('.ogv') || f.format?.toLowerCase().includes('mp4');
    });
    if(videoFiles.length === 0){
      tracksContainer.innerHTML = `<div class="small">No video files found for identifier <code>${id}</code>.</div>`;
      currentTracks = [];
      return;
    }

    // Build track objects
    currentTracks = videoFiles.map((f, i) => {
      const filename = f.name;
      // direct file URL pattern:
      const fileUrl = `https://archive.org/download/${id}/${filename}`;
      return {
        title: f.title || filename || `${idx}-${i}`,
        fileUrl,
        size: f.size,
        format: f.format || '',
      };
    });

    renderTracks();
    loadTrack(0);
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
    el.innerHTML = `
      <div class="meta">
        <div class="title">${escapeHtml(t.title)}</div>
        <div class="sub">${escapeHtml(t.format)} ${t.size ? '• ' + t.size : ''}</div>
      </div>
      <div class="small">▶</div>
    `;
    el.addEventListener('click', ()=> loadTrack(i));
    tracksContainer.appendChild(el);
  });
  highlightActive();
}

function loadTrack(i){
  if(!currentTracks[i]) return;
  currentIndex = i;
  const t = currentTracks[i];
  // remove existing sources then add a single source (browser picks)
  while(videoPlayer.firstChild) videoPlayer.removeChild(videoPlayer.firstChild);
  const source = document.createElement('source');
  source.src = t.fileUrl;
  // try to set type from format
  if(t.format && t.format.toLowerCase().includes('mp4')) source.type = 'video/mp4';
  videoPlayer.appendChild(source);
  videoPlayer.load();
  videoPlayer.play().catch(()=>{ /* autoplay may be blocked */});
  highlightActive();
}

function highlightActive(){
  const els = tracksContainer.querySelectorAll('.track');
  els.forEach(el => {
    el.classList.toggle('active', Number(el.dataset.index) === currentIndex);
  });
}

// helper: get /metadata/<id>
async function fetchArchiveMetadata(identifier){
  const url = `https://archive.org/metadata/${encodeURIComponent(identifier)}`;
  const res = await fetch(url);
  if(!res.ok) throw new Error('Archive.org metadata fetch failed: ' + res.status);
  return res.json();
}

function extractIdentifierFromUrl(url){
  try{
    // common forms:
    // https://archive.org/details/identifier
    // .../details/identifier/
    // .../details/identifier/anything
    const u = new URL(url);
    // split pathname, identifier is first segment after /details/ or last segment
    const parts = u.pathname.split('/').filter(Boolean);
    const idx = parts.indexOf('details');
    if(idx >= 0 && parts.length > idx+1) return parts[idx+1];
    // fallback to last segment
    return parts[parts.length - 1] || null;
  }catch(e){
    return null;
  }
}

function escapeHtml(s = ''){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// init
loadPlaylists();

// Optional: keyboard next/prev
document.addEventListener('keydown', e=>{
  if(e.key === 'ArrowRight'){ if(currentIndex < currentTracks.length-1) loadTrack(currentIndex+1) }
  if(e.key === 'ArrowLeft'){ if(currentIndex > 0) loadTrack(currentIndex-1) }
});
