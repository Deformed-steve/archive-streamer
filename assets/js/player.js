// assets/js/player.js
const PLAYLISTS_URL = '/data/playlists.json';
const playlistsContainer = document.getElementById('playlists');
const tracksContainer = document.getElementById('playlistTracks');
const coverImg = document.getElementById('coverImg');

let currentPlaylist = null;
let currentTracks = [];

async function loadPlaylists(){
  try{
    const r = await fetch(PLAYLISTS_URL);
    if(!r.ok) throw new Error('Failed loading playlists.json');
    const data = await r.json();
    renderPlaylistsList(data.playlists || []);
    if(data.playlists?.length) selectPlaylist(0, data.playlists[0]);
  }catch(err){
    playlistsContainer.innerHTML = `<div class="small">Error loading playlists: ${err.message}</div>`;
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

    currentTracks = files.filter(f => {
      const n = f.name?.toLowerCase() || '';
      return videoFormats.some(ext => n.endsWith(ext));
    }).map(f => {
      const urlBase = pl.url.replace('/details/','/download/').replace(/\/$/,'');
      return {
        title: f.name,
        url: `${urlBase}/${encodeURIComponent(f.name)}`
      };
    });

    if(currentTracks.length === 0){
      tracksContainer.innerHTML = `<div class="small">No playable videos found.</div>`;
      return;
    }

    renderTracks();

  }catch(err){
    tracksContainer.innerHTML = `<div class="small">Error: ${err.message}</div>`;
  }
}

function renderTracks(){
  tracksContainer.innerHTML = '';
  currentTracks.forEach((t, i) => {
    const el = document.createElement('div');
    el.className = 'track';
    el.innerHTML = `
      <div class="meta">
        <div class="title">${escapeHtml(t.title)}</div>
      </div>
    `;
    el.addEventListener('click', ()=> openIframe(t.url));
    tracksContainer.appendChild(el);
  });
}

// IFRAME overlay
function openIframe(url){
  // overlay container
  const overlay = document.createElement('div');
  overlay.className = 'iframe-overlay';
  overlay.innerHTML = `
    <div class="iframe-box">
      <iframe src="${url}" frameborder="0" allowfullscreen></iframe>
      <button class="iframe-close">✖</button>
      <button class="iframe-fullscreen">⛶</button>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('.iframe-close').addEventListener('click', ()=> overlay.remove());
  overlay.querySelector('.iframe-fullscreen').addEventListener('click', ()=>{
    const iframe = overlay.querySelector('iframe');
    if(iframe.requestFullscreen) iframe.requestFullscreen();
  });
}

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
