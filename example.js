<!doctype html>
<html lang="es">
<head>
    <link rel="icon" href="data:,">
    <meta charset="utf-8">
    <title>Editor Avanzado de Materiales y Texturas - Three.js + lil-gui</title>
    <style>
      body { margin: 0; overflow: hidden; background-color: #111; font-family: sans-serif; }
      #canvas { display: block; }
      
      /* Contenedor para el inspector visual de texturas arriba a la izquierda */
      #texture-inspector-container {
        position: fixed;
        top: 15px;
        left: 15px;
        z-index: 10000;
        background: rgba(0, 0, 0, 0.7);
        padding: 8px;
        border-radius: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      #texture-inspector-container span {
        color: #fff;
        font-size: 11px;
        margin-bottom: 6px;
        font-weight: bold;
        letter-spacing: 0.5px;
      }
      #texture-inspector-container canvas {
        width: 120px;
        height: 120px;
        border: 2px solid #ffffff;
        border-radius: 4px;
        display: block;
      }
    </style>
</head>
<body>

<div id="texture-inspector-container">
  <span>INSPECTOR DE TEXTURA</span>
  <!-- El canvas del inspector se inyectará aquí -->
</div>

<canvas id="canvas"></canvas>

<script type="importmap">
{
  "imports": {
    "three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js",
    "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/",
    "lil-gui": "https://cdn.jsdelivr.net/npm/lil-gui@0.21.0/dist/lil-gui.esm.min.js"
  }
}
</script>

<script type="module">
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { SpotLightHelper } from "three/addons/helpers/SpotLightHelper.js";
import { GUI } from 'lil-gui';

// --- 1. Renderizador y Escena -------------------------------------------------
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111111);

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 0, 5);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// --- 2. Generadores de Texturas Procedurales con sus Canvases ------------------
const textureSettings = {
  radial: {
    innerRadius: 50,
    outerRadius: 250,
    colorCenter: '#fefefe',
    colorMiddle: '#00eeff',
    colorOuter: '#da8aff'
  },
  gradient: {
    stop1Color: '#ae00ff',
    stop2Color: '#0755fe',
    stop3Color: '#ffffff'
  }
};

// Creamos los objetos canvas nativos para poder inspectarlos visualmente
const radialCanvas = document.createElement('canvas');
radialCanvas.width = 512;
radialCanvas.height = 512;

const gradientCanvas = document.createElement('canvas');
gradientCanvas.width = 16;
gradientCanvas.height = 256;

function updateRadialCanvas() {
  const ctx = radialCanvas.getContext('2d');
  const grad = ctx.createRadialGradient(256, 256, textureSettings.radial.innerRadius, 256, 256, textureSettings.radial.outerRadius);
  grad.addColorStop(0.0, textureSettings.radial.colorCenter);
  grad.addColorStop(0.9, textureSettings.radial.colorMiddle);
  grad.addColorStop(1.0, textureSettings.radial.colorOuter);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
}

function updateGradientCanvas() {
  const ctx = gradientCanvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0.1, textureSettings.gradient.stop1Color);
  grad.addColorStop(0.4, textureSettings.gradient.stop2Color);
  grad.addColorStop(0.9, textureSettings.gradient.stop3Color);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 16, 256);
}

// Inicializar contenido de los canvas
updateRadialCanvas();
updateGradientCanvas();

const radialTex = new THREE.CanvasTexture(radialCanvas);
radialTex.colorSpace = THREE.SRGBColorSpace;

const gradientTex = new THREE.CanvasTexture(gradientCanvas);
gradientTex.colorSpace = THREE.SRGBColorSpace;

// --- 3. Materiales y Configuración de Textura Independiente ------------------
const baseMaterialConfig = { texture: 'ninguna' };
const material = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transmission: 0.5,
  ior: 1.5,
  roughness: 0.2,
  metalness: 0.1,
  specularIntensity: 1.0,
  specularColor: new THREE.Color(0xffffff)
});

const iridMatConfig = { texture: 'ninguna' };
const iridMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  transmission: 0.2,
  ior: 1.5,
  roughness: 0.1,
  metalness: 0.0,
  iridescence: 0.8,
  iridescenceIOR: 1.6,
  specularIntensity: 1.0,
  specularColor: new THREE.Color(0xffffff)
});

const chosen = { material: 'base' };

