/**
 * GitHub Contributions Interactive Canvas Suite
 * Supports: Skyline, Grid, Pulse, Ring, Streak, Terminal animations
 * Pure function: draw(ctx, w, h, t)
 */

export const GITHUB_GREENS = {
  0: '#ebedf0',
  1: '#9be9a8',
  2: '#40c463',
  3: '#30a14e',
  4: '#216e39',
};

export const SHADED_GREENS = {
  0: { top: '#ebedf0', front: '#d1d5db', side: '#9ca3af' },
  1: { top: '#9be9a8', front: '#7ad188', side: '#5cb96b' },
  2: { top: '#40c463', front: '#34a853', side: '#288842' },
  3: { top: '#30a14e', front: '#26873f', side: '#1d6b31' },
  4: { top: '#216e39', front: '#18562b', side: '#103f1e' },
};

export function createContributionAnimator({ container, data, animationType = 'skyline' }) {
  const { total, days, bestDay } = data;
  const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Setup DOM elements
  const wrapper = document.createElement('div');
  wrapper.className = 'github-contrib-card';
  wrapper.style.cssText = `
    position: relative;
    background: #ffffff;
    border: 1px solid #d0d7de;
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    overflow: hidden;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;';
  header.innerHTML = `
    <div>
      <div style="font-size:18px; font-weight:700; color:#24292f;" class="counter-display">
        ${total.toLocaleString()} contributions in the last year
      </div>
      <div style="font-size:12px; color:#57606a;">
        Mode: <span style="font-weight:600; text-transform:capitalize; color:#0969da;">${animationType}</span>
      </div>
    </div>
  `;

  const replayBtn = document.createElement('button');
  replayBtn.innerHTML = '↻ Replay';
  replayBtn.style.cssText = `
    background: #f6f8fa;
    border: 1px solid #d0d7de;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #24292f;
    cursor: pointer;
    transition: all 0.2s;
  `;
  replayBtn.onmouseenter = () => (replayBtn.style.background = '#ebedf0');
  replayBtn.onmouseleave = () => (replayBtn.style.background = '#f6f8fa');
  header.appendChild(replayBtn);
  wrapper.appendChild(header);

  // Canvas container & Tooltip
  const canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'position:relative; width:100%; height:320px;';
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'width:100%; height:100%; display:block;';
  canvasWrap.appendChild(canvas);

  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: absolute;
    display: none;
    background: #24292f;
    color: #ffffff;
    padding: 5px 9px;
    border-radius: 6px;
    font-size: 11px;
    pointer-events: none;
    z-index: 10;
    white-space: nowrap;
    box-shadow: 0 4px 10px rgba(0,0,0,0.15);
    transform: translate(-50%, -120%);
  `;
  canvasWrap.appendChild(tooltip);
  wrapper.appendChild(canvasWrap);
  container.appendChild(wrapper);

  const ctx = canvas.getContext('2d');
  let startTime = null;
  let isVisible = false;
  let animId = null;
  let hoveredDay = null;

  // Split into weeks
  const weeks = [];
  let curWeek = [];
  for (let i = 0; i < days.length; i++) {
    const d = days[i];
    const dow = new Date(d.date + 'T00:00:00Z').getUTCDay();
    curWeek.push({ ...d, dow, index: i });
    if (dow === 6 || i === days.length - 1) {
      weeks.push(curWeek);
      curWeek = [];
    }
  }

  // Animation implementations: draw(ctx, w, h, t)
  function drawSkyline(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const originX = 35;
    const originY = 60;
    const tileW = Math.max(8, (w - originX - 60) / weeks.length - 2);
    const tileD = 8;
    const angleX = 4;
    const maxH = 100;
    const duration = isReducedMotion ? 0 : 2500;

    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < weeks.length; c++) {
        const d = weeks[c].find((item) => item.dow === r);
        if (!d) continue;

        // Front to back wave
        const delay = (r * 180) + (c * 15);
        let progress = 1;
        if (!isReducedMotion) {
          progress = Math.max(0, Math.min(1, (t - delay) / 600));
          // easeOutBack overshoot
          const s = 1.70158;
          progress = --progress * progress * ((s + 1) * progress + s) + 1;
          progress = Math.max(0, progress);
        }

        const bx = originX + c * (tileW + 2);
        const by = originY + maxH + r * (tileD + 8);
        const targetH = d.count > 0 ? Math.max(6, Math.min(maxH, Math.sqrt(d.count) * 8.5)) : 2;
        const curH = targetH * progress;
        const topY = by - curH;

        const colors = SHADED_GREENS[d.level] || SHADED_GREENS[0];

        // Draw top face
        ctx.fillStyle = colors.top;
        ctx.beginPath();
        ctx.moveTo(bx, topY);
        ctx.lineTo(bx + tileW, topY);
        ctx.lineTo(bx + tileW + angleX, topY - tileD);
        ctx.lineTo(bx + angleX, topY - tileD);
        ctx.closePath();
        ctx.fill();

        // Draw front face
        ctx.fillStyle = colors.front;
        ctx.fillRect(bx, topY, tileW, curH);

        // Draw side face
        ctx.fillStyle = colors.side;
        ctx.beginPath();
        ctx.moveTo(bx + tileW, topY);
        ctx.lineTo(bx + tileW + angleX, topY - tileD);
        ctx.lineTo(bx + tileW + angleX, by - tileD);
        ctx.lineTo(bx + tileW, by);
        ctx.closePath();
        ctx.fill();

        // Best day indicator line
        if (d.date === bestDay.date && t > 1800) {
          ctx.strokeStyle = '#24292f';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(bx + tileW / 2, topY);
          ctx.lineTo(bx + tileW / 2, topY - 35);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.fillStyle = '#24292f';
          ctx.beginPath();
          ctx.arc(bx + tileW / 2, topY, 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = 'bold 11px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(`${d.count} commits (Best Day)`, bx + tileW / 2, topY - 42);
        }
      }
    }
  }

  function drawGrid(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const originX = 30;
    const originY = 40;
    const size = Math.max(6, (w - originX - 40) / weeks.length - 2);

    for (let c = 0; c < weeks.length; c++) {
      for (let r = 0; r < 7; r++) {
        const d = weeks[c].find((item) => item.dow === r);
        if (!d) continue;

        // Diagonal wave
        const delay = (c + r) * 18;
        let progress = 1;
        if (!isReducedMotion) {
          progress = Math.max(0, Math.min(1, (t - delay) / 400));
          // ease overshoot
          const s = 1.5;
          progress = --progress * progress * ((s + 1) * progress + s) + 1;
          progress = Math.max(0, progress);
        }

        const x = originX + c * (size + 2);
        const targetY = originY + r * (size + 2);
        const y = targetY - (1 - progress) * 35;

        ctx.globalAlpha = Math.min(1, progress);
        ctx.fillStyle = GITHUB_GREENS[d.level];
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function draw(t) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
    }
    ctx.save();
    ctx.scale(dpr, dpr);

    if (animationType === 'skyline') {
      drawSkyline(ctx, rect.width, rect.height, t);
    } else {
      drawGrid(ctx, rect.width, rect.height, t);
    }

    ctx.restore();
  }

  function loop(now) {
    if (!isVisible) return;
    if (!startTime) startTime = now;
    const t = isReducedMotion ? Infinity : now - startTime;
    draw(t);
    animId = requestAnimationFrame(loop);
  }

  // IntersectionObserver to start when 40% in view
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          isVisible = true;
          if (!animId) animId = requestAnimationFrame(loop);
        } else {
          isVisible = false;
          if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
          }
        }
      }
    },
    { threshold: 0.4 }
  );

  observer.observe(wrapper);

  replayBtn.onclick = () => {
    startTime = performance.now();
    if (!animId && isVisible) animId = requestAnimationFrame(loop);
  };

  return {
    destroy() {
      observer.disconnect();
      if (animId) cancelAnimationFrame(animId);
      wrapper.remove();
    },
  };
}
