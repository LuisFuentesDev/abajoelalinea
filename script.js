  const video = document.getElementById('livePlayer');
  const msg = document.getElementById('videoMsg');
  const streamUrl = 'https://5ff3d9babae13.streamlock.net/ynfpncxxjg/ynfpncxxjg/playlist.m3u8';

  function showMsg(text){
    msg.classList.remove('hidden');
    msg.innerHTML = text;
  }

  if (Hls.isSupported()) {
    const hls = new Hls();
    hls.loadSource(streamUrl);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, function () {
      msg.classList.add('hidden');
      video.play().catch(()=>{ /* autoplay bloqueado por el navegador, el usuario debe darle play */ });
    });
    hls.on(Hls.Events.ERROR, function (event, data) {
      if (data.fatal) {
        showMsg('No se pudo cargar la señal en vivo ahora mismo.<br>Puede estar fuera de horario o hubo un problema de conexión.');
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari soporta HLS nativo
    video.src = streamUrl;
    video.addEventListener('loadedmetadata', () => msg.classList.add('hidden'));
    video.addEventListener('error', () => showMsg('No se pudo cargar la señal en vivo ahora mismo.'));
  } else {
    showMsg('Tu navegador no soporta la reproducción de este video.<br>Prueba en Chrome, Firefox o Safari actualizados.');
  }
