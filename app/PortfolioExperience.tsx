"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import {
  FOLDERS,
  OTHER_FILTERS,
  PROFILE,
  PROJECTS,
  SKILLS,
  VISUAL_FILTERS,
  slidesFor,
  type FolderCategory,
  type FolderId,
  type Project,
  type VisualFilter,
} from "./content";
import {
  PHOTO_REGIONS,
  photoCollectionById,
} from "./photoArchive";

type ActiveView =
  | { kind: "profile" }
  | { kind: "allWorks" }
  | { kind: "folder"; folder: FolderId }
  | { kind: "landscapeArchive" }
  | { kind: "photoProject"; projectId: "portrait-photo" | "product-photo" }
  | null;
type SceneFocus =
  | { kind: "folder"; id: FolderId }
  | { kind: "portfolio" }
  | { kind: "photoWall" }
  | { kind: "easel" }
  | { kind: "computer" }
  | null;
type ScreenPoint = { x: number; y: number };
type PhotoTransitionOrigin = {
  projectId: string;
  src: string;
  frameId: string;
  corners: [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
  rect: { left: number; top: number; width: number; height: number };
  aspect: number;
};
type PhotoTransitionSpec = PhotoTransitionOrigin & {
  phase: "enter" | "exit";
};
type PhotoFlowState = "idle" | "entering" | "gallery" | "exiting";
const FOLDER_TONES: Record<FolderId, string> = {
  visual: "#8ebdca",
  brand: "#d7a2aa",
  long: "#a7c28f",
  photo: "#dec17a",
};
const FOLDER_COVERS: Record<FolderId, string> = {
  visual: "/portfolio/folder-covers/visual.jpg",
  brand: "/portfolio/folder-covers/brand.jpg",
  long: "/portfolio/folder-covers/long.jpg",
  photo: "/portfolio/folder-covers/other.jpg",
};
const PROJECT_COVER_FOCUS: Record<string, { x: string; y: string; scale: number }> = {
  jiedian: { x: "76%", y: "52%", scale: 1.72 },
  wanli: { x: "76%", y: "52%", scale: 1.46 },
  "sanlin-coconut": { x: "50%", y: "50%", scale: 1 },
  "sanlin-soda": { x: "50%", y: "50%", scale: 1 },
  "fzu-letter": { x: "30%", y: "52%", scale: 1.82 },
  nushu: { x: "18%", y: "50%", scale: 2.3 },
  kawei: { x: "52%", y: "50%", scale: 2.12 },
  linyu: { x: "62%", y: "54%", scale: 1.92 },
  xiangcheng: { x: "51%", y: "52%", scale: 1.82 },
  aigc: { x: "79%", y: "48%", scale: 1.9 },
  "product-photo": { x: "80%", y: "52%", scale: 1.65 },
  "landscape-photo": { x: "67%", y: "65%", scale: 1.82 },
  "portrait-photo": { x: "58%", y: "50%", scale: 1.92 },
};

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function photoTargetRect(aspect: number, viewportWidth: number, viewportHeight: number) {
  const maxWidth = Math.min(viewportWidth * 0.82, 1320);
  const maxHeight = viewportHeight * 0.76;
  const width = Math.min(maxWidth, maxHeight * aspect);
  const height = width / aspect;
  return {
    left: (viewportWidth - width) / 2,
    top: (viewportHeight - height) / 2 + viewportHeight * 0.025,
    width,
    height,
  };
}

function rectCorners(rect: { left: number; top: number; width: number; height: number }) {
  return [
    { x: rect.left, y: rect.top },
    { x: rect.left + rect.width, y: rect.top },
    { x: rect.left + rect.width, y: rect.top + rect.height },
    { x: rect.left, y: rect.top + rect.height },
  ] as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
}

function PhotoSharedTransition({
  spec,
  onComplete,
}: {
  spec: PhotoTransitionSpec;
  onComplete: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const completeRef = useRef(onComplete);
  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let disposed = false;
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, 1, 0, 1, 0.1, 10);
    camera.position.z = 1;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
    geometry.setAttribute(
      "uv",
      new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]), 2),
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const texture = new THREE.TextureLoader().load(spec.src);
    texture.colorSpace = THREE.SRGBColorSpace;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
      uniforms: {
        uMap: { value: texture },
        uSize: { value: new THREE.Vector2(spec.rect.width, spec.rect.height) },
        uRadius: { value: 5 },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform vec2 uSize;
        uniform float uRadius;
        uniform float uOpacity;
        varying vec2 vUv;
        void main(){
          vec2 p=abs((vUv-0.5)*uSize)-(uSize*0.5-vec2(uRadius));
          float d=length(max(p,0.0))+min(max(p.x,p.y),0.0)-uRadius;
          float mask=1.0-smoothstep(-1.25,1.25,d);
          vec4 color=texture2D(uMap,vUv);
          gl_FragColor=vec4(color.rgb,color.a*mask*uOpacity);
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const duration = reduced ? 150 : 900;
    const started = performance.now();
    const resize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      renderer.setSize(width, height, false);
      camera.right = width;
      camera.top = 0;
      camera.bottom = height;
      camera.updateProjectionMatrix();
    };
    resize();
    window.addEventListener("resize", resize);
    const render = (now: number) => {
      const raw = Math.min(1, (now - started) / duration);
      const progress = reduced ? raw : raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      const target = photoTargetRect(spec.aspect, window.innerWidth, window.innerHeight);
      const targetCorners = rectCorners(target);
      const from = spec.phase === "enter" ? spec.corners : targetCorners;
      const to = spec.phase === "enter" ? targetCorners : spec.corners;
      const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let index = 0; index < 4; index += 1) {
        positions.setXYZ(
          index,
          THREE.MathUtils.lerp(from[index].x, to[index].x, progress),
          THREE.MathUtils.lerp(from[index].y, to[index].y, progress),
          0,
        );
      }
      positions.needsUpdate = true;
      material.uniforms.uSize.value.set(
        THREE.MathUtils.lerp(spec.rect.width, target.width, spec.phase === "enter" ? progress : 1 - progress),
        THREE.MathUtils.lerp(spec.rect.height, target.height, spec.phase === "enter" ? progress : 1 - progress),
      );
      material.uniforms.uRadius.value = THREE.MathUtils.lerp(
        spec.phase === "enter" ? 4 : 18,
        spec.phase === "enter" ? 18 : 4,
        progress,
      );
      renderer.render(scene, camera);
      if (raw < 1 && !disposed) frame = requestAnimationFrame(render);
      else if (!disposed) completeRef.current();
    };
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer.dispose();
    };
  }, [spec]);
  return (
    <canvas
      ref={canvasRef}
      className={`photo-transition-canvas ${spec.phase}`}
      aria-hidden="true"
    />
  );
}

function makeSpineLabelTexture(title: string, subtitle: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 480;
  canvas.height = 760;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f8f5ed";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#d5d0c7";
  ctx.lineWidth = 16;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  ctx.fillStyle = "#292d2d";
  ctx.textAlign = "center";
  const splitAt = Math.ceil(title.length / 2);
  ctx.font = "118px Xiangjiao, sans-serif";
  ctx.fillText(title.slice(0, splitAt), canvas.width / 2, 180);
  ctx.fillText(title.slice(splitAt), canvas.width / 2, 310);
  ctx.font = "28px Xiangjiao, sans-serif";
  ctx.fillText(subtitle, canvas.width / 2, 372);
  ctx.strokeStyle = "#c7c3bb";
  ctx.lineWidth = 4;
  [445, 535, 625].forEach((y) => {
    ctx.beginPath();
    ctx.moveTo(70, y);
    ctx.lineTo(canvas.width - 70, y);
    ctx.stroke();
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePortfolioNoteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#ded6ca";
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 480);
  ctx.fillStyle = "#3e3731";
  ctx.textAlign = "center";
  ctx.font = "108px Xiangjiao, sans-serif";
  ctx.fillText("作品集", 256, 286);
  ctx.font = "30px Xiangjiao, sans-serif";
  ctx.fillText("PORTFOLIO · 2026", 256, 355);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePhotoArchiveNoteTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#b9def1";
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = "#4d718344";
  ctx.lineWidth = 7;
  ctx.strokeRect(18, 18, 476, 476);
  ctx.fillStyle = "#30464f";
  ctx.textAlign = "center";
  ctx.font = "112px Xiangjiao, sans-serif";
  ctx.fillText("摄影图集", 256, 292);
  ctx.font = "28px Xiangjiao, sans-serif";
  ctx.fillText("PHOTO ARCHIVE", 256, 354);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makePhotoRegionLabelTexture(title: string, en: string, accent: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 180;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fffaf1";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 18, canvas.height);
  ctx.fillStyle = "#342f2a";
  ctx.font = "700 74px Xiangjiao, sans-serif";
  ctx.fillText(title, 42, 90);
  ctx.font = "25px Xiangjiao, sans-serif";
  ctx.fillStyle = "#6d6259";
  ctx.fillText(en, 44, 139);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function createMonitorDisplay() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 620;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const render = (text: string, cursor: { x: number; y: number }) => {
    ctx.fillStyle = "#26282c";
    ctx.fillRect(0, 0, 900, 620);
    ctx.fillStyle = "#111317";
    ctx.fillRect(0, 0, 900, 48);
    ctx.fillStyle = "#e7e7e7";
    ctx.textAlign = "left";
    ctx.font = "20px sans-serif";
    ctx.fillText("Ps", 18, 31);
    ctx.font = "15px sans-serif";
    ctx.fillText("文件  编辑  图像  图层  文字  选择  滤镜  视图", 70, 30);
    ctx.fillStyle = "#373a40";
    ctx.fillRect(0, 48, 900, 42);
    ctx.fillStyle = "#d4d5d7";
    ctx.font = "13px sans-serif";
    ctx.fillText("移动工具   自动选择：图层   显示变换控件", 22, 74);
    ctx.fillStyle = "#1d1f23";
    ctx.fillRect(0, 90, 64, 530);
    const tools = ["↖", "□", "T", "⌁", "✦", "◯", "⌕", "▱"];
    ctx.font = "24px sans-serif";
    ctx.textAlign = "center";
    tools.forEach((tool, index) => {
      ctx.fillStyle = index === 2 ? "#4d8ccf" : "#d9dadd";
      ctx.fillText(tool, 32, 132 + index * 55);
    });
    ctx.fillStyle = "#34373c";
    ctx.fillRect(690, 90, 210, 530);
    ctx.fillStyle = "#e6e6e6";
    ctx.textAlign = "left";
    ctx.font = "15px sans-serif";
    ctx.fillText("属性", 710, 122);
    ctx.fillText("图层", 710, 350);
    [390, 435, 480].forEach((y, index) => {
      ctx.fillStyle = index === 0 ? "#526c88" : "#45484d";
      ctx.fillRect(705, y - 28, 178, 36);
      ctx.fillStyle = "#e8e8e8";
      ctx.fillText(index === 0 ? "T  欢迎文字" : index === 1 ? "▧  背景" : "▧  光影", 716, y - 5);
    });
    ctx.fillStyle = "#bbb7ad";
    ctx.fillRect(64, 90, 626, 530);
    ctx.fillStyle = "#f7f3ea";
    ctx.fillRect(132, 140, 490, 410);
    const artGradient = ctx.createLinearGradient(132, 140, 622, 550);
    artGradient.addColorStop(0, "#e7f2ef");
    artGradient.addColorStop(0.55, "#f4dfc9");
    artGradient.addColorStop(1, "#d6c2d8");
    ctx.fillStyle = artGradient;
    ctx.fillRect(151, 159, 452, 372);
    ctx.fillStyle = "#4a4b50";
    ctx.textAlign = "center";
    ctx.font = "40px Xiangjiao, sans-serif";
    ctx.fillText("欢迎光临", 377, 300);
    ctx.font = "58px Xiangjiao, sans-serif";
    ctx.fillText(text || "邓海玲的空间", 377, 385, 420);
    ctx.strokeStyle = "#287bd0";
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.strokeRect(176, 326, 402, 84);
    ctx.setLineDash([]);
    const cursorX = 150 + cursor.x * 450;
    const cursorY = 158 + cursor.y * 370;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#17191d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cursorX, cursorY);
    ctx.lineTo(cursorX + 4, cursorY + 25);
    ctx.lineTo(cursorX + 11, cursorY + 18);
    ctx.lineTo(cursorX + 19, cursorY + 31);
    ctx.lineTo(cursorX + 24, cursorY + 28);
    ctx.lineTo(cursorX + 16, cursorY + 15);
    ctx.lineTo(cursorX + 27, cursorY + 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    texture.needsUpdate = true;
  };
  render("邓海玲的空间", { x: 0.48, y: 0.55 });
  return { texture, render };
}

function BulgeCoverTitle() {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !supportsWebGL()) return;
    let renderer: THREE.WebGLRenderer | null = null;
    let frame = 0;
    let disposed = false;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 10);
    camera.position.z = 2;
    const titleCanvas = document.createElement("canvas");
    const titleContext = titleCanvas.getContext("2d")!;
    const texture = new THREE.CanvasTexture(titleCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const uniforms = {
      uTexture: { value: texture },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uStrength: { value: 0 },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      vertexShader: `
        uniform vec2 uMouse;
        uniform float uStrength;
        varying vec2 vUv;
        varying float vBulge;
        void main() {
          vUv = uv;
          float distanceToMouse = distance(uv, uMouse);
          float bulge = smoothstep(0.27, 0.0, distanceToMouse) * uStrength;
          vec3 displaced = position;
          displaced.z += bulge * 0.34;
          vBulge = bulge;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uTexture;
        uniform vec2 uMouse;
        varying vec2 vUv;
        varying float vBulge;
        void main() {
          vec2 delta = vUv - uMouse;
          vec2 warpedUv = uMouse + delta * (1.0 - vBulge * 0.12);
          vec4 title = texture2D(uTexture, warpedUv);
          float softLight = 0.91 + vBulge * 0.18;
          gl_FragColor = vec4(title.rgb * softLight, title.a);
        }
      `,
    });
    const geometry = new THREE.PlaneGeometry(1, 1, 180, 100);
    const titlePlane = new THREE.Mesh(geometry, material);
    scene.add(titlePlane);
    const targetMouse = new THREE.Vector2(0.5, 0.5);
    let targetStrength = 0;
    let last = performance.now();
    const drawTitle = (width: number, height: number) => {
      const pixelRatio = Math.min(window.devicePixelRatio, 1.6);
      titleCanvas.width = Math.max(2, Math.round(width * pixelRatio));
      titleCanvas.height = Math.max(2, Math.round(height * pixelRatio));
      const w = titleCanvas.width;
      const h = titleCanvas.height;
      titleContext.clearRect(0, 0, w, h);
      titleContext.textAlign = "center";
      titleContext.textBaseline = "middle";
      titleContext.fillStyle = "#38322d";
      const smallSize = Math.min(w * 0.105, h * 0.23);
      const largeSize = Math.min(w * 0.17, h * 0.39);
      titleContext.font = `900 ${smallSize}px PortfolioHeadline, sans-serif`;
      titleContext.fillText("欢迎光临", w / 2, h * 0.3);
      titleContext.font = `900 ${largeSize}px PortfolioHeadline, sans-serif`;
      titleContext.fillText("邓海玲的空间", w / 2, h * 0.68);
      texture.needsUpdate = true;
    };
    const resize = () => {
      const rect = host.getBoundingClientRect();
      renderer?.setSize(rect.width, rect.height, false);
      camera.aspect = rect.width / Math.max(rect.height, 1);
      camera.updateProjectionMatrix();
      const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
      titlePlane.scale.set(viewHeight * camera.aspect, viewHeight, 1);
      drawTitle(rect.width, rect.height);
    };
    const updatePointer = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      targetMouse.set(
        THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width, 0, 1),
        THREE.MathUtils.clamp(1 - (event.clientY - rect.top) / rect.height, 0, 1),
      );
      targetStrength = 1;
    };
    const leave = () => {
      targetStrength = 0;
    };
    const animate = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      uniforms.uMouse.value.x = THREE.MathUtils.damp(uniforms.uMouse.value.x, targetMouse.x, 5.2, delta);
      uniforms.uMouse.value.y = THREE.MathUtils.damp(uniforms.uMouse.value.y, targetMouse.y, 5.2, delta);
      uniforms.uStrength.value = THREE.MathUtils.damp(uniforms.uStrength.value, targetStrength, 4.2, delta);
      renderer?.render(scene, camera);
      if (!disposed) frame = requestAnimationFrame(animate);
    };
    resize();
    document.fonts.load("900 92px PortfolioHeadline").then(() => {
      if (!disposed) resize();
    });
    host.addEventListener("pointermove", updatePointer);
    host.addEventListener("pointerdown", updatePointer);
    host.addEventListener("pointerleave", leave);
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame((now) => {
      setReady(true);
      animate(now);
    });
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      host.removeEventListener("pointermove", updatePointer);
      host.removeEventListener("pointerdown", updatePointer);
      host.removeEventListener("pointerleave", leave);
      window.removeEventListener("resize", resize);
      geometry.dispose();
      material.dispose();
      texture.dispose();
      renderer?.dispose();
    };
  }, []);
  return (
    <div ref={hostRef} className={`bulge-title ${ready ? "is-ready" : ""}`}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <strong>
        <b>欢迎光临</b>
        <b>邓海玲的空间</b>
      </strong>
    </div>
  );
}

