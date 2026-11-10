import type { Furniture, House } from '@shijian/shared';
import { floorElevation } from '@shijian/shared';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildHouse, disposeObject } from './house';
import type { HouseBuild } from './house';
import { createLabelTexture, createWoodTexture } from './textures';

export type FloorDisplayMode = 'whole' | 'active';

export interface SceneController {
  updateHouse: (house: House) => void;
  setFloor: (level: number, mode: FloorDisplayMode) => void;
  setSelection: (id: string | null) => void;
  setHighlight: (id: string | null, itemName: string) => void;
  focusOn: (x: number, y: number, level?: number, zoom?: number) => void;
  resetView: () => void;
  topView: () => void;
  setCutaway: (enabled: boolean) => void;
  resize: () => void;
  dispose: () => void;
}

interface SceneOptions {
  onPick?: (furnitureId: string | null, floorLevel?: number) => void;
}

interface CameraTween {
  start: number;
  fromPosition: THREE.Vector3;
  toPosition: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toTarget: THREE.Vector3;
  duration: number;
}

function clearGroup(group: THREE.Group): void {
  for (const child of [...group.children]) {
    group.remove(child);
    disposeObject(child);
  }
}

function buildSelection(object: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  const helper = new THREE.BoxHelper(object, 0xc47049);
  const helperMaterial = helper.material as THREE.LineBasicMaterial;
  helperMaterial.depthTest = false;
  helperMaterial.transparent = true;
  helperMaterial.opacity = 0.92;
  helper.renderOrder = 5;
  group.add(helper);

  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const radius = Math.max(size.x, size.z) * 0.58 + 0.16;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.022, 8, 72),
    new THREE.MeshBasicMaterial({
      color: 0xc47049,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(center.x, box.min.y + 0.025, center.z);
  ring.renderOrder = 4;
  group.add(ring);
  return group;
}

export function createScene(container: HTMLElement, options: SceneOptions = {}): SceneController {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdfe6dc);
  scene.fog = new THREE.Fog(0xdfe6dc, 34, 88);

  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 180);
  camera.position.set(16, 13, 19);

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 2.4;
  controls.maxDistance = 52;
  controls.maxPolarAngle = Math.PI / 2.04;
  controls.minPolarAngle = 0.12;
  controls.target.set(5, 0.9, 3.5);
  controls.update();

  const hemi = new THREE.HemisphereLight(0xfff9ea, 0x748274, 1.55);
  scene.add(hemi);
  const ambient = new THREE.AmbientLight(0xfff6e7, 0.28);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff0d2, 2.6);
  sun.position.set(16, 24, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -24;
  sun.shadow.camera.right = 24;
  sun.shadow.camera.top = 24;
  sun.shadow.camera.bottom = -24;
  sun.shadow.bias = -0.00025;
  sun.shadow.normalBias = 0.025;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xbfd7d2, 0.75);
  fill.position.set(-14, 12, -12);
  scene.add(fill);

  const interior = new THREE.PointLight(0xffd9ad, 14, 18, 2);
  interior.position.set(6, 3.1, 4);
  scene.add(interior);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: 0xcfd8cc, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.18;
  ground.receiveShadow = true;
  scene.add(ground);

  const grid = new THREE.GridHelper(100, 100, 0xaebcae, 0xc1ccbf);
  grid.position.y = -0.17;
  const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.22;
    material.depthWrite = false;
  }
  scene.add(grid);

  const woodTexture = createWoodTexture(Math.min(renderer.capabilities.getMaxAnisotropy(), 8));
  const anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

  let currentHouse: House | null = null;
  let house: HouseBuild | null = null;
  let selectionId: string | null = null;
  let highlightId: string | null = null;
  let highlightItemName = '';
  let activeLevel = 0;
  let displayMode: FloorDisplayMode = 'whole';
  let firstBuild = true;
  let cameraTween: CameraTween | null = null;
  let cutawayEnabled = true;

  const selectionGroup = new THREE.Group();
  scene.add(selectionGroup);
  const highlightGroup = new THREE.Group();
  highlightGroup.visible = false;
  scene.add(highlightGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPoint: { x: number; y: number } | null = null;
  let hoverFrame = 0;

  function rebuild(next: House): void {
    currentHouse = next;
    if (house) {
      scene.remove(house.root);
      disposeObject(house.root);
    }
    const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xf1ebdf, roughness: 0.94 });
    house = buildHouse(next, woodTexture, wallMaterial, anisotropy);
    scene.add(house.root);
    house.root.updateMatrixWorld(true);
    interior.position.set(house.center.x, house.topHeight * 0.6, house.center.z);
    updateFloorVisibility();
    updateSelection();
    updateHighlight();
    if (firstBuild) {
      firstBuild = false;
      frameHouse(true);
    }
  }

  function updateHouse(next: House): void {
    rebuild(next);
  }

  function updateFloorVisibility(): void {
    if (!house) return;
    for (const floor of house.floorGroups.values()) {
      floor.group.visible = displayMode === 'whole' || floor.level === activeLevel;
    }
  }

  function setFloor(level: number, mode: FloorDisplayMode): void {
    activeLevel = level;
    displayMode = mode;
    updateFloorVisibility();
  }

  function updateSelection(): void {
    clearGroup(selectionGroup);
    if (!selectionId || !house) return;
    const object = house.furnitureObjects.get(selectionId);
    if (!object) return;
    const group = buildSelection(object);
    selectionGroup.add(group);
  }

  function setSelection(id: string | null): void {
    selectionId = id;
    updateSelection();
  }

  function updateHighlight(): void {
    clearGroup(highlightGroup);
    highlightGroup.visible = false;
    if (!highlightId || !house) {
      updateCountBadges();
      return;
    }
    const object = house.furnitureObjects.get(highlightId);
    if (!object) {
      updateCountBadges();
      return;
    }
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const baseY = box.min.y;
    const radius = Math.max(size.x, size.z) * 0.66 + 0.28;

    const ringMaterial = new THREE.MeshBasicMaterial({
      color: 0xc47049,
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.035, 8, 80), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(center.x, baseY + 0.035, center.z);
    ring.userData.highlightRing = true;
    highlightGroup.add(ring);

    const halo = new THREE.Mesh(
      new THREE.CircleGeometry(radius, 48),
      new THREE.MeshBasicMaterial({
        color: 0xc47049,
        transparent: true,
        opacity: 0.07,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.set(center.x, baseY + 0.03, center.z);
    halo.userData.highlightHalo = true;
    highlightGroup.add(halo);

    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.15, 4.6, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xc47049,
        transparent: true,
        opacity: 0.075,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    beam.position.set(center.x, baseY + 2.3, center.z);
    beam.userData.highlightBeam = true;
    highlightGroup.add(beam);

    if (highlightItemName) {
      const furniture = currentHouse?.floors
        .flatMap((floor) => floor.furniture)
        .find((item: Furniture) => item.id === highlightId);
      const label = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: createLabelTexture(highlightItemName, furniture ? `在 ${furniture.name} · 点击查看` : '物品位置'),
          transparent: true,
          depthTest: false,
          depthWrite: false,
        }),
      );
      label.scale.set(1.28, 0.36, 1);
      label.position.set(center.x, baseY + 2.55, center.z);
      label.renderOrder = 20;
      label.userData.highlightLabel = true;
      label.userData.baseY = baseY + 2.55;
      highlightGroup.add(label);
    }
    highlightGroup.visible = true;
    updateCountBadges();
  }

  function updateCountBadges(): void {
    if (!house) return;
    house.root.traverse((child) => {
      if (child.userData.isCountBadge) child.visible = !highlightId;
    });
  }

  function setHighlight(id: string | null, itemName: string): void {
    highlightId = id;
    highlightItemName = itemName;
    updateHighlight();
  }

  function frameHouse(animated = false): void {
    if (!house) return;
    const target = new THREE.Vector3(house.center.x, Math.max(0.55, house.topHeight * 0.45), house.center.z);
    const distance = Math.max(11, house.radius * 2.45, house.topHeight * 2.2);
    const direction = new THREE.Vector3(1, 0.62, 0.95).normalize();
    const position = target.clone().add(direction.multiplyScalar(distance));
    controls.maxDistance = Math.max(44, house.radius * 7, house.topHeight * 5);
    if (animated) {
      camera.position.copy(target.clone().add(new THREE.Vector3(0.2, 1.7, 0.3).normalize().multiplyScalar(distance * 1.5)));
      tweenCamera(position, target, 900);
    } else {
      camera.position.copy(position);
      controls.target.copy(target);
      controls.update();
    }
  }

  function tweenCamera(position: THREE.Vector3, target: THREE.Vector3, duration = 650): void {
    cameraTween = {
      start: performance.now(),
      fromPosition: camera.position.clone(),
      toPosition: position.clone(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      duration,
    };
    controls.enabled = false;
  }

  function focusOn(x: number, y: number, level = 0, zoom?: number): void {
    if (!house) return;
    const target = new THREE.Vector3(x, floorElevation(level) + 0.8, y);
    const currentDirection = camera.position.clone().sub(controls.target);
    if (currentDirection.lengthSq() < 0.01) currentDirection.set(1, 1, 1);
    currentDirection.y = Math.max(currentDirection.y, currentDirection.length() * 0.35);
    currentDirection.normalize();
    const distance = zoom ? Math.max(7.2, house.radius * 1.05) : Math.max(8.5, house.radius * 1.25);
    tweenCamera(target.clone().add(currentDirection.multiplyScalar(distance)), target, 620);
  }

  function resetView(): void {
    frameHouse(true);
  }

  function topView(): void {
    if (!house) return;
    const target = new THREE.Vector3(house.center.x, 0, house.center.z);
    const position = target.clone().add(
      new THREE.Vector3(0.02, house.topHeight + Math.max(11, house.radius * 3.1), 4.8),
    );
    tweenCamera(position, target, 650);
  }

  function resize(): void {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function updateWallVisibility(): void {
    if (!house) return;
    const horizontal = camera.position.clone().sub(controls.target);
    horizontal.y = 0;
    if (horizontal.lengthSq() < 0.0001) horizontal.set(0, 0, 1);
    horizontal.normalize();
    for (const visual of house.wallVisuals) {
      let hide = false;
      if (cutawayEnabled) {
        const toWall = visual.center.clone().sub(house.center);
        toWall.y = 0;
        hide = toWall.lengthSq() > 0.001 && toWall.normalize().dot(horizontal) > 0.16;
      }
      visual.group.visible = !hide;
    }
  }

  function setCutaway(enabled: boolean): void {
    cutawayEnabled = enabled;
    updateWallVisibility();
  }

  function pickFurniture(
    clientX: number,
    clientY: number,
  ): { id: string; level?: number } | null {
    if (!house) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(house.root, true);
    for (const hit of hits) {
      let current: THREE.Object3D | null = hit.object;
      while (current) {
        if (typeof current.userData.furnitureId === 'string') {
          return {
            id: current.userData.furnitureId as string,
            level:
              typeof current.userData.floorLevel === 'number'
                ? (current.userData.floorLevel as number)
                : undefined,
          };
        }
        current = current.parent;
      }
      return null;
    }
    return null;
  }

  function handlePointerDown(event: PointerEvent): void {
    downPoint = { x: event.clientX, y: event.clientY };
  }

  function handlePointerUp(event: PointerEvent): void {
    if (!downPoint || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y);
    downPoint = null;
    if (moved > 5) return;
    const picked = pickFurniture(event.clientX, event.clientY);
    options.onPick?.(picked?.id ?? null, picked?.level);
  }

  function handlePointerMove(event: PointerEvent): void {
    if (event.buttons !== 0) return;
    if (hoverFrame) return;
    hoverFrame = requestAnimationFrame(() => {
      hoverFrame = 0;
      const picked = pickFurniture(event.clientX, event.clientY);
      renderer.domElement.style.cursor = picked ? 'pointer' : 'grab';
    });
  }

  renderer.domElement.addEventListener('pointerdown', handlePointerDown);
  renderer.domElement.addEventListener('pointerup', handlePointerUp);
  renderer.domElement.addEventListener('pointermove', handlePointerMove);

  const resizeObserver = new ResizeObserver(() => resize());
  resizeObserver.observe(container);
  resize();

  let raf = 0;
  function animate(now: number): void {
    raf = requestAnimationFrame(animate);
    if (cameraTween) {
      const t = Math.min(1, (now - cameraTween.start) / cameraTween.duration);
      const eased = 1 - Math.pow(1 - t, 3);
      camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, eased);
      controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, eased);
      if (t >= 1) {
        cameraTween = null;
        controls.enabled = true;
      }
    }
    controls.update();
    updateWallVisibility();

    for (const child of highlightGroup.children) {
      if (child.userData.highlightRing) {
        const pulse = 1 + Math.sin(now / 330) * 0.07;
        child.scale.set(pulse, pulse, pulse);
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = 0.58 + Math.sin(now / 330) * 0.14;
      }
      if (child.userData.highlightHalo) {
        const material = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        material.opacity = 0.055 + (Math.sin(now / 330) + 1) * 0.025;
      }
      if (child.userData.highlightLabel) {
        const baseY = typeof child.userData.baseY === 'number' ? child.userData.baseY : 2.55;
        child.position.y = baseY + Math.sin(now / 640) * 0.05;
      }
    }

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(animate);

  function dispose(): void {
    cancelAnimationFrame(raf);
    cancelAnimationFrame(hoverFrame);
    resizeObserver.disconnect();
    renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
    renderer.domElement.removeEventListener('pointerup', handlePointerUp);
    renderer.domElement.removeEventListener('pointermove', handlePointerMove);
    controls.dispose();
    if (house) disposeObject(house.root);
    clearGroup(selectionGroup);
    clearGroup(highlightGroup);
    woodTexture.dispose();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
        child.geometry.dispose();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        for (const material of materials) material.dispose();
      }
    });
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
  }

  return {
    updateHouse,
    setFloor,
    setSelection,
    setHighlight,
    focusOn,
    resetView,
    topView,
    setCutaway,
    resize,
    dispose,
  };
}
