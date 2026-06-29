// @ts-nocheck
'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// --- Helper to Generate 2D Targets for 3D Particles ---
const getTargetPoints = (w: number, h: number) => {
  const offCanvas = document.createElement('canvas');
  offCanvas.width = w; offCanvas.height = h;
  const offCtx = offCanvas.getContext('2d', { willReadFrequently: true });
  if (!offCtx) return { humanoid: [], text: [] };

  // 1. Draw Humanoid Silhouette
  offCtx.clearRect(0, 0, w, h);
  offCtx.fillStyle = '#fff';
  offCtx.beginPath();
  offCtx.arc(w/2, h/2 - 40, 30, 0, Math.PI * 2); // Head
  offCtx.fill();
  offCtx.beginPath();
  offCtx.ellipse(w/2, h/2 + 60, 80, 60, 0, Math.PI, 0); // Body
  offCtx.fill();
  
  let imgData = offCtx.getImageData(0,0,w,h).data;
  const humanoidPoints = [];
  for(let y=0; y<h; y+=8) {
    for(let x=0; x<w; x+=8) {
      if (imgData[(y * w + x) * 4] > 128) {
        // Project 2D coordinates into 3D space near Z=0
        humanoidPoints.push(
          (x - w/2) * 0.1, 
          -(y - h/2) * 0.1, 
          (Math.random() - 0.5) * 5
        );
      }
    }
  }

  // 2. Draw "ECHORURA" text
  offCtx.clearRect(0, 0, w, h);
  offCtx.font = 'bold 80px "Inter", sans-serif';
  offCtx.textAlign = 'center';
  offCtx.textBaseline = 'middle';
  offCtx.fillText('ECHORURA', w/2, h/2 + 180);
  
  imgData = offCtx.getImageData(0,0,w,h).data;
  const textPoints = [];
  for(let y=0; y<h; y+=4) { 
    for(let x=0; x<w; x+=4) {
      if (imgData[(y * w + x) * 4] > 128) {
        textPoints.push(
          (x - w/2) * 0.1, 
          -(y - h/2) * 0.1, 
          (Math.random() - 0.5) * 2
        );
      }
    }
  }

  return { humanoid: humanoidPoints, text: textPoints };
};

