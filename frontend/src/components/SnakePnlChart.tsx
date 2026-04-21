import React, { useEffect, useRef } from "react";

export type PnlPoint = {
  time: string;
  value: number;
};

type Props = {
  data?: PnlPoint[];
  target?: number;
  stopLoss?: number;
  zeroLine?: number;
  height?: number;
};

type Pt = {
  x: number;
  y: number;
};

const DPR_CAP = 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function catmullRomToBezier(ctx: CanvasRenderingContext2D, points: Pt[]) {
  if (points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

function pointOnPath(points: Pt[], t: number): Pt {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  const idx = clamp(t * (points.length - 1), 0, points.length - 1);
  const i0 = Math.floor(idx);
  const i1 = Math.min(points.length - 1, i0 + 1);
  const frac = idx - i0;

  return {
    x: lerp(points[i0].x, points[i1].x, frac),
    y: lerp(points[i0].y, points[i1].y, frac),
  };
}

function angleOnPath(points: Pt[], t: number): number {
  const a = pointOnPath(points, Math.max(0, t - 0.01));
  const b = pointOnPath(points, Math.min(1, t + 0.01));
  return Math.atan2(b.y - a.y, b.x - a.x);
}

function buildSnakePath(
  pnlSeries: number[],
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number,
  zeroLine: number
) {
  const drawW = width - padLeft - padRight;
  const drawH = height - padTop - padBottom;

  const values = pnlSeries.length ? pnlSeries : [zeroLine];
  const minVal = Math.min(...values, zeroLine);
  const maxVal = Math.max(...values, zeroLine);
  const span = Math.max(1, maxVal - minVal);

  const yMin = minVal - span * 0.35 - 25;
  const yMax = maxVal + span * 0.35 + 25;

  const mapX = (i: number) =>
    padLeft + (i / Math.max(1, values.length - 1)) * drawW;

  const mapY = (v: number) =>
    padTop + (1 - (v - yMin) / Math.max(1, yMax - yMin)) * drawH;

  const pts: Pt[] = values.map((v, i) => ({
    x: mapX(i),
    y: mapY(v),
  }));

  return {
    pts,
    yMin,
    yMax,
    mapY,
  };
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  padLeft: number,
  padRight: number,
  padTop: number,
  padBottom: number,
  mapY: (v: number) => number,
  yMin: number,
  yMax: number,
  target: number,
  stopLoss: number,
  zeroLine: number
) {
  const right = width - padRight;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const ticks = 5;
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    const y = mapY(v);

    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "12px Inter, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(Math.round(v).toString(), padLeft - 10, y + 4);
  }

  const zeroY = mapY(zeroLine);

  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(96,165,250,0.55)";
  ctx.beginPath();
  ctx.moveTo(padLeft, zeroY);
  ctx.lineTo(right, zeroY);
  ctx.stroke();

  const targetY = mapY(target);
  ctx.setLineDash([8, 4]);
  ctx.strokeStyle = "rgba(34,197,94,0.55)";
  ctx.beginPath();
  ctx.moveTo(padLeft, targetY);
  ctx.lineTo(right, targetY);
  ctx.stroke();

  const stopY = mapY(stopLoss);
  ctx.strokeStyle = "rgba(239,68,68,0.55)";
  ctx.beginPath();
  ctx.moveTo(padLeft, stopY);
  ctx.lineTo(right, stopY);
  ctx.stroke();

  ctx.setLineDash([]);

  ctx.fillStyle = "rgba(34,197,94,0.85)";
  ctx.textAlign = "left";
  ctx.fillText(`Target ₹${target.toFixed(0)}`, right - 110, targetY - 8);

  ctx.fillStyle = "rgba(239,68,68,0.85)";
  ctx.fillText(`SL ₹${stopLoss.toFixed(0)}`, right - 90, stopY - 8);

  ctx.fillStyle = "rgba(96,165,250,0.85)";
  ctx.fillText(`Zero ₹${zeroLine.toFixed(0)}`, right - 95, zeroY - 8);

  ctx.restore();
}

function drawSnakeBody(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  widthBase: number
) {
  if (points.length < 2) return;

  ctx.save();

  catmullRomToBezier(ctx, points);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.lineWidth = widthBase * 1.35;
  ctx.strokeStyle = "rgba(20,10,0,0.95)";
  ctx.stroke();

  catmullRomToBezier(ctx, points);
  ctx.lineWidth = widthBase * 1.18;
  const outer = ctx.createLinearGradient(0, 0, 0, 600);
  outer.addColorStop(0, "#4d2b00");
  outer.addColorStop(0.35, "#8e5a07");
  outer.addColorStop(0.65, "#d4981a");
  outer.addColorStop(1, "#3f2200");
  ctx.strokeStyle = outer;
  ctx.stroke();

  catmullRomToBezier(ctx, points);
  ctx.lineWidth = widthBase * 0.75;
  const inner = ctx.createLinearGradient(0, 0, 0, 600);
  inner.addColorStop(0, "#ffefb0");
  inner.addColorStop(0.22, "#ffd76a");
  inner.addColorStop(0.5, "#e3a820");
  inner.addColorStop(0.82, "#8a4c05");
  inner.addColorStop(1, "#3a1c00");
  ctx.strokeStyle = inner;
  ctx.stroke();

  ctx.restore();
}

function drawScales(
  ctx: CanvasRenderingContext2D,
  points: Pt[],
  bodyWidth: number
) {
  if (points.length < 2) return;

  ctx.save();

  const count = Math.max(18, Math.floor(points.length * 2.3));
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const p = pointOnPath(points, t);
    const angle = angleOnPath(points, t);
    const taper = 1 - t * 0.65;
    const rx = bodyWidth * 0.28 * taper;
    const ry = bodyWidth * 0.16 * taper;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(angle);

    const grad = ctx.createRadialGradient(-rx * 0.2, -ry * 0.2, 0, 0, 0, rx * 1.15);
    grad.addColorStop(0, "rgba(255,245,195,0.92)");
    grad.addColorStop(0.25, "rgba(247,201,88,0.96)");
    grad.addColorStop(0.6, "rgba(188,120,15,0.92)");
    grad.addColorStop(1, "rgba(70,35,0,0.95)");

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = "rgba(35,15,0,0.45)";
    ctx.lineWidth = 0.6;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-rx * 0.12, -ry * 0.15, rx * 0.45, ry * 0.22, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,250,210,0.18)";
    ctx.fill();

    ctx.restore();
  }

  ctx.restore();
}

