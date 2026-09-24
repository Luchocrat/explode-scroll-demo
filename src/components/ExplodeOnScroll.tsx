"use client";

/**
 * ExplodeOnScroll — React Three Fiber scroll-driven explode.
 * Explodes GLB parts along vectors from model center → part origin.
 *
 * Explode distance is in world units on the fitted model (max dim ≈ 2).
 * Materials are softened so the CAD solids stay readable without a remote HDR.
 */
import {
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
  useState,
  Suspense,
  type RefObject,
  type CSSProperties,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  ContactShadows,
  useProgress,
} from "@react-three/drei";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

type PartEntry = {
  obj: THREE.Object3D;
  rest: THREE.Vector3;
  dir: THREE.Vector3;
};

function useScrollProgress(targetRef: RefObject<HTMLElement | null> | null) {
  const [t, setT] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = targetRef?.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const total = Math.max(rect.height - window.innerHeight, 1);
        const scrolled = Math.min(Math.max(-rect.top, 0), total);
        setT(scrolled / total);
      } else {
        const max =
          document.documentElement.scrollHeight - window.innerHeight;
        setT(max > 0 ? window.scrollY / max : 0);
      }
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [targetRef]);

  return t;
}

function softenMaterial(material: THREE.Material): THREE.Material {
  const cloned = material.clone();
  if (cloned instanceof THREE.MeshStandardMaterial) {
    cloned.metalness = Math.min(cloned.metalness, 0.22);
    cloned.roughness = Math.max(cloned.roughness, 0.48);
    cloned.envMapIntensity = 0.55;
    cloned.color.offsetHSL(0, 0.12, 0);
  }
  return cloned;
}

function LocalEnvironment() {
  const { gl, scene } = useThree();

  useLayoutEffect(() => {
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    let envMap: THREE.Texture | undefined;
    let pmrem: THREE.PMREMGenerator | undefined;
    let room: RoomEnvironment | undefined;
    try {
      pmrem = new THREE.PMREMGenerator(gl);
      room = new RoomEnvironment();
      envMap = pmrem.fromScene(room, 0.04).texture;
      scene.environment = envMap;
      scene.environmentIntensity = 0.45;
    } catch {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
    }
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      envMap?.dispose();
      room?.dispose();
      pmrem?.dispose();
    };
  }, [gl, scene]);

  return null;
}

function ExplodingModel({
  url,
  progress,
  explodeDistance = 1.25,
}: {
  url: string;
  progress: number;
  explodeDistance?: number;
}) {
  const { scene } = useGLTF(url);
  const root = useMemo(() => scene.clone(true), [scene]);

  const { parts, localExplode } = useMemo(() => {
    const list: PartEntry[] = [];
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-3);
    const fitScale = 2 / maxDim;

    root.position.sub(center);
    root.scale.setScalar(fitScale);
    root.updateMatrixWorld(true);

    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;

      if (Array.isArray(mesh.material)) {
        mesh.material = mesh.material.map(softenMaterial);
      } else if (mesh.material) {
        mesh.material = softenMaterial(mesh.material);
      }

      const rest = mesh.position.clone();
      const partBox = new THREE.Box3().setFromObject(mesh);
      const partCenter = partBox.getCenter(new THREE.Vector3());
      root.worldToLocal(partCenter);
      let dir = partCenter.clone();

      if (dir.lengthSq() < 1e-8) {
        dir = rest.clone();
      }
      if (dir.lengthSq() < 1e-8) {
        dir.set(0, 1, 0);
      } else {
        dir.normalize();
      }

      list.push({ obj: mesh, rest, dir });
    });

    // explodeDistance is world-space on the fitted model; convert back
    // to the unscaled mesh local units that `mesh.position` uses.
    return { parts: list, localExplode: explodeDistance / fitScale };
  }, [root, explodeDistance]);

  useFrame(() => {
    const p = Math.min(Math.max(progress, 0), 1);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const dist = localExplode * e;
    for (const { obj, rest, dir } of parts) {
      obj.position.set(
        rest.x + dir.x * dist,
        rest.y + dir.y * dist,
        rest.z + dir.z * dist,
      );
    }
  });

  return <primitive object={root} />;
}

useGLTF.preload("/model.glb");

export type ExplodeOnScrollProps = {
  url?: string;
  scrollRef?: RefObject<HTMLElement | null> | null;
  explodeDistance?: number;
  className?: string;
  style?: CSSProperties;
  showProgress?: boolean;
};

export function ExplodeOnScroll({
  url = "/model.glb",
  scrollRef = null,
  explodeDistance = 1.35,
  className,
  style,
  showProgress = true,
}: ExplodeOnScrollProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(scrollRef || localRef);
  const { active: modelLoading } = useProgress();

  return (
    <div
      ref={scrollRef ? undefined : localRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        background: "#0e1014",
        ...style,
      }}
    >
      <Canvas
        camera={{ position: [4.4, 2.6, 4.4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ toneMappingExposure: 0.92 }}
      >
        <color attach="background" args={["#0e1014"]} />
        <hemisphereLight args={["#e8eef6", "#1c1e22", 0.55]} />
        <ambientLight intensity={0.28} />
        <directionalLight position={[4, 6, 2]} intensity={1.15} />
        <directionalLight position={[-3, 1.5, -2]} intensity={0.35} />
        <LocalEnvironment />
        <Suspense fallback={null}>
          <ExplodingModel
            url={url}
            progress={progress}
            explodeDistance={explodeDistance}
          />
        </Suspense>
        <ContactShadows opacity={0.28} scale={10} blur={2.8} />
        <OrbitControls enablePan={false} minDistance={2.4} maxDistance={12} />
      </Canvas>
      {modelLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#c8ccd4",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 13,
            pointerEvents: "none",
          }}
        >
          Loading model…
        </div>
      )}
      {showProgress && (
        <div
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            color: "#c8ccd4",
            fontFamily: "ui-sans-serif, system-ui, sans-serif",
            fontSize: 12,
            opacity: 0.85,
          }}
        >
          explode {(progress * 100).toFixed(0)}% · scroll to assemble / pull
          apart
        </div>
      )}
    </div>
  );
}

export default ExplodeOnScroll;