function LoadingCurtain({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    const startedAt = performance.now();
    let finishTimer = 0;
    let doneTimer = 0;
    const finish = () => {
      const remaining = Math.max(0, 3000 - (performance.now() - startedAt));
      finishTimer = window.setTimeout(() => {
        setExiting(true);
        doneTimer = window.setTimeout(onDone, 550);
      }, remaining);
    };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const reducedFrame = requestAnimationFrame(() => {
        setProgress(100);
        finish();
      });
      return () => {
        cancelAnimationFrame(reducedFrame);
        window.clearTimeout(finishTimer);
        window.clearTimeout(doneTimer);
      };
    }
    const timer = window.setInterval(
      () =>
        setProgress((value) => {
          const next = Math.min(100, value + (value < 70 ? 8 : 4));
          if (next === 100) {
            clearInterval(timer);
            finish();
          }
          return next;
        }),
      45,
    );
    return () => {
      clearInterval(timer);
      window.clearTimeout(finishTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);
  return (
    <div className={`loader ${exiting ? "exiting" : ""}`} role="status" aria-label="正在布置桌面个人空间">
      <img src="/portfolio/pages/page-01.webp" alt="" />
      <div className="loader-wash" />
      <div className="loader-copy">
        <span>邓海玲 · PORTFOLIO 2026</span>
        <BulgeCoverTitle />
        <div className="loader-line">
          <i style={{ width: `${progress}%` }} />
        </div>
        <small>{progress}% · 正在布置桌面个人空间</small>
      </div>
    </div>
  );
}

function Scene({
  onOpenFolder,
  onOpenProfile,
  onOpenPhotoProject,
  sceneFocus,
  onFocusChange,
  interactionLocked,
  zoom,
  resetSignal,
  introReady,
  onIntroComplete,
  freeView,
}: {
  onOpenFolder: (id: FolderId) => void;
  onOpenProfile: () => void;
  onOpenPhotoProject: (spec: PhotoTransitionOrigin) => void;
  sceneFocus: SceneFocus;
  onFocusChange: (focus: SceneFocus) => void;
  interactionLocked: boolean;
  zoom: number;
  resetSignal: number;
  introReady: boolean;
  onIntroComplete: () => void;
  freeView: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const folderOpenRef = useRef(onOpenFolder);
  const profileOpenRef = useRef(onOpenProfile);
  const photoOpenRef = useRef(onOpenPhotoProject);
  const focusChangeRef = useRef(onFocusChange);
  const focusRef = useRef(sceneFocus);
  const interactionLockedRef = useRef(interactionLocked);
  const zoomRef = useRef(zoom);
  const resetRef = useRef(resetSignal);
  const introReadyRef = useRef(introReady);
  const introCompleteRef = useRef(onIntroComplete);
  const freeViewRef = useRef(freeView);
  useEffect(() => {
    folderOpenRef.current = onOpenFolder;
  }, [onOpenFolder]);
  useEffect(() => {
    profileOpenRef.current = onOpenProfile;
  }, [onOpenProfile]);
  useEffect(() => {
    photoOpenRef.current = onOpenPhotoProject;
  }, [onOpenPhotoProject]);
  useEffect(() => {
    focusChangeRef.current = onFocusChange;
  }, [onFocusChange]);
  useEffect(() => {
    focusRef.current = sceneFocus;
  }, [sceneFocus]);
  useEffect(() => {
    interactionLockedRef.current = interactionLocked;
  }, [interactionLocked]);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    resetRef.current = resetSignal;
  }, [resetSignal]);
  useEffect(() => {
    introReadyRef.current = introReady;
  }, [introReady]);
  useEffect(() => {
    introCompleteRef.current = onIntroComplete;
  }, [onIntroComplete]);
  useEffect(() => {
    freeViewRef.current = freeView;
  }, [freeView]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cleanup = () => {};
    let cancelled = false;
    const setup = async () => {
      await document.fonts.load("32px Xiangjiao");
      if (cancelled) return;
      const scene = new THREE.Scene();
      scene.background = new THREE.Color("#d9e9df");
      scene.fog = new THREE.Fog("#dedfcf", 15, 28);
      const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 50);
      const introCameraStart = new THREE.Vector3(-4.15, 3.25, 15.5);
      const initialCamera = new THREE.Vector3(0.35, 2.15, 15.8);
      camera.position.copy(introCameraStart);
      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
      });
      renderer.setPixelRatio(
        Math.min(window.devicePixelRatio, window.innerWidth < 700 ? 1.25 : 1.8),
      );
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.setAttribute("aria-hidden", "true");
      host.appendChild(renderer.domElement);
      const badgeHint = document.createElement("div");
      badgeHint.className = "badge-hover-hint";
      badgeHint.textContent = "点击查看个人简历";
      badgeHint.setAttribute("aria-hidden", "true");
      host.appendChild(badgeHint);
      const easelHint = document.createElement("div");
      easelHint.className = "easel-hover-hint";
      easelHint.textContent = "点击放大 · 选择画笔即可涂鸦";
      easelHint.setAttribute("aria-hidden", "true");
      host.appendChild(easelHint);
      const actionHint = document.createElement("div");
      actionHint.className = "scene-action-hint";
      actionHint.setAttribute("aria-hidden", "true");
      host.appendChild(actionHint);
      const monitorInput = document.createElement("input");
      monitorInput.className = "monitor-text-input";
      monitorInput.value = "邓海玲的空间";
      monitorInput.maxLength = 18;
      monitorInput.setAttribute("aria-label", "在电脑屏幕中输入文字");
      monitorInput.placeholder = "输入电脑屏幕文字";
      host.appendChild(monitorInput);
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(0.35, 0.1, -0.25);
      controls.enableDamping = !reducedMotion;
      controls.dampingFactor = 0.045;
      controls.enablePan = false;
      controls.minDistance = 9.4;
      controls.maxDistance = 24;
      controls.minPolarAngle = 0.72;
      controls.maxPolarAngle = 1.25;
      controls.minAzimuthAngle = -0.94;
      controls.maxAzimuthAngle = 0.58;
      controls.enabled = false;
      controls.update();
      const ambientLight = new THREE.HemisphereLight("#fffdf2", "#82a99d", 2.28);
      scene.add(ambientLight);
      const key = new THREE.DirectionalLight("#ffe5a5", 3.45);
      key.position.set(-7, 7, 6);
      key.castShadow = true;
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.bias = -0.00035;
      key.shadow.normalBias = 0.018;
      key.shadow.radius = 4;
      key.shadow.camera.left = -8;
      key.shadow.camera.right = 8;
      key.shadow.camera.top = 8;
      key.shadow.camera.bottom = -8;
      scene.add(key);
      const sunlight = new THREE.SpotLight("#ffd574", 6, 18, 0.58, 0.76, 1.2);
      sunlight.position.set(-6.2, 5.4, 3.8);
      sunlight.castShadow = true;
      sunlight.shadow.mapSize.set(2048, 2048);
      sunlight.shadow.bias = -0.0003;
      sunlight.shadow.normalBias = 0.015;
      sunlight.target.position.set(-0.8, -1.8, 0.8);
      scene.add(sunlight, sunlight.target);
      const windowGlow = new THREE.RectAreaLight("#ffd5a0", 3.1, 7.5, 5.2);
      windowGlow.position.set(-5.8, 2.8, 1.3);
      windowGlow.lookAt(0, -1.2, 0.2);
      scene.add(windowGlow);
      const root = new THREE.Group();
      scene.add(root);
      const addBox = (
        parent: THREE.Group,
        size: [number, number, number],
        color: string,
        position: [number, number, number],
        roughness = 0.72,
      ) => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(...size),
          new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.03 }),
        );
        mesh.position.set(...position);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        parent.add(mesh);
        return mesh;
      };
      const interactive: THREE.Object3D[] = [];
      const draggableRoots: THREE.Object3D[] = [];
      const draggableMeshes: THREE.Object3D[] = [];
      const mainDeskLift = 0.4;
      addBox(root, [12.3, 0.42, 5.15], "#a97858", [-0.25, -2.05 + mainDeskLift, -0.25], 0.9);
      addBox(root, [11.95, 0.16, 4.85], "#dfa56f", [-0.25, -1.75 + mainDeskLift, -0.25], 0.84);
      // A complete studio desk: rounded legs, aprons and a low cross brace.
      const deskWood = new THREE.MeshStandardMaterial({
        color: "#9d6848",
        roughness: 0.86,
        metalness: 0.02,
      });
      [[-5.55, -4.0, -1.98], [5.05, -4.0, -1.98], [-5.55, -4.0, 1.48], [5.05, -4.0, 1.48]].forEach(
        ([x, y, z]) => {
          const leg = new THREE.Mesh(
            new RoundedBoxGeometry(0.52, 4.05, 0.52, 5, 0.1),
            deskWood,
          );
          leg.position.set(x, y + 0.22, z);
          leg.castShadow = true;
          leg.receiveShadow = true;
          root.add(leg);
        },
      );
      addBox(root, [11.05, 0.48, 0.28], "#986243", [-0.25, -2.48 + mainDeskLift, 1.38], 0.88);
      addBox(root, [11.05, 0.48, 0.28], "#86583f", [-0.25, -2.48 + mainDeskLift, -1.88], 0.88);
      addBox(root, [0.3, 0.48, 3.22], "#8e5c41", [-5.55, -2.48 + mainDeskLift, -0.25], 0.88);
      addBox(root, [0.3, 0.48, 3.22], "#8e5c41", [5.05, -2.48 + mainDeskLift, -0.25], 0.88);
      addBox(root, [7.2, 0.22, 0.28], "#8d5b40", [0.25, -4.4, -1.5], 0.9);
      const drawerGroups: THREE.Group[] = [];
      const drawerOpen = [false, false];
      [-2.38, 2.38].forEach((x, index) => {
        addBox(root, [4.65, 0.78, 0.12], "#70462f", [x, -2.78 + mainDeskLift, 2.47], 0.94);
        const drawer = new THREE.Group();
        drawer.position.set(x, 0, 0);
        root.add(drawer);
        drawerGroups.push(drawer);
        const tray = addBox(drawer, [4.42, 0.56, 1.14], "#b77b55", [0, -2.78 + mainDeskLift, 1.86], 0.84);
        const front = new THREE.Mesh(
          new RoundedBoxGeometry(4.55, 0.68, 0.18, 5, 0.07),
          new THREE.MeshStandardMaterial({ color: "#c98b60", roughness: 0.8 }),
        );
        front.position.set(0, -2.78 + mainDeskLift, 2.48);
        front.castShadow = true;
        drawer.add(front);
        const pull = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.56, 14),
          new THREE.MeshStandardMaterial({ color: "#d9bd86", metalness: 0.42, roughness: 0.34 }),
        );
        pull.rotation.z = Math.PI / 2;
        pull.position.set(0, -2.78 + mainDeskLift, 2.61);
        drawer.add(pull);
        [tray, front, pull].forEach((mesh) => {
          mesh.userData.drawer = index;
          interactive.push(mesh);
        });
      });
      const chair = new THREE.Group();
      chair.position.set(-1.55, 0, 4.65);
      chair.rotation.y = 0.1;
      chair.userData.dragMode = "rotate";
      chair.userData.hoverKind = "chair";
      root.add(chair);
      draggableRoots.push(chair);
      const chairUpper = new THREE.Group();
      chair.add(chairUpper);
      const chairWood = new THREE.MeshPhysicalMaterial({
        color: "#a97858",
        roughness: 0.5,
        clearcoat: 0.3,
        clearcoatRoughness: 0.42,
      });
      const chairFabric = new THREE.MeshPhysicalMaterial({
        color: "#c8bba8",
        roughness: 0.88,
        sheen: 0.5,
        sheenColor: new THREE.Color("#eee4d6"),
      });
      const chairMetal = new THREE.MeshStandardMaterial({
        color: "#594b40",
        roughness: 0.48,
        metalness: 0.52,
      });
      const chairSeatShell = new THREE.Mesh(
        new RoundedBoxGeometry(2.18, 0.2, 1.72, 6, 0.16),
        chairWood,
      );
      chairSeatShell.position.set(0, -2.93, 0);
      chairSeatShell.castShadow = true;
      chairUpper.add(chairSeatShell);
      const chairSeatCushion = new THREE.Mesh(
        new RoundedBoxGeometry(1.9, 0.3, 1.48, 7, 0.18),
        chairFabric,
      );
      chairSeatCushion.position.set(0, -2.76, 0.04);
      chairSeatCushion.castShadow = true;
      chairUpper.add(chairSeatCushion);
      const chairBackShell = new THREE.Mesh(
        new RoundedBoxGeometry(1.92, 2.16, 0.16, 7, 0.2),
        chairWood,
      );
      chairBackShell.position.set(0, -1.48, -0.69);
      chairBackShell.rotation.x = -0.1;
      chairBackShell.castShadow = true;
      chairUpper.add(chairBackShell);
      const chairBackCushion = new THREE.Mesh(
        new RoundedBoxGeometry(1.58, 1.76, 0.2, 7, 0.24),
        chairFabric,
      );
      chairBackCushion.position.set(0, -1.5, -0.55);
      chairBackCushion.rotation.x = -0.1;
      chairBackCushion.castShadow = true;
      chairUpper.add(chairBackCushion);
      const chairHeadrest = new THREE.Mesh(
        new RoundedBoxGeometry(1.16, 0.4, 0.22, 6, 0.16),
        chairFabric,
      );
      chairHeadrest.position.set(0, -0.27, -0.67);
      chairHeadrest.rotation.x = -0.08;
      chairHeadrest.castShadow = true;
      chairUpper.add(chairHeadrest);
      const lumbarSupport = new THREE.Mesh(
        new RoundedBoxGeometry(1.28, 0.28, 0.28, 6, 0.12),
        chairWood,
      );
      lumbarSupport.position.set(0, -1.82, -0.38);
      lumbarSupport.castShadow = true;
      chairUpper.add(lumbarSupport);
      [-1, 1].forEach((side) => {
        const armSupport = new THREE.Mesh(
          new RoundedBoxGeometry(0.13, 0.78, 0.13, 5, 0.055),
          chairMetal,
        );
        armSupport.position.set(side * 0.93, -2.37, 0.06);
        armSupport.rotation.z = side * -0.08;
        armSupport.castShadow = true;
        chairUpper.add(armSupport);
        const armTop = new THREE.Mesh(
          new RoundedBoxGeometry(0.25, 0.14, 0.84, 5, 0.07),
          chairWood,
        );
        armTop.position.set(side * 0.96, -1.98, 0.18);
        armTop.rotation.x = -0.04;
        armTop.castShadow = true;
        chairUpper.add(armTop);
      });
      const gasRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.82, 20),
        new THREE.MeshStandardMaterial({ color: "#c4c9c8", metalness: 0.88, roughness: 0.22 }),
      );
      gasRod.position.y = -3.43;
      gasRod.castShadow = true;
      chair.add(gasRod);
      const gasSleeve = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.24, 0.65, 20),
        chairMetal,
      );
      gasSleeve.position.y = -3.76;
      chair.add(gasSleeve);
      const chairHub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.24, 20), chairMetal);
      chairHub.position.y = -4.05;
      chair.add(chairHub);
      const chairLever = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.72, 12), chairMetal);
      chairLever.position.set(-0.44, -3.16, 0.05);
      chairLever.rotation.z = Math.PI / 2.35;
      chairUpper.add(chairLever);
      const leverGrip = new THREE.Mesh(
        new RoundedBoxGeometry(0.27, 0.12, 0.12, 4, 0.045),
        new THREE.MeshStandardMaterial({ color: "#101415", roughness: 0.78 }),
      );
      leverGrip.position.set(-0.76, -3.38, 0.05);
      leverGrip.rotation.z = -0.7;
      chairUpper.add(leverGrip);
      const tiltKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.22, 18), chairMetal);
      tiltKnob.position.set(0.5, -3.18, 0.05);
      tiltKnob.rotation.z = Math.PI / 2;
      chairUpper.add(tiltKnob);
      const baseDirection = new THREE.Vector3(0, 1, 0);
      for (let index = 0; index < 5; index++) {
        const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
        const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
        const baseArm = new THREE.Mesh(
          new THREE.CylinderGeometry(0.075, 0.12, 1.22, 12),
          chairMetal,
        );
        baseArm.quaternion.setFromUnitVectors(baseDirection, direction);
        baseArm.position.set(direction.x * 0.58, -4.13, direction.z * 0.58);
        baseArm.castShadow = true;
        chair.add(baseArm);
        const casterStem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 10), chairMetal);
        casterStem.position.set(direction.x * 1.15, -4.22, direction.z * 1.15);
        chair.add(casterStem);
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.16, 0.16, 16),
          new THREE.MeshStandardMaterial({ color: "#171b1c", roughness: 0.74 }),
        );
        wheel.position.set(direction.x * 1.2, -4.36, direction.z * 1.2);
        wheel.rotation.z = Math.PI / 2;
        wheel.rotation.y = -angle;
        wheel.castShadow = true;
        chair.add(wheel);
      }
      addBox(root, [20.5, 10.2, 0.28], "#c5b69e", [0.5, 0.65, -3.25], 0.96);
      const oceanTexture = new THREE.TextureLoader().load("/portfolio/scene/ocean-view.webp");
      oceanTexture.colorSpace = THREE.SRGBColorSpace;
      addBox(root, [3.7, 4.75, 0.2], "#d5b58b", [-4.65, 1.58, -3.01], 0.88);
      const ocean = new THREE.Mesh(
        new THREE.PlaneGeometry(3.32, 4.34),
        new THREE.MeshBasicMaterial({ map: oceanTexture }),
      );
      ocean.position.set(-4.65, 1.58, -2.88);
      root.add(ocean);
      for (let i = 0; i < 5; i++)
        addBox(
          root,
          [3.3, 0.055, 0.06],
          "#f2e7d4",
          [-4.65, 3.47 - i * 0.24, -2.78],
          0.92,
        );
      let curtainClosed = false;
      const curtainCanvas = document.createElement("canvas");
      curtainCanvas.width = 512;
      curtainCanvas.height = 512;
      const curtainCtx = curtainCanvas.getContext("2d")!;
      curtainCtx.fillStyle = "#fbfaf3";
      curtainCtx.fillRect(0, 0, 512, 512);
      for (let x = 0; x < 512; x += 52) {
        const fold = curtainCtx.createLinearGradient(x, 0, x + 52, 0);
        fold.addColorStop(0, "rgba(126,157,174,.13)");
        fold.addColorStop(0.45, "rgba(255,255,255,.03)");
        fold.addColorStop(1, "rgba(107,145,168,.11)");
        curtainCtx.fillStyle = fold;
        curtainCtx.fillRect(x, 0, 52, 512);
      }
      curtainCtx.fillStyle = "#78a9c6";
      for (let row = 0; row < 10; row++) {
        for (let column = 0; column < 8; column++) {
          curtainCtx.beginPath();
          curtainCtx.arc(28 + column * 65 + (row % 2) * 18, 25 + row * 52, 6.5, 0, Math.PI * 2);
          curtainCtx.fill();
        }
      }
      const curtainTexture = new THREE.CanvasTexture(curtainCanvas);
      curtainTexture.colorSpace = THREE.SRGBColorSpace;
      curtainTexture.wrapS = curtainTexture.wrapT = THREE.RepeatWrapping;
      curtainTexture.repeat.set(1.15, 1.8);
      const curtainMaterial = new THREE.MeshPhysicalMaterial({
        map: curtainTexture,
        color: "#fffdf7",
        roughness: 0.94,
        sheen: 0.32,
        sheenColor: new THREE.Color("#d8ecf3"),
        side: THREE.DoubleSide,
      });
      const curtainRod = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.055, 4.05, 18),
        new THREE.MeshStandardMaterial({ color: "#f4f2ea", metalness: 0.38, roughness: 0.34 }),
      );
      curtainRod.position.set(-4.65, 3.98, -2.61);
      curtainRod.rotation.z = Math.PI / 2;
      root.add(curtainRod);
      [-6.47, -2.83].forEach((x) => {
        const finial = new THREE.Mesh(
          new THREE.SphereGeometry(0.11, 18, 12),
          new THREE.MeshPhysicalMaterial({ color: "#f8f5ed", roughness: 0.4, clearcoat: 0.22 }),
        );
        finial.position.set(x, 3.98, -2.61);
        root.add(finial);
      });
      const curtainPanels = [-1, 1].map((side) => {
        const fabricGeometry = new THREE.PlaneGeometry(1.72, 4.05, 12, 24);
        const fabricPosition = fabricGeometry.attributes.position as THREE.BufferAttribute;
        for (let index = 0; index < fabricPosition.count; index++) {
          const x = fabricPosition.getX(index);
          const y = fabricPosition.getY(index);
          fabricPosition.setZ(index, Math.sin((x + 0.86) * 14) * 0.055);
          if (y < -1.96) fabricPosition.setY(index, y + Math.sin((x + 0.86) * 8) * 0.035);
        }
        fabricGeometry.computeVertexNormals();
        const panel = new THREE.Mesh(
          fabricGeometry,
          curtainMaterial,
        );
        panel.position.set(side < 0 ? -6.09 : -3.21, 1.84, -2.57);
        panel.scale.x = 0.28;
        panel.castShadow = true;
        panel.userData.curtain = true;
        panel.userData.side = side;
        root.add(panel);
        interactive.push(panel);
        return panel;
      });
      const curtainTies = [-1, 1].map((side) => {
        const tie = new THREE.Mesh(
          new THREE.TorusGeometry(0.18, 0.035, 10, 28),
          new THREE.MeshPhysicalMaterial({ color: "#6f9fbd", roughness: 0.58, sheen: 0.2 }),
        );
        tie.position.set(side < 0 ? -6.08 : -3.22, 1.55, -2.47);
        tie.rotation.y = Math.PI / 2;
        tie.userData.curtain = true;
        root.add(tie);
        interactive.push(tie);
        return tie;
      });
      const calendar = new THREE.Group();
      calendar.position.set(-7.55, 2.17, -2.83);
      calendar.userData.dragSurface = "wall";
      root.add(calendar);
      draggableRoots.push(calendar);
      const calendarCanvas = document.createElement("canvas");
      calendarCanvas.width = 720;
      calendarCanvas.height = 840;
      const calendarCtx = calendarCanvas.getContext("2d")!;
      const calendarTexture = new THREE.CanvasTexture(calendarCanvas);
      calendarTexture.colorSpace = THREE.SRGBColorSpace;
      const calendarPaper = new THREE.Mesh(
        new THREE.PlaneGeometry(1.72, 2.02),
        new THREE.MeshPhysicalMaterial({
          map: calendarTexture,
          roughness: 0.92,
          sheen: 0.1,
          side: THREE.DoubleSide,
        }),
      );
      calendarPaper.position.z = 0.04;
      calendarPaper.castShadow = true;
      calendar.add(calendarPaper);
      addBox(calendar, [1.86, 0.13, 0.11], "#b88159", [0, 1.08, 0], 0.84);
      addBox(calendar, [1.86, 0.08, 0.1], "#b88159", [0, -1.07, 0], 0.84);
      [-0.47, 0.47].forEach((x) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.105, 0.025, 9, 24),
          new THREE.MeshStandardMaterial({ color: "#7f8785", metalness: 0.72, roughness: 0.28 }),
        );
        ring.position.set(x, 1.04, 0.12);
        ring.rotation.x = Math.PI / 2;
        calendar.add(ring);
      });
      let calendarDayKey = "";
      const renderBeijingCalendar = () => {
        const parts = new Intl.DateTimeFormat("zh-CN", {
          timeZone: "Asia/Shanghai",
          year: "numeric",
          month: "numeric",
          day: "numeric",
        }).formatToParts(new Date());
        const value = (type: Intl.DateTimeFormatPartTypes) =>
          Number(parts.find((part) => part.type === type)?.value ?? 0);
        const year = value("year");
        const month = value("month");
        const day = value("day");
        const nextKey = `${year}-${month}-${day}`;
        if (nextKey === calendarDayKey) return;
        calendarDayKey = nextKey;
        const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
        const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
        calendarCtx.clearRect(0, 0, 720, 840);
        calendarCtx.fillStyle = "#fffaf0";
        calendarCtx.fillRect(0, 0, 720, 840);
        calendarCtx.fillStyle = "#91b7b4";
        calendarCtx.fillRect(0, 0, 720, 178);
        calendarCtx.fillStyle = "#fffdf6";
        calendarCtx.textAlign = "center";
        calendarCtx.font = "700 40px Xiangjiao, sans-serif";
        calendarCtx.fillText(`${year} · BEIJING`, 360, 60);
        calendarCtx.font = "900 82px Xiangjiao, sans-serif";
        calendarCtx.fillText(`${String(month).padStart(2, "0")} 月`, 360, 145);
        calendarCtx.fillStyle = "#4e4a44";
        calendarCtx.font = "700 30px Xiangjiao, sans-serif";
        ["日", "一", "二", "三", "四", "五", "六"].forEach((label, index) =>
          calendarCtx.fillText(label, 74 + index * 95, 238),
        );
        calendarCtx.strokeStyle = "rgba(90,78,67,.12)";
        calendarCtx.lineWidth = 2;
        for (let row = 0; row <= 6; row += 1) {
          calendarCtx.beginPath();
          calendarCtx.moveTo(32, 270 + row * 82);
          calendarCtx.lineTo(688, 270 + row * 82);
          calendarCtx.stroke();
        }
        calendarCtx.font = "700 31px Xiangjiao, sans-serif";
        for (let date = 1; date <= days; date += 1) {
          const slot = firstWeekday + date - 1;
          const column = slot % 7;
          const row = Math.floor(slot / 7);
          const x = 74 + column * 95;
          const y = 320 + row * 82;
          if (date === day) {
            calendarCtx.fillStyle = "#e6a5a0";
            calendarCtx.beginPath();
            calendarCtx.arc(x, y - 10, 28, 0, Math.PI * 2);
            calendarCtx.fill();
            calendarCtx.fillStyle = "#fffdf8";
          } else calendarCtx.fillStyle = column === 0 || column === 6 ? "#b2706f" : "#4e4a44";
          calendarCtx.fillText(String(date), x, y);
        }
        calendarCtx.fillStyle = "#7d9f9d";
        calendarCtx.font = "600 24px Xiangjiao, sans-serif";
        calendarCtx.fillText("今天也要好好生活与创作", 360, 795);
        calendarTexture.needsUpdate = true;
      };
      renderBeijingCalendar();
      const calendarTimer = window.setInterval(renderBeijingCalendar, 60_000);
      const loader = new THREE.TextureLoader();
      const corkCanvas = document.createElement("canvas");
      corkCanvas.width = 512;
      corkCanvas.height = 512;
      const corkCtx = corkCanvas.getContext("2d")!;
      corkCtx.fillStyle = "#c9b694";
      corkCtx.fillRect(0, 0, 512, 512);
      corkCtx.lineCap = "round";
      for (let index = 0; index < 780; index++) {
        const x = (index * 73) % 512;
        const y = (index * 191) % 512;
        const length = 3 + (index % 6);
        corkCtx.strokeStyle = index % 3 === 0 ? "rgba(111,88,57,.13)" : "rgba(255,244,215,.18)";
        corkCtx.lineWidth = index % 5 === 0 ? 1.4 : 0.8;
        corkCtx.beginPath();
        corkCtx.moveTo(x, y);
        corkCtx.lineTo(x + length, y + ((index % 5) - 2) * 0.7);
        corkCtx.stroke();
      }
      const corkTexture = new THREE.CanvasTexture(corkCanvas);
      corkTexture.colorSpace = THREE.SRGBColorSpace;
      corkTexture.wrapS = corkTexture.wrapT = THREE.RepeatWrapping;
      corkTexture.repeat.set(2.2, 1.5);
      addBox(root, [8.85, 5.72, 0.13], "#d3aa77", [1.55, 2.36, -3.12], 0.76);
      const corkBoard = new THREE.Mesh(
        new THREE.BoxGeometry(8.5, 5.38, 0.15),
        new THREE.MeshStandardMaterial({ map: corkTexture, color: "#d2bea0", roughness: 0.98 }),
      );
      corkBoard.position.set(1.55, 2.36, -3.015);
      corkBoard.receiveShadow = true;
      corkBoard.userData.hoverKind = "photoWall";
      root.add(corkBoard);
      interactive.push(corkBoard);
      const pinColors = ["#e9656b", "#5fa8d6", "#f2c14e", "#65a96f", "#ad7bd4", "#ef8f4f"];
      const addPushPin = (
        parent: THREE.Group,
        x: number,
        y: number,
        color: string,
        z = 0.16,
      ) => {
        const pin = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 16, 12),
          new THREE.MeshPhysicalMaterial({ color, roughness: 0.35, clearcoat: 0.72 }),
        );
        pin.scale.set(1, 1, 0.65);
        pin.position.set(x, y, z);
        pin.castShadow = true;
        parent.add(pin);
        const needle = new THREE.Mesh(
          new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8),
          new THREE.MeshStandardMaterial({ color: "#b8b7b1", metalness: 0.9, roughness: 0.2 }),
        );
        needle.rotation.x = Math.PI / 2;
        needle.position.set(x, y, z - 0.065);
        parent.add(needle);
      };
      let photoFrameIndex = 0;
      const addPhotoFrame = (
        path: string,
        projectId: string,
        label: string,
        labelEn: string,
        accent: string,
        size: [number, number],
        position: [number, number, number],
        rotation = 0,
      ) => {
        const frame = new THREE.Group();
        frame.position.set(...position);
        frame.rotation.z = rotation;
        root.add(frame);
        const cardMargin = size[1] > size[0] ? 0.34 : 0.22;
        addBox(
          frame,
          [size[0] + cardMargin, size[1] + cardMargin, 0.1],
          "#fffdf8",
          [0, 0, 0],
          0.84,
        );
        const texture = loader.load(path);
        texture.colorSpace = THREE.SRGBColorSpace;
        const photo = new THREE.Mesh(
          new THREE.PlaneGeometry(size[0], size[1]),
          new THREE.MeshBasicMaterial({ map: texture }),
        );
        photo.position.z = 0.065;
        photo.userData.photoProjectId = projectId;
        photo.userData.photoSrc = path;
        frame.add(photo);
        const caption = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(size[0], 1.58), 0.44),
          new THREE.MeshBasicMaterial({
            map: makePhotoRegionLabelTexture(label, labelEn, accent),
            transparent: true,
          }),
        );
        caption.position.set(0, -size[1] / 2 - 0.3, 0.075);
        caption.userData.photoProjectId = projectId;
        caption.userData.photoSrc = path;
        frame.add(caption);
        addPushPin(frame, -size[0] * 0.38, size[1] * 0.42, pinColors[photoFrameIndex % pinColors.length]);
        addPushPin(frame, size[0] * 0.38, size[1] * 0.42, pinColors[(photoFrameIndex + 1) % pinColors.length]);
        photoFrameIndex += 2;
        return frame;
      };
      const wallFrames = [
        addPhotoFrame(
          "/portfolio/travel/western-sichuan-01.webp",
          "landscape-archive",
          "风景摄影",
          "LANDSCAPE",
          "#9db8c8",
          [2.0, 1.13],
          [-1.18, 3.02, -2.83],
          -0.04,
        ),
        addPhotoFrame(
          "/portfolio/photo-archive/product-09.webp",
          "product-photo",
          "产品摄影",
          "PRODUCT",
          "#dec17a",
          [2.0, 1.13],
          [1.65, 3.12, -2.83],
          0.035,
        ),
        addPhotoFrame(
          "/portfolio/photo-archive/portrait-13.webp",
          "portrait-photo",
          "人像摄影",
          "PORTRAIT",
          "#9fbfd1",
          [1.52, 2.14],
          [4.02, 2.9, -2.83],
          -0.025,
        ),
      ];
      wallFrames.forEach((frame) => {
        frame.userData.dragSurface = "wall";
        frame.userData.hoverKind = "photoWall";
        draggableRoots.push(frame);
      });
      const photoArchiveNote = new THREE.Mesh(
        new RoundedBoxGeometry(1.28, 1.28, 0.055, 5, 0.06),
        new THREE.MeshStandardMaterial({ map: makePhotoArchiveNoteTexture(), roughness: 0.9 }),
      );
      photoArchiveNote.position.set(-2.02, 4.32, -2.82);
      photoArchiveNote.rotation.z = -0.035;
      photoArchiveNote.castShadow = true;
      photoArchiveNote.userData.hoverKind = "photoWall";
      root.add(photoArchiveNote);
      interactive.push(photoArchiveNote);
      const archivePin = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 18, 12),
        new THREE.MeshPhysicalMaterial({ color: "#6ca6c4", roughness: 0.28, clearcoat: 0.72 }),
      );
      archivePin.scale.set(1, 1, 0.62);
      archivePin.position.set(-2.02, 4.75, -2.72);
      archivePin.castShadow = true;
      archivePin.userData.hoverKind = "photoWall";
      root.add(archivePin);
      interactive.push(archivePin);
      const stickyColors = ["#f1b6b2", "#b8d8cf", "#f3dc8c", "#a9cde2"];
      [
        [-1.82, 3.45, -0.08, 0.48, 0.48],
        [-1.7, 1.38, 0.05, 0.34, 0.5],
        [0.28, 1.32, 0.06, 0.4, 0.4],
        [0.38, 3.78, -0.1, 0.56, 0.34],
        [2.68, 3.72, 0.04, 0.38, 0.52],
        [2.78, 1.28, -0.05, 0.58, 0.38],
        [4.82, 1.38, 0.08, 0.4, 0.56],
        [4.92, 3.7, -0.06, 0.62, 0.4],
      ].forEach(([x, y, rotation, width, height], index) => {
        const sticky = new THREE.Group();
        sticky.position.set(x, y, -2.9);
        sticky.rotation.z = rotation;
        sticky.userData.dragSurface = "wall";
        root.add(sticky);
        addBox(
          sticky,
          [width, height, 0.035],
          stickyColors[index % stickyColors.length],
          [0, 0, 0],
          0.9,
        );
        addPushPin(sticky, 0, height * 0.34, pinColors[(index + 2) % pinColors.length], 0.09);
        draggableRoots.push(sticky);
      });
      const addWallSticker = (
        x: number,
        y: number,
        color: string,
        kind: "smile" | "star" | "ticket" | "bolt" | "planet",
      ) => {
        const sticker = new THREE.Group();
        sticker.position.set(x, y, -2.88);
        sticker.userData.dragSurface = "wall";
        root.add(sticker);
        const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        if (kind === "star") {
          const shape = new THREE.Shape();
          for (let i = 0; i < 10; i++) {
            const radius = i % 2 ? 0.12 : 0.27;
            const angle = -Math.PI / 2 + (i * Math.PI) / 5;
            const px = Math.cos(angle) * radius;
            const py = Math.sin(angle) * radius;
            if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
          }
          sticker.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), mat));
        } else if (kind === "smile") {
          sticker.add(new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), mat));
          const smile = new THREE.Mesh(
            new THREE.TorusGeometry(0.1, 0.018, 8, 18, Math.PI),
            new THREE.MeshBasicMaterial({ color: "#5b5149" }),
          );
          smile.position.set(0, -0.01, 0.008);
          smile.rotation.z = Math.PI;
          sticker.add(smile);
        } else if (kind === "ticket") {
          sticker.add(new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.3, 0.02, 4, 0.06), mat));
          [-0.13, 0, 0.13].forEach((px) => {
            const mark = new THREE.Mesh(
              new THREE.CircleGeometry(0.025, 12),
              new THREE.MeshBasicMaterial({ color: "#fff8ea" }),
            );
            mark.position.set(px, 0, 0.018);
            sticker.add(mark);
          });
        } else if (kind === "bolt") {
          const bolt = new THREE.Shape();
          bolt.moveTo(-0.05, 0.3);
          bolt.lineTo(0.16, 0.08);
          bolt.lineTo(0.04, 0.08);
          bolt.lineTo(0.12, -0.28);
          bolt.lineTo(-0.18, 0.02);
          bolt.lineTo(-0.05, 0.02);
          sticker.add(new THREE.Mesh(new THREE.ShapeGeometry(bolt), mat));
        } else {
          sticker.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), mat));
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 28), mat);
          ring.scale.y = 0.42;
          ring.rotation.z = -0.32;
          sticker.add(ring);
        }
        addPushPin(sticker, 0, 0.23, pinColors[Math.abs(Math.round(x * 2 + y)) % pinColors.length], 0.075);
        draggableRoots.push(sticker);
      };
      addWallSticker(-2.15, 2.65, "#e8849c", "ticket");
      addWallSticker(0.5, 3.66, "#f0b847", "star");
      addWallSticker(2.72, 1.25, "#7fb7d4", "smile");
      addWallSticker(5.05, 3.25, "#91bd82", "planet");
      addWallSticker(4.9, 2.05, "#e86b5b", "bolt");
      const monitor = new THREE.Group();
      monitor.position.set(-2.08, 0.35 + mainDeskLift, -1.0);
      monitor.userData.hoverKind = "computer";
      root.add(monitor);
      draggableRoots.push(monitor);
      const monitorShell = new THREE.Mesh(
        new RoundedBoxGeometry(3.72, 2.95, 0.56, 6, 0.18),
        new THREE.MeshPhysicalMaterial({
          color: "#b9d8e8",
          roughness: 0.38,
          clearcoat: 0.32,
        }),
      );
      monitorShell.position.y = 0.65;
      monitorShell.castShadow = true;
      monitor.add(monitorShell);
      const screenBezel = new THREE.Mesh(
        new RoundedBoxGeometry(3.18, 2.34, 0.12, 5, 0.14),
        new THREE.MeshStandardMaterial({ color: "#f5a346", roughness: 0.52 }),
      );
      screenBezel.position.set(0, 0.65, 0.34);
      monitor.add(screenBezel);
      const monitorDisplay = createMonitorDisplay();
      const screen = new THREE.Mesh(
        new THREE.PlaneGeometry(2.88, 2.04),
        new THREE.MeshBasicMaterial({ map: monitorDisplay.texture }),
      );
      screen.position.set(0, 0.65, 0.415);
      screen.userData.monitor = true;
      monitor.add(screen);
      interactive.push(screen);
      const updateMonitorText = () =>
        monitorDisplay.render(monitorInput.value, {
          x: THREE.MathUtils.clamp((mouse.position.x + 1.2) / 1.75, 0, 1),
          y: THREE.MathUtils.clamp((mouse.position.z - 0.85) / 1.7, 0, 1),
        });
      monitorInput.addEventListener("input", updateMonitorText);
      addBox(monitor, [0.62, 1.18, 0.48], "#a9cfe2", [0, -1.35, -0.04], 0.48);
      addBox(monitor, [1.55, 0.25, 1.55], "#c8e0eb", [0, -1.86, 0.23], 0.45);
      addBox(monitor, [1.72, 0.09, 1.72], "#79afd0", [0, -2.03, 0.25], 0.52);
      [
        [-1.45, -0.62, "#f2c746"],
        [-1.16, -0.62, "#6db7de"],
        [1.12, -0.62, "#ee8fba"],
        [1.4, -0.62, "#89c965"],
      ].forEach(([x, y, color]) => {
        const button = new THREE.Mesh(
          new THREE.SphereGeometry(0.07, 14, 10),
          new THREE.MeshStandardMaterial({ color: color as string, roughness: 0.5 }),
        );
        button.position.set(x as number, y as number, 0.36);
        monitor.add(button);
      });
      const keyboard = new THREE.Group();
      keyboard.position.set(-2.45, -1.58 + mainDeskLift, 0.72);
      keyboard.rotation.x = -0.08;
      root.add(keyboard);
      draggableRoots.push(keyboard);
      addBox(keyboard, [3.25, 0.22, 1.08], "#8ebed6", [0, 0, 0], 0.68);
      for (let row = 0; row < 3; row++)
        for (let col = 0; col < 9; col++)
          addBox(
            keyboard,
            [0.25, 0.06, 0.18],
            (row + col) % 3 === 0 ? "#d8ebf3" : "#a9d1e2",
            [-1.1 + col * 0.28, 0.15, -0.28 + row * 0.25],
            0.75,
          );
      const mouse = new THREE.Group();
      mouse.position.set(-0.45, -1.55 + mainDeskLift, 1.42);
      mouse.userData.dragBounds = { minX: -1.2, maxX: 0.55, minZ: 0.85, maxZ: 2.55 };
      root.add(mouse);
      draggableRoots.push(mouse);
      const mouseBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 28, 18),
        new THREE.MeshPhysicalMaterial({ color: "#a9cfe2", roughness: 0.38, clearcoat: 0.22 }),
      );
      mouseBody.scale.set(0.72, 0.3, 1.05);
      mouseBody.castShadow = true;
      mouse.add(mouseBody);
      addBox(mouse, [0.025, 0.045, 0.42], "#edf6f8", [0, 0.15, -0.08], 0.5);
      const wheel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14),
        new THREE.MeshStandardMaterial({ color: "#e497b4", roughness: 0.48 }),
      );
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.15, -0.17);
      mouse.add(wheel);
      const shelf = new THREE.Group();
      shelf.position.y = mainDeskLift;
      root.add(shelf);
      addBox(shelf, [4.8, 0.18, 0.8], "#9f6944", [3.45, 0.18, -2.45], 0.86);
      addBox(shelf, [0.18, 2.0, 0.18], "#744d35", [1.25, -0.82, -2.45], 0.9);
      addBox(shelf, [0.18, 2.0, 0.18], "#744d35", [5.65, -0.82, -2.45], 0.9);
      const bear = new THREE.Group();
      bear.position.set(8.78, 1.86, -2.38);
      bear.userData.dragSurface = "wall";
      root.add(bear);
      draggableRoots.push(bear);
      const pandaWhite = new THREE.MeshPhysicalMaterial({
        color: "#f6f2e8",
        roughness: 1,
        sheen: 0.75,
        sheenColor: new THREE.Color("#fffaf2"),
        sheenRoughness: 0.95,
      });
      const pandaBlack = new THREE.MeshPhysicalMaterial({
        color: "#202829",
        roughness: 1,
        sheen: 0.5,
        sheenColor: new THREE.Color("#596061"),
        sheenRoughness: 1,
      });
      const bearBody = new THREE.Mesh(
        new THREE.SphereGeometry(0.48, 22, 16),
        pandaWhite,
      );
      bearBody.position.y = -0.02;
      bearBody.scale.set(0.84, 0.9, 0.76);
      bear.add(bearBody);
      const bearHead = new THREE.Mesh(
        new THREE.SphereGeometry(0.38, 22, 16),
        pandaWhite,
      );
      bearHead.position.y = 0.55;
      bearHead.scale.set(1.34, 1.24, 1.3);
      bear.add(bearHead);
      [-0.27, 0.27].forEach((x) => {
        const ear = new THREE.Mesh(
          new THREE.SphereGeometry(0.15, 18, 12),
          pandaBlack,
        );
        ear.position.set(x * 1.12, 0.93, 0);
        bear.add(ear);
        const eyePatch = new THREE.Mesh(
          new THREE.SphereGeometry(0.145, 18, 14),
          pandaBlack,
        );
        eyePatch.scale.set(1.22, 1.3, 0.34);
        eyePatch.position.set(x * 0.72, 0.64, 0.43);
        bear.add(eyePatch);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), pandaBlack);
        eye.position.set(x * 0.72, 0.65, 0.485);
        bear.add(eye);
        const eyeGlint = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 6), pandaWhite);
        eyeGlint.position.set(x * 0.72 - 0.009, 0.662, 0.516);
        bear.add(eyeGlint);
      });
      const bearMuzzle = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 18, 12),
        pandaWhite,
      );
      bearMuzzle.position.set(0, 0.51, 0.38);
      bearMuzzle.scale.y = 0.75;
      bear.add(bearMuzzle);
      const pandaNose = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 10),
        pandaBlack,
      );
      pandaNose.position.set(0, 0.54, 0.52);
      bear.add(pandaNose);
      [-1, 1].forEach((side) => {
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 12), pandaBlack);
        hand.position.set(side * 0.38, -0.02, 0.16);
        hand.scale.set(0.72, 1.28, 0.68);
        hand.rotation.z = side * -0.3;
        hand.castShadow = true;
        bear.add(hand);
        const foot = new THREE.Mesh(new THREE.SphereGeometry(0.195, 20, 14), pandaBlack);
        foot.position.set(side * 0.23, -0.33, 0.3);
        foot.scale.set(1.08, 0.84, 0.82);
        bear.add(foot);
      });
      [-1, 1].forEach((side) => {
        const bowWing = new THREE.Mesh(
          new RoundedBoxGeometry(0.33, 0.22, 0.14, 4, 0.085),
          new THREE.MeshStandardMaterial({ color: "#d94c4f", roughness: 0.62 }),
        );
        bowWing.rotation.z = side * 0.22;
        bowWing.position.set(side * 0.2, 0.15, 0.49);
        bear.add(bowWing);
      });
      const bowCenter = new THREE.Mesh(
        new THREE.SphereGeometry(0.078, 16, 12),
        new THREE.MeshStandardMaterial({ color: "#b9363d", roughness: 0.58 }),
      );
      bowCenter.position.set(0, 0.14, 0.55);
      bear.add(bowCenter);
      [-0.055, 0.055].forEach((x, index) => {
        const tail = new THREE.Mesh(
          new RoundedBoxGeometry(0.09, 0.2, 0.075, 3, 0.035),
          new THREE.MeshStandardMaterial({ color: "#c83e45", roughness: 0.66 }),
        );
        tail.position.set(x, -0.02, 0.5);
        tail.rotation.z = index ? 0.28 : -0.28;
        bear.add(tail);
      });
      const plant = new THREE.Group();
      // Rest the planter directly on the upper shelf instead of leaving a gap.
      plant.position.set(4.85, 0.88, -2.2);
      root.add(plant);
      draggableRoots.push(plant);
      const potCanvas = document.createElement("canvas");
      potCanvas.width = 256;
      potCanvas.height = 256;
      const potCtx = potCanvas.getContext("2d")!;
      potCtx.fillStyle = "#fffaf0";
      potCtx.fillRect(0, 0, 256, 256);
      potCtx.fillStyle = "#d95151";
      for (let row = 0; row < 7; row++)
        for (let column = 0; column < 6; column++) {
          potCtx.beginPath();
          potCtx.arc(18 + column * 48 + (row % 2) * 17, 18 + row * 40, 7, 0, Math.PI * 2);
          potCtx.fill();
        }
      const potTexture = new THREE.CanvasTexture(potCanvas);
      potTexture.colorSpace = THREE.SRGBColorSpace;
      potTexture.wrapS = potTexture.wrapT = THREE.RepeatWrapping;
      const pot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.28, 0.34, 0.48, 20),
        new THREE.MeshStandardMaterial({ map: potTexture, color: "#fffdf7", roughness: 0.88 }),
      );
      plant.add(pot);
      const potRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.285, 0.035, 10, 28),
        new THREE.MeshStandardMaterial({ color: "#fffaf0", roughness: 0.82 }),
      );
      potRim.rotation.x = Math.PI / 2;
      potRim.position.y = 0.24;
      plant.add(potRim);
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.025, 0.035, 1.25, 10),
        new THREE.MeshStandardMaterial({ color: "#456747", roughness: 0.9 }),
      );
      stem.position.y = 0.78;
      plant.add(stem);
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.23, 14, 10),
          new THREE.MeshStandardMaterial({
            color: i % 2 ? "#5f8054" : "#769263",
            roughness: 0.92,
          }),
        );
        leaf.scale.set(1.5, 0.45, 0.7);
        leaf.position.set(
          (i % 2 ? 1 : -1) * (0.18 + i * 0.035),
          0.65 + i * 0.18,
          0,
        );
        leaf.rotation.z = (i % 2 ? 1 : -1) * 0.45;
        plant.add(leaf);
      }
      const cup = new THREE.Group();
      cup.position.set(0.45, -1.4 + mainDeskLift, -0.58);
      root.add(cup);
      draggableRoots.push(cup);
      const cupMaterial = new THREE.MeshPhysicalMaterial({
        color: "#db8eb9",
        roughness: 0.38,
        clearcoat: 0.24,
      });
      const cupBody = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.78, 32, 1, true),
        cupMaterial,
      );
      cupBody.position.y = 0.39;
      cupBody.castShadow = true;
      cup.add(cupBody);
      const cupBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.34, 0.34, 0.055, 32),
        cupMaterial,
      );
      cupBase.position.y = 0.025;
      cup.add(cupBase);
      const cupRim = new THREE.Mesh(
        new THREE.TorusGeometry(0.34, 0.035, 10, 36),
        new THREE.MeshStandardMaterial({ color: "#efb1d2", roughness: 0.4 }),
      );
      cupRim.rotation.x = Math.PI / 2;
      cupRim.position.y = 0.78;
      cup.add(cupRim);
      const pencilColors = [
        "#ef9bbd",
        "#69a7de",
        "#efb82e",
        "#d58848",
        "#7bc36b",
      ];
      pencilColors.forEach((color, i) => {
        const pencil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 1.05, 8),
          new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
        );
        pencil.position.set(-0.18 + i * 0.085, 0.76, -0.02 + (i % 2) * 0.08);
        pencil.rotation.z = (i - 2) * 0.045;
        cup.add(pencil);
        const tip = new THREE.Mesh(
          new THREE.ConeGeometry(0.045, 0.13, 8),
          new THREE.MeshStandardMaterial({ color: "#ead6b4", roughness: 0.85 }),
        );
        tip.position.copy(pencil.position);
        tip.position.y += 0.62;
        tip.rotation.z = pencil.rotation.z;
        cup.add(tip);
      });
      const ruler = new THREE.Mesh(
        new RoundedBoxGeometry(0.13, 1.02, 0.035, 3, 0.018),
        new THREE.MeshPhysicalMaterial({
          color: "#f1c84f",
          transparent: true,
          opacity: 0.9,
          roughness: 0.42,
        }),
      );
      ruler.position.set(0.2, 0.79, 0.03);
      ruler.rotation.z = -0.1;
      cup.add(ruler);
      const scissorGroup = new THREE.Group();
      scissorGroup.position.set(-0.12, 0.68, 0.12);
      scissorGroup.rotation.z = 0.1;
      cup.add(scissorGroup);
      const scissorGreen = new THREE.MeshStandardMaterial({ color: "#4fa75f", roughness: 0.58 });
      [-0.09, 0.09].forEach((x) => {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.036, 9, 22), scissorGreen);
        loop.position.set(x, 0.52, 0);
        scissorGroup.add(loop);
      });
      [-0.045, 0.045].forEach((x, index) => {
        const blade = new THREE.Mesh(
          new THREE.BoxGeometry(0.035, 0.52, 0.024),
          new THREE.MeshStandardMaterial({ color: "#c5c7c4", metalness: 0.7, roughness: 0.28 }),
        );
        blade.position.set(x, 0.15, 0);
        blade.rotation.z = index ? -0.09 : 0.09;
        scissorGroup.add(blade);
      });
      let lampOn = true;
      const lamp = new THREE.Group();
      // Keep the lamp in its own clear zone on the far-left side of the desk.
      // The extra horizontal and depth separation prevents the shade and arm
      // from intersecting or visually covering the monitor.
      lamp.position.set(-5.35, -1.75 + mainDeskLift, -0.35);
      root.add(lamp);
      draggableRoots.push(lamp);
      const lampMetal = new THREE.MeshStandardMaterial({
        color: "#86a99a",
        metalness: 0.22,
        roughness: 0.46,
      });
      const lampBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.48, 0.54, 0.14, 32),
        new THREE.MeshPhysicalMaterial({ color: "#91b2a3", roughness: 0.4, clearcoat: 0.2 }),
      );
      lampBase.position.y = 0.08;
      lampBase.castShadow = true;
      lamp.add(lampBase);
      const lampLowerArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.055, 0.065, 2.5, 14),
        lampMetal,
      );
      lampLowerArm.position.set(0, 1.32, 0);
      lamp.add(lampLowerArm);
      const lowerJoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.13, 18, 12),
        new THREE.MeshPhysicalMaterial({ color: "#789d8d", roughness: 0.38, clearcoat: 0.22 }),
      );
      lowerJoint.position.set(0, 2.58, 0);
      lamp.add(lowerJoint);
      const lampElbow = new THREE.Vector3(0, 2.58, 0);
      const lampHeadJoint = new THREE.Vector3(0.82, 3.36, 0.02);
      const lampUpperDirection = lampHeadJoint.clone().sub(lampElbow);
      const lampUpperArm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.06, lampUpperDirection.length(), 14),
        lampMetal,
      );
      lampUpperArm.position.copy(lampElbow).add(lampHeadJoint).multiplyScalar(0.5);
      lampUpperArm.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        lampUpperDirection.clone().normalize(),
      );
      lamp.add(lampUpperArm);
      const upperJoint = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 18, 12),
        new THREE.MeshPhysicalMaterial({ color: "#789d8d", roughness: 0.38, clearcoat: 0.22 }),
      );
      upperJoint.position.copy(lampHeadJoint);
      lamp.add(upperJoint);
      const lampShade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.66, 0.72, 28, 1, true),
        new THREE.MeshPhysicalMaterial({
          color: "#87aa9a",
          roughness: 0.38,
          clearcoat: 0.25,
          side: THREE.DoubleSide,
        }),
      );
      lampShade.position.set(1.08, 3.3, 0.08);
      lampShade.rotation.z = -1.2;
      lampShade.rotation.y = 0.08;
      lampShade.castShadow = true;
      lamp.add(lampShade);
      const bulbMaterial = new THREE.MeshStandardMaterial({
        color: "#fff1bd",
        emissive: "#ffd578",
        emissiveIntensity: 1.5,
      });
      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 18, 12),
        bulbMaterial,
      );
      bulb.position.set(1.32, 3.12, 0.1);
      lamp.add(bulb);
      const pullCord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.022, 0.022, 1.55, 8),
        new THREE.MeshStandardMaterial({ color: "#665b52", roughness: 0.76 }),
      );
      pullCord.position.set(0.68, 2.69, 0.18);
      pullCord.userData.lampPull = true;
      lamp.add(pullCord);
      interactive.push(pullCord);
      const pullBead = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 14, 10),
        new THREE.MeshStandardMaterial({ color: "#f1c65b", roughness: 0.5 }),
      );
      pullBead.position.set(0.68, 1.9, 0.18);
      pullBead.userData.lampPull = true;
      lamp.add(pullBead);
      interactive.push(pullBead);
      const lampLight = new THREE.SpotLight("#ffd889", 13, 9, 0.76, 0.62, 1.15);
      lampLight.position.set(1.32, 3.12, 0.12);
      lampLight.target.position.set(1.5, 0, 0.8);
      lampLight.castShadow = true;
      lampLight.shadow.mapSize.set(1024, 1024);
      lamp.add(lampLight, lampLight.target);
      const cameraModel = new THREE.Group();
      cameraModel.position.set(2.25, 1.08, -2.18);
      cameraModel.userData.dragSurface = "wall";
      cameraModel.rotation.y = 0.12;
      root.add(cameraModel);
      draggableRoots.push(cameraModel);
      addBox(cameraModel, [1.55, 0.86, 0.5], "#3e4748", [0, 0, 0], 0.58);
      addBox(cameraModel, [1.5, 0.22, 0.54], "#d8d4c8", [0, 0.5, 0], 0.48);
      const grip = addBox(
        cameraModel,
        [0.36, 0.72, 0.58],
        "#2f3838",
        [0.58, -0.03, 0.02],
        0.68,
      );
      grip.rotation.z = -0.03;
      const lensMaterial = new THREE.MeshStandardMaterial({
        color: "#293333",
        metalness: 0.58,
        roughness: 0.28,
      });
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.39, 0.45, 0.62, 32),
        lensMaterial,
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(-0.15, 0, 0.48);
      lens.castShadow = true;
      cameraModel.add(lens);
      const glass = new THREE.Mesh(
        new THREE.CylinderGeometry(0.29, 0.29, 0.035, 32),
        new THREE.MeshPhysicalMaterial({
          color: "#6d9ca2",
          metalness: 0.65,
          roughness: 0.12,
          clearcoat: 1,
        }),
      );
      glass.rotation.x = Math.PI / 2;
      glass.position.set(-0.15, 0, 0.8);
      cameraModel.add(glass);
      for (let i = 0; i < 3; i++) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.36 - i * 0.035, 0.025, 10, 32),
          new THREE.MeshStandardMaterial({
            color: i === 1 ? "#b7a36e" : "#252d2d",
            metalness: 0.62,
            roughness: 0.3,
          }),
        );
        ring.position.set(-0.15, 0, 0.5 + i * 0.11);
        cameraModel.add(ring);
      }
      [-0.42, 0.35].forEach((x, index) => {
        const dial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.13, 0.13, 0.09, 18),
          new THREE.MeshStandardMaterial({
            color: index ? "#c8bfb0" : "#4b5352",
            metalness: 0.6,
            roughness: 0.28,
          }),
        );
        dial.position.set(x, 0.65, 0);
        cameraModel.add(dial);
      });
      const shutter = new THREE.Mesh(
        new THREE.SphereGeometry(0.055, 14, 10),
        new THREE.MeshStandardMaterial({
          color: "#d8786f",
          metalness: 0.3,
          roughness: 0.4,
        }),
      );
      shutter.position.set(0.48, 0.65, 0.08);
      cameraModel.add(shutter);
      const viewfinder = addBox(
        cameraModel,
        [0.32, 0.22, 0.08],
        "#242b2d",
        [-0.46, 0.24, 0.3],
        0.45,
      );
      viewfinder.castShadow = true;
      const deskFrame = new THREE.Group();
      deskFrame.position.set(-5.1, -1.04 + mainDeskLift, 0.35);
      deskFrame.scale.setScalar(0.68);
      deskFrame.rotation.y = 0.04;
      deskFrame.rotation.z = -0.045;
      root.add(deskFrame);
      draggableRoots.push(deskFrame);
      addBox(deskFrame, [1.32, 1.64, 0.14], "#d8b88d", [0, 0, 0], 0.82);
      const frameTexture = loader.load("/portfolio/desk-portrait.png");
      frameTexture.colorSpace = THREE.SRGBColorSpace;
      const framedPhoto = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 1.4),
        new THREE.MeshBasicMaterial({ map: frameTexture }),
      );
      framedPhoto.position.z = 0.08;
      deskFrame.add(framedPhoto);
      const frameLeg = addBox(
        deskFrame,
        [0.12, 0.8, 0.12],
        "#b38b61",
        [0, -1.05, -0.22],
        0.88,
      );
      frameLeg.rotation.x = -0.22;
      frameLeg.visible = false;
      const easelRug = new THREE.Group();
      easelRug.position.set(-7.45, -4.39, 0.55);
      root.add(easelRug);
      const rugMaterial = new THREE.MeshPhysicalMaterial({
        color: "#f5f1e8",
        roughness: 1,
        sheen: 1,
        sheenColor: new THREE.Color("#fffdf7"),
      });
      const rugCenter = new THREE.Mesh(new THREE.CircleGeometry(1.65, 48), rugMaterial);
      rugCenter.rotation.x = -Math.PI / 2;
      rugCenter.scale.set(1.35, 0.92, 1);
      rugCenter.receiveShadow = true;
      easelRug.add(rugCenter);
      for (let index = 0; index < 28; index++) {
        const angle = (index / 28) * Math.PI * 2;
        const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), rugMaterial);
        tuft.scale.set(1.5, 0.34, 1.1);
        tuft.position.set(Math.cos(angle) * 1.78, 0.04, Math.sin(angle) * 1.18);
        tuft.castShadow = true;
        easelRug.add(tuft);
      }
      const easel = new THREE.Group();
      easel.position.set(-7.45, 1.83, 0.55);
      easel.scale.set(1.18, 1.5, 1.18);
      easel.rotation.y = 0.18;
      easel.userData.dragBounds = { minX: -8.5, maxX: -6.45, minZ: -2.2, maxZ: 2.7 };
      easel.userData.hoverKind = "easel";
      root.add(easel);
      draggableRoots.push(easel);
      const easelWood = new THREE.MeshStandardMaterial({
        color: "#a96d43",
        roughness: 0.82,
      });
      [-0.58, 0.58].forEach((x) => {
        const leg = new THREE.Mesh(
          new RoundedBoxGeometry(0.16, 3.45, 0.16, 4, 0.04),
          easelWood,
        );
        leg.position.set(x, -2.66, 0);
        leg.rotation.z = x < 0 ? -0.08 : 0.08;
        leg.castShadow = true;
        easel.add(leg);
      });
      const rearLeg = new THREE.Mesh(
        new RoundedBoxGeometry(0.16, 3.2, 0.16, 4, 0.04),
        easelWood,
      );
      rearLeg.position.set(0, -2.8, -0.58);
      rearLeg.rotation.x = -0.17;
      rearLeg.castShadow = true;
      easel.add(rearLeg);
      addBox(easel, [1.78, 0.16, 0.38], "#9a633f", [0, -4.18, 0.2], 0.82);
      addBox(easel, [1.82, 0.14, 0.34], "#9a633f", [0, -4.18, -0.62], 0.82);
      addBox(easel, [0.16, 0.14, 1.18], "#9a633f", [-0.82, -4.18, -0.2], 0.82);
      addBox(easel, [0.16, 0.14, 1.18], "#9a633f", [0.82, -4.18, -0.2], 0.82);
      addBox(easel, [1.3, 0.13, 0.18], "#8f5d3d", [0, -3.2, 0.02], 0.8);
      addBox(easel, [1.58, 0.18, 0.42], "#8f5d3d", [0, -2.45, 0.08], 0.78);
      addBox(easel, [0.18, 3.62, 0.18], "#a96d43", [0, -1.93, -0.02], 0.82);
      const easelCanvas = new THREE.Mesh(
        new RoundedBoxGeometry(1.76, 2.22, 0.12, 5, 0.06),
        new THREE.MeshStandardMaterial({ color: "#f5efe3", roughness: 0.95 }),
      );
      easelCanvas.position.set(0, -1.42, 0.16);
      easelCanvas.rotation.z = -0.025;
      easelCanvas.castShadow = true;
      easelCanvas.userData.easelCanvas = true;
      easel.add(easelCanvas);
      const artCanvas = document.createElement("canvas");
      artCanvas.width = 960;
      artCanvas.height = 1200;
      const artCtx = artCanvas.getContext("2d")!;
      artCtx.fillStyle = "#fffdf7";
      artCtx.fillRect(0, 0, artCanvas.width, artCanvas.height);
      artCtx.strokeStyle = "#e3ddd2";
      artCtx.lineWidth = 10;
      artCtx.strokeRect(8, 8, artCanvas.width - 16, artCanvas.height - 16);
      const artTexture = new THREE.CanvasTexture(artCanvas);
      artTexture.colorSpace = THREE.SRGBColorSpace;
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(1.54, 1.96),
        new THREE.MeshBasicMaterial({ map: artTexture }),
      );
      art.position.set(0, -1.42, 0.235);
      art.rotation.z = -0.025;
      art.userData.easelCanvas = true;
      easel.add(art);
      interactive.push(art, easelCanvas);
      addBox(easel, [0.72, 0.14, 0.22], "#835334", [0, -0.27, 0.23], 0.8);
      addBox(easel, [0.42, 0.38, 0.2], "#9a633f", [0, -0.05, 0.2], 0.8);
      const hangingCup = new THREE.Group();
      hangingCup.position.set(0.5, -2.25, 0.38);
      easel.add(hangingCup);
      const brushCup = new THREE.Mesh(
        new THREE.CylinderGeometry(0.24, 0.19, 0.52, 20, 1, true),
        new THREE.MeshPhysicalMaterial({ color: "#8fb9c4", roughness: 0.55, clearcoat: 0.14 }),
      );
      brushCup.position.y = 0.15;
      hangingCup.add(brushCup);
      const brushCupBase = new THREE.Mesh(
        new THREE.CylinderGeometry(0.19, 0.19, 0.04, 20),
        new THREE.MeshStandardMaterial({ color: "#769ea9", roughness: 0.62 }),
      );
      brushCupBase.position.y = -0.11;
      hangingCup.add(brushCupBase);
      ["#507fa2", "#d86e70", "#d0a53f", "#5d8d68", "#8d65a8"].forEach((color, index) => {
        const pencilRig = new THREE.Group();
        pencilRig.position.set(-0.16 + index * 0.078, 0, (index % 2) * 0.055);
        pencilRig.rotation.z = (index - 2) * 0.045;
        hangingCup.add(pencilRig);
        const pencilLength = 0.68 + index * 0.025;
        const pencil = new THREE.Mesh(
          new THREE.CylinderGeometry(0.034, 0.034, pencilLength, 6),
          new THREE.MeshStandardMaterial({ color, roughness: 0.72 }),
        );
        pencil.position.y = -0.06 + pencilLength / 2;
        pencil.userData.brushColor = color;
        pencilRig.add(pencil);
        interactive.push(pencil);
        const woodTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.04, 0.13, 6),
          new THREE.MeshStandardMaterial({ color: "#e4c797", roughness: 0.86 }),
        );
        woodTip.position.y = -0.06 + pencilLength + 0.065;
        woodTip.userData.brushColor = color;
        pencilRig.add(woodTip);
        interactive.push(woodTip);
        const pigmentTip = new THREE.Mesh(
          new THREE.ConeGeometry(0.015, 0.045, 6),
          new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
        );
        pigmentTip.position.y = -0.06 + pencilLength + 0.142;
        pigmentTip.userData.brushColor = color;
        pencilRig.add(pigmentTip);
        interactive.push(pigmentTip);
      });
      const easelEraser = new THREE.Mesh(
        new RoundedBoxGeometry(0.42, 0.16, 0.22, 4, 0.045),
        new THREE.MeshStandardMaterial({ color: "#f2a8b7", roughness: 0.88 }),
      );
      easelEraser.position.set(-0.45, -2.29, 0.44);
      easelEraser.rotation.z = -0.08;
      easelEraser.userData.eraser = true;
      easel.add(easelEraser);
      interactive.push(easelEraser);

      const sewingTable = new THREE.Group();
      sewingTable.position.set(8.15, 1.2, -0.72);
      sewingTable.scale.setScalar(1.32);
      sewingTable.userData.dragBounds = { minX: 7.75, maxX: 9.1, minZ: -1.15, maxZ: 1.5 };
      root.add(sewingTable);
      draggableRoots.push(sewingTable);
      const sideTableWood = new THREE.MeshStandardMaterial({ color: "#b87a51", roughness: 0.86 });
      const sideTop = new THREE.Mesh(new RoundedBoxGeometry(3.25, 0.28, 2.55, 5, 0.09), sideTableWood);
      sideTop.position.y = -2.02;
      sideTop.castShadow = true;
      sewingTable.add(sideTop);
      [[-1.38, -0.96], [1.38, -0.96], [-1.38, 0.96], [1.38, 0.96]].forEach(([x, z]) => {
        const leg = new THREE.Mesh(new RoundedBoxGeometry(0.2, 2.28, 0.2, 4, 0.05), sideTableWood);
        leg.position.set(x, -3.18, z);
        leg.castShadow = true;
        sewingTable.add(leg);
      });
      const clothCanvas = document.createElement("canvas");
      clothCanvas.width = 512;
      clothCanvas.height = 512;
      const clothCtx = clothCanvas.getContext("2d")!;
      clothCtx.fillStyle = "#f6eee1";
      clothCtx.fillRect(0, 0, 512, 512);
      clothCtx.strokeStyle = "rgba(104,151,170,.33)";
      clothCtx.lineWidth = 7;
      for (let line = 0; line <= 512; line += 96) {
        clothCtx.beginPath(); clothCtx.moveTo(line, 0); clothCtx.lineTo(line, 512); clothCtx.stroke();
        clothCtx.beginPath(); clothCtx.moveTo(0, line); clothCtx.lineTo(512, line); clothCtx.stroke();
      }
      clothCtx.fillStyle = "rgba(213,106,112,.5)";
      for (let y = 48; y < 512; y += 96)
        for (let x = 48; x < 512; x += 96) {
          clothCtx.beginPath(); clothCtx.arc(x, y, 7, 0, Math.PI * 2); clothCtx.fill();
        }
      const clothTexture = new THREE.CanvasTexture(clothCanvas);
      clothTexture.colorSpace = THREE.SRGBColorSpace;
      clothTexture.wrapS = clothTexture.wrapT = THREE.RepeatWrapping;
      clothTexture.repeat.set(2.2, 1.65);
      const clothMaterial = new THREE.MeshStandardMaterial({
        map: clothTexture,
        color: "#fffaf0",
        roughness: 0.98,
        side: THREE.DoubleSide,
      });
      const tableclothTop = new THREE.Mesh(new RoundedBoxGeometry(3.12, 0.065, 2.45, 5, 0.055), clothMaterial);
      tableclothTop.position.y = -1.84;
      tableclothTop.castShadow = true;
      sewingTable.add(tableclothTop);
      const tableclothDrop = new THREE.Mesh(new THREE.PlaneGeometry(3.08, 0.72), clothMaterial);
      tableclothDrop.position.set(0, -2.2, 1.3);
      tableclothDrop.castShadow = true;
      sewingTable.add(tableclothDrop);
      for (let x = -1.44; x <= 1.44; x += 0.18) {
        const lace = new THREE.Mesh(
          new THREE.TorusGeometry(0.09, 0.018, 8, 18, Math.PI),
          new THREE.MeshStandardMaterial({ color: "#fffaf2", roughness: 0.94 }),
        );
        lace.position.set(x, -2.57, 1.315);
        lace.rotation.z = Math.PI;
        sewingTable.add(lace);
      }
      const machine = new THREE.Group();
      machine.position.set(0, -1.83, 0);
      sewingTable.add(machine);
      const machineMat = new THREE.MeshPhysicalMaterial({
        color: "#f1dfca",
        roughness: 0.42,
        clearcoat: 0.3,
      });
      const machineAccent = new THREE.MeshStandardMaterial({ color: "#c86f70", roughness: 0.55, metalness: 0.08 });
      const machineBase = new THREE.Mesh(new RoundedBoxGeometry(2.02, 0.18, 0.9, 5, 0.08), machineMat);
      machineBase.position.y = 0.08;
      machineBase.castShadow = true;
      machine.add(machineBase);
      const machineColumn = new THREE.Mesh(new RoundedBoxGeometry(0.54, 1.12, 0.62, 6, 0.16), machineMat);
      machineColumn.position.set(0.68, 0.68, 0);
      machineColumn.castShadow = true;
      machine.add(machineColumn);
      const machineArm = new THREE.Mesh(new RoundedBoxGeometry(1.58, 0.5, 0.62, 6, 0.16), machineMat);
      machineArm.position.set(0.02, 1.02, 0);
      machineArm.castShadow = true;
      machine.add(machineArm);
      const wheelRing = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.06, 14, 36), machineAccent);
      wheelRing.position.set(1.0, 0.8, 0);
      wheelRing.rotation.y = Math.PI / 2;
      machine.add(wheelRing);
      const needleBar = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.035, 0.75, 10),
        new THREE.MeshStandardMaterial({ color: "#9ea3a0", metalness: 0.88, roughness: 0.2 }),
      );
      needleBar.position.set(-0.6, 0.55, 0.18);
      machine.add(needleBar);
      const presserFoot = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.05, 0.22), machineAccent);
      presserFoot.position.set(-0.6, 0.19, 0.18);
      machine.add(presserFoot);
      const spool = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.28, 16), machineAccent);
      spool.position.set(0.34, 1.46, 0);
      machine.add(spool);
      const spoolPin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 0.42, 8),
        new THREE.MeshStandardMaterial({ color: "#9ea3a0", metalness: 0.8, roughness: 0.25 }),
      );
      spoolPin.position.set(0.34, 1.45, 0);
      machine.add(spoolPin);
      const fabric = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9, 0.62),
        new THREE.MeshBasicMaterial({ color: "#9cc3b5", side: THREE.DoubleSide }),
      );
      fabric.rotation.x = -Math.PI / 2;
      fabric.position.set(-0.58, 0.19, 0.18);
      machine.add(fabric);
      const sewingTools = new THREE.Group();
      sewingTools.position.set(-1.02, -1.73, 0.72);
      sewingTable.add(sewingTools);
      ["#7eafd0", "#d891a4", "#e7c05f"].forEach((color, index) => {
        const toolSpool = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 0.26, 18),
          new THREE.MeshStandardMaterial({ color, roughness: 0.68 }),
        );
        toolSpool.rotation.z = Math.PI / 2;
        toolSpool.position.set(index * 0.28, 0.08, 0);
        sewingTools.add(toolSpool);
      });
      const pinCushion = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 20, 14),
        new THREE.MeshPhysicalMaterial({ color: "#d96d74", roughness: 0.85, sheen: 0.35 }),
      );
      pinCushion.scale.set(1, 0.5, 1);
      pinCushion.position.set(0.9, 0.1, -0.03);
      sewingTools.add(pinCushion);
      [-0.09, 0, 0.09].forEach((offset, index) => {
        const pin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.009, 0.009, 0.34, 6),
          new THREE.MeshStandardMaterial({ color: "#c5c7c4", metalness: 0.76, roughness: 0.25 }),
        );
        pin.position.set(0.9 + offset, 0.3, -0.03);
        pin.rotation.z = (index - 1) * 0.2;
        sewingTools.add(pin);
      });
      const tape = new THREE.Mesh(
        new THREE.TorusGeometry(0.24, 0.045, 10, 32),
        new THREE.MeshStandardMaterial({ color: "#f0c451", roughness: 0.7 }),
      );
      tape.rotation.x = Math.PI / 2;
      tape.position.set(0.42, 0.08, 0.42);
      sewingTools.add(tape);
      const sewingScissors = new THREE.Group();
      sewingScissors.position.set(-0.15, 0.1, 0.42);
      sewingScissors.rotation.y = -0.3;
      sewingTools.add(sewingScissors);
      [-0.09, 0.09].forEach((x) => {
        const loop = new THREE.Mesh(
          new THREE.TorusGeometry(0.1, 0.028, 8, 20),
          new THREE.MeshStandardMaterial({ color: "#6f9cae", roughness: 0.54 }),
        );
        loop.position.x = x;
        loop.rotation.x = Math.PI / 2;
        sewingScissors.add(loop);
      });
      const sewingPegboard = new THREE.Group();
      sewingPegboard.position.set(8.1, 1.6, -2.82);
      sewingPegboard.userData.dragSurface = "wall";
      root.add(sewingPegboard);
      draggableRoots.push(sewingPegboard);
      const pegWood = new THREE.MeshStandardMaterial({ color: "#c49a6c", roughness: 0.92 });
      const pegPanel = new THREE.Mesh(new RoundedBoxGeometry(3.65, 6.9, 0.16, 5, 0.08), pegWood);
      pegPanel.castShadow = true;
      pegPanel.receiveShadow = true;
      sewingPegboard.add(pegPanel);
      const pegHoleMaterial = new THREE.MeshStandardMaterial({ color: "#6e503c", roughness: 1 });
      for (let row = 0; row < 15; row += 1)
        for (let column = 0; column < 8; column += 1) {
          const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.035, 10), pegHoleMaterial);
          hole.rotation.x = Math.PI / 2;
          hole.position.set(-1.47 + column * 0.42, -2.94 + row * 0.42, 0.095);
          sewingPegboard.add(hole);
        }
      [
        { width: 2.55, x: -0.28, y: -2.18 },
        { width: 1.75, x: 0.58, y: -0.3 },
        { width: 2.45, x: -0.06, y: 2.22 },
      ].forEach(({ width, x, y }) => {
        const ledge = new THREE.Mesh(
          new RoundedBoxGeometry(width, 0.13, 0.72, 4, 0.04),
          new THREE.MeshStandardMaterial({ color: "#a96f49", roughness: 0.86 }),
        );
        ledge.position.set(x, y, 0.45);
        ledge.castShadow = true;
        sewingPegboard.add(ledge);
        [-width * 0.36, width * 0.36].forEach((offset) => {
          const bracket = new THREE.Mesh(
            new RoundedBoxGeometry(0.08, 0.42, 0.08, 3, 0.025),
            new THREE.MeshStandardMaterial({ color: "#8b5b3d", roughness: 0.9 }),
          );
          bracket.position.set(x + offset, y - 0.22, 0.22);
          sewingPegboard.add(bracket);
        });
      });
      const plushMaterial = (color: string, sheenColor = color) =>
        new THREE.MeshPhysicalMaterial({
          color,
          roughness: 1,
          sheen: 0.92,
          sheenColor: new THREE.Color(sheenColor),
        });
      const plushInk = plushMaterial("#17191a", "#4b5152");
      const makePlushLimb = (
        parent: THREE.Group,
        start: THREE.Vector3,
        end: THREE.Vector3,
        radius: number,
        material: THREE.Material,
      ) => {
        const direction = end.clone().sub(start);
        const limb = new THREE.Mesh(
          new THREE.CapsuleGeometry(radius, Math.max(0.01, direction.length() - radius * 2), 5, 12),
          material,
        );
        limb.position.copy(start).add(end).multiplyScalar(0.5);
        limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
        limb.castShadow = true;
        parent.add(limb);
        return limb;
      };
      const makePlushLine = (
        parent: THREE.Group,
        points: THREE.Vector3[],
        material: THREE.Material,
        radius = 0.014,
      ) => {
        const line = new THREE.Mesh(
          new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 16, radius, 7, false),
          material,
        );
        parent.add(line);
        return line;
      };

      const blueFabric = plushMaterial("#6cb8dc", "#cbeaf5");
      const orangeFabric = plushMaterial("#f4a21d", "#ffd487");
      const whiteFabric = plushMaterial("#fffaf0", "#ffffff");
      const bluePlush = new THREE.Group();
      bluePlush.position.set(-0.66, 2.82, 0.63);
      bluePlush.rotation.y = 0.08;
      sewingPegboard.add(bluePlush);
      const blueHead = new THREE.Mesh(new THREE.SphereGeometry(0.43, 28, 22), blueFabric);
      blueHead.scale.set(1.05, 0.92, 0.72);
      blueHead.position.set(0, 0.27, 0);
      blueHead.castShadow = true;
      bluePlush.add(blueHead);
      [-1, 1].forEach((side) => {
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.28, 3), blueFabric);
        ear.position.set(side * 0.28, 0.62, -0.01);
        ear.rotation.z = side * -0.17;
        ear.rotation.y = side * 0.12;
        ear.castShadow = true;
        bluePlush.add(ear);
      });
      [-0.25, 0.25].forEach((x) => {
        const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), orangeFabric);
        cheek.scale.z = 0.38;
        cheek.position.set(x, 0.25, 0.315);
        bluePlush.add(cheek);
      });
      [-1, 1].forEach((side) => {
        makePlushLine(
          bluePlush,
          [
            new THREE.Vector3(side * 0.2, 0.4, 0.326),
            new THREE.Vector3(side * 0.11, 0.35, 0.344),
            new THREE.Vector3(side * 0.2, 0.31, 0.326),
          ],
          plushInk,
          0.018,
        );
      });
      const blueNose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 14), plushInk);
      blueNose.scale.set(1.15, 0.72, 0.5);
      blueNose.position.set(0, 0.24, 0.35);
      bluePlush.add(blueNose);
      makePlushLine(
        bluePlush,
        [new THREE.Vector3(0, 0.2, 0.35), new THREE.Vector3(0, 0.11, 0.36), new THREE.Vector3(-0.08, 0.07, 0.34)],
        plushInk,
        0.014,
      );
      makePlushLine(
        bluePlush,
        [new THREE.Vector3(0, 0.11, 0.36), new THREE.Vector3(0.08, 0.07, 0.34)],
        plushInk,
        0.014,
      );
      const tongue = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.08, 4, 10), whiteFabric);
      tongue.position.set(0, 0.005, 0.348);
      bluePlush.add(tongue);
      const blueTorso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.2, 6, 14), blueFabric);
      blueTorso.position.set(0, -0.27, 0);
      blueTorso.castShadow = true;
      bluePlush.add(blueTorso);
      makePlushLimb(bluePlush, new THREE.Vector3(-0.2, -0.15, 0.04), new THREE.Vector3(-0.055, -0.28, 0.31), 0.075, blueFabric);
      makePlushLimb(bluePlush, new THREE.Vector3(0.2, -0.15, 0.04), new THREE.Vector3(0.055, -0.28, 0.31), 0.075, blueFabric);
      makePlushLimb(bluePlush, new THREE.Vector3(-0.05, -0.43, 0), new THREE.Vector3(-0.01, -0.65, 0.02), 0.085, blueFabric);
      makePlushLine(
        bluePlush,
        [new THREE.Vector3(0.14, -0.39, -0.03), new THREE.Vector3(0.27, -0.48, -0.02), new THREE.Vector3(0.17, -0.6, 0)],
        blueFabric,
        0.065,
      );

      const yellowFabric = plushMaterial("#d7cf51", "#fff2a1");
      const finFabric = plushMaterial("#59668f", "#aab6da");
      const armFabric = plushMaterial("#dbe983", "#f4ffc4");
      const shortsFabric = plushMaterial("#70a9ad", "#b9dddc");
      const lipFabric = plushMaterial("#c8afe8", "#eee3ff");
      const yellowPlush = new THREE.Group();
      yellowPlush.position.set(0.7, 2.84, 0.62);
      yellowPlush.rotation.y = -0.08;
      sewingPegboard.add(yellowPlush);
      const yellowBody = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 8, 18), yellowFabric);
      yellowBody.scale.z = 0.7;
      yellowBody.position.y = 0.02;
      yellowBody.castShadow = true;
      yellowPlush.add(yellowBody);
      [-0.16, 0.16].forEach((x) => {
        const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), whiteFabric);
        eyeWhite.scale.set(1, 0.78, 0.4);
        eyeWhite.position.set(x, 0.29, 0.225);
        yellowPlush.add(eyeWhite);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), plushInk);
        pupil.position.set(x, 0.255, 0.278);
        yellowPlush.add(pupil);
        makePlushLine(
          yellowPlush,
          [new THREE.Vector3(x - 0.1, 0.34, 0.285), new THREE.Vector3(x, 0.315, 0.3), new THREE.Vector3(x + 0.1, 0.34, 0.285)],
          plushInk,
          0.014,
        );
      });
      [-1, 1].forEach((side) => {
        makePlushLine(
          yellowPlush,
          [new THREE.Vector3(side * 0.18, 0.48, 0.2), new THREE.Vector3(side * 0.1, 0.54, 0.21), new THREE.Vector3(side * 0.02, 0.52, 0.22)],
          plushInk,
          0.012,
        );
      });
      const upperLip = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.28, 4, 12), lipFabric);
      upperLip.rotation.z = Math.PI / 2;
      upperLip.position.set(0, 0.08, 0.29);
      upperLip.scale.y = 0.75;
      yellowPlush.add(upperLip);
      const lowerLip = upperLip.clone();
      lowerLip.position.y = 0.015;
      lowerLip.scale.set(1.08, 0.75, 1);
      yellowPlush.add(lowerLip);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.18, 18, 14), plushMaterial("#96913e", "#bbb75f"));
      belly.scale.set(1.12, 1.45, 0.28);
      belly.position.set(0, -0.25, 0.245);
      yellowPlush.add(belly);
      const plushShorts = new THREE.Mesh(new RoundedBoxGeometry(0.61, 0.25, 0.4, 5, 0.08), shortsFabric);
      plushShorts.position.set(0, -0.48, 0.02);
      yellowPlush.add(plushShorts);
      [-0.15, 0.15].forEach((x) => {
        makePlushLimb(yellowPlush, new THREE.Vector3(x, -0.54, 0), new THREE.Vector3(x, -0.66, 0.02), 0.055, yellowFabric);
      });
      makePlushLimb(yellowPlush, new THREE.Vector3(-0.28, 0.12, 0), new THREE.Vector3(-0.5, 0.28, 0.06), 0.055, armFabric);
      makePlushLimb(yellowPlush, new THREE.Vector3(-0.5, 0.28, 0.06), new THREE.Vector3(-0.54, 0.52, 0.08), 0.055, armFabric);
      makePlushLimb(yellowPlush, new THREE.Vector3(-0.54, 0.52, 0.08), new THREE.Vector3(-0.61, 0.7, 0.08), 0.032, armFabric);
      makePlushLimb(yellowPlush, new THREE.Vector3(-0.54, 0.52, 0.08), new THREE.Vector3(-0.48, 0.72, 0.08), 0.032, armFabric);
      makePlushLimb(yellowPlush, new THREE.Vector3(0.28, 0.06, 0), new THREE.Vector3(0.4, -0.28, 0.05), 0.055, armFabric);
      [0.2, 0, -0.2].forEach((y, index) => {
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.27, 5), finFabric);
        fin.position.set(0.26, y, -0.2);
        fin.rotation.z = -Math.PI / 2;
        fin.scale.set(1 - index * 0.08, 1, 0.72);
        yellowPlush.add(fin);
      });
      const lightBeam = new THREE.Mesh(
        new THREE.PlaneGeometry(4.7, 7.2),
        new THREE.MeshBasicMaterial({
          color: "#fff1b7",
          transparent: true,
          opacity: 0.065,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      lightBeam.position.set(-3.55, 0.2, 0.15);
      lightBeam.rotation.set(-0.2, 0.45, -0.42);
      scene.add(lightBeam);
      const archiveGroup = new THREE.Group();
      archiveGroup.scale.setScalar(0.46);
      archiveGroup.position.set(3.25, -0.38 + mainDeskLift, 0.08);
      root.add(archiveGroup);
      draggableRoots.push(archiveGroup);
      const folderGroups = new Map<FolderId, THREE.Group>();
      FOLDERS.forEach((folder, index) => {
        const group = new THREE.Group();
        const baseX = -1.83 + index * 1.22;
        group.position.set(baseX, 0.45, -0.02 + Math.abs(index - 1.5) * 0.08);
        group.rotation.y = (index - 1.5) * -0.025;
        group.userData.baseY = group.position.y;
        group.userData.baseRotation = group.rotation.y;
        archiveGroup.add(group);
        folderGroups.set(folder.id, group);
        // Keep the physical folder and every project end note on one palette.
        const color = FOLDER_TONES[folder.id];
        const binderMaterial = new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.34,
          clearcoat: 0.42,
          clearcoatRoughness: 0.28,
        });
        const makeBinderPart = (
          size: [number, number, number],
          position: [number, number, number],
          radius = 0.07,
        ) => {
          const mesh = new THREE.Mesh(
            new RoundedBoxGeometry(...size, 4, radius),
            binderMaterial,
          );
          mesh.position.set(...position);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          group.add(mesh);
          return mesh;
        };
        const pageBlock = addBox(
          group,
          [1.02, 4.1, 3.08],
          "#f4f0e7",
          [0, 0.04, -0.04],
          0.96,
        );
        const spine = makeBinderPart([1.17, 4.55, 0.18], [0, 0, 1.69], 0.075);
        const leftCover = makeBinderPart(
          [0.065, 4.55, 3.38],
          [-0.55, 0, 0],
          0.025,
        );
        const rightCover = makeBinderPart(
          [0.065, 4.55, 3.38],
          [0.55, 0, 0],
          0.025,
        );
        const backEdge = makeBinderPart(
          [1.17, 4.55, 0.08],
          [0, 0, -1.69],
          0.025,
        );
        [pageBlock, spine, leftCover, rightCover, backEdge].forEach((mesh) => {
          mesh.userData.folder = folder.id;
          interactive.push(mesh);
        });
        for (let pageIndex = 0; pageIndex < 9; pageIndex++) {
          const pageRidge = addBox(
            group,
            [0.96, 0.025, 0.08],
            pageIndex % 2 ? "#e4dfd5" : "#fffdf8",
            [0, 2.115, -1.48 + pageIndex * 0.37],
            0.92,
          );
          pageRidge.userData.folder = folder.id;
          interactive.push(pageRidge);
        }
        const label = new THREE.Mesh(
          new RoundedBoxGeometry(0.9, 1.55, 0.045, 4, 0.045),
          new THREE.MeshStandardMaterial({
            map: makeSpineLabelTexture(folder.cn, folder.en),
            roughness: 0.76,
          }),
        );
        label.position.set(0, 0.76, 1.79);
        label.castShadow = true;
        label.userData.folder = folder.id;
        group.add(label);
        interactive.push(label);
        const grommet = new THREE.Mesh(
          new THREE.TorusGeometry(0.16, 0.042, 12, 32),
          new THREE.MeshStandardMaterial({
            color: "#bbb9b2",
            metalness: 0.88,
            roughness: 0.22,
          }),
        );
        grommet.position.set(0, -0.3, 1.79);
        grommet.userData.folder = folder.id;
        group.add(grommet);
        interactive.push(grommet);
        const grommetHole = new THREE.Mesh(
          new THREE.CircleGeometry(0.115, 28),
          new THREE.MeshBasicMaterial({ color: "#262727" }),
        );
        grommetHole.position.set(0, -0.3, 1.795);
        grommetHole.userData.folder = folder.id;
        group.add(grommetHole);
        interactive.push(grommetHole);
      });
      const box = new THREE.Group();
      archiveGroup.add(box);
      const portfolioBoxParts = [
        addBox(box, [6.3, 2.55, 0.32], "#a77950", [0, -1.72, 1.92], 0.98),
        addBox(box, [0.28, 2.6, 3.75], "#8e603d", [-2.96, -1.58, 0.08], 0.98),
        addBox(box, [0.28, 2.6, 3.75], "#b2855f", [2.96, -1.58, 0.08], 0.98),
        addBox(box, [6.0, 0.28, 3.55], "#8f623e", [0, -2.88, 0.08], 0.98),
      ];
      portfolioBoxParts.forEach((part) => {
        part.userData.portfolio = true;
        interactive.push(part);
      });
      const handle = new THREE.Mesh(
        new THREE.TorusGeometry(0.52, 0.12, 10, 32, Math.PI),
        new THREE.MeshStandardMaterial({ color: "#5f4430", roughness: 0.85 }),
      );
      handle.position.set(2.72, -1.5, 0.62);
      handle.rotation.set(0, Math.PI / 2, Math.PI);
      box.add(handle);
      const portfolioNote = new THREE.Mesh(
        new RoundedBoxGeometry(1.55, 1.55, 0.045, 4, 0.055),
        new THREE.MeshStandardMaterial({ map: makePortfolioNoteTexture(), roughness: 0.86 }),
      );
      portfolioNote.position.set(0, -1.55, 2.11);
      portfolioNote.rotation.z = -0.025;
      portfolioNote.castShadow = true;
      portfolioNote.userData.portfolio = true;
      box.add(portfolioNote);
      interactive.push(portfolioNote);
      const noteClip = new THREE.Mesh(
        new THREE.TorusGeometry(0.17, 0.032, 10, 28, Math.PI * 1.55),
        new THREE.MeshStandardMaterial({ color: "#bab8b0", metalness: 0.9, roughness: 0.22 }),
      );
      noteClip.position.set(0.43, -0.9, 2.15);
      noteClip.rotation.z = 0.18;
      box.add(noteClip);
      const badgeRig = new THREE.Group();
      // Keep the A4 resume between the pencil cup and archive box without touching either.
      badgeRig.position.set(0.85, -1.62 + mainDeskLift, 0.95);
      badgeRig.rotation.y = -0.04;
      root.add(badgeRig);
      draggableRoots.push(badgeRig);
      const badgeGroup = new THREE.Group();
      badgeGroup.position.set(0, 0, 0);
      badgeGroup.scale.setScalar(0.93);
      badgeGroup.userData.baseY = badgeGroup.position.y;
      badgeRig.add(badgeGroup);
      const badge = addBox(
        badgeGroup,
        [1.78, 0.1, 2.52],
        "#c89b62",
        [0, 0, 0],
        0.9,
      );
      badge.userData.profile = true;
      interactive.push(badge);
      const flapShape = new THREE.Shape();
      flapShape.moveTo(-0.86, -1.23);
      flapShape.lineTo(0, 0.08);
      flapShape.lineTo(0.86, -1.23);
      flapShape.closePath();
      const envelopeFlap = new THREE.Mesh(
        new THREE.ShapeGeometry(flapShape),
        new THREE.MeshStandardMaterial({ color: "#d8ad73", roughness: 0.92, side: THREE.DoubleSide }),
      );
      envelopeFlap.rotation.x = -Math.PI / 2;
      envelopeFlap.position.y = 0.065;
      envelopeFlap.userData.profile = true;
      badgeGroup.add(envelopeFlap);
      interactive.push(envelopeFlap);
      const resumeTexture = loader.load("/portfolio/resume.jpg");
      resumeTexture.colorSpace = THREE.SRGBColorSpace;
      const resumePage = new THREE.Mesh(
        new THREE.PlaneGeometry(1.48, 2.09),
        new THREE.MeshBasicMaterial({ map: resumeTexture, side: THREE.DoubleSide }),
      );
      resumePage.rotation.x = -Math.PI / 2;
      resumePage.rotation.z = 0;
      resumePage.position.set(0, 0.085, 0.05);
      resumePage.userData.profile = true;
      badgeGroup.add(resumePage);
      interactive.push(resumePage);
      const roomRugCanvas = document.createElement("canvas");
      roomRugCanvas.width = 1024;
      roomRugCanvas.height = 640;
      const roomRugContext = roomRugCanvas.getContext("2d")!;
      roomRugContext.fillStyle = "#ece9e2";
      roomRugContext.fillRect(0, 0, roomRugCanvas.width, roomRugCanvas.height);
      const rugPatches: Array<[number, number, number, number, string, "vertical" | "horizontal" | "grid"]> = [
        [0, 0, 250, 210, "#dedbd4", "grid"],
        [250, 0, 330, 210, "#f3f0e9", "vertical"],
        [580, 0, 260, 165, "#d5d2cb", "horizontal"],
        [840, 0, 184, 220, "#ebe8e1", "grid"],
        [0, 210, 300, 240, "#d4d2cd", "vertical"],
        [300, 210, 270, 210, "#f5f2eb", "grid"],
        [570, 165, 300, 285, "#dfddd7", "vertical"],
        [870, 220, 154, 230, "#f1eee7", "horizontal"],
        [0, 450, 230, 190, "#eeebe4", "horizontal"],
        [230, 420, 360, 220, "#d9d6cf", "grid"],
        [590, 450, 240, 190, "#f4f1ea", "horizontal"],
        [830, 450, 194, 190, "#dad7d0", "vertical"],
      ];
      rugPatches.forEach(([x, y, width, height, color, weave]) => {
        roomRugContext.fillStyle = color;
        roomRugContext.fillRect(x, y, width, height);
        roomRugContext.strokeStyle = "rgba(116,111,103,.16)";
        roomRugContext.lineWidth = 1;
        const drawVertical = weave !== "horizontal";
        const drawHorizontal = weave !== "vertical";
        if (drawVertical) for (let line = x + 5; line < x + width; line += 7) {
          roomRugContext.beginPath();
          roomRugContext.moveTo(line, y);
          roomRugContext.lineTo(line, y + height);
          roomRugContext.stroke();
        }
        if (drawHorizontal) for (let line = y + 5; line < y + height; line += 7) {
          roomRugContext.beginPath();
          roomRugContext.moveTo(x, line);
          roomRugContext.lineTo(x + width, line);
          roomRugContext.stroke();
        }
        roomRugContext.strokeStyle = "rgba(255,255,255,.5)";
        roomRugContext.strokeRect(x + 1, y + 1, width - 2, height - 2);
      });
      const roomRugTexture = new THREE.CanvasTexture(roomRugCanvas);
      roomRugTexture.colorSpace = THREE.SRGBColorSpace;
      const roomRug = new THREE.Mesh(
        new RoundedBoxGeometry(21.2, 0.075, 12.2, 8, 0.24),
        new THREE.MeshPhysicalMaterial({
          map: roomRugTexture,
          color: "#ffffff",
          roughness: 0.93,
          clearcoat: 0.02,
        }),
      );
      roomRug.position.set(0, -4.39, 0.25);
      roomRug.receiveShadow = true;
      scene.add(roomRug);
      const fringeMaterial = new THREE.MeshPhysicalMaterial({
        color: "#f7f3eb",
        roughness: 1,
        sheen: 0.85,
        sheenColor: new THREE.Color("#fffdf8"),
      });
      const addRugFringe = (x: number, z: number, rotationY: number, length = 0.34) => {
        const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.026, length, 7), fringeMaterial);
        strand.rotation.z = Math.PI / 2;
        strand.rotation.y = rotationY;
        strand.position.set(x, -4.36, z);
        strand.castShadow = true;
        scene.add(strand);
      };
      for (let index = 0; index < 34; index++) {
        const x = -10.2 + (index / 33) * 20.4;
        addRugFringe(x, -5.98, 0, 0.28 + (index % 3) * 0.035);
        addRugFringe(x, 6.48, 0, 0.28 + ((index + 1) % 3) * 0.035);
      }
      for (let index = 0; index < 20; index++) {
        const z = -5.68 + (index / 19) * 11.86;
        addRugFringe(-10.72, z, Math.PI / 2, 0.28 + (index % 3) * 0.035);
        addRugFringe(10.72, z, Math.PI / 2, 0.28 + ((index + 1) % 3) * 0.035);
      }
      const floor = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 18),
        new THREE.ShadowMaterial({ transparent: true, opacity: 0.13 }),
      );
      floor.position.set(0, -4.45, 0.2);
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);

      draggableRoots.forEach((dragRoot) => {
        dragRoot.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) return;
          child.userData.dragRoot = dragRoot;
          child.userData.dragSurface = dragRoot.userData.dragSurface ?? "table";
          child.userData.dragMode = dragRoot.userData.dragMode ?? "move";
          child.userData.hoverKind = dragRoot.userData.hoverKind;
          draggableMeshes.push(child);
        });
      });
      const pickables = Array.from(new Set([...interactive, ...draggableMeshes]));

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let profileHovered = false;
      let chairHovered = false;
      let easelHovered = false;
      let hoveredFolder: FolderId | null = null;
      let drawing = false;
      let activeBrushColor = "#507fa2";
      let erasing = false;
      let lastBrushPoint: { x: number; y: number } | null = null;
      let chairSpinActive = false;
      let chairSpinRemaining = 0;
      let chairSpinVelocity = 0;
      let introComplete = false;
      let introStartedAt = 0;
      let introCompletionSent = false;
      let pointerStart: {
        x: number;
        y: number;
        object: THREE.Object3D | null;
        dragRoot: THREE.Object3D | null;
        dragPlane: THREE.Plane | null;
        dragOffset: THREE.Vector3 | null;
        dragMode: "move" | "rotate";
        startRotationY: number;
      } | null = null;
      let dragged = false;
      const updateRay = (event: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointer.set(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          -((event.clientY - rect.top) / rect.height) * 2 + 1,
        );
        raycaster.setFromCamera(pointer, camera);
      };
      const hit = (event: PointerEvent) => {
        updateRay(event);
        return (
          raycaster.intersectObjects(pickables, false)[0]?.object ?? null
        );
      };
      const projectedPhoto = (object: THREE.Object3D): Pick<PhotoTransitionOrigin, "corners" | "rect" | "aspect"> => {
        const geometry = object instanceof THREE.Mesh ? object.geometry : null;
        geometry?.computeBoundingBox();
        const bounds = geometry?.boundingBox;
        const width = bounds ? bounds.max.x - bounds.min.x : 1;
        const height = bounds ? bounds.max.y - bounds.min.y : 1;
        const localCorners = bounds
          ? [
              new THREE.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
              new THREE.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
              new THREE.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
              new THREE.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
            ]
          : [
              new THREE.Vector3(-0.5, 0.5, 0),
              new THREE.Vector3(0.5, 0.5, 0),
              new THREE.Vector3(0.5, -0.5, 0),
              new THREE.Vector3(-0.5, -0.5, 0),
            ];
        const corners = localCorners.map((corner) => {
          const point = object.localToWorld(corner.clone()).project(camera);
          return {
            x: (point.x * 0.5 + 0.5) * host.clientWidth,
            y: (-point.y * 0.5 + 0.5) * host.clientHeight,
          };
        }) as [ScreenPoint, ScreenPoint, ScreenPoint, ScreenPoint];
        const xs = corners.map((corner) => corner.x);
        const ys = corners.map((corner) => corner.y);
        const left = Math.min(...xs);
        const top = Math.min(...ys);
        const right = Math.max(...xs);
        const bottom = Math.max(...ys);
        return {
          corners,
          rect: { left, top, width: right - left, height: bottom - top },
          aspect: width / Math.max(height, 0.001),
        };
      };
      const paintAt = (event: PointerEvent) => {
        updateRay(event);
        const intersection = raycaster.intersectObject(art, false)[0];
        if (!intersection?.uv) return;
        const point = {
          x: intersection.uv.x * artCanvas.width,
          y: (1 - intersection.uv.y) * artCanvas.height,
        };
        artCtx.lineCap = "round";
        artCtx.lineJoin = "round";
        artCtx.strokeStyle = erasing ? "#fffdf7" : activeBrushColor;
        artCtx.lineWidth = erasing ? 72 : 24;
        artCtx.globalAlpha = erasing ? 1 : 0.88;
        artCtx.beginPath();
        if (lastBrushPoint) artCtx.moveTo(lastBrushPoint.x, lastBrushPoint.y);
        else artCtx.moveTo(point.x, point.y);
        artCtx.lineTo(point.x, point.y);
        artCtx.stroke();
        artCtx.globalAlpha = 1;
        lastBrushPoint = point;
        artTexture.needsUpdate = true;
      };
      const move = (event: PointerEvent) => {
        if (!introComplete) {
          renderer.domElement.style.cursor = "default";
          return;
        }
        if (interactionLockedRef.current) {
          renderer.domElement.style.cursor = "wait";
          return;
        }
        if (drawing) {
          paintAt(event);
          renderer.domElement.style.cursor = "crosshair";
          return;
        }
        if (pointerStart) {
          if (
            Math.hypot(
              event.clientX - pointerStart.x,
              event.clientY - pointerStart.y,
            ) > 5
          )
            dragged = true;
          if (dragged && pointerStart.dragRoot && pointerStart.dragMode === "rotate") {
            pointerStart.dragRoot.rotation.y =
              pointerStart.startRotationY + (event.clientX - pointerStart.x) * 0.012;
          } else if (
            dragged &&
            pointerStart.dragRoot &&
            pointerStart.dragPlane &&
            pointerStart.dragOffset
          ) {
            updateRay(event);
            const point = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(pointerStart.dragPlane, point)) {
              const next = point.sub(pointerStart.dragOffset);
              if (pointerStart.object?.userData.dragSurface === "wall") {
                pointerStart.dragRoot.position.x = THREE.MathUtils.clamp(
                  next.x,
                  -8.4,
                  8.4,
                );
                pointerStart.dragRoot.position.y = THREE.MathUtils.clamp(
                  next.y,
                  -0.45,
                  5.1,
                );
              } else {
                const bounds = pointerStart.dragRoot.userData.dragBounds ?? {
                  minX: -5.65,
                  maxX: 5.65,
                  minZ: -2.55,
                  maxZ: 2.7,
                };
                pointerStart.dragRoot.position.x = THREE.MathUtils.clamp(
                  next.x,
                  bounds.minX,
                  bounds.maxX,
                );
                pointerStart.dragRoot.position.z = THREE.MathUtils.clamp(
                  next.z,
                  bounds.minZ,
                  bounds.maxZ,
                );
              }
            }
          }
          renderer.domElement.style.cursor = "grabbing";
          return;
        }
        const object = hit(event);
        profileHovered = Boolean(object?.userData.profile);
        hoveredFolder = focusRef.current?.kind === "portfolio"
          ? (object?.userData.folder as FolderId | undefined) ?? null
          : null;
        easelHovered = object?.userData.hoverKind === "easel";
        const nextChairHovered = object?.userData.hoverKind === "chair";
        if (nextChairHovered && !chairHovered && !reducedMotion) {
          chairSpinRemaining = Math.PI * 2;
          chairSpinActive = true;
        }
        chairHovered = nextChairHovered;
        const folderLabel = hoveredFolder
          ? FOLDERS.find((folder) => folder.id === hoveredFolder)?.cn
          : null;
        const hintText = folderLabel
          ? focusRef.current?.kind === "portfolio"
            ? `点击打开 · ${folderLabel}`
            : "点击聚焦作品集"
          : object?.userData.hoverKind === "photoWall"
            ? "点击查看摄影图集"
            : object?.userData.monitor
              ? "点击在电脑中输入文字"
              : object?.userData.portfolio
                ? "点击聚焦作品集"
              : "";
        actionHint.textContent = hintText;
        actionHint.classList.toggle("visible", Boolean(hintText));
        const actionable = Boolean(
            object?.userData.folder ||
            object?.userData.portfolio ||
            object?.userData.profile ||
            object?.userData.monitor ||
            object?.userData.photoProjectId ||
            object?.userData.hoverKind === "photoWall" ||
            object?.userData.hoverKind === "easel" ||
            object?.userData.drawer !== undefined ||
            object?.userData.curtain ||
            object?.userData.lampPull ||
            object?.userData.brushColor ||
            object?.userData.eraser,
        );
        renderer.domElement.style.cursor = focusRef.current?.kind === "easel" && object?.userData.easelCanvas
          ? "crosshair"
          : freeViewRef.current && object?.userData.dragRoot
          ? object.userData.dragMode === "rotate" ? "ew-resize" : "move"
          : actionable
            ? "pointer"
            : freeViewRef.current
              ? "grab"
              : "default";
      };
      const leave = () => {
        if (pointerStart) return;
        profileHovered = false;
        chairHovered = false;
        easelHovered = false;
        hoveredFolder = null;
        actionHint.classList.remove("visible");
        pointer.set(0, 0);
        renderer.domElement.style.cursor = freeViewRef.current ? "grab" : "default";
      };
      const down = (event: PointerEvent) => {
        if (!introComplete) return;
        if (interactionLockedRef.current) return;
        const object = hit(event);
        if (focusRef.current?.kind === "easel" && object?.userData.easelCanvas) {
          drawing = true;
          lastBrushPoint = null;
          controls.enabled = false;
          renderer.domElement.setPointerCapture?.(event.pointerId);
          paintAt(event);
          return;
        }
        const wallLocked = focusRef.current?.kind === "photoWall" && object?.userData.hoverKind === "photoWall";
        const isDirectControl = Boolean(
          object?.userData.lampPull || object?.userData.easelCanvas || object?.userData.brushColor || object?.userData.eraser,
        );
        const dragRoot = wallLocked || isDirectControl || !freeViewRef.current
          ? null
          : (object?.userData.dragRoot as THREE.Object3D) ?? null;
        const dragSurface = object?.userData.dragSurface ?? "table";
        const dragMode = object?.userData.dragMode === "rotate" ? "rotate" : "move";
        if (dragMode === "rotate") chairSpinActive = false;
        const dragPlane = dragRoot
          ? new THREE.Plane(
              dragSurface === "wall"
                ? new THREE.Vector3(0, 0, 1)
                : new THREE.Vector3(0, 1, 0),
              dragSurface === "wall"
                ? -dragRoot.position.z
                : -dragRoot.position.y,
            )
          : null;
        const dragPoint = new THREE.Vector3();
        const dragOffset =
          dragRoot && dragPlane && raycaster.ray.intersectPlane(dragPlane, dragPoint)
            ? dragPoint.sub(dragRoot.position)
            : null;
        pointerStart = {
          x: event.clientX,
          y: event.clientY,
          object,
          dragRoot,
          dragPlane,
          dragOffset,
          dragMode,
          startRotationY: dragRoot?.rotation.y ?? 0,
        };
        dragged = false;
        if (dragRoot) controls.enabled = false;
        renderer.domElement.setPointerCapture?.(event.pointerId);
        renderer.domElement.style.cursor = "grabbing";
      };
      const up = (event: PointerEvent) => {
        if (!introComplete) return;
        if (interactionLockedRef.current) return;
        if (drawing) {
          drawing = false;
          lastBrushPoint = null;
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          renderer.domElement.style.cursor = "crosshair";
          return;
        }
        const target = hit(event);
        const start = pointerStart;
        pointerStart = null;
        controls.enabled = freeViewRef.current;
        renderer.domElement.releasePointerCapture?.(event.pointerId);
        renderer.domElement.style.cursor = freeViewRef.current && target?.userData.dragRoot
          ? target.userData.dragMode === "rotate" ? "ew-resize" : "move"
          : target
            ? "pointer"
            : freeViewRef.current
              ? "grab"
              : "default";
        if (start?.object?.userData.lampPull) {
          lampOn = !lampOn;
          return;
        }
        if (!start || dragged || target !== start.object) return;
        if (target?.userData.folder) {
          const id = target.userData.folder as FolderId;
          if (focusRef.current?.kind === "portfolio") folderOpenRef.current(id);
          else focusChangeRef.current({ kind: "portfolio" });
        }
        else if (target?.userData.portfolio) focusChangeRef.current({ kind: "portfolio" });
        else if (target?.userData.profile) profileOpenRef.current();
        else if (target?.userData.brushColor) {
          activeBrushColor = target.userData.brushColor as string;
          erasing = false;
          focusChangeRef.current({ kind: "easel" });
        }
        else if (target?.userData.eraser) {
          erasing = true;
          focusChangeRef.current({ kind: "easel" });
        }
        else if (target?.userData.easelCanvas || target?.userData.hoverKind === "easel")
          focusChangeRef.current({ kind: "easel" });
        else if (target?.userData.photoProjectId) {
          if (focusRef.current?.kind !== "photoWall")
            focusChangeRef.current({ kind: "photoWall" });
          else {
            const projection = projectedPhoto(target);
            photoOpenRef.current({
              projectId: target.userData.photoProjectId as string,
              src: target.userData.photoSrc as string,
              frameId: `wall-${target.userData.photoProjectId as string}`,
              ...projection,
            });
          }
        }
        else if (target?.userData.hoverKind === "photoWall")
          focusChangeRef.current({ kind: "photoWall" });
        else if (target?.userData.monitor) {
          focusChangeRef.current({ kind: "computer" });
          monitorInput.classList.add("visible");
          monitorInput.focus();
          monitorInput.select();
        }
        else if (typeof target?.userData.drawer === "number") {
          const index = target.userData.drawer as number;
          drawerOpen[index] = !drawerOpen[index];
        }
        else if (target?.userData.curtain) curtainClosed = !curtainClosed;
      };
      renderer.domElement.addEventListener("pointermove", move);
      renderer.domElement.addEventListener("pointerleave", leave);
      renderer.domElement.addEventListener("pointerdown", down);
      renderer.domElement.addEventListener("pointerup", up);
      renderer.domElement.addEventListener("pointercancel", up);
      const resize = () => {
        const width = host.clientWidth,
          height = host.clientHeight;
        renderer.setSize(width, height, false);
        camera.aspect = width / Math.max(height, 1);
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", resize);
      resize();
      let frame = 0;
      let last = performance.now();
      let previousZoom = zoomRef.current;
      let previousReset = resetRef.current;
      let activeFolderFocus: FolderId | null = null;
      let activePortfolioFocus = false;
      let activeWallFocus = false;
      let activeEaselFocus = false;
      let activeComputerFocus = false;
      let returningFromFolder = false;
      const returnCamera = initialCamera.clone();
      const returnTarget = controls.target.clone();
      const defaultTarget = controls.target.clone();
      const introTargetStart = new THREE.Vector3(0.35, 0.5, -0.25);
      const folderWorld = new THREE.Vector3();
      const cameraGoal = new THREE.Vector3();
      const targetGoal = new THREE.Vector3();
      const easelNormal = new THREE.Vector3();
      const easelQuaternion = new THREE.Quaternion();
      const previousMouseCursor = new THREE.Vector2(-1, -1);
      const dampVector = (value: THREE.Vector3, goal: THREE.Vector3, speed: number, dt: number) => {
        value.set(
          THREE.MathUtils.damp(value.x, goal.x, speed, dt),
          THREE.MathUtils.damp(value.y, goal.y, speed, dt),
          THREE.MathUtils.damp(value.z, goal.z, speed, dt),
        );
      };
      const animate = () => {
        const now = performance.now();
        const delta = Math.min((now - last) / 1000, 0.05);
        last = now;
        const current = focusRef.current?.kind === "folder" ? focusRef.current.id : null;
        const portfolioFocused = focusRef.current?.kind === "portfolio";
        const photoWallFocused = focusRef.current?.kind === "photoWall";
        const easelFocused = focusRef.current?.kind === "easel";
        const computerFocused = focusRef.current?.kind === "computer";
        monitorInput.classList.toggle("visible", computerFocused);
        easelRug.position.x = THREE.MathUtils.damp(easelRug.position.x, easel.position.x, 1.4, delta);
        easelRug.position.z = THREE.MathUtils.damp(easelRug.position.z, easel.position.z, 1.4, delta);
        const monitorCursor = new THREE.Vector2(
          THREE.MathUtils.clamp((mouse.position.x + 1.2) / 1.75, 0, 1),
          THREE.MathUtils.clamp((mouse.position.z - 0.85) / 1.7, 0, 1),
        );
        if (monitorCursor.distanceTo(previousMouseCursor) > 0.004) {
          monitorDisplay.render(monitorInput.value, {
            x: monitorCursor.x,
            y: monitorCursor.y,
          });
          previousMouseCursor.copy(monitorCursor);
        }
        folderGroups.forEach((group, id) => {
          const active = id === current;
          const hovered = id === hoveredFolder;
          const target = group.userData.baseY + (active ? 0.44 : hovered ? 0.32 : 0);
          group.position.y = THREE.MathUtils.damp(
            group.position.y,
            target,
            1.18,
            delta,
          );
          group.rotation.y = THREE.MathUtils.damp(
            group.rotation.y,
            active || hovered ? 0 : group.userData.baseRotation,
            1.18,
            delta,
          );
        });
        if (chairSpinActive) {
          chairSpinVelocity = THREE.MathUtils.damp(
            chairSpinVelocity,
            chairHovered ? 0.92 : 0,
            chairHovered ? 2.8 : 1.15,
            delta,
          );
          const chairStep = Math.min(chairSpinVelocity * delta, chairSpinRemaining);
          chairUpper.rotation.y += chairStep;
          chairSpinRemaining -= chairStep;
          if (chairSpinRemaining <= 0.001 || (!chairHovered && chairSpinVelocity < 0.01)) {
            chairSpinActive = false;
            chairSpinVelocity = 0;
          }
        }
        drawerGroups.forEach((drawer, index) => {
          const target = drawerOpen[index] ? 0.92 : 0;
          drawer.position.z = reducedMotion
            ? target
            : THREE.MathUtils.damp(drawer.position.z, target, 9, delta);
        });
        badgeGroup.position.y = THREE.MathUtils.damp(
          badgeGroup.position.y,
          badgeGroup.userData.baseY + (profileHovered ? 0.08 : 0),
          1.45,
          delta,
        );
        badgeGroup.rotation.z = THREE.MathUtils.damp(
          badgeGroup.rotation.z,
          profileHovered ? -0.02 : -0.08,
          1.45,
          delta,
        );
        const badgeScale = THREE.MathUtils.damp(
          badgeGroup.scale.x,
          profileHovered ? 1.15 : 0.93,
          1.45,
          delta,
        );
        badgeGroup.scale.setScalar(badgeScale);
        const badgeHintPoint = new THREE.Vector3();
        badgeGroup.getWorldPosition(badgeHintPoint);
        badgeHintPoint.add(new THREE.Vector3(-0.72, 1.08, 0));
        badgeHintPoint.project(camera);
        badgeHint.style.left = `${(badgeHintPoint.x * 0.5 + 0.5) * host.clientWidth}px`;
        badgeHint.style.top = `${(-badgeHintPoint.y * 0.5 + 0.5) * host.clientHeight}px`;
        badgeHint.classList.toggle("visible", profileHovered);
        const easelHintPoint = new THREE.Vector3();
        easelCanvas.getWorldPosition(easelHintPoint);
        easelHintPoint.add(new THREE.Vector3(0, 1.42, 0));
        easelHintPoint.project(camera);
        easelHint.style.left = `${(easelHintPoint.x * 0.5 + 0.5) * host.clientWidth}px`;
        easelHint.style.top = `${(-easelHintPoint.y * 0.5 + 0.5) * host.clientHeight}px`;
        easelHint.classList.toggle("visible", easelHovered && !easelFocused);
        const lightMotion = reducedMotion ? 0 : Math.sin(now * 0.00035);
        key.intensity = THREE.MathUtils.damp(
          key.intensity,
          curtainClosed ? 1.12 : 3.45 + lightMotion * 0.28,
          2.8,
          delta,
        );
        sunlight.intensity = THREE.MathUtils.damp(
          sunlight.intensity,
          curtainClosed ? 0.72 : 6 + (reducedMotion ? 0 : Math.sin(now * 0.00048 + 0.8) * 0.5),
          2.8,
          delta,
        );
        ambientLight.intensity = THREE.MathUtils.damp(
          ambientLight.intensity,
          curtainClosed ? 1.18 : 2.28,
          2.8,
          delta,
        );
        windowGlow.intensity = THREE.MathUtils.damp(
          windowGlow.intensity,
          curtainClosed ? 0.36 : 3.1,
          2.8,
          delta,
        );
        lightBeam.material.opacity = THREE.MathUtils.damp(
          lightBeam.material.opacity,
          curtainClosed ? 0.008 : 0.07 + (reducedMotion ? 0 : Math.sin(now * 0.00042) * 0.014),
          2.8,
          delta,
        );
        curtainPanels.forEach((panel, index) => {
          const side = index === 0 ? -1 : 1;
          panel.scale.x = THREE.MathUtils.damp(panel.scale.x, curtainClosed ? 0.98 : 0.28, 3.4, delta);
          panel.position.x = THREE.MathUtils.damp(
            panel.position.x,
            curtainClosed ? (side < 0 ? -5.49 : -3.81) : (side < 0 ? -6.09 : -3.21),
            3.4,
            delta,
          );
        });
        curtainTies.forEach((tie) => {
          const tieScale = THREE.MathUtils.damp(tie.scale.x, curtainClosed ? 0.05 : 1, 5, delta);
          tie.scale.setScalar(tieScale);
        });
        lampLight.intensity = THREE.MathUtils.damp(
          lampLight.intensity,
          lampOn ? 13 : 0,
          10,
          delta,
        );
        bulbMaterial.emissiveIntensity = THREE.MathUtils.damp(
          bulbMaterial.emissiveIntensity,
          lampOn ? 2.4 : 0.03,
          10,
          delta,
        );
        if (portfolioFocused) {
          if (!activePortfolioFocus) {
            returnCamera.copy(camera.position);
            returnTarget.copy(controls.target);
          }
          activePortfolioFocus = true;
          activeFolderFocus = null;
          activeWallFocus = false;
          activeEaselFocus = false;
          activeComputerFocus = false;
          returningFromFolder = false;
          archiveGroup.getWorldPosition(folderWorld);
          targetGoal.copy(folderWorld).add(new THREE.Vector3(0, 0.22, 0.55));
          cameraGoal.copy(targetGoal).add(new THREE.Vector3(0, 0.22, 5.1));
          controls.minDistance = 4.2;
          controls.enabled = false;
          dampVector(controls.target, targetGoal, 2, delta);
          dampVector(camera.position, cameraGoal, 2, delta);
        } else if (current) {
          if (!activeFolderFocus) {
            returnCamera.copy(camera.position);
            returnTarget.copy(controls.target);
          }
          activeFolderFocus = current;
          activePortfolioFocus = false;
          activeWallFocus = false;
          activeEaselFocus = false;
          activeComputerFocus = false;
          returningFromFolder = false;
          archiveGroup.getWorldPosition(folderWorld);
          targetGoal.copy(folderWorld).add(new THREE.Vector3(0, 0.18, 0.62));
          cameraGoal.copy(targetGoal).add(new THREE.Vector3(0, 0, 3.95));
          controls.minDistance = 3.2;
          controls.enabled = false;
          dampVector(controls.target, targetGoal, 2, delta);
          dampVector(camera.position, cameraGoal, 2, delta);
        } else if (photoWallFocused) {
          if (!activeWallFocus) {
            returnCamera.copy(camera.position);
            returnTarget.copy(controls.target);
          }
          activeFolderFocus = null;
          activePortfolioFocus = false;
          activeWallFocus = true;
          activeEaselFocus = false;
          activeComputerFocus = false;
          returningFromFolder = false;
          targetGoal.set(1.55, 2.36, -3.02);
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const fitHeight = 5.88 / (2 * Math.tan(verticalFov / 2));
          const fitWidth = 8.95 / (2 * Math.tan(verticalFov / 2) * camera.aspect);
          const wallDistance = Math.max(fitHeight, fitWidth) + 0.45;
          cameraGoal.copy(targetGoal).add(new THREE.Vector3(0, 0, wallDistance));
          controls.minDistance = Math.max(4.2, wallDistance - 0.35);
          controls.enabled = false;
          dampVector(controls.target, targetGoal, 2, delta);
          dampVector(camera.position, cameraGoal, 2, delta);
        } else if (easelFocused) {
          if (!activeEaselFocus) {
            returnCamera.copy(camera.position);
            returnTarget.copy(controls.target);
          }
          activeFolderFocus = null;
          activePortfolioFocus = false;
          activeWallFocus = false;
          activeEaselFocus = true;
          activeComputerFocus = false;
          returningFromFolder = false;
          art.getWorldPosition(targetGoal);
          art.getWorldQuaternion(easelQuaternion);
          easelNormal.set(0, 0, 1).applyQuaternion(easelQuaternion).normalize();
          cameraGoal.copy(targetGoal).addScaledVector(easelNormal, 3.15);
          controls.minDistance = 2.8;
          controls.enabled = false;
          dampVector(controls.target, targetGoal, 2, delta);
          dampVector(camera.position, cameraGoal, 2, delta);
        } else if (computerFocused) {
          if (!activeComputerFocus) {
            returnCamera.copy(camera.position);
            returnTarget.copy(controls.target);
          }
          activeFolderFocus = null;
          activePortfolioFocus = false;
          activeWallFocus = false;
          activeEaselFocus = false;
          activeComputerFocus = true;
          returningFromFolder = false;
          monitor.getWorldPosition(targetGoal);
          targetGoal.add(new THREE.Vector3(0, 0.35, 0.4));
          cameraGoal.copy(targetGoal).add(new THREE.Vector3(0, 0.15, 5.15));
          controls.minDistance = 4.2;
          controls.enabled = false;
          dampVector(controls.target, targetGoal, 2, delta);
          dampVector(camera.position, cameraGoal, 2, delta);
        } else {
          if (activeFolderFocus || activePortfolioFocus || activeWallFocus || activeEaselFocus || activeComputerFocus) {
            activeFolderFocus = null;
            activePortfolioFocus = false;
            activeWallFocus = false;
            activeEaselFocus = false;
            activeComputerFocus = false;
            returningFromFolder = true;
          }
          controls.minDistance = 9.4;
          controls.enabled = freeViewRef.current && !pointerStart?.dragRoot;
          if (returningFromFolder) {
            dampVector(controls.target, returnTarget, 2.3, delta);
            dampVector(camera.position, returnCamera, 2.3, delta);
            if (
              camera.position.distanceTo(returnCamera) < 0.035 &&
              controls.target.distanceTo(returnTarget) < 0.02
            ) returningFromFolder = false;
          }
        }
        if (!current && !portfolioFocused && !photoWallFocused && !easelFocused && !computerFocused && previousZoom !== zoomRef.current) {
          const direction = camera.position.clone().sub(controls.target);
          direction.setLength(
            THREE.MathUtils.clamp(
              (direction.length() * previousZoom) / zoomRef.current,
              controls.minDistance,
              controls.maxDistance,
            ),
          );
          camera.position.copy(controls.target).add(direction);
          previousZoom = zoomRef.current;
        }
        if (previousReset !== resetRef.current) {
          camera.position.copy(initialCamera);
          controls.target.set(0.35, -0.1, -0.25);
          activeFolderFocus = null;
          activePortfolioFocus = false;
          activeWallFocus = false;
          activeEaselFocus = false;
          activeComputerFocus = false;
          returningFromFolder = false;
          controls.update();
          previousReset = resetRef.current;
          previousZoom = zoomRef.current;
        }
        if (current || portfolioFocused || photoWallFocused || easelFocused || computerFocused || returningFromFolder) camera.lookAt(controls.target);
        else {
          // Fixed mode preserves the composed hero angle; free mode removes
          // horizontal stops so mouse/touch dragging can orbit through 360°.
          controls.minAzimuthAngle = freeViewRef.current ? -Infinity : -0.94;
          controls.maxAzimuthAngle = freeViewRef.current ? Infinity : 0.58;
          controls.update();
        }
        if (!introComplete) {
          controls.enabled = false;
          if (!introReadyRef.current) {
            camera.position.copy(introCameraStart);
            controls.target.copy(introTargetStart);
          } else if (reducedMotion) {
            camera.position.copy(initialCamera);
            controls.target.copy(defaultTarget);
            introComplete = true;
          } else {
            if (!introStartedAt) introStartedAt = now;
            const progress = THREE.MathUtils.clamp((now - introStartedAt) / 2400, 0, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            camera.position.lerpVectors(introCameraStart, initialCamera, eased);
            controls.target.lerpVectors(introTargetStart, defaultTarget, eased);
            if (progress >= 1) introComplete = true;
          }
          if (introComplete) {
            controls.maxDistance = 24;
            controls.enabled = freeViewRef.current;
            if (!introCompletionSent) {
              introCompletionSent = true;
              introCompleteRef.current();
            }
          }
          camera.lookAt(controls.target);
        }
        renderer.render(scene, camera);
        frame = requestAnimationFrame(animate);
      };
      animate();
      cleanup = () => {
        cancelAnimationFrame(frame);
        controls.dispose();
        window.removeEventListener("resize", resize);
        renderer.domElement.removeEventListener("pointermove", move);
        renderer.domElement.removeEventListener("pointerleave", leave);
        renderer.domElement.removeEventListener("pointerdown", down);
        renderer.domElement.removeEventListener("pointerup", up);
        renderer.domElement.removeEventListener("pointercancel", up);
        scene.traverse((object) => {
          if (object instanceof THREE.Mesh) {
            object.geometry.dispose();
            const materials = Array.isArray(object.material)
              ? object.material
              : [object.material];
            materials.forEach((material) => {
              if ("map" in material && material.map) material.map.dispose();
              material.dispose();
            });
          }
        });
        renderer.dispose();
        renderer.domElement.remove();
        badgeHint.remove();
        easelHint.remove();
        actionHint.remove();
        window.clearInterval(calendarTimer);
        monitorInput.removeEventListener("input", updateMonitorText);
        monitorInput.remove();
      };
    };
    void setup();
    return () => {
      cancelled = true;
      cleanup();
    };
  }, []);
  return <div className="three-host" ref={hostRef} />;
}

