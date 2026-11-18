import type { CardinalityMode, IdeaDetail, IdeaNode } from '../types/brainflow';
import { computeNodeDegrees, getCardinalityVisual } from './cardinality';
import {
  ALL_PORT_SIDES,
  buildConnectionCurve,
  buildParallelConnectionCurves,
  getEdgeAnchorPoint,
  getInputPortSide,
  getOutputPortSide,
  getPortRimPoint,
  PORT_RADIUS,
} from './geometry';

export function toSafeFilenameSlug(name: string, fallback: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export function triggerBlobDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const trimmed = src.trim();
    if (!trimmed) {
      resolve(null);
      return;
    }

    const img = new Image();
    if (!trimmed.startsWith('data:')) {
      img.crossOrigin = 'anonymous';
    }

    const timer = window.setTimeout(() => {
      resolve(null);
    }, 6000);

    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = trimmed;
  });
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const paragraphs = text.split(/\r?\n/);
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push('');
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Hard-break a single extra-long word if needed
        if (ctx.measureText(word).width > maxWidth) {
          let chunk = '';
          for (const ch of word) {
            if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
              lines.push(chunk);
              chunk = ch;
            } else {
              chunk += ch;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }

  return lines;
}

function parseCubicEndpoints(d: string): {
  p0: { x: number; y: number };
  c1: { x: number; y: number };
  c2: { x: number; y: number };
  p1: { x: number; y: number };
} | null {
  const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number);
  if (!nums || nums.length < 8) return null;
  return {
    p0: { x: nums[0], y: nums[1] },
    c1: { x: nums[2], y: nums[3] },
    c2: { x: nums[4], y: nums[5] },
    p1: { x: nums[6], y: nums[7] },
  };
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  tipX: number,
  tipY: number,
  angle: number,
  color: string,
  size = 9
) {
  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size * 0.48);
  ctx.lineTo(-size, size * 0.48);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

function getBoundingBox(idea: IdeaDetail) {
  if (idea.nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 420 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const nodeMap = new Map<number, IdeaNode>(idea.nodes.map((n) => [n.id, n]));

  for (const node of idea.nodes) {
    minX = Math.min(minX, node.x - 14);
    minY = Math.min(minY, node.y - 14);
    maxX = Math.max(maxX, node.x + node.width + 14);
    maxY = Math.max(maxY, node.y + node.height + 14);
  }

  for (const conn of idea.connections) {
    const fromNode = nodeMap.get(conn.fromNodeId);
    const toNode = nodeMap.get(conn.toNodeId);
    if (!fromNode || !toNode) continue;

    const fromSide = conn.fromSide ?? getOutputPortSide(fromNode);
    const toSide = conn.toSide ?? getInputPortSide(toNode);
    const p1 = getPortRimPoint(getEdgeAnchorPoint(fromNode, fromSide), fromSide);
    const p2 = getPortRimPoint(getEdgeAnchorPoint(toNode, toSide), toSide);
    const curve = buildConnectionCurve(p1, p2, fromSide, toSide);

    const cx = curve.midX + (conn.labelOffsetX ?? 0);
    const cy = curve.midY + (conn.labelOffsetY ?? 0);
    const lw = Math.max(40, conn.labelWidth ?? 96);
    const lh = Math.max(20, conn.labelHeight ?? 24);

    minX = Math.min(minX, cx - lw / 2 - 10, p1.x - 20, p2.x - 20);
    minY = Math.min(minY, cy - lh / 2 - 10, p1.y - 20, p2.y - 20);
    maxX = Math.max(maxX, cx + lw / 2 + 10, p1.x + 20, p2.x + 20);
    maxY = Math.max(maxY, cy + lh / 2 + 10, p1.y + 20, p2.y + 20);
  }

  return { minX, minY, maxX, maxY };
}

async function renderIdeaToCanvas(
  idea: IdeaDetail,
  projectName: string,
  cardinalityMode: CardinalityMode
): Promise<HTMLCanvasElement> {
  const PAD = 48;
  const HEADER_H = 54;
  const bounds = getBoundingBox(idea);
  const contentW = Math.max(640, bounds.maxX - bounds.minX);
  const contentH = Math.max(360, bounds.maxY - bounds.minY);
  const logicalW = Math.ceil(contentW + PAD * 2);
  const logicalH = Math.ceil(contentH + PAD * 2 + HEADER_H);

  // Use 2x crisp DPI while capping max texture dimension safely at 4096px
  const maxDim = Math.max(logicalW, logicalH);
  const pixelRatio = maxDim * 2 <= 4096 ? 2 : Math.max(1, 4096 / maxDim);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalW * pixelRatio);
  canvas.height = Math.round(logicalH * pixelRatio);

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize 2D canvas context for export.');
  }

  // Preload all unique node images concurrently
  const uniqueUrls = Array.from(
    new Set(idea.nodes.map((n) => n.imageUrl?.trim()).filter((u): u is string => Boolean(u)))
  );
  const loadedEntries = await Promise.all(
    uniqueUrls.map(async (url) => [url, await loadImageForCanvas(url)] as const)
  );
  const imageCache = new Map<string, HTMLImageElement | null>(loadedEntries);

  ctx.save();
  ctx.scale(pixelRatio, pixelRatio);

  // Background & subtle dot grid matching BrainFlow theme
  ctx.fillStyle = '#020617';
  ctx.fillRect(0, 0, logicalW, logicalH);

  ctx.fillStyle = '#1e293b';
  for (let gx = 12; gx < logicalW; gx += 24) {
    for (let gy = HEADER_H + 12; gy < logicalH; gy += 24) {
      ctx.fillRect(gx, gy, 1.5, 1.5);
    }
  }

  // Top Header Strip
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, logicalW, HEADER_H);
  ctx.strokeStyle = '#1e293b';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, HEADER_H);
  ctx.lineTo(logicalW, HEADER_H);
  ctx.stroke();

  ctx.fillStyle = '#f1f5f9';
  ctx.font = '600 15px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  const titleText = projectName ? `${projectName} / ${idea.name}` : idea.name;
  ctx.fillText(titleText, 24, 24);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
  ctx.fillText(
    `${idea.nodes.length} idea object${idea.nodes.length === 1 ? '' : 's'} • ${idea.connections.length} connection${idea.connections.length === 1 ? '' : 's'}`,
    24,
    42
  );

  // Translate to diagram coordinate space
  const offsetX = PAD - bounds.minX;
  const offsetY = HEADER_H + PAD - bounds.minY;
  ctx.translate(offsetX, offsetY);

  if (idea.nodes.length === 0) {
    ctx.fillStyle = '#64748b';
    ctx.font = '14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Empty idea canvas', contentW / 2, contentH / 2);
    ctx.restore();
    return canvas;
  }

  const nodeMap = new Map<number, IdeaNode>(idea.nodes.map((n) => [n.id, n]));
  const degrees = computeNodeDegrees(idea.nodes, idea.connections);

  // 1. Draw Group Containers (behind connections and ideas)
  for (const node of idea.nodes.filter((n) => n.isGroup)) {
    ctx.save();
    // Translucent background
    drawRoundedRectPath(ctx, node.x, node.y, node.width, node.height, 16);
    ctx.fillStyle = '#090d16';
    ctx.globalAlpha = 0.85;
    ctx.fill();

    // Subtle tint
    ctx.fillStyle = node.color;
    ctx.globalAlpha = 0.08;
    ctx.fill();

    // Border
    ctx.globalAlpha = 1;
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();

    // Group badge
    ctx.setLineDash([]);
    drawRoundedRectPath(ctx, node.x + 12, node.y + 10, 64, 18, 9);
    ctx.fillStyle = node.color;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = node.color;
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('GROUP', node.x + 44, node.y + 19);

    // Group Title
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(node.label, node.x + 84, node.y + 20);

    // Group Description
    if (node.description?.trim()) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(node.description.slice(0, 80), node.x + 14, node.y + 42);
    }
    ctx.restore();
  }

  // 2. Draw Connections
  for (const conn of idea.connections) {
    const fromNode = nodeMap.get(conn.fromNodeId);
    const toNode = nodeMap.get(conn.toNodeId);
    if (!fromNode || !toNode) continue;

    const fromSide = conn.fromSide ?? getOutputPortSide(fromNode);
    const toSide = conn.toSide ?? getInputPortSide(toNode);
    const p1 = getPortRimPoint(getEdgeAnchorPoint(fromNode, fromSide), fromSide);
    const p2 = getPortRimPoint(getEdgeAnchorPoint(toNode, toSide), toSide);

    const isBidirectional = Boolean(conn.bidirectional);
    const parallel = isBidirectional
      ? buildParallelConnectionCurves(p1, p2, fromSide, toSide, 3.5)
      : null;
    const single = !isBidirectional ? buildConnectionCurve(p1, p2, fromSide, toSide) : null;

    if (isBidirectional && parallel) {
      ctx.save();
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 1.75;
      ctx.setLineDash([6, 4]);

      ctx.stroke(new Path2D(parallel.dForward));
      ctx.stroke(new Path2D(parallel.dBackward));
      ctx.setLineDash([]);

      const fwd = parseCubicEndpoints(parallel.dForward);
      if (fwd) {
        const angleEnd = Math.atan2(fwd.p1.y - fwd.c2.y, fwd.p1.x - fwd.c2.x);
        drawArrowhead(ctx, fwd.p1.x, fwd.p1.y, angleEnd, conn.color, 8.5);
      }
      const bwd = parseCubicEndpoints(parallel.dBackward);
      if (bwd) {
        const angleStart = Math.atan2(bwd.p0.y - bwd.c1.y, bwd.p0.x - bwd.c1.x);
        drawArrowhead(ctx, bwd.p0.x, bwd.p0.y, angleStart, conn.color, 8.5);
      }
      ctx.restore();
    } else if (single) {
      ctx.save();
      ctx.strokeStyle = conn.color;
      ctx.lineWidth = 2;
      ctx.stroke(new Path2D(single.d));

      const pts = parseCubicEndpoints(single.d);
      if (pts) {
        const angleEnd = Math.atan2(pts.p1.y - pts.c2.y, pts.p1.x - pts.c2.x);
        drawArrowhead(ctx, pts.p1.x, pts.p1.y, angleEnd, conn.color, 9);
      }
      ctx.restore();
    }

    const mx = single?.midX ?? parallel!.midX;
    const my = single?.midY ?? parallel!.midY;
    const lx = conn.labelOffsetX ?? 0;
    const ly = conn.labelOffsetY ?? 0;
    const labelW = Math.max(40, conn.labelWidth ?? 96);
    const labelH = Math.max(20, conn.labelHeight ?? 24);
    const cx = mx + lx;
    const cy = my + ly;
    const rx = cx - labelW / 2;
    const ry = cy - labelH / 2;

    if (Math.hypot(lx, ly) > 12) {
      ctx.save();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(cx, cy);
      ctx.stroke();
      ctx.restore();
    }

    // Pointed hexagon label symbol
    const cap = Math.min(12, labelH / 2, labelW / 4);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rx, cy);
    ctx.lineTo(rx + cap, ry);
    ctx.lineTo(rx + labelW - cap, ry);
    ctx.lineTo(rx + labelW, cy);
    ctx.lineTo(rx + labelW - cap, ry + labelH);
    ctx.lineTo(rx + cap, ry + labelH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fill();
    ctx.strokeStyle = conn.color;
    ctx.lineWidth = 1.25;
    ctx.stroke();

    const hasExtras =
      Object.keys(conn.properties || {}).length > 0 || (conn.actions || []).length > 0;
    const labelText = `${conn.label}${hasExtras ? ' •' : ''}`;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '500 12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labelLines = wrapTextLines(ctx, labelText, Math.max(24, labelW - 22));
    const lineHeight = 14;
    const startY = cy - ((labelLines.length - 1) * lineHeight) / 2;
    labelLines.forEach((line, idx) => {
      ctx.fillText(line, cx, startY + idx * lineHeight);
    });
    ctx.restore();
  }

  // 3. Draw Idea Nodes
  for (const node of idea.nodes.filter((n) => !n.isGroup)) {
    const degree = degrees[node.id] ?? { inDegree: 0, outDegree: 0, total: 0 };
    const card = getCardinalityVisual(degree, cardinalityMode);

    ctx.save();
    if (card.dimmed) {
      ctx.globalAlpha = 0.38;
    }

    // Cardinality halo
    if (card.ringColor) {
      ctx.save();
      drawRoundedRectPath(
        ctx,
        node.x - 5,
        node.y - 5,
        node.width + 10,
        node.height + 10,
        13
      );
      ctx.strokeStyle = card.ringColor;
      ctx.lineWidth = card.ringWidth;
      if (card.dashed) ctx.setLineDash([5, 3]);
      ctx.stroke();
      ctx.restore();
    }

    // Card background & border
    drawRoundedRectPath(ctx, node.x, node.y, node.width, node.height, 10);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Left accent strip
    drawRoundedRectPath(ctx, node.x, node.y, 5, node.height, 3);
    ctx.fillStyle = node.color;
    ctx.fill();

    // Title
    ctx.fillStyle = '#f1f5f9';
    ctx.font = '600 13px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(node.label, node.x + 10, node.y + 18);

    // Attached Image & Description
    const innerX = node.x + 10;
    const innerW = Math.max(40, node.width - 18);
    let cursorY = node.y + 26;
    const hasImage = Boolean(node.imageUrl?.trim());
    const hasDesc = Boolean(node.description?.trim());
    const availH = Math.max(20, node.height - 43);

    if (hasImage) {
      const imgH = hasDesc ? Math.max(36, availH - 36) : availH;
      const loadedImg = imageCache.get((node.imageUrl ?? '').trim());
      if (loadedImg && loadedImg.naturalWidth > 0 && loadedImg.naturalHeight > 0) {
        const ratio = Math.min(
          innerW / loadedImg.naturalWidth,
          imgH / loadedImg.naturalHeight
        );
        const drawW = loadedImg.naturalWidth * ratio;
        const drawH = loadedImg.naturalHeight * ratio;
        const drawX = innerX + (innerW - drawW) / 2;
        const drawY = cursorY + (imgH - drawH) / 2;
        ctx.drawImage(loadedImg, drawX, drawY, drawW, drawH);
      } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '11px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.fillText('[External image unavailable]', innerX, cursorY + 14);
      }
      cursorY += imgH + 4;
    }

    if (hasDesc) {
      ctx.fillStyle = '#cbd5e1';
      ctx.font = '12px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
      const descLines = wrapTextLines(ctx, node.description, innerW);
      const lineH = 15;
      for (const line of descLines) {
        ctx.fillText(line, innerX, cursorY + 10);
        cursorY += lineH;
      }
    }

    // Anchor Ports
    const inputSide = getInputPortSide(node);
    const outputSide = getOutputPortSide(node);
    for (const side of ALL_PORT_SIDES) {
      const pt = getEdgeAnchorPoint(node, side);
      const isInput = side === inputSide;
      const isOutput = side === outputSide;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, isInput || isOutput ? PORT_RADIUS : 4, 0, Math.PI * 2);
      ctx.fillStyle = isInput ? '#10b981' : isOutput ? '#3b82f6' : '#1e293b';
      ctx.fill();
      ctx.strokeStyle = isInput || isOutput ? '#020617' : '#64748b';
      ctx.lineWidth = isInput || isOutput ? 2 : 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  ctx.restore();
  return canvas;
}

function buildPdfFromJpeg(
  jpegBytes: Uint8Array,
  pxWidth: number,
  pxHeight: number
): Blob {
  // Fit diagram cleanly onto a PDF page (points, 72pt = 1 inch)
  const pageW = Math.max(595, Math.min(1440, Math.round(pxWidth * 0.5)));
  const pageH = Math.max(240, Math.round(pageW * (pxHeight / pxWidth)));

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const pushBytes = (bytes: Uint8Array) => {
    chunks.push(bytes);
    byteLength += bytes.length;
  };
  const pushText = (text: string) => {
    pushBytes(encoder.encode(text));
  };

  pushText('%PDF-1.4\n');
  pushBytes(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  const beginObj = (id: number) => {
    offsets[id] = byteLength;
    pushText(`${id} 0 obj\n`);
  };

  beginObj(1);
  pushText('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObj(2);
  pushText('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  beginObj(3);
  pushText(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );

  beginObj(4);
  pushText(
    `<< /Type /XObject /Subtype /Image /Width ${pxWidth} /Height ${pxHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`
  );
  pushBytes(jpegBytes);
  pushText('\nendstream\nendobj\n');

  const contentStream = `q ${pageW} 0 0 ${pageH} 0 0 cm /Im1 Do Q\n`;
  beginObj(5);
  pushText(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLength;
  pushText('xref\n0 6\n0000000000 65535 f \n');
  for (let id = 1; id <= 5; id++) {
    const offStr = String(offsets[id]).padStart(10, '0');
    pushText(`${offStr} 00000 n \n`);
  }
  pushText(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const merged = new Uint8Array(byteLength);
  let pos = 0;
  for (const chunk of chunks) {
    merged.set(chunk, pos);
    pos += chunk.length;
  }

  return new Blob([merged], { type: 'application/pdf' });
}

export async function exportIdeaAsImage(
  idea: IdeaDetail,
  projectName: string,
  cardinalityMode: CardinalityMode
): Promise<void> {
  const canvas = await renderIdeaToCanvas(idea, projectName, cardinalityMode);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) {
    throw new Error('Failed to generate PNG image from canvas.');
  }
  const slug = toSafeFilenameSlug(idea.name, `idea-${idea.id}`);
  triggerBlobDownload(`${slug}.png`, blob);
}

export async function exportIdeaAsPdf(
  idea: IdeaDetail,
  projectName: string,
  cardinalityMode: CardinalityMode
): Promise<void> {
  const canvas = await renderIdeaToCanvas(idea, projectName, cardinalityMode);
  const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.95);
  const base64 = jpegDataUrl.split(',')[1];
  if (!base64) {
    throw new Error('Failed to encode canvas image for PDF export.');
  }
  const binary = atob(base64);
  const jpegBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    jpegBytes[i] = binary.charCodeAt(i);
  }
  const pdfBlob = buildPdfFromJpeg(jpegBytes, canvas.width, canvas.height);
  const slug = toSafeFilenameSlug(idea.name, `idea-${idea.id}`);
  triggerBlobDownload(`${slug}.pdf`, pdfBlob);
}
