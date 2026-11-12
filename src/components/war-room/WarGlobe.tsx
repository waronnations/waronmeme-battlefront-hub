// Holographic globe: one pulsing beacon per faction sector, sized by dominance.
// Loaded lazily and only in the browser.
import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { Group, Mesh } from "three";
import { latLonToXYZ, type Sector } from "@/lib/war-room/sectors";

const RADIUS = 1.6;

function cssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

function useThemeColors() {
  const [c, setC] = useState({ cyan: "#00f0ff", amber: "#ffb800", green: "#39ff14", danger: "#ff3b4e", bg: "#0b0e14" });
  useEffect(() => {
    setC({
      cyan: cssVar("--neon-cyan", "#00f0ff"),
      amber: cssVar("--neon-amber", "#ffb800"),
      green: cssVar("--neon-green", "#39ff14"),
      danger: cssVar("--destructive", "#ff3b4e"),
      bg: cssVar("--background", "#0b0e14"),
    });
  }, []);
  return c;
}

function Beacon({ sector, color, selected, onSelect }: { sector: Sector; color: string; selected: boolean; onSelect: () => void }) {
  const ring = useRef<Mesh>(null);
  const pos = useMemo(() => latLonToXYZ(sector.lat, sector.lon, RADIUS), [sector.lat, sector.lon]);
  const outward = useMemo(() => latLonToXYZ(sector.lat, sector.lon, RADIUS + 0.4), [sector.lat, sector.lon]);
  const size = 0.06 + sector.dominance * 0.16;
  const speed = 1.2 + sector.dominance * 4;
  useFrame(({ clock }) => {
    const m = ring.current;
    if (!m) return;
    const t = (clock.elapsedTime * speed) % 1;
    m.scale.setScalar(1 + t * 2.2);
    const mat = m.material as { opacity: number };
    mat.opacity = 0.7 * (1 - t);
  });
  return (
    <group position={pos} onClick={(e) => (e.stopPropagation(), onSelect())}>
      <mesh>
        <sphereGeometry args={[size, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ring} onUpdate={(m) => m.lookAt(outward[0] * 2, outward[1] * 2, outward[2] * 2)}>
        <ringGeometry args={[size * 1.2, size * 1.5, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} depthWrite={false} />
      </mesh>
      {selected && (
        <mesh onUpdate={(m) => m.lookAt(outward[0] * 2, outward[1] * 2, outward[2] * 2)}>
          <ringGeometry args={[size * 2.4, size * 2.6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Globe({ sectors, radiation, selected, onSelect }: { sectors: Sector[]; radiation: number; selected: string | null; onSelect: (id: string) => void }) {
  const g = useRef<Group>(null);
  const c = useThemeColors();
  const palette = [c.cyan, c.amber, c.green, c.danger];
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += Math.min(dt, 0.05) * 0.12;
  });
  return (
    <group ref={g} rotation={[0.35, 0, 0]}>
      <mesh>
        <sphereGeometry args={[RADIUS * 0.985, 48, 48]} />
        <meshStandardMaterial color={c.bg} emissive={radiation >= 50 ? c.danger : c.cyan} emissiveIntensity={0.05 + radiation / 900} roughness={0.8} />
      </mesh>
      <mesh>
        <sphereGeometry args={[RADIUS, 32, 20]} />
        <meshBasicMaterial color={c.cyan} wireframe transparent opacity={0.18} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[RADIUS * 1.25, 0.004, 8, 128]} />
        <meshBasicMaterial color={c.amber} transparent opacity={0.5} />
      </mesh>
      {sectors.map((s, i) => (
        <Beacon key={s.id} sector={s} color={palette[i % palette.length]!} selected={selected === s.id} onSelect={() => onSelect(s.id)} />
      ))}
    </group>
  );
}

export default function WarGlobe(props: { sectors: Sector[]; radiation: number; selected: string | null; onSelect: (id: string) => void }) {
  const [ready, setReady] = useState(false);
  return (
    <div className="relative h-full w-full" data-scene-ready={ready ? "true" : undefined}>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 4.6], fov: 45 }}
        gl={{ antialias: true, powerPreference: "low-power" }}
        onCreated={() => setReady(true)}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[4, 3, 5]} intensity={20} />
        <Globe {...props} />
      </Canvas>
    </div>
  );
}