function StaticDesk({
  sceneFocus,
  onFolderClick,
  onFocusChange,
  onOpenPhotoProject,
  onOpenProfile,
  interactionLocked,
}: {
  sceneFocus: SceneFocus;
  onFolderClick: (id: FolderId) => void;
  onFocusChange: (focus: SceneFocus) => void;
  onOpenPhotoProject: (spec: PhotoTransitionOrigin) => void;
  onOpenProfile: () => void;
  interactionLocked: boolean;
}) {
  return (
    <div className="static-desk" aria-label="静态桌面个人空间视图">
      <div className="static-room">
        <i />
        <i />
        <i />
      </div>
      <div className="static-room-rug" aria-hidden="true" />
      <div className="static-monitor">
        <b>欢迎光临</b>
        <span>邓海玲的空间</span>
      </div>
      <div className="static-folders">
        {FOLDERS.map((folder, index) => (
          <button
            key={folder.id}
            style={
              {
                "--folder": FOLDER_TONES[folder.id],
                "--order": index,
              } as React.CSSProperties
            }
            className={sceneFocus?.kind === "portfolio" ? "focused" : ""}
            onClick={() => {
              onFolderClick(folder.id);
            }}
          >
            <i />
            <span>{folder.en}</span>
            <strong>{folder.cn}</strong>
          </button>
        ))}
      </div>
      <div className={`static-photo-wall ${sceneFocus?.kind === "photoWall" ? "focused" : ""}`}>
        <button
          className="static-photo-wall-trigger"
          onClick={() => onFocusChange({ kind: "photoWall" })}
          aria-label="打开摄影图集软木板"
        >
          <strong>摄影图集</strong>
        </button>
        {sceneFocus?.kind === "photoWall" && PHOTO_ARCHIVE_CATEGORIES.map((region) => (
          <button
            key={region.id}
            className="static-photo-thumb"
            aria-label={`打开${region.title}摄影图集`}
            disabled={interactionLocked}
            onClick={(event) => {
              event.stopPropagation();
              const rect = event.currentTarget.getBoundingClientRect();
              onOpenPhotoProject({
                projectId: region.id,
                src: region.src,
                frameId: `static-wall-${region.id}`,
                corners: rectCorners({ left: rect.left, top: rect.top, width: rect.width, height: rect.height }),
                rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                aspect: rect.width / Math.max(rect.height, 1),
              });
            }}
          >
            <img src={region.src} alt={`${region.title}摄影图集封面`} />
            <span>{region.title}</span>
          </button>
        ))}
      </div>
      <div className="static-table">
        <button className="static-badge static-resume-envelope" onClick={onOpenProfile}>
          <img src="/portfolio/resume.jpg" alt="邓海玲简历首页" />
          <span>
            <b>个人档案</b>
            <small>点击查看完整简历</small>
          </span>
        </button>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const cardRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const card = cardRef.current;
    card?.querySelector<HTMLElement>("button, a")?.focus();
    document.body.classList.add("modal-open");
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab" && card) {
        const items = [
          ...card.querySelectorAll<HTMLElement>(
            "button:not([disabled]), a[href]",
          ),
        ];
        if (!items.length) return;
        const first = items[0],
          last = items.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("modal-open");
      previous?.focus?.();
    };
  }, [onClose]);
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        ref={cardRef}
        className={`modal-card ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <button className="modal-close" onClick={onClose} aria-label="关闭">
          ×
        </button>
        {children}
      </section>
    </div>
  );
}

function ProfilePanel() {
  const [copied, setCopied] = useState("");
  const copy = async (value: string, label: string) => {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  };
  const resumeImageOnly = true;
  if (resumeImageOnly)
    return (
      <div className="resume-image-panel">
        <img src="/portfolio/resume.jpg" alt="邓海玲个人简历" />
      </div>
    );
  return (
    <div className="profile-panel profile-waterfall">
      <header>
        <span>IDENTIFICATION · FUZHOU UNIVERSITY</span>
        <b>向下滑动浏览完整个人简介 ↓</b>
      </header>
      <div className="profile-waterfall-content">
        <section className="profile-sheet profile-sheet-one profile-waterfall-section">
          <div className="profile-identity-compact">
            <div className="profile-photo"><img src="/portfolio/portrait.webp" alt="邓海玲个人照片" /></div>
            <div>
              <p>ABOUT ME / 个人档案</p><h2>邓海玲</h2>
              <span>{PROFILE.location} · {PROFILE.birthday}</span>
              <span>{PROFILE.major}</span>
            </div>
          </div>
          <div className="profile-education-compact">
            <h3>教育经历</h3>
            {PROFILE.educationHistory.map((item) => (
              <article key={item.date}><time>{item.date}</time><b>{item.school}</b><span>{item.degree}</span></article>
            ))}
            <p><b>主修</b>{PROFILE.courses.join(" · ")}</p><p><b>排名</b>{PROFILE.ranking}</p>
          </div>
          <div className="profile-experience-compact">
            <h3>实习经历 / INTERNSHIP</h3>
            {PROFILE.experience.map((item) => (
              <article key={item.date}>
                <header><time>{item.date}</time><b>{item.company}</b><span>{item.role}</span></header>
                <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>
        <section className="profile-sheet profile-sheet-two profile-waterfall-section">
          <div className="profile-campus-compact">
            <h3>校内实践与获奖</h3>
            <article><time>{PROFILE.campusPractice.date}</time><b>{PROFILE.campusPractice.school}</b><span>{PROFILE.campusPractice.role}</span></article>
            <ul>{PROFILE.campusPractice.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>
            <ol>{PROFILE.awards.map((award) => <li key={award}>{award}</li>)}</ol>
          </div>
          <div className="profile-more-compact">
            <h3>兴趣与技能证书</h3>
            <div>{PROFILE.interests.map((interest) => <span key={interest}>{interest}</span>)}</div>
            <ul>{PROFILE.qualifications.map((item) => <li key={item}>{item}</li>)}</ul>
          </div>
          <div className="profile-skills-compact">
            <h3>设计技能 / SKILLS</h3>
            <div>{SKILLS.map((skill) => (
              <article key={skill.no} style={{ "--skill": skill.color } as React.CSSProperties}>
                <b>{skill.cn}</b><span>{skill.desc}</span><small>{skill.tools.join(" · ")}</small>
              </article>
            ))}</div>
          </div>
          <div className="profile-contact-compact">
            <h3>保持联系</h3>
            <p><b>{PROFILE.phone}</b><button onClick={() => copy(PROFILE.phone, "电话")}>复制电话</button></p>
            <p><b>{PROFILE.email}</b><button onClick={() => copy(PROFILE.email, "邮箱")}>复制邮箱</button></p>
            <a href={`mailto:${PROFILE.email}?subject=${encodeURIComponent("作品集交流 · 邓海玲")}`}>发送邮件 ↗</a>
            <i aria-live="polite">{copied ? `已复制${copied}` : ""}</i>
          </div>
        </section>
      </div>
    </div>
  );
}

function AllWorksPanel() {
  const [selected, setSelected] = useState<Project | null>(null);
  if (selected)
    return (
      <Gallery
        project={selected}
        projects={PROJECTS.filter((item) => item.folder === selected.folder)}
        onBack={() => setSelected(null)}
        onSelectProject={setSelected}
      />
    );
  return (
    <div className="all-works-panel">
      <header>
        <small>PORTFOLIO 2026 · COMPLETE ARCHIVE</small>
        <h2>全部作品集</h2>
        <p>四个文件夹 · {PROJECTS.length} 个项目 · 点击任意封面查看完整内容</p>
      </header>
      <div className="all-works-scroll">
        {FOLDERS.map((folder, folderIndex) => (
          <section key={folder.id} style={{ "--folder": FOLDER_TONES[folder.id] } as React.CSSProperties}>
            <div>
              <span>0{folderIndex + 1}</span>
              <small>{folder.en}</small>
              <h3>{folder.cn}</h3>
            </div>
            <div className="all-work-grid">
              {PROJECTS.filter((project) => project.folder === folder.id).map((project, index) => (
                <button key={project.id} onClick={() => setSelected(project)} className="all-work-card">
                  <div>
                    <img
                      src={project.cover}
                      alt={`${project.title}项目封面`}
                      loading="lazy"
                      decoding="async"
                      style={{
                        objectPosition: `${PROJECT_COVER_FOCUS[project.id]?.x ?? "50%"} ${PROJECT_COVER_FOCUS[project.id]?.y ?? "50%"}`,
                        transform: `scale(${PROJECT_COVER_FOCUS[project.id]?.scale ?? 1})`,
                      }}
                    />
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <small>{project.en}</small>
                  <strong>{project.title}</strong>
                  <p>{project.summary}</p>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function Gallery({
  project,
  projects,
  onBack,
  onSelectProject,
}: {
  project: Project;
  projects: Project[];
  onBack: () => void;
  onSelectProject: (project: Project) => void;
}) {
  const slides = useMemo(() => slidesFor(project), [project]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLElement>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const projectIndex = projects.findIndex((item) => item.id === project.id);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    requestAnimationFrame(() => setCurrentPage(1));
    if (progressRef.current) progressRef.current.style.width = "0%";
  }, [project.id]);

  const updateReadingProgress = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const maxScroll = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    const ratio = scroller.scrollTop / maxScroll;
    setCurrentPage(Math.min(slides.length, Math.floor(ratio * slides.length) + 1));
    if (progressRef.current) progressRef.current.style.width = `${ratio * 100}%`;
  };

  return (
    <div
      className="project-waterfall-view"
      style={{ "--folder": FOLDER_TONES[project.folder] } as React.CSSProperties}
    >
      <header>
        <button onClick={onBack}>← 返回分类</button>
        <div><small>{project.en}</small><h2>{project.title}</h2></div>
        <span>{slides.length} PAGES</span>
      </header>
      <div ref={scrollRef} className="project-waterfall-scroll" onScroll={updateReadingProgress}>
        {slides.map((item, index) => (
          <figure key={`${item.page}-${index}`}>
            <figcaption>{item.label ?? String(item.page).padStart(2, "0")}</figcaption>
            <img
              src={item.src}
              alt={item.alt}
              loading={index === 0 ? "eager" : "lazy"}
              decoding="async"
            />
          </figure>
        ))}
      </div>
      <nav className="project-detail-toolbar" aria-label="项目详情导航">
        <button
          disabled={projectIndex === 0}
          onClick={() => onSelectProject(projects[projectIndex - 1])}
        >
          ‹ <span>上一个</span>
        </button>
        <div className="project-detail-progress">
          <i ref={progressRef} />
          <span>{String(currentPage).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span>
        </div>
        <button onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" })}>
          ↑ <span>回到顶部</span>
        </button>
        <button
          disabled={projectIndex === projects.length - 1}
          onClick={() => onSelectProject(projects[projectIndex + 1])}
        >
          <span>下一个</span> ›
        </button>
      </nav>
    </div>
  );
}

const PHOTO_ARCHIVE_CATEGORIES = [
  { id: "landscape-archive", title: "风景摄影", en: "LANDSCAPE", src: "/portfolio/travel/western-sichuan-01.webp", accent: "#9db8c8", images: ["/portfolio/travel/western-sichuan-01.webp", "/portfolio/travel/xinjiang-18.webp", "/portfolio/travel/fujian-09.webp", "/portfolio/travel/xinjiang-04.webp"] },
  { id: "product-photo", title: "产品摄影", en: "PRODUCT", src: "/portfolio/photo-archive/product-09.webp", accent: "#dec17a", images: ["/portfolio/photo-archive/product-09.webp", "/portfolio/photo-archive/product-14.webp", "/portfolio/photo-archive/product-15.webp"] },
  { id: "portrait-photo", title: "人像摄影", en: "PORTRAIT", src: "/portfolio/photo-archive/portrait-01.webp", accent: "#9fbfd1", images: ["/portfolio/photo-archive/portrait-01.webp", "/portfolio/photo-archive/portrait-09.webp", "/portfolio/photo-archive/portrait-13.webp"] },
] as const;

function DraggableWallItem({
  className,
  children,
  onActivate,
}: {
  className: string;
  children: React.ReactNode;
  onActivate?: (element: HTMLButtonElement) => void;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = useRef<null | { pointerId: number; x: number; y: number; ox: number; oy: number; moved: boolean }>(null);

  return (
    <button
      type="button"
      className={`${className}${dragging ? " is-dragging" : ""}`}
      style={{ "--drag-x": `${offset.x}px`, "--drag-y": `${offset.y}px` } as React.CSSProperties}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false };
        setDragging(true);
      }}
      onPointerMove={(event) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId) return;
        const dx = event.clientX - state.x;
        const dy = event.clientY - state.y;
        if (Math.hypot(dx, dy) > 5) state.moved = true;
        setOffset({ x: state.ox + dx, y: state.oy + dy });
      }}
      onPointerUp={(event) => {
        const state = drag.current;
        if (!state || state.pointerId !== event.pointerId) return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        drag.current = null;
        setDragging(false);
        if (!state.moved) onActivate?.(event.currentTarget);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setDragging(false);
      }}
      onKeyDown={(event) => {
        if (onActivate && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          onActivate(event.currentTarget);
        }
      }}
      tabIndex={onActivate ? 0 : -1}
      aria-disabled={onActivate ? undefined : true}
    >
      {children}
    </button>
  );
}

function PhotoArchiveWallOverlay({
  onBack,
  onOpen,
}: {
  onBack: () => void;
  onOpen: (projectId: string, src: string) => void;
}) {
  return (
    <section className="photo-archive-overlay" role="dialog" aria-modal="true" aria-label="摄影图集分类">
      <header>
        <button onClick={onBack}>← 返回空间</button>
        <div><small>PHOTO ARCHIVE</small><h2>摄影图集</h2></div>
        <span>点击任意一组查看完整图集</span>
      </header>
      <div className="photo-archive-category-grid photo-wall-collage">
        {PHOTO_ARCHIVE_CATEGORIES.map((item, index) => (
          <article
            key={item.id}
            className="photo-wall-cluster"
            style={{ "--archive-accent": item.accent } as React.CSSProperties}
          >
            <span className="photo-wall-number">0{index + 1}</span>
            <div className="photo-archive-triptych">
              {item.images.map((src, imageIndex) => (
                <DraggableWallItem
                  className={`photo-wall-print print-${imageIndex + 1}`}
                  key={src}
                  onActivate={() => onOpen(item.id, item.src)}
                >
                  <i aria-hidden="true" />
                  <img
                    src={src}
                    alt={`${item.title}作品 ${imageIndex + 1}`}
                    loading={index === 0 && imageIndex === 0 ? "eager" : "lazy"}
                    decoding="async"
                  />
                </DraggableWallItem>
              ))}
            </div>
            <DraggableWallItem
              className="photo-wall-label"
              onActivate={() => onOpen(item.id, item.src)}
            ><small>{item.en} · 点击查看</small><strong>{item.title}</strong></DraggableWallItem>
          </article>
        ))}
        <div className="photo-wall-decor" aria-hidden="true">
          <div className="flight-ticket">
            <b className="flight-ticket-side">FLIGHT TICKET</b>
            <div className="flight-ticket-main">
              <header><span>✈</span><strong>BOARDING PASS</strong></header>
              <div className="flight-ticket-grid">
                <span><small>FLIGHT</small><strong>AAB1187</strong></span>
                <span><small>BOARDING</small><strong>07:20</strong></span>
                <span><small>ROW</small><strong>03</strong></span>
              </div>
              <i>✈</i>
              <p>FROM FUZHOU · TO XINJIANG</p>
            </div>
            <div className="flight-ticket-stub"><small>SEAT</small><strong>10B</strong><span>CLASS · WINDOW</span></div>
          </div>
          <i className="dot-sticker dots-blue" />
          <i className="dot-sticker dots-pink" />
          <i className="dot-sticker dots-yellow" />
        </div>
      </div>
    </section>
  );
}

function CircularPhotoGallery({
  title,
  en,
  photos,
  initialSrc,
  onClose,
}: {
  title: string;
  en: string;
  photos: Array<{ id: string; src: string; alt: string }>;
  initialSrc: string;
  onClose: () => void;
}) {
  const initialIndex = Math.max(0, photos.findIndex((photo) => photo.src === initialSrc));
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef(initialIndex);
  const [index, setIndex] = useState(initialIndex);
  const [fallback, setFallback] = useState(false);
  const move = (step: number) => {
    targetRef.current = Math.round(targetRef.current) + step;
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      else if (event.key === "ArrowLeft") targetRef.current = Math.round(targetRef.current) - 1;
      else if (event.key === "ArrowRight") targetRef.current = Math.round(targetRef.current) + 1;
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !photos.length) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: false, antialias: true });
    } catch {
      const fallbackFrame = requestAnimationFrame(() => setFallback(true));
      return () => cancelAnimationFrame(fallbackFrame);
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor("#d7d2c4", 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog("#d7d2c4", 8.5, 17);
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 30);
    camera.position.set(0, 0.15, 9.2);
    const geometry = new THREE.PlaneGeometry(1, 1, 48, 24);
    const loader = new THREE.TextureLoader();
    const placeholder = new THREE.DataTexture(new Uint8Array([226, 221, 210, 255]), 1, 1);
    placeholder.needsUpdate = true;
    placeholder.colorSpace = THREE.SRGBColorSpace;
    const wrap = (value: number) => ((value % photos.length) + photos.length) % photos.length;
    type GallerySlot = {
      mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
      virtualIndex: number;
      photoIndex: number;
      aspect: number;
      request: number;
      texture: THREE.Texture;
    };
    const materialForSlot = () => new THREE.ShaderMaterial({
      transparent: true,
      depthTest: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: placeholder },
        uTime: { value: Math.random() * 20 },
        uSpeed: { value: 0 },
        uOpacity: { value: 1 },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uSpeed;
        varying vec2 vUv;
        void main(){
          vUv=uv;
          vec3 p=position;
          float wave=sin((p.x+0.5)*8.0+uTime)*cos((p.y+0.5)*4.0+uTime*.7);
          p.z+=wave*min(abs(uSpeed)*.42,.14);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        uniform float uOpacity;
        varying vec2 vUv;
        void main(){
          vec4 color=texture2D(uMap,vUv);
          gl_FragColor=vec4(color.rgb,color.a*uOpacity);
          #include <colorspace_fragment>
        }
      `,
    });
    const slots: GallerySlot[] = Array.from({ length: 9 }, (_, slotIndex) => {
      const material = materialForSlot();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = 10 - Math.abs(slotIndex - 4);
      scene.add(mesh);
      return {
        mesh,
        virtualIndex: initialIndex + slotIndex - 4,
        photoIndex: -1,
        aspect: 1.4,
        request: 0,
        texture: placeholder,
      };
    });
    const assignPhoto = (slot: GallerySlot) => {
      const photoIndex = wrap(slot.virtualIndex);
      if (slot.photoIndex === photoIndex) return;
      slot.photoIndex = photoIndex;
      const request = ++slot.request;
      loader.load(
        photos[photoIndex].src,
        (texture) => {
          if (request !== slot.request) {
            texture.dispose();
            return;
          }
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.minFilter = THREE.LinearFilter;
          texture.magFilter = THREE.LinearFilter;
          const image = texture.image as { width?: number; height?: number };
          slot.aspect = Math.max(0.45, Math.min(2.25, (image.width ?? 1) / Math.max(image.height ?? 1, 1)));
          if (slot.texture !== placeholder) slot.texture.dispose();
          slot.texture = texture;
          slot.mesh.material.uniforms.uMap.value = texture;
        },
        undefined,
        () => undefined,
      );
    };
    slots.forEach(assignPhoto);

    const scroll = { current: initialIndex, last: initialIndex };
    targetRef.current = initialIndex;
    let frame = 0;
    let disposed = false;
    let dragging = false;
    let pointerId = -1;
    let pointerStart = 0;
    let targetStart = initialIndex;
    let wheelTimer = 0;
    let reportedIndex = initialIndex;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const width = Math.max(1, canvas.clientWidth);
      const height = Math.max(1, canvas.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const snap = () => {
      targetRef.current = Math.round(targetRef.current);
    };
    const onPointerDown = (event: PointerEvent) => {
      dragging = true;
      pointerId = event.pointerId;
      pointerStart = event.clientX;
      targetStart = targetRef.current;
      canvas.setPointerCapture(event.pointerId);
      canvas.classList.add("is-dragging");
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      targetRef.current = targetStart + (pointerStart - event.clientX) / Math.max(210, canvas.clientWidth * 0.22);
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = -1;
      canvas.classList.remove("is-dragging");
      snap();
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      targetRef.current += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) * 0.0028;
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(snap, 120);
    };
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    resize();

    const render = () => {
      const ease = reduced ? 0.18 : 0.075;
      scroll.current = THREE.MathUtils.lerp(scroll.current, targetRef.current, ease);
      const speed = scroll.current - scroll.last;
      const base = Math.floor(scroll.current);
      slots.forEach((slot) => {
        while (slot.virtualIndex < base - 4) slot.virtualIndex += slots.length;
        while (slot.virtualIndex > base + 4) slot.virtualIndex -= slots.length;
        assignPhoto(slot);
        const relative = slot.virtualIndex - scroll.current;
        const distance = Math.abs(relative);
        const centerScale = THREE.MathUtils.lerp(1.18, 0.9, Math.min(distance / 3.5, 1));
        const baseHeight = slot.aspect >= 1 ? Math.min(4.2, 6.75 / slot.aspect) : 5.35;
        slot.mesh.position.set(relative * 4.05, 0.22 - distance * distance * 0.13, -distance * 0.58);
        slot.mesh.rotation.set(0, relative * -0.055, relative * -0.06);
        slot.mesh.scale.set(baseHeight * slot.aspect * centerScale, baseHeight * centerScale, 1);
        slot.mesh.material.uniforms.uTime.value += 0.024;
        slot.mesh.material.uniforms.uSpeed.value = speed;
        slot.mesh.material.uniforms.uOpacity.value = 1;
        slot.mesh.renderOrder = Math.round(100 - distance * 10);
      });
      const nextIndex = wrap(Math.round(scroll.current));
      if (nextIndex !== reportedIndex) {
        reportedIndex = nextIndex;
        setIndex(nextIndex);
      }
      renderer.render(scene, camera);
      scroll.last = scroll.current;
      if (!disposed) frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(wheelTimer);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      slots.forEach((slot) => {
        slot.request += 1;
        if (slot.texture !== placeholder) slot.texture.dispose();
        slot.mesh.material.dispose();
      });
      placeholder.dispose();
      geometry.dispose();
      renderer.dispose();
    };
  }, [initialIndex, photos]);

  const current = photos[index];
  return (
    <section className="circular-photo-gallery" role="dialog" aria-modal="true" aria-label={`${title}环形图集`}>
      <header>
        <button onClick={onClose}>← 返回摄影墙</button>
        <div><strong>{title}</strong><small>{en}</small></div>
        <span>{String(index + 1).padStart(2, "0")} / {String(photos.length).padStart(2, "0")}</span>
      </header>
      <div className="circular-photo-stage">
        <canvas ref={canvasRef} aria-label="可拖拽的无限环形摄影画廊" />
        {fallback && <img className="circular-photo-fallback" src={current.src} alt={current.alt} />}
        <button className="circular-photo-arrow previous" onClick={() => move(-1)} aria-label="上一张照片">‹</button>
        <button className="circular-photo-arrow next" onClick={() => move(1)} aria-label="下一张照片">›</button>
      </div>
      <footer><span aria-live="polite">{current.alt}</span><small>拖拽或滚轮浏览 · 松手自动吸附 · 支持方向键</small></footer>
    </section>
  );
}

