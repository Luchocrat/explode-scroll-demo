"use client";

/**
 * ExplodeOnScroll — React Three Fiber scroll-driven explode.
 * Explodes GLB parts along vectors from model center → part origin.
 */
import {
  useMemo,
  useRef,
  useEffect,
  useState,
  Suspense,
  type RefObject,
  type CSSProperties,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  useGLTF,
  Environment,
  ContactShadows,
} from "@react-three/drei";
import * as THREE from "three";

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

  const parts = useMemo(() => {
    const list: PartEntry[] = [];
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const center = box.getCenter(new THREE.Vector3());
    root.position.sub(center);

    root.traverse((obj) => {
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = obj as THREE.Mesh;
      const rest = mesh.position.clone();
      let dir = rest.clone();

      if (dir.lengthSq() < 1e-8) {
        mesh.geometry.computeBoundingBox();
        const c = new THREE.Vector3();
        mesh.geometry.boundingBox!.getCenter(c);
        dir =
          c.lengthSq() > 1e-8 ? c.normalize() : new THREE.Vector3(0, 1, 0);
      } else {
        dir.normalize();
      }

      const extras = mesh.userData || {};
      if (
        Array.isArray(extras.explode_dir) &&
        extras.explode_dir.length === 3
      ) {
        dir.fromArray(extras.explode_dir).normalize();
      }
      if (
        Array.isArray(extras.rest_location) &&
        extras.rest_location.length === 3
      ) {
        rest.fromArray(extras.rest_location);
      }

      list.push({ obj: mesh, rest, dir });
    });

    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-3);
    root.scale.setScalar(2 / maxDim);
    return list;
  }, [root]);

  useFrame(() => {
    const p = Math.min(Math.max(progress, 0), 1);
    const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
    const dist = explodeDistance * e;
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
      <Canvas camera={{ position: [2.4, 1.6, 2.4], fov: 40 }} dpr={[1, 2]}>
        <color attach="background" args={["#0e1014"]} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[4, 6, 2]} intensity={1.2} />
        <Suspense fallback={null}>
          <ExplodingModel
            url={url}
            progress={progress}
            explodeDistance={explodeDistance}
          />
          <Environment preset="city" />
          <ContactShadows opacity={0.35} scale={8} blur={2.5} />
        </Suspense>
        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={8} />
      </Canvas>
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