function applyMaterialTexture(mat, config) {
  if (config.texture === 'radial') {
    mat.map = radialTex;
  } else if (config.texture === 'gradient') {
    mat.map = gradientTex;
  } else {
    mat.map = null;
  }
  mat.needsUpdate = true;
  updateInspectorView();
}

// Inspector visual en la esquina superior izquierda
const inspectorContainer = document.getElementById('texture-inspector-container');
let currentInspectedCanvas = null;

function updateInspectorView() {
  // Determinar qué textura mostrar en función del material activo en el selector
  let targetTexType = chosen.material === 'base' ? baseMaterialConfig.texture : iridMatConfig.texture;
  
  if (currentInspectedCanvas) {
    currentInspectedCanvas.remove();
    currentInspectedCanvas = null;
  }

  if (targetTexType === 'radial') {
    currentInspectedCanvas = radialCanvas.cloneNode(true);
  } else if (targetTexType === 'gradient') {
    currentInspectedCanvas = gradientCanvas.cloneNode(true);
  }

  if (currentInspectedCanvas) {
    inspectorContainer.appendChild(currentInspectedCanvas);
    inspectorContainer.style.display = 'flex';
  } else {
    inspectorContainer.style.display = 'none';
  }
}

// --- 4. Cargar Modelo 3D ------------------------------------------------------
const loader = new GLTFLoader();
let modelMesh;
loader.load('metaballs.glb', gltf => {
  modelMesh = gltf.scene;
  const box = new THREE.Box3().setFromObject(modelMesh);
  const center = new THREE.Vector3();
  box.getCenter(center);
  modelMesh.position.sub(center);
  scene.add(modelMesh);
  
  applySelectedMaterial();
}, undefined, err => console.error("Error cargando GLB:", err));

function applySelectedMaterial() {
  if (!modelMesh) return;
  const activeMat = chosen.material === 'base' ? material : iridMat;
  modelMesh.traverse(c => {
    if (c.isMesh) c.material = activeMat;
  });
  updateInspectorView();
}

// --- 5. Sistema de Luces y Agrupación -----------------------------------------
const lights = [];
const lightFolders = [];
const lightGroup = new THREE.Group();
scene.add(lightGroup);

const gui = new GUI();
const lightsMainFolder = gui.addFolder('Iluminación');

const lightSettings = {
  gizmosVisible: true,
  lightCount: 4
};

lightsMainFolder.add(lightSettings, 'gizmosVisible').name('Mostrar Gizmos').onChange(value => {
  lights.forEach(l => {
    if (l.helper) l.helper.visible = value;
  });
});

function createSpotLight(idx) {
  const l = new THREE.SpotLight(0xffffff, 2, 15, Math.PI / 6, 0.5, 1);
  const positions = [
    {x: -4, z: 4},
    {x: 4, z: 4},
    {x: 4, z: -4},
    {x: -4, z: -4}
  ];
  const p = positions[idx % positions.length];
  l.position.set(p.x, 3, p.z);
  l.target.position.set(0, 0, 0);
  scene.add(l.target);
  lightGroup.add(l);

  const helper = new SpotLightHelper(l, 0xffffff);
  helper.visible = lightSettings.gizmosVisible;
  scene.add(helper);
  l.helper = helper;

  const sphereGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sphere = new THREE.Mesh(sphereGeo, sphereMat);
  l.add(sphere);

  return l;
}

function updateLightFolders() {
  lightFolders.forEach(f => f.destroy());
  lightFolders.length = 0;

  lights.forEach((l, i) => {
    const lf = lightsMainFolder.addFolder(`Luz ${i + 1}`);
    lf.addColor(l, 'color').onChange(() => { l.color.set(l.color); });
    lf.add(l, 'intensity', 0, 10).onChange(v => l.intensity = v);
    lf.add(l.position, 'x', -10, 10);
    lf.add(l.position, 'y', -10, 10);
    lf.add(l.position, 'z', -10, 10);
    lf.close();
    lightFolders.push(lf);
  });
}

function adjustLights(count) {
  while (lights.length > count) {
    const l = lights.pop();
    lightGroup.remove(l);
    if (l.target) scene.remove(l.target);
    if (l.helper) {
      scene.remove(l.helper);
      l.helper.dispose();
    }
  }
  while (lights.length < count) {
    lights.push(createSpotLight(lights.length));
  }
  updateLightFolders();
}