function FlatProjectGrid({
  projects,
  onSelect,
}: {
  projects: Project[];
  onSelect: (project: Project) => void;
}) {
  return (
    <div className="flat-project-grid" role="list" aria-label="项目平铺列表">
      {projects.map((project, index) => (
        <article className={`flat-project-card kind-${project.kind}`} role="listitem" key={project.id}>
          <button
            type="button"
            className="flat-project-cover"
            onClick={() => onSelect(project)}
            aria-label={`点击${project.title}封面查看项目`}
          >
            <img
              src={project.cover}
              alt={`${project.title}项目封面`}
              loading={index < 2 ? "eager" : "lazy"}
              decoding="async"
            />
          </button>
          <div className="flat-project-meta">
            <h3 title={project.title}>{project.title}</h3>
            <button
              type="button"
              onClick={() => onSelect(project)}
              aria-label={`打开${project.title}项目并浏览全部页面`}
            >
              点击查看
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function FolderPanel({
  folder,
}: {
  folder: FolderCategory;
}) {
  const [filter, setFilter] = useState<VisualFilter>("all");
  const [selected, setSelected] = useState<Project | null>(null);
  const projects = useMemo(() => {
    const filtered = PROJECTS.filter(
        (project) =>
          project.folder === folder.id &&
          ((folder.id !== "visual" && folder.id !== "photo") ||
            filter === "all" ||
            project.kind === filter),
      );
    if (folder.id !== "visual" || filter !== "all") return filtered;
    const visualOrder: Partial<Record<Project["kind"], number>> = {
      meitu: 0,
      poster: 1,
      app: 2,
    };
    return filtered.sort(
      (left, right) => (visualOrder[left.kind] ?? 99) - (visualOrder[right.kind] ?? 99),
    );
  }, [folder.id, filter]);
  if (selected)
    return (
      <Gallery
        project={selected}
        projects={projects}
        onBack={() => setSelected(null)}
        onSelectProject={setSelected}
      />
    );
  return (
    <div
      className="folder-panel"
      style={
        {
          "--folder": FOLDER_TONES[folder.id],
          "--card-count": projects.length,
        } as React.CSSProperties
      }
    >
      <header>
        <div>
          <small>{folder.en} · PROJECT GRID</small>
          <h2>{folder.cn}</h2>
        </div>
        <span>{String(projects.length).padStart(2, "0")} PROJECTS</span>
      </header>
      <nav className="filter-tabs" aria-label={`${folder.cn}项目分类`}>
          {(folder.id === "visual"
            ? VISUAL_FILTERS
            : folder.id === "photo"
              ? OTHER_FILTERS
              : [{ id: "all" as const, label: "全部项目" }]
          ).map((item) => (
            <button
              key={item.id}
              className={filter === item.id ? "active" : ""}
              onClick={() => {
                setFilter(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
      </nav>
      {projects.length ? (
        <FlatProjectGrid
          key={`${folder.id}-${filter}`}
          projects={projects}
          onSelect={setSelected}
        />
      ) : (
        <div className="gradient-carousel-empty" role="status">
          <small>COMING SOON</small>
          <strong>美图项目</strong>
          <p>项目内容正在整理中，暂时为你保留这个分类。</p>
        </div>
      )}
    </div>
  );
}

function FolderCoverGate({
  folder,
  onEnter,
  onClose,
}: {
  folder: FolderCategory;
  onEnter: () => void;
  onClose: () => void;
}) {
  const enterRef = useRef(onEnter);
  useEffect(() => {
    enterRef.current = onEnter;
  }, [onEnter]);
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => enterRef.current(), reduced ? 220 : 1050);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <section className="folder-cover-gate" role="dialog" aria-modal="true" aria-label={`${folder.cn}作品集封面`}>
      <button className="folder-cover-gate-close" type="button" onClick={onClose}>← 返回空间</button>
      <div className="folder-cover-gate-enter" role="status" aria-label={`正在打开${folder.cn}项目列表`}>
        <img src={FOLDER_COVERS[folder.id]} alt={`${folder.cn}作品集封面`} />
      </div>
    </section>
  );
}

export default function PortfolioExperience() {
  const [loading, setLoading] = useState(true);
  const [sceneIntroDone, setSceneIntroDone] = useState(false);
  const [active, setActive] = useState<ActiveView>(null);
  const [sceneFocus, setSceneFocus] = useState<SceneFocus>(null);
  const [openingFolder, setOpeningFolder] = useState<FolderId | null>(null);
  const [photoOrigin, setPhotoOrigin] = useState<PhotoTransitionOrigin | null>(null);
  const [photoTransition, setPhotoTransition] = useState<PhotoTransitionSpec | null>(null);
  const [photoFlow, setPhotoFlow] = useState<PhotoFlowState>("idle");
  const [zoom, setZoom] = useState(1);
  const [resetSignal, setResetSignal] = useState(0);
  const [freeView, setFreeView] = useState(false);
  const [showHints, setShowHints] = useState(false);
  const [webgl, setWebgl] = useState(true);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setWebgl(supportsWebGL()));
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (loading || webgl) return;
    const frame = requestAnimationFrame(() => setSceneIntroDone(true));
    return () => cancelAnimationFrame(frame);
  }, [loading, webgl]);
  const openFolder = (folder: FolderId) => {
    setOpeningFolder(folder);
  };
  const handleFolderClick = (folder: FolderId) => {
    if (sceneFocus?.kind === "portfolio") openFolder(folder);
    else setSceneFocus({ kind: "portfolio" });
  };
  const openPhotoProject = (spec: PhotoTransitionOrigin) => {
    if (photoFlow !== "idle") return;
    setPhotoOrigin(spec);
    setPhotoFlow("entering");
    setPhotoTransition({ ...spec, phase: "enter" });
  };
  const openPhotoCategoryDirect = (projectId: string, src: string) => {
    if (photoFlow !== "idle") return;
    const rect = { left: window.innerWidth / 2, top: window.innerHeight / 2, width: 1, height: 1 };
    setPhotoOrigin({
      projectId,
      src,
      frameId: `direct-category-${projectId}`,
      corners: rectCorners(rect),
      rect,
      aspect: 1,
    });
    if (projectId === "landscape-archive") setActive({ kind: "landscapeArchive" });
    else setActive({ kind: "photoProject", projectId: projectId as "portrait-photo" | "product-photo" });
    setPhotoTransition(null);
    setPhotoFlow("gallery");
  };
  const returnPhotoToWall = () => {
    if (!photoOrigin || photoFlow !== "gallery") return;
    if (photoOrigin.frameId.startsWith("direct-category-")) {
      setActive(null);
      setPhotoOrigin(null);
      setPhotoFlow("idle");
      return;
    }
    setPhotoFlow("exiting");
    setPhotoTransition({ ...photoOrigin, phase: "exit" });
    setActive(null);
  };
  const finishPhotoTransition = () => {
    if (!photoTransition) return;
    if (photoTransition.phase === "enter") {
      if (photoTransition.projectId === "landscape-archive")
        setActive({ kind: "landscapeArchive" });
      else
        setActive({ kind: "photoProject", projectId: photoTransition.projectId as "portrait-photo" | "product-photo" });
      setPhotoFlow("gallery");
    } else setPhotoFlow("idle");
    setPhotoTransition(null);
  };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !active && sceneFocus && photoFlow === "idle")
        setSceneFocus(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, photoFlow, sceneFocus]);
  const close = () => setActive(null);
  const activePhotoProject = active?.kind === "photoProject"
    ? photoCollectionById(active.projectId) ?? null
    : null;
  return (
    <main className={`experience-shell photo-flow-${photoFlow} ${sceneIntroDone ? "" : "scene-intro-active"}`}>
      {loading && <LoadingCurtain onDone={() => setLoading(false)} />}
      {!sceneFocus && !active && !openingFolder && photoFlow === "idle" && (
        <header className="experience-nav">
          <button
            className="tips-toggle"
            aria-expanded={showHints}
            onClick={() => setShowHints((value) => !value)}
          >
            {showHints ? "收起提示" : "显示提示"}
          </button>
        </header>
      )}
      <section
        className={`hero-scene photo-flow-${photoFlow}`}
        aria-label="海景阳光照亮的莫兰蒂设计桌、软木摄影墙、人体工学椅、画架、缝纫机与四个作品文件夹"
      >
        <div className="scene-guide">
          <strong>邓海玲的空间</strong>
          <small>DENG HAILING&apos;S SPACE</small>
        </div>
        <div className="scene-guide-notes" aria-label="空间内容提示">
          <button onClick={() => { close(); setSceneFocus({ kind: "portfolio" }); }}>
            <strong>作品集</strong><small>PORTFOLIO</small>
          </button>
          <button onClick={() => setActive({ kind: "profile" })}>
            <strong>个人简介</strong><small>PROFILE</small>
          </button>
        </div>
        <div className="scene-guide-controls" role="group" aria-label="视图控制">
          <button onClick={() => setZoom((value) => Math.min(1.3, value + 0.08))} aria-label="拉近镜头">＋</button>
          <button onClick={() => setZoom((value) => Math.max(0.72, value - 0.08))} aria-label="拉远镜头">－</button>
          <button onClick={() => { setZoom(1); setSceneFocus(null); setResetSignal((value) => value + 1); }}>返回视图</button>
        </div>
        {showHints && !active && photoFlow === "idle" && (
          <div className="scene-object-hints" aria-label="可交互物品提示">
            <button className="hint-folder" onClick={() => { setSceneFocus({ kind: "portfolio" }); setShowHints(false); }}>点击可查看作品集</button>
            <button className="hint-photo-wall" onClick={() => { setSceneFocus({ kind: "photoWall" }); setShowHints(false); }}>点击可查看摄影图集</button>
            <button className="hint-computer" onClick={() => { setSceneFocus({ kind: "computer" }); setShowHints(false); }}>点击可查看电脑</button>
            <button className="hint-resume" onClick={() => { setActive({ kind: "profile" }); setShowHints(false); }}>点击可查看个人简历</button>
            <button className="hint-easel" onClick={() => { setSceneFocus({ kind: "easel" }); setShowHints(false); }}>点击可在画布上涂鸦</button>
            <span className="hint-lamp">拉动绳子调节台灯</span>
            <span className="hint-curtain">点击可开合窗帘</span>
            <span className="hint-drawer">点击可打开抽屉</span>
          </div>
        )}
        {!sceneFocus && photoFlow === "idle" && (
          <button
            className="photo-wall-click-target"
            onClick={() => setSceneFocus({ kind: "photoWall" })}
            aria-label="打开摄影图集软木板"
          >
            摄影图集
          </button>
        )}
        {webgl ? (
          <Scene
            onOpenFolder={openFolder}
            onOpenProfile={() => setActive({ kind: "profile" })}
            onOpenPhotoProject={openPhotoProject}
            sceneFocus={sceneFocus}
            onFocusChange={setSceneFocus}
            interactionLocked={photoFlow !== "idle"}
            zoom={zoom}
            resetSignal={resetSignal}
            introReady={!loading}
            onIntroComplete={() => setSceneIntroDone(true)}
            freeView={freeView}
          />
        ) : (
          <StaticDesk
            sceneFocus={sceneFocus}
            onFolderClick={handleFolderClick}
            onFocusChange={setSceneFocus}
            onOpenPhotoProject={openPhotoProject}
            onOpenProfile={() => setActive({ kind: "profile" })}
            interactionLocked={photoFlow !== "idle"}
          />
        )}
        {sceneFocus && !active && photoFlow === "idle" && (
          <button className="scene-focus-back" onClick={() => setSceneFocus(null)}>
            ← 返回全景
          </button>
        )}
        {sceneFocus?.kind === "photoWall" && !active && (
          <PhotoArchiveWallOverlay onBack={() => setSceneFocus(null)} onOpen={openPhotoCategoryDirect} />
        )}
        {webgl && (
          <div className="scene-mode-controls" role="group" aria-label="场景交互模式">
            <span>
              {freeView
                ? "自由旋转、缩放并移动物品"
                : "固定全景 · 点击物件查看内容"}
            </span>
            <button
              className={!freeView ? "active" : ""}
              onClick={() => {
                setFreeView(false);
                setZoom(1);
                setSceneFocus(null);
                setResetSignal((value) => value + 1);
              }}
            >
              固定视角
            </button>
            <button
              className={freeView ? "active" : ""}
              aria-pressed={freeView}
              onClick={() => setFreeView(true)}
            >
              自由视角
            </button>
          </div>
        )}
      </section>
      {openingFolder && (
        <FolderCoverGate
          folder={FOLDERS.find((folder) => folder.id === openingFolder)!}
          onClose={() => setOpeningFolder(null)}
          onEnter={() => {
            setActive({ kind: "folder", folder: openingFolder });
            setOpeningFolder(null);
          }}
        />
      )}
      {photoTransition && webgl && (
        <PhotoSharedTransition spec={photoTransition} onComplete={finishPhotoTransition} />
      )}
      {photoTransition && !webgl && (
        <img
          className={`shared-photo-transition ${photoTransition.phase}`}
          src={photoTransition.src}
          alt=""
          onAnimationEnd={finishPhotoTransition}
          style={
            {
              "--photo-left": `${photoTransition.rect.left}px`,
              "--photo-top": `${photoTransition.rect.top}px`,
              "--photo-width": `${photoTransition.rect.width}px`,
              "--photo-height": `${photoTransition.rect.height}px`,
            } as React.CSSProperties
          }
        />
      )}
      {active?.kind === "profile" && (
        <Modal title="个人档案" onClose={close}>
          <ProfilePanel />
        </Modal>
      )}
      {active?.kind === "allWorks" && (
        <Modal title="全部作品集" onClose={close} wide>
          <AllWorksPanel />
        </Modal>
      )}
      {active?.kind === "folder" && (
        <Modal
          title={`${FOLDERS.find((folder) => folder.id === active.folder)?.cn}作品`}
          onClose={close}
          wide
        >
          <FolderPanel
            folder={FOLDERS.find((folder) => folder.id === active.folder)!}
          />
        </Modal>
      )}
      {active?.kind === "landscapeArchive" && photoOrigin && (
        <CircularPhotoGallery
          title="风景摄影"
          en="LANDSCAPE"
          photos={PHOTO_REGIONS.flatMap((region) => region.photos)}
          initialSrc={photoOrigin.src}
          onClose={returnPhotoToWall}
        />
      )}
      {activePhotoProject && photoOrigin && (
        <CircularPhotoGallery
          title={activePhotoProject.title}
          en={activePhotoProject.en}
          photos={activePhotoProject.photos}
          initialSrc={photoOrigin.src}
          onClose={returnPhotoToWall}
        />
      )}
    </main>
  );
}