function drawSnakeHead(
  ctx: CanvasRenderingContext2D,
  head: Pt,
  angle: number,
  scale: number,
  time: number
) {
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(angle);

  const headLen = scale * 2.2;
  const headH = scale * 1.4;

  const skull = ctx.createRadialGradient(
    headLen * 0.1,
    -headH * 0.25,
    0,
    headLen * 0.35,
    0,
    headLen * 1.15
  );
  skull.addColorStop(0, "#fff2b0");
  skull.addColorStop(0.25, "#ffd86b");
  skull.addColorStop(0.55, "#d19013");
  skull.addColorStop(1, "#4a2600");

  ctx.beginPath();
  ctx.moveTo(-headLen * 0.35, -headH * 0.75);
  ctx.quadraticCurveTo(headLen * 0.2, -headH * 1.1, headLen * 0.95, -headH * 0.1);
  ctx.quadraticCurveTo(headLen * 1.12, 0, headLen * 0.95, headH * 0.1);
  ctx.quadraticCurveTo(headLen * 0.2, headH * 1.1, -headLen * 0.35, headH * 0.75);
  ctx.quadraticCurveTo(-headLen * 0.68, 0, -headLen * 0.35, -headH * 0.75);
  ctx.closePath();
  ctx.fillStyle = skull;
  ctx.fill();
  ctx.strokeStyle = "rgba(30,10,0,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const eyeX = headLen * 0.14;
  const eyeY = -headH * 0.32;

  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, scale * 0.22, scale * 0.18, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#0c0300";
  ctx.fill();

  const iris = ctx.createRadialGradient(eyeX - 2, eyeY - 2, 0, eyeX, eyeY, scale * 0.18);
  iris.addColorStop(0, "#fff890");
  iris.addColorStop(0.35, "#ff9f1a");
  iris.addColorStop(0.7, "#8b1600");
  iris.addColorStop(1, "#100000");
  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, scale * 0.16, scale * 0.14, 0, 0, Math.PI * 2);
  ctx.fillStyle = iris;
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(eyeX, eyeY, scale * 0.035, scale * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(eyeX - scale * 0.04, eyeY - scale * 0.04, scale * 0.025, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,230,0.9)";
  ctx.fill();

  const flick = Math.sin(time * 0.018) * scale * 0.16;
  const tongueBaseX = headLen * 1.04;
  const tongueBaseY = headH * 0.05;

  ctx.strokeStyle = "#d91f1f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";

  ctx.beginPath();
  ctx.moveTo(tongueBaseX, tongueBaseY);
  ctx.quadraticCurveTo(
    tongueBaseX + scale * 0.4,
    tongueBaseY + flick * 0.4,
    tongueBaseX + scale * 0.88,
    tongueBaseY + flick
  );
  ctx.stroke();

  const tongueTipX = tongueBaseX + scale * 0.88;
  const tongueTipY = tongueBaseY + flick;

  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(tongueTipX, tongueTipY);
  ctx.lineTo(tongueTipX + scale * 0.25, tongueTipY - scale * 0.16);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tongueTipX, tongueTipY);
  ctx.lineTo(tongueTipX + scale * 0.25, tongueTipY + scale * 0.16);
  ctx.stroke();

  ctx.restore();
}

