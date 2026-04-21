import React, { useEffect, useRef, useCallback, useState } from "react";

export type PnlPoint = { time: string; value: number };

type Props = {
  data?: PnlPoint[];
  target?: number;
  stopLoss?: number;
  scaleSize?: number;
  height?: number;
  animationSpeed?: number;
  liveMode?: boolean;
};

export default function MetalSnakePnlChart({
  data,
  target = 3000,
  stopLoss = -1500,
  scaleSize = 11,
  height = 420,
  animationSpeed = 600,
  liveMode = false,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tongueRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef({
    pnlHistory: [] as number[],
    currentPnl: 0,
    tradeTime: 0,
    tongueFlick: 0,
    target,
    stopLoss,
    scaleSize,
  });
  const [stats, setStats] = useState({ pnl: 0, pct: 0, status: "—" });

  // ── helpers ──────────────────────────────────────────────────────────────────
  function smoothPath(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[]) {
    if (pts.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i];
      const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
    }
  }

  // Convert PnL value → snake body points (length = PnL progress)
  function buildSnakePoints(
    pnl: number, tgt: number, sl: number,
    W: number, H: number
  ) {
    const PL = 80, PR = 40, PT = 60, PB = 60;
    const aW = W - PL - PR, aH = H - PT - PB;
    const centerY = PT + aH / 2;
    const totalRange = Math.abs(tgt) + Math.abs(sl);
    const frac = Math.max(0.03, Math.min(0.97, (pnl - sl) / totalRange));
    const snakeLen = aW * 0.12 + aW * 0.80 * frac;
    const amplitude = aH * 0.23;
    const numPts = Math.max(8, Math.floor(snakeLen / 16));
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < numPts; i++) {
      const t = i / (numPts - 1);
      pts.push({
        x: PL + snakeLen * t,
        y: centerY + Math.sin(t * Math.PI * 2.5) * amplitude * (1 - t * 0.28),
      });
    }
    return pts;
  }

  // Draw a single gold scale
  function drawScale(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, angle: number,
    rx: number, ry: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    const g = ctx.createRadialGradient(-rx * 0.1, -ry * 0.3, 0, 0, 0, rx * 1.1);
    g.addColorStop(0,   "#fffacc");
    g.addColorStop(0.22,"#f5d060");
    g.addColorStop(0.48,"#d4920a");
    g.addColorStop(0.78,"#8a5008");
    g.addColorStop(1,   "#3a1e02");

    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(15,8,0,0.7)";
    ctx.lineWidth = 0.35;
    ctx.stroke();

    const sh = ctx.createLinearGradient(0, -ry, 0, ry * 0.3);
    sh.addColorStop(0, "rgba(255,250,200,0.38)");
    sh.addColorStop(1, "rgba(255,250,200,0)");
    ctx.beginPath();
    ctx.ellipse(0, -ry * 0.1, rx * 0.58, ry * 0.42, 0, 0, Math.PI * 2);
    ctx.fillStyle = sh;
    ctx.fill();
    ctx.restore();
  }

  // Draw snake head with eye, nostril, jaw
  function drawHead(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, angle: number, sc: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const s2 = sc * 2.2;

    // Jaw
    const jawG = ctx.createRadialGradient(s2 * 0.5, sc * 0.3, 0, s2 * 0.5, 0, s2);
    jawG.addColorStop(0, "#d4920a"); jawG.addColorStop(1, "#3a1e02");
    ctx.beginPath();
    ctx.ellipse(s2 * 0.6, sc * 0.55, s2 * 0.85, sc * 0.52, 0, 0, Math.PI * 2);
    ctx.fillStyle = jawG; ctx.fill();
    ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 0.7; ctx.stroke();

    // Skull
    const hG = ctx.createRadialGradient(s2 * 0.3, -sc * 0.2, 0, s2 * 0.5, 0, s2);
    hG.addColorStop(0, "#fff8d0"); hG.addColorStop(0.28, "#f5c842");
    hG.addColorStop(0.58, "#d4920a"); hG.addColorStop(1, "#4a2802");
    ctx.beginPath();
    ctx.ellipse(s2 * 0.5, 0, s2 * 0.9, sc * 0.72, 0, 0, Math.PI * 2);
    ctx.fillStyle = hG; ctx.fill();
    ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 0.8; ctx.stroke();

    // Snout
    const snG = ctx.createRadialGradient(s2 * 1.3, 0, 0, s2 * 1.3, 0, sc * 0.8);
    snG.addColorStop(0, "#e8a820"); snG.addColorStop(1, "#6a3a05");
    ctx.beginPath();
    ctx.ellipse(s2 * 1.3, sc * 0.1, sc * 0.65, sc * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = snG; ctx.fill();
    ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 0.5; ctx.stroke();

    // Nostrils
    ctx.fillStyle = "#0a0300";
    ctx.beginPath(); ctx.ellipse(s2*1.52, -sc*0.12, sc*0.1, sc*0.07, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(s2*1.52,  sc*0.18, sc*0.1, sc*0.07, 0, 0, Math.PI*2); ctx.fill();

    // Crown scale marks
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.ellipse(s2*(0.1+i*0.28), sc*(i%2?0.15:-0.18), sc*0.22, sc*0.14, 0, 0, Math.PI*2);
      ctx.strokeStyle = "rgba(255,210,60,0.2)"; ctx.lineWidth = 0.5; ctx.stroke();
    }

    // Eye socket
    ctx.beginPath(); ctx.arc(s2*0.22, -sc*0.28, sc*0.28, 0, Math.PI*2);
    ctx.fillStyle = "#050200"; ctx.fill();
    ctx.strokeStyle = "#7a5008"; ctx.lineWidth = 0.8; ctx.stroke();

    // Iris
    const eyeG = ctx.createRadialGradient(s2*0.19, -sc*0.31, 0, s2*0.22, -sc*0.28, sc*0.19);
    eyeG.addColorStop(0,    "#ffff88");
    eyeG.addColorStop(0.4,  "#ff4400");
    eyeG.addColorStop(0.75, "#880000");
    eyeG.addColorStop(1,    "#000");
    ctx.beginPath(); ctx.arc(s2*0.22, -sc*0.28, sc*0.19, 0, Math.PI*2);
    ctx.fillStyle = eyeG; ctx.fill();

    // Slit pupil
    ctx.beginPath(); ctx.ellipse(s2*0.22, -sc*0.28, sc*0.06, sc*0.14, 0, 0, Math.PI*2);
    ctx.fillStyle = "#000"; ctx.fill();

    // Gleam
    ctx.beginPath(); ctx.arc(s2*0.19, -sc*0.32, sc*0.05, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,255,200,0.9)"; ctx.fill();

    ctx.restore();
  }

  // Animated forked tongue
  function drawTongue(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, angle: number, sc: number, flick: number
  ) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const s2 = sc * 2.2;
    const hx = s2 * 1.95, hy = sc * 0.1;
    const fl = sc * 1.15, fs = sc * 0.38;
    const wave = Math.sin(flick * 0.9) * sc * 0.22;
    const ex = hx + fl, ey = hy + wave;

    ctx.strokeStyle = "#cc1111"; ctx.lineCap = "round";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(hx, hy);
    ctx.quadraticCurveTo(hx + fl*0.4, hy + wave*0.5, ex, ey);
    ctx.stroke();

    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.moveTo(ex, ey);
    ctx.lineTo(ex + fs*0.8 - Math.sin(angle)*fs, ey - fs + wave*0.3);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ex, ey);
    ctx.lineTo(ex + fs*0.8 + Math.sin(angle)*fs, ey + fs + wave*0.3);
    ctx.stroke();
    ctx.restore();
  }

  // Pointed tail tip
  function drawTail(
    ctx: CanvasRenderingContext2D,
    pt: { x: number; y: number }, sc: number
  ) {
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
    ctx.lineTo(pt.x - sc*1.6, pt.y - sc*0.18);
    ctx.lineTo(pt.x - sc*2.4, pt.y + sc*0.38);
    ctx.lineTo(pt.x - sc*1.3, pt.y + sc*0.5);
    ctx.closePath();
    const tG = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, sc*2.2);
    tG.addColorStop(0, "#d4920a"); tG.addColorStop(1, "#2a1200");
    ctx.fillStyle = tG; ctx.fill();
    ctx.strokeStyle = "#1a0a00"; ctx.lineWidth = 0.6; ctx.stroke();
  }

  // Y-axis reference lines
  function drawRefLines(
    ctx: CanvasRenderingContext2D,
    W: number, H: number, tgt: number, sl: number
  ) {
    const PL=80, PR=40, PT=60, PB=60;
    const aH = H - PT - PB;
    const totalRange = Math.abs(tgt) + Math.abs(sl);
    const mY = (v: number) => PT + aH * (1 - (v - sl) / totalRange);

    [[0,"rgba(70,70,70,0.5)","6,4"],[tgt,"rgba(74,222,128,0.5)","7,4"],[sl,"rgba(248,113,113,0.5)","7,4"]].forEach(([v,s,d])=>{
      const y = mY(+v);
      ctx.save();
      ctx.strokeStyle = s as string; ctx.lineWidth = 1;
      ctx.setLineDash((d as string).split(",").map(Number));
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W-PR, y); ctx.stroke();
      ctx.restore();
    });

    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(74,222,128,0.6)";  ctx.fillText(`₹${tgt}`, W-PR+4, mY(tgt)+4);
    ctx.fillStyle = "rgba(248,113,113,0.6)"; ctx.fillText(`₹${sl}`,  W-PR+4, mY(sl)+4);
    ctx.fillStyle = "rgba(100,100,100,0.5)"; ctx.fillText("₹0",      W-PR+4, mY(0)+4);

    // Y axis ticks
    for (let i = 0; i <= 6; i++) {
      const v = sl + totalRange * (i/6);
      const y = mY(v);
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(Math.round(v).toString(), PL - 8, y + 4);
      ctx.strokeStyle = "rgba(255,255,255,0.03)"; ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(W-PR, y); ctx.stroke();
    }
    ctx.textAlign = "left";
  }

  // PnL trail sparkline (top-right)
  function drawTrail(
    ctx: CanvasRenderingContext2D,
    history: number[], W: number, H: number, tgt: number, sl: number
  ) {
    if (history.length < 2) return;
    const PL=80, PR=40, PT=60, PB=60;
    const aH = H - PT - PB;
    const totalRange = Math.abs(tgt) + Math.abs(sl);
    const trailX = W - PR - 120, trailW = 110;
    ctx.save();
    ctx.strokeStyle = "rgba(238,183,65,0.35)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = trailX + (i / (history.length - 1)) * trailW;
      const frac = Math.max(0, Math.min(1, (v - sl) / totalRange));
      const y = PT + aH * (1 - frac);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.fillStyle = "rgba(238,183,65,0.5)";
    const last = history[history.length - 1];
    const lFrac = Math.max(0, Math.min(1, (last - sl) / totalRange));
    ctx.beginPath();
    ctx.arc(trailX + trailW, PT + aH * (1 - lFrac), 3, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  }

  // PnL progress bar (right edge)
  function drawProgressBar(
    ctx: CanvasRenderingContext2D,
    pnl: number, W: number, H: number, tgt: number, sl: number
  ) {
    const PT=60, PB=60;
    const bX = W - 28, bH = H - PT - PB, bY = PT;
    const totalRange = Math.abs(tgt) + Math.abs(sl);
    const frac = Math.max(0, Math.min(1, (pnl - sl) / totalRange));
    const fillH = bH * frac;

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fillRect(bX, bY, 10, bH);

    const barG = ctx.createLinearGradient(0, bY + bH, 0, bY);
    barG.addColorStop(0,   "#f87171");
    barG.addColorStop(0.4, "#eeb741");
    barG.addColorStop(1,   "#4ade80");
    ctx.fillStyle = barG;
    ctx.fillRect(bX, bY + bH - fillH, 10, fillH);
    ctx.strokeStyle = "rgba(255,255,255,0.07)";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(bX, bY, 10, bH);
  }

  // ── main draw ─────────────────────────────────────────────────────────────────
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const { pnlHistory, currentPnl, tongueFlick, target: tgt, stopLoss: sl, scaleSize: sc } = stateRef.current;

    ctx.fillStyle = "#0a0b0d"; ctx.fillRect(0, 0, W, H);
    drawRefLines(ctx, W, H, tgt, sl);
    drawTrail(ctx, pnlHistory, W, H, tgt, sl);

    const pts = buildSnakePoints(currentPnl, tgt, sl, W, H);
    if (pts.length < 2) return;

    // Body shadow layers
    ctx.save();
    smoothPath(ctx, pts); ctx.lineWidth = sc*2.7; ctx.strokeStyle = "#180900"; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.stroke();
    smoothPath(ctx, pts); ctx.lineWidth = sc*2.1; ctx.strokeStyle = "#3a2005"; ctx.stroke();
    ctx.restore();

    // Scales
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i-1], curr = pts[i];
      const dx = curr.x - prev.x, dy = curr.y - prev.y;
      const len = Math.sqrt(dx*dx + dy*dy);
      const ang = Math.atan2(dy, dx);
      const den = Math.max(2, Math.floor(len / 7));
      for (let j = 0; j < den; j++) {
        const t = j / den;
        const ph = (i + j) * 0.75;
        const pl = 1 + 0.13 * Math.sin(ph);
        drawScale(ctx, prev.x + dx*t, prev.y + dy*t, ang, sc*pl, sc*0.65*pl);
      }
    }

    // Top shine
    ctx.save();
    smoothPath(ctx, pts); ctx.lineWidth = 1.8; ctx.strokeStyle = "rgba(255,255,220,0.18)"; ctx.lineCap = "round"; ctx.stroke();
    ctx.restore();

    // Tail
    drawTail(ctx, pts[0], sc);

    // Head + tongue
    const lp = pts[pts.length - 1], l2 = pts[pts.length - 2];
    const headAng = Math.atan2(lp.y - l2.y, lp.x - l2.x);
    drawHead(ctx, lp.x, lp.y, headAng, sc);
    drawTongue(ctx, lp.x, lp.y, headAng, sc, tongueFlick);

    // Tip glow
    ctx.beginPath(); ctx.arc(lp.x, lp.y, sc*1.3, 0, Math.PI*2);
    ctx.strokeStyle = "rgba(238,183,65,0.2)"; ctx.lineWidth = 1.5; ctx.stroke();

    drawProgressBar(ctx, currentPnl, W, H, tgt, sl);

    // Update React stats
    const totalRange = Math.abs(tgt) + Math.abs(sl);
    const pct = Math.max(0, Math.min(100, (currentPnl - sl) / totalRange * 100));
    const status = currentPnl >= tgt*0.9 ? "Near Target"
      : currentPnl <= sl*0.9 ? "Near SL"
      : currentPnl > 0 ? "Profitable" : "In Loss";
    setStats({ pnl: currentPnl, pct, status });
  }, []);

  // ── demo data generator ───────────────────────────────────────────────────────
  const genNext = useCallback(() => {
    const s = stateRef.current;
    const prog = Math.min(1, s.tradeTime / 60);
    const trend = s.target * 0.55 * prog * prog;
    const wave = Math.sin(s.tradeTime * 0.45) * Math.abs(s.target) * 0.12;
    const noise = (Math.random() - 0.38) * Math.abs(s.target) * 0.16;
    s.currentPnl = s.currentPnl * 0.84 + (trend + wave + noise) * 0.16 + noise * 0.45;
    s.currentPnl = Math.max(s.stopLoss*1.05, Math.min(s.target*1.05, s.currentPnl));
    s.currentPnl = Math.round(s.currentPnl * 100) / 100;
    s.tradeTime++;
    s.pnlHistory.push(s.currentPnl);
    if (s.pnlHistory.length > 60) s.pnlHistory.shift();
  }, []);

  // ── sync props ────────────────────────────────────────────────────────────────
  useEffect(() => {
    stateRef.current.target = target;
    stateRef.current.stopLoss = stopLoss;
    stateRef.current.scaleSize = scaleSize;
  }, [target, stopLoss, scaleSize]);

  // ── external data mode ────────────────────────────────────────────────────────
  useEffect(() => {
    if (data && data.length > 0) {
      stateRef.current.currentPnl = data[data.length - 1].value;
      stateRef.current.pnlHistory = data.map(d => d.value);
      draw();
    }
  }, [data, draw]);

  // ── live / demo animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (data && data.length > 0) return;

    animRef.current = setInterval(() => {
      genNext();
      draw();
    }, animationSpeed);

    tongueRef.current = setInterval(() => {
      stateRef.current.tongueFlick++;
      draw();
    }, 110);

    return () => {
      clearInterval(animRef.current!);
      clearInterval(tongueRef.current!);
    };
  }, [data, animationSpeed, genNext, draw]);

  // ── canvas resize ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = canvas.offsetWidth;
      canvas.height = height;
      draw();
    });
    ro.observe(canvas.parentElement!);
    canvas.width = canvas.offsetWidth || 900;
    canvas.height = height;
    draw();
    return () => ro.disconnect();
  }, [height, draw]);

  const isPos = stats.pnl >= 0;
  const statusColor = stats.status === "Near Target" || stats.status === "Profitable" ? "#4ade80" : "#f87171";

  return (
    <div style={{ background: "#0a0b0d", width: "100%", fontFamily: "monospace" }}>
      {/* Stats bar */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 20px", background:"#0d0e11", borderBottom:"1px solid #1a1a1a", flexWrap:"wrap", gap:12 }}>
        <div style={{ display:"flex", gap:22, flexWrap:"wrap" }}>
          {[
            { label:"Net PnL",     val:`₹${stats.pnl.toFixed(2)}`,   color: isPos?"#4ade80":"#f87171" },
            { label:"Target",      val:`₹${target}`,                  color:"#4ade80" },
            { label:"Stop Loss",   val:`₹${stopLoss}`,                color:"#f87171" },
            { label:"Progress",    val:`${stats.pct.toFixed(1)}%`,    color:"#eeb741" },
            { label:"Status",      val:stats.status,                  color:statusColor },
          ].map(s => (
            <div key={s.label} style={{ display:"flex", flexDirection:"column", gap:2 }}>
              <span style={{ fontSize:9, color:"#3a3a3a", letterSpacing:1.5, textTransform:"uppercase" }}>{s.label}</span>
              <span style={{ fontSize:14, fontWeight:700, color:s.color }}>{s.val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div style={{ position:"relative", width:"100%" }}>
        <canvas ref={canvasRef} style={{ display:"block", width:"100%" }} />
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:18, padding:"8px 20px", background:"#0a0b0d", borderTop:"1px solid #111", flexWrap:"wrap" }}>
        {[
          { type:"dot", color:"#eeb741", label:"snake (grows with profit)" },
          { type:"line", color:"#4ade80", label:"target" },
          { type:"line", color:"#f87171", label:"stop loss" },
          { type:"line", color:"#444",   label:"zero" },
          { type:"line", color:"rgba(238,183,65,0.4)", label:"pnl trail" },
        ].map(l => (
          <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, color:"#444" }}>
            {l.type === "dot"
              ? <div style={{ width:8, height:8, borderRadius:"50%", background:l.color }} />
              : <div style={{ width:18, height:2, background:l.color }} />
            }
            {l.label}
          </div>
        ))}
      </div>
    </div>
  );
}
