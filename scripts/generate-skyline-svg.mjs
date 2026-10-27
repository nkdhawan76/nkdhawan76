import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync('data/github.json', 'utf8'));
const { days, total, bestDay } = data;

// Color schemes matching GitHub green levels
const PALETTE = [
  { top: '#EBEDF0', front: '#D5D9E0', side: '#BFC5D1' }, // 0: Empty
  { top: '#9BE9A8', front: '#7AD188', side: '#5CB96B' }, // 1: Low (1-3)
  { top: '#40C463', front: '#34A853', side: '#288842' }, // 2: Mid (4-9)
  { top: '#30A14E', front: '#26873F', side: '#1D6B31' }, // 3: High (10-20)
  { top: '#216E39', front: '#18562B', side: '#103F1E' }, // 4: Peak (20+)
];

// Months mapping
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Organize into weeks (columns of 7 days)
const weeks = [];
let currentWeek = [];

for (let i = 0; i < days.length; i++) {
  const d = days[i];
  const dateObj = new Date(d.date + 'T00:00:00Z');
  const dayOfWeek = dateObj.getUTCDay(); // 0 is Sunday, 1 is Mon, etc.

  currentWeek.push({ ...d, dayOfWeek, index: i });
  if (dayOfWeek === 6 || i === days.length - 1) {
    weeks.push(currentWeek);
    currentWeek = [];
  }
}

// Projection parameters
const numWeeks = weeks.length;
const tileW = 16;
const tileD = 12; // Depth in projection
const angleOffset = 6; // Oblique X shift for depth
const gapX = 4;
const gapY = 4;

const originX = 65;
const originY = 130;
const canvasW = originX + numWeeks * (tileW + gapX) + 80;
const maxBuildingH = 120;
const canvasH = originY + 7 * (tileD + gapY + 12) + maxBuildingH + 40;

let svgElements = [];

// Header text
svgElements.push(`
  <!-- Header Title -->
  <text x="30" y="45" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="22" font-weight="700" fill="#24292F">
    ${total.toLocaleString()} contributions in the last year
  </text>
  <text x="30" y="70" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="500" fill="#57609A">
    🏙️ 3D Contribution Skyline — Small buildings = few commits, Skyscrapers = high commit volume
  </text>
`);

// Weekday labels
const weekdayLabels = [
  { name: 'Mon', row: 1 },
  { name: 'Wed', row: 3 },
  { name: 'Fri', row: 5 },
];

for (const wl of weekdayLabels) {
  const yPos = originY + maxBuildingH + wl.row * (tileD + gapY + 10) + 8;
  svgElements.push(`
    <text x="25" y="${yPos}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="500" fill="#57606A">
      ${wl.name}
    </text>
  `);
}

// Track month positions
let lastMonth = -1;
const monthHeaders = [];

for (let w = 0; w < weeks.length; w++) {
  const firstDay = weeks[w][0];
  if (firstDay) {
    const m = new Date(firstDay.date + 'T00:00:00Z').getUTCMonth();
    if (m !== lastMonth && weeks[w].length >= 4) {
      lastMonth = m;
      monthHeaders.push({
        name: monthNames[m],
        x: originX + w * (tileW + gapX) + angleOffset * 3,
      });
    }
  }
}

for (const mh of monthHeaders) {
  svgElements.push(`
    <text x="${mh.x}" y="${originY + maxBuildingH - 24}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" font-weight="600" fill="#57606A">
      ${mh.name}
    </text>
  `);
}

// Draw buildings from back row (day 0) to front row (day 6), and week 0 to N
// To ensure correct occlusion:
let bestDayCoords = null;

for (let row = 0; row < 7; row++) {
  for (let w = 0; w < weeks.length; w++) {
    const day = weeks[w].find((d) => d.dayOfWeek === row);
    if (!day) continue;

    // Base coordinate on ground plane
    const bx = originX + w * (tileW + gapX) + (6 - row) * (angleOffset / 6);
    const by = originY + maxBuildingH + row * (tileD + gapY + 10);

    // Height calculation: square root scaling
    let h = 3; // minimal flat base
    if (day.count > 0) {
      h = Math.max(7, Math.min(maxBuildingH, Math.round(Math.sqrt(day.count) * 9.2)));
    }

    const colors = PALETTE[day.level] || PALETTE[0];
    const topY = by - h;

    const isBest = day.date === bestDay.date && day.count === bestDay.count;
    if (isBest) {
      bestDayCoords = { x: bx + tileW / 2, y: topY, count: day.count, date: day.date };
    }

    // Top face polygon
    // points: (bx, topY) -> (bx + tileW, topY) -> (bx + tileW + angleOffset, topY - tileD) -> (bx + angleOffset, topY - tileD)
    const topPoints = `${bx},${topY} ${bx + tileW},${topY} ${bx + tileW + angleOffset},${topY - tileD} ${bx + angleOffset},${topY - tileD}`;

    // Front face: rect from (bx, topY) to (bx + tileW, by)
    const frontPoints = `${bx},${topY} ${bx + tileW},${topY} ${bx + tileW},${by} ${bx},${by}`;

    // Right side face: polygon (bx + tileW, topY) -> (bx + tileW + angleOffset, topY - tileD) -> (bx + tileW + angleOffset, by - tileD) -> (bx + tileW, by)
    const sidePoints = `${bx + tileW},${topY} ${bx + tileW + angleOffset},${topY - tileD} ${bx + tileW + angleOffset},${by - tileD} ${bx + tileW},${by}`;

    svgElements.push(`
      <g class="building" data-date="${day.date}" data-count="${day.count}">
        <polygon points="${frontPoints}" fill="${colors.front}" stroke="#000000" stroke-opacity="0.08" stroke-width="0.5"/>
        <polygon points="${sidePoints}" fill="${colors.side}" stroke="#000000" stroke-opacity="0.1" stroke-width="0.5"/>
        <polygon points="${topPoints}" fill="${colors.top}" stroke="#000000" stroke-opacity="0.06" stroke-width="0.5"/>
      </g>
    `);
  }
}

// Add Leader line to best day
if (bestDayCoords) {
  const lineTopY = bestDayCoords.y - 48;
  const formatDate = (iso) => {
    const d = new Date(iso + 'T00:00:00Z');
    return `${d.getUTCDate()} ${monthNames[d.getUTCMonth()].toUpperCase()} ${d.getUTCFullYear()}`;
  };

  svgElements.push(`
    <!-- Best Day Pointer -->
    <g class="best-day-indicator">
      <line x1="${bestDayCoords.x}" y1="${bestDayCoords.y}" x2="${bestDayCoords.x}" y2="${lineTopY}" stroke="#24292F" stroke-width="1.5" stroke-dasharray="2,2"/>
      <circle cx="${bestDayCoords.x}" cy="${bestDayCoords.y}" r="3" fill="#24292F"/>
      
      <!-- Callout card -->
      <rect x="${bestDayCoords.x - 65}" y="${lineTopY - 34}" width="130" height="32" rx="6" fill="#24292F" opacity="0.95"/>
      <text x="${bestDayCoords.x}" y="${lineTopY - 20}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#FFFFFF" text-anchor="middle">
        ${bestDayCoords.count} commits
      </text>
      <text x="${bestDayCoords.x}" y="${lineTopY - 8}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="9" font-weight="600" fill="#9BE9A8" text-anchor="middle">
        ${formatDate(bestDayCoords.date)}, BEST DAY
      </text>
    </g>
  `);
}

// Legend at bottom
const legendY = canvasH - 24;
const legendX = canvasW - 200;

svgElements.push(`
  <g class="legend" transform="translate(${legendX}, ${legendY})">
    <text x="-32" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#57606A">Less</text>
    <rect x="0" y="0" width="11" height="11" rx="2" fill="${PALETTE[0].top}" stroke="#D0D7DE" stroke-width="0.5"/>
    <rect x="15" y="0" width="11" height="11" rx="2" fill="${PALETTE[1].top}"/>
    <rect x="30" y="0" width="11" height="11" rx="2" fill="${PALETTE[2].top}"/>
    <rect x="45" y="0" width="11" height="11" rx="2" fill="${PALETTE[3].top}"/>
    <rect x="60" y="0" width="11" height="11" rx="2" fill="${PALETTE[4].top}"/>
    <text x="78" y="10" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="11" fill="#57606A">More</text>
  </g>
`);

// Wrap complete SVG
const svgContent = `
<svg width="100%" height="auto" viewBox="0 0 ${canvasW} ${canvasH}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <style>
    .building { transition: transform 0.2s ease; cursor: pointer; }
    .building:hover { opacity: 0.85; }
  </style>
  <rect width="${canvasW}" height="${canvasH}" rx="12" fill="#FFFFFF" stroke="#D0D7DE" stroke-width="1"/>
  ${svgElements.join('\n')}
</svg>
`;

fs.writeFileSync('assets/github-skyline-3d.svg', svgContent.trim(), 'utf8');
console.log(`Generated assets/github-skyline-3d.svg (canvas: ${canvasW}x${canvasH})`);