function drawTail(ctx: CanvasRenderingContext2D, tail: Pt, angle: number, scale: number) {
  ctx.save();
  ctx.translate(tail.x, tail.y);
  ctx.rotate(angle);

  const grad = ctx.createLinearGradient(0, -scale, 0, scale);
  grad.addColorStop(0, "#d19013");
  grad.addColorStop(1, "#351600");

  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-scale * 1.55, -scale * 0.22);
  ctx.lineTo(-scale * 2.15, scale * 0.16);
  ctx.lineTo(-scale * 1.1, scale * 0.38);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "rgba(35,10,0,0.8)";
  ctx.lineWidth = 0.8;
  ctx.stroke();

  ctx.restore();
}

export default function SnakePnlChart({
  data = [],
  target = 3000,
  stopLoss = -1500,
  zeroLine = 0,
  height = 420,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const cssWidth = parent.clientWidth || 1000;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
      canvas.width = Math.floor(cssWidth * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(parent);

    let frame = 0;

    const render = () => {
      frame += 1;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const width = canvas.clientWidth;
      const h = height;

      ctx.clearRect(0, 0, width, h);

      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, "#0a0f1b");
      bg.addColorStop(1, "#080d18");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, h);

      const glow = ctx.createRadialGradient(width * 0.72, h * 0.28, 0, width * 0.72, h * 0.28, width * 0.55);
      glow.addColorStop(0, "rgba(255,180,0,0.08)");
      glow.addColorStop(1, "rgba(255,180,0,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, h);

      const padLeft = 70;
      const padRight = 30;
      const padTop = 30;
      const padBottom = 50;

      const pnlSeries = data.map((d) => d.value);
      const chart = buildSnakePath(
        pnlSeries,
        width,
        h,
        padLeft,
        padRight,
        padTop,
        padBottom,
        zeroLine
      );

      drawGrid(
        ctx,
        width,
        h,
        padLeft,
        padRight,
        padTop,
        padBottom,
        chart.mapY,
        chart.yMin,
        chart.yMax,
        target,
        stopLoss,
        zeroLine
      );

      if (chart.pts.length >= 2) {
        const bodyWidth = clamp(Math.min(28, Math.max(18, width * 0.022)), 18, 28);

        drawSnakeBody(ctx, chart.pts, bodyWidth);
        drawScales(ctx, chart.pts, bodyWidth);

        const tail = chart.pts[0];
        const tailAngle = angleOnPath(chart.pts, 0.03);
        drawTail(ctx, tail, tailAngle, bodyWidth * 0.52);

        const head = chart.pts[chart.pts.length - 1];
        const headAngle = angleOnPath(chart.pts, 0.98);
        drawSnakeHead(ctx, head, headAngle, bodyWidth * 0.78, frame);

        const last = data[data.length - 1];
        if (last) {
          ctx.save();
          ctx.fillStyle = "#f7cf65";
          ctx.font = "bold 13px Inter, sans-serif";
          ctx.fillText(`₹${last.value.toFixed(2)}`, head.x + 14, head.y - 12);
          ctx.restore();
        }
      }

      animRef.current = window.requestAnimationFrame(render);
    };

    animRef.current = window.requestAnimationFrame(render);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [data, height, target, stopLoss, zeroLine]);

  return (
    <div
      style={{
        width: "100%",
        background: "linear-gradient(180deg, rgba(8,12,18,0.98), rgba(10,15,24,0.98))",
        borderRadius: 18,
        overflow: "hidden",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <canvas ref={canvasRef} />

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 18,
          flexWrap: "wrap",
          padding: "8px 14px 14px",
          fontSize: 13,
          color: "rgba(255,255,255,0.72)",
        }}
      >
        <span style={{ color: "#f0c75e" }}>● pnl snake</span>
        <span style={{ color: "#22c55e" }}>● target</span>
        <span style={{ color: "#ef4444" }}>● stop loss</span>
        <span style={{ color: "#60a5fa" }}>● zero</span>
      </div>
    </div>
  );
}
