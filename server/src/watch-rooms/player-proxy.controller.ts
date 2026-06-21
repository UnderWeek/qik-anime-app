import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';

@Controller('player-proxy')
export class PlayerProxyController {
  @Get()
  async proxy(@Query('url') url: string, @Res() res: Response) {
    if (!url) {
      return res.status(400).send('Missing ?url= parameter');
    }

    try {
      const fullUrl = url.startsWith('//') ? `https:${url}` : url;
      const resp = await fetch(fullUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QIK-Anime/1.0)',
        },
      });

      if (!resp.ok) {
        console.error('[PLAYER-PROXY] upstream error', resp.status, resp.statusText);
        return res.status(resp.status).send('Failed to fetch player');
      }

      const contentType = resp.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) {
        console.error('[PLAYER-PROXY] not HTML, got', contentType);
        return res.status(502).send('Not HTML');
      }

      let html = await resp.text();

      // Add <base> tag so relative CSS/JS/assets resolve to Kodik, not our domain
      const kodikOrigin = new URL(fullUrl).origin;
      const baseTag = `<base href="${kodikOrigin}/">`;

      // Inject base tag right after <head> (before any other tags)
      // Inject control script before </head>
      const controlScript = `<script>
(function() {
  var v = document.querySelector('video');
  function waitForVideo(cb) {
    if (v) return cb(v);
    var iv = setInterval(function() {
      v = document.querySelector('video');
      if (v) { clearInterval(iv); cb(v); }
    }, 200);
  }
  waitForVideo(function(video) {
    window.addEventListener('message', function(e) {
      var cmd = e.data && e.data.kodikCommand;
      if (!cmd) return;
      switch (cmd) {
        case 'play': video.play(); break;
        case 'pause': video.pause(); break;
        case 'seek': video.currentTime = e.data.time || 0; break;
      }
    });
    // Notify parent that proxy is ready for commands
    parent.postMessage({ event: 'proxy_ready' }, '*');
  });
})();
</script>`;

      html = html.replace(/<head[^>]*>/i, (match) => match + baseTag);
      html = html.replace('</head>', controlScript + '</head>');
      res.type('text/html').send(html);
    } catch (err) {
      console.error('[PLAYER-PROXY] fetch error', err.message);
      res.status(502).send('Proxy error');
    }
  }
}