// --- R3F Scene Component ---
const Scene = ({ audioReady }: { audioReady: boolean }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const nebulaRef = useRef<THREE.Points>(null);
  
  const startMs = useRef(performance.now());
  const [phase, setPhase] = useState(0);

  // Generate Geometry
  const { positions, colors, targets, roles, delays } = useMemo(() => {
    // Arbitrary viewport size for projection mapping
    const w = 1000; const h = 1000; 
    const t = getTargetPoints(w, h);
    
    const count = (t.humanoid.length / 3) + (t.text.length / 3) + 3000; // 3000 bg particles
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const roles = new Float32Array(count); // 0=bg, 1=humanoid, 2=text
    const delays = new Float32Array(count);

    const colorWhite = new THREE.Color('#FFFFFF');

    for (let i = 0; i < count; i++) {
      let role = 0;
      let tx = (Math.random() - 0.5) * 200;
      let ty = (Math.random() - 0.5) * 200;
      let tz = (Math.random() - 0.5) * 100 - 50;

      const idx3 = i * 3;
      if (i < t.humanoid.length / 3) {
        role = 1;
        tx = t.humanoid[idx3];
        ty = t.humanoid[idx3 + 1];
        tz = t.humanoid[idx3 + 2];
      } else if (i < (t.humanoid.length + t.text.length) / 3) {
        role = 2;
        const textIdx = idx3 - t.humanoid.length;
        tx = t.text[textIdx];
        ty = t.text[textIdx + 1];
        tz = t.text[textIdx + 2];
      }

      // Initial Position (Bottom up like Pillars of Creation)
      positions[idx3] = tx + (Math.random() - 0.5) * 50;
      positions[idx3 + 1] = ty - 100 - Math.random() * 50; // far below
      positions[idx3 + 2] = tz + (Math.random() - 0.5) * 100;

      targets[idx3] = tx;
      targets[idx3 + 1] = ty;
      targets[idx3 + 2] = tz;

      roles[i] = role;
      delays[i] = role === 2 ? Math.random() * 3 : Math.random() * 2;

      // Color
      colorWhite.toArray(colors, idx3);
    }
    return { positions, colors, targets, roles, delays };
  }, []);

  const { nebulaPositions, nebulaColors } = useMemo(() => {
    const count = 300;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const c1 = new THREE.Color('#00F0FF');
    const c2 = new THREE.Color('#9600FF');
    const c3 = new THREE.Color('#FF0064');

    for(let i=0; i<count; i++) {
      const pillar = i % 3;
      const baseX = (pillar - 1) * 40;
      positions[i*3] = baseX + (Math.random() - 0.5) * 30;
      positions[i*3+1] = -50 + Math.random() * 100;
      positions[i*3+2] = -50 + Math.random() * 30;
      
      const c = pillar === 0 ? c1 : (pillar === 1 ? c2 : c3);
      c.toArray(colors, i*3);
    }
    return { nebulaPositions: positions, nebulaColors: colors };
  }, []);

  useFrame((state) => {
    if (!audioReady) return;

    const t = (performance.now() - startMs.current) / 1000;
    
    // Simulate Web Audio Frequencies
    const audioT = t; 
    const intensity = Math.min(1, audioT / 4.0);
    const lowFreq = Math.pow(Math.sin(audioT * Math.PI * 0.5), 2) * intensity;
    const highFreq = Math.pow(Math.sin(audioT * Math.PI * 8), 4) * Math.random() * intensity;

    // Update camera (Low freq pushes space)
    const isPhase3 = t >= 4.0;
    const phase3Progress = Math.min(1, Math.max(0, (t - 4.0) / 4.0));
    
    state.camera.position.z = 100 + lowFreq * 5 * (1 - phase3Progress) - phase3Progress * 20;
    
    // Animate Particles
    if (pointsRef.current) {
      const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
      const col = pointsRef.current.geometry.attributes.color.array as Float32Array;
      
      for(let i=0; i<roles.length; i++) {
        const i3 = i * 3;
        const role = roles[i];
        
        if (!isPhase3) {
          // PHASE 2: Slowly rising stardust (Pillars)
          pos[i3] += Math.sin(t + i) * 0.05 * lowFreq;
          pos[i3+1] += 0.1 + (Math.random() * 0.1); // Rise up
          
          // Flash effect
          const flash = Math.random() < 0.01 ? highFreq : 0;
          col[i3] = col[i3+1] = col[i3+2] = Math.min(1, 0.3 + flash);
        } else {
          // PHASE 3: Soul Link Aggregation
          if (role !== 0) {
            const growthFactor = Math.min(1, Math.max(0, phase3Progress * 2.5 - delays[i]));
            const lerpFactor = growthFactor * 0.03;
            
            const lookUpY = role === 1 ? 2 * phase3Progress : 0; // Humanoid looks up
            
            pos[i3] += (targets[i3] - pos[i3]) * lerpFactor;
            pos[i3+1] += (targets[i3+1] + lookUpY - pos[i3+1]) * lerpFactor;
            pos[i3+2] += (targets[i3+2] - pos[i3+2]) * lerpFactor;
            
            // Color shift for text
            if (role === 2) {
              col[i3] = 0; // R
              col[i3+1] = 0.94 * phase3Progress; // G
              col[i3+2] = 1 * phase3Progress; // B
            } else {
              col[i3] = col[i3+1] = col[i3+2] = 0.5 + phase3Progress * 0.5;
            }
          } else {
            pos[i3+1] += 0.05; // bg keeps rising
          }
        }
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
      pointsRef.current.geometry.attributes.color.needsUpdate = true;
    }

    // Animate Nebula
    if (nebulaRef.current) {
      nebulaRef.current.position.y += 0.02; // whole nebula rises
      const mat = nebulaRef.current.material as THREE.PointsMaterial;
      mat.opacity = Math.min(0.15, audioT / 6.0); // slow fade in
    }

    // Trigger UI Slogan
    if (t > 8.0 && phase === 0) setPhase(1);
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={colors.length / 3} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.5} vertexColors transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </points>

      <points ref={nebulaRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={nebulaPositions.length / 3} array={nebulaPositions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={nebulaColors.length / 3} array={nebulaColors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={60} vertexColors transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} sizeAttenuation={true} />
      </points>
    </>
  );
};

export default function SplashScreen() {
  const [started, setStarted] = useState(false);
  const [sloganVisible, setSloganVisible] = useState(false);
  const [exited, setExited] = useState(false);

  const handleStart = () => {
    setStarted(true);
    setTimeout(() => setSloganVisible(true), 8000);
    setTimeout(() => setExited(true), 12000);
  };

  if (exited) return null;

  return (
    <AnimatePresence>
      <motion.div 
        className="fixed inset-0 z-[200] bg-[#000000] overflow-hidden flex items-center justify-center pointer-events-auto"
        initial={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1.5 }}
      >
        <div className="absolute inset-0 z-0">
          <Canvas camera={{ position: [0, 0, 100], fov: 60 }}>
            <Scene audioReady={started} />
          </Canvas>
        </div>

        <div className="relative z-10 flex flex-col items-center justify-center w-full h-full">
          <AnimatePresence>
            {!started && (
              <motion.button
                onClick={handleStart}
                className="px-8 py-4 rounded-full border border-white/10 text-white/50 tracking-[0.3em] text-sm uppercase hover:bg-white/5 hover:text-white transition-all duration-500 backdrop-blur-md cursor-pointer"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1, filter: "blur(10px)" }}
                transition={{ duration: 1 }}
              >
                Touch to Awaken
              </motion.button>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {sloganVisible && (
              <motion.div
                className="absolute bottom-16 flex flex-col items-center w-[400px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 2, ease: "easeOut" }}
              >
                <p className="text-sm font-medium text-white/80 tracking-[0.4em] drop-shadow-[0_0_15px_rgba(0,240,255,0.5)]">
                  创作与收听，皆为价值！
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
