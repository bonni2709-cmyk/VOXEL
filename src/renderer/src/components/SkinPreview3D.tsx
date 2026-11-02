import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { boxFaces, faceOrder, rectToUv } from '@shared/skin-uv';

/** Модель игрока: голова, тело, руки и ноги с UV-раскладкой Minecraft. */
const PARTS: { name: string; size: [number, number, number]; pos: [number, number, number]; uv: [number, number] }[] = [
  { name: 'head', size: [8, 8, 8], pos: [0, 24, 0], uv: [0, 0] },
  { name: 'body', size: [8, 12, 4], pos: [0, 12, 0], uv: [16, 16] },
  { name: 'rarm', size: [4, 12, 4], pos: [-6, 12, 0], uv: [40, 16] },
  { name: 'larm', size: [4, 12, 4], pos: [6, 12, 0], uv: [32, 48] },
  { name: 'rleg', size: [4, 12, 4], pos: [-2, 0, 0], uv: [0, 16] },
  { name: 'lleg', size: [4, 12, 4], pos: [2, 0, 0], uv: [16, 48] },
];

function buildBox(w: number, h: number, d: number, u: number, v: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, h, d);
  const faces = faceOrder(boxFaces(u, v, w, h, d));
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  faces.forEach((rect, face) => {
    rectToUv(rect, 64, 64).forEach(([a, b], k) => uv.setXY(face * 4 + k, a, b));
  });
  uv.needsUpdate = true;
  return new THREE.Mesh(geo, mat);
}

export function SkinPreview3D({ dataUrl, height = 320 }: { dataUrl: string | null; height?: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const texRef = useRef<THREE.CanvasTexture | null>(null);

  useEffect(() => {
    const host = hostRef.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, height);
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, host.clientWidth / height, 0.1, 200);
    camera.position.set(0, 18, 58);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    texRef.current = tex;
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4 });
    matRef.current = mat;

    const group = new THREE.Group();
    for (const p of PARTS) {
      const mesh = buildBox(p.size[0], p.size[1], p.size[2], p.uv[0], p.uv[1], mat);
      mesh.position.set(p.pos[0], p.pos[1] + (p.name.includes('leg') ? 6 : 0), p.pos[2]);
      group.add(mesh);
    }
    group.position.y = -16;
    scene.add(group);

    scene.add(new THREE.AmbientLight(0xffffff, 0.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(20, 40, 30);
    scene.add(sun);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 30;
    controls.maxDistance = 90;

    let raf = 0;
    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    const onResize = () => {
      renderer.setSize(host.clientWidth, height);
      camera.aspect = host.clientWidth / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      controls.dispose();
      tex.dispose();
      mat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [height]);

  useEffect(() => {
    if (!dataUrl || !texRef.current) return;
    const img = new Image();
    img.onload = () => {
      const tex = texRef.current!;
      const canvas = tex.image as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 64, 64);
      ctx.drawImage(img, 0, 0, 64, 64);
      tex.needsUpdate = true;
    };
    img.src = dataUrl;
  }, [dataUrl]);

  return <div ref={hostRef} className="w-full overflow-hidden rounded-2xl" style={{ height }} />;
}