lightsMainFolder.add(lightSettings, 'lightCount', 1, 10, 1).name('Cantidad de luces').onChange(v => adjustLights(v));
lightsMainFolder.open();
adjustLights(4);

// --- 6. Controles de Texturas Procedurales en GUI ------------------------------
const texFolder = gui.addFolder('Generadores de Texturas');

const radFolder = texFolder.addFolder('Config Radial');
radFolder.add(textureSettings.radial, 'innerRadius', 0, 200).onChange(() => { updateRadialCanvas(); radialTex.needsUpdate = true; });
radFolder.add(textureSettings.radial, 'outerRadius', 50, 400).onChange(() => { updateRadialCanvas(); radialTex.needsUpdate = true; });
radFolder.addColor(textureSettings.radial, 'colorCenter').onChange(() => { updateRadialCanvas(); radialTex.needsUpdate = true; });
radFolder.addColor(textureSettings.radial, 'colorMiddle').onChange(() => { updateRadialCanvas(); radialTex.needsUpdate = true; });
radFolder.addColor(textureSettings.radial, 'colorOuter').onChange(() => { updateRadialCanvas(); radialTex.needsUpdate = true; });
radFolder.close();

const gradFolder = texFolder.addFolder('Config Gradient');
gradFolder.addColor(textureSettings.gradient, 'stop1Color').onChange(() => { updateGradientCanvas(); gradientTex.needsUpdate = true; });
gradFolder.addColor(textureSettings.gradient, 'stop2Color').onChange(() => { updateGradientCanvas(); gradientTex.needsUpdate = true; });
gradFolder.addColor(textureSettings.gradient, 'stop3Color').onChange(() => { updateGradientCanvas(); gradientTex.needsUpdate = true; });
gradFolder.close();
texFolder.close();

// --- 7. Controles de Materiales en GUI ----------------------------------------
const matChoiceFolder = gui.addFolder('MATERIAL ELEGIDO');
matChoiceFolder.add(chosen, 'material', ['base', 'iridiscente']).onChange(() => applySelectedMaterial());
matChoiceFolder.open();

const matFolder = gui.addFolder('Base Material');
matFolder.addColor(material, 'color');
// Selector de textura justo debajo del color
matFolder.add(baseMaterialConfig, 'texture', ['ninguna', 'radial', 'gradient']).name('Textura').onChange(v => {
  applyMaterialTexture(material, baseMaterialConfig);
});
matFolder.add(material, 'transmission', 0, 1);
matFolder.add(material, 'ior', 1, 3);
matFolder.add(material, 'roughness', 0, 1);
matFolder.add(material, 'metalness', 0, 1);
matFolder.add(material, 'specularIntensity', 0, 1);
matFolder.addColor(material, 'specularColor');
matFolder.close();

const iridFolder = gui.addFolder('Iridiscente Mat');
iridFolder.addColor(iridMat, 'color');
// Selector de textura justo debajo del color
iridFolder.add(iridMatConfig, 'texture', ['ninguna', 'radial', 'gradient']).name('Textura').onChange(v => {
  applyMaterialTexture(iridMat, iridMatConfig);
});
iridFolder.add(iridMat, 'iridescence', 0, 1).name('Iridiscencia');
iridFolder.add(iridMat, 'iridescenceIOR', 1, 3).name('Iridiscent IOR');
iridFolder.add(iridMat, 'transmission', 0, 1);
iridFolder.add(iridMat, 'roughness', 0, 1);
iridFolder.add(iridMat, 'metalness', 0, 1);
iridFolder.add(iridMat, 'specularIntensity', 0, 1);
iridFolder.addColor(iridMat, 'specularColor');
iridFolder.close();

// Inicializar la vista del inspector por defecto
updateInspectorView();

// --- 8. Bucle de Animación ----------------------------------------------------
function animate() {
  requestAnimationFrame(animate);
  if (modelMesh) modelMesh.rotation.y += 0.005;
  
  lights.forEach(l => { 
    if (l.helper && typeof l.helper.update === 'function') {
      l.helper.update(); 
    }
  });

  controls.update();
  renderer.render(scene, camera);
}
animate();

// --- 9. Redimensionar ventana -------------------------------------------------
window.addEventListener('resize', () => {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});
</script>
</body>
</html>