// ===== Three.js Module Imports =====
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

// ===== Three.js Scene Setup =====
let scene, camera, renderer, composer;
let fireParticles = [];
let smokeParticles = [];
let emberParticles = [];
let fireLight;
let logs = [];
let groundLogs = [];
let hoveredLog = null;
let hoveredFirepit = null;
let firepitStones = [];

// Game State
let gameState = {
    logs: 5,
    kindling: 10,
    fireIntensity: 0,
    isLit: false,
    logsInFire: 0
};

// Character System
let player;
let playerVelocity = new THREE.Vector3();
let playerInput = { w: false, a: false, s: false, d: false };
const MOVEMENT_SPEED = 0.1;
const ROTATION_SPEED = 0.15; // Increased rotation speed for snappier feel

// Camera State
let cameraState = {
    angleX: 0, // 0 = Camera at +Z (South), looking -Z (North)
    angleY: 0.3, // Pitch (radians)
    radius: 8.0,
    isDragging: false
};

// ===== Initialize Scene =====
function init() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a14);
    // scene.fog = new THREE.Fog(0x0a0a14, 10, 50);

    // Create camera
    camera = new THREE.PerspectiveCamera(
        60,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    camera.position.set(0, 3, 8);
    camera.lookAt(0, 0, 0);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    // Post-processing
    const renderScene = new RenderPass(scene, camera);

    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        1.5,
        0.4,
        0.85
    );
    bloomPass.threshold = 0.2; // Glows starts at 20% brightness
    bloomPass.strength = 1.5;  // Intensity
    bloomPass.radius = 0.5;    // Spread

    composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);

    // Create lighting
    const ambientLight = new THREE.AmbientLight(0x1a1a2e, 0.6); // Increased ambient for better visibility
    scene.add(ambientLight);

    // Fire point light
    fireLight = new THREE.PointLight(0xff6b35, 0, 40); // Increased max distance
    fireLight.position.set(0, 1.5, 0); // Raised slightly
    fireLight.castShadow = true;
    scene.add(fireLight);

    // Moonlight
    // Moonlight
    const moonLight = new THREE.DirectionalLight(0x9db4c0, 0.2); // Subtle intensity
    // Position will be matched to moon mesh in createMoon, but set default here
    moonLight.position.set(20, 10, 20);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 2048;
    moonLight.shadow.mapSize.height = 2048;
    moonLight.shadow.camera.left = -30;
    moonLight.shadow.camera.right = 30;
    moonLight.shadow.camera.top = 30;
    moonLight.shadow.camera.bottom = -30;
    scene.add(moonLight);
    // Expose to global/scope if needed, or find by type later. 
    // Actually, simpler to assign in createMoon or pass it. 
    // Let's make it global for simplicity or just name it.
    moonLight.name = "MoonLight";

    // Create environment
    createGround();
    createStoneRing();
    createTrees();
    createMountains();
    createStars();
    createMoon();
    createGroundLogs();
    createCharacter();

    // Event listeners
    window.addEventListener('resize', onWindowResize);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    renderer.domElement.addEventListener('click', onCanvasClick);

    // Mouse control listeners
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('contextmenu', e => e.preventDefault());

    // UI Event Listeners
    document.getElementById('logs-resource').addEventListener('click', () => {
        addLogToFire();
    });

    // Start animation loop
    animate();
}

// ===== Character System =====
function createCharacter() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x88cccc, roughness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.7; // Half height + radius
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffddaa, roughness: 0.5 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Eyes (to see direction)
    const eyeGeo = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

    const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
    leftEye.position.set(-0.1, 1.4, 0.2);
    group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeo, eyeMat);
    rightEye.position.set(0.1, 1.4, 0.2);
    group.add(rightEye);

    // Backpack (logs)
    const packGeo = new THREE.BoxGeometry(0.4, 0.5, 0.2);
    const packMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 1.0, -0.2);
    pack.castShadow = true;
    group.add(pack);

    // Initial position away from fire
    group.position.set(0, 0, 4);

    scene.add(group);
    player = group;
}

function updatePlayer() {
    if (!player) return;

    // --- Movement Logic ---
    let inputVector = new THREE.Vector3(0, 0, 0);

    // Relative to camera view
    const yaw = cameraState.angleX;

    if (playerInput.w || playerInput.s || playerInput.a || playerInput.d) {
        if (playerInput.w) {
            inputVector.x -= Math.sin(yaw);
            inputVector.z -= Math.cos(yaw);
        }
        if (playerInput.s) {
            inputVector.x += Math.sin(yaw);
            inputVector.z += Math.cos(yaw);
        }
        if (playerInput.a) {
            inputVector.x -= Math.cos(yaw);
            inputVector.z += Math.sin(yaw);
        }
        if (playerInput.d) {
            inputVector.x += Math.cos(yaw);
            inputVector.z -= Math.sin(yaw);
        }
    }

    if (inputVector.length() > 0) {
        inputVector.normalize();

        // Move
        player.position.add(inputVector.clone().multiplyScalar(MOVEMENT_SPEED));

        // Boundary Clamp (Radius 18 - keep in flat zone)
        const distSq = player.position.x * player.position.x + player.position.z * player.position.z;
        if (distSq > 18 * 18) {
            const dist = Math.sqrt(distSq);
            const ratio = 18 / dist;
            player.position.x *= ratio;
            player.position.z *= ratio;
        }

        // Rotate to face movement
        const targetRotation = Math.atan2(inputVector.x, inputVector.z);

        // Shortest path rotation logic
        let diff = targetRotation - player.rotation.y;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        player.rotation.y += diff * ROTATION_SPEED;
    }

    // --- Camera Update ---
    // Calculate camera position based on spherical coordinates
    const cx = player.position.x + cameraState.radius * Math.sin(cameraState.angleX) * Math.cos(cameraState.angleY);
    const cy = player.position.y + cameraState.radius * Math.sin(cameraState.angleY);
    const cz = player.position.z + cameraState.radius * Math.cos(cameraState.angleX) * Math.cos(cameraState.angleY);

    // Smooth camera follow
    const targetCamPos = new THREE.Vector3(cx, cy, cz);

    // Ground collision (prevent going under)
    let undershoot = 0;
    if (targetCamPos.y < 0.8) {
        undershoot = 0.8 - targetCamPos.y;
        targetCamPos.y = 0.8;
    }

    camera.position.lerp(targetCamPos, 0.2); // Slightly faster lerp for responsiveness

    // Look at player (upper body) - Adjust look target if near ground to allow looking up
    const lookTarget = player.position.clone().add(new THREE.Vector3(0, 1.2 + undershoot * 1.5, 0));
    camera.lookAt(lookTarget);
}

function getTerrainHeight(x, z) {
    // Calculate distance from center
    const dist = Math.sqrt(x * x + z * z); // Plane is X-Y initially

    // Gentle rolling hills logic
    // Only apply if far away (keep center flat for camp)
    if (dist > 20) {
        let height = Math.sin(x * 0.05) * Math.sin(z * 0.05) * 4;
        height += Math.cos(x * 0.1 + z * 0.1) * 2;

        // Perlin-ish noise approximation
        height += Math.sin(x * 0.2) * Math.cos(z * 0.2) * 1;

        // Fade in the height from radius 20 to 50
        const blend = Math.min(1, Math.max(0, (dist - 20) / 30));

        // Apply blend
        return height * blend; // Z is 'up' before we rotate
    }

    return 0;
}

// ===== Create Ground =====
function createGround() {
    // Large plane for terrain
    const groundGeometry = new THREE.PlaneGeometry(200, 200, 128, 128);

    // Apply Height Variations
    const posAttribute = groundGeometry.attributes.position;
    const vertex = new THREE.Vector3();

    for (let i = 0; i < posAttribute.count; i++) {
        vertex.fromBufferAttribute(posAttribute, i);

        vertex.z += getTerrainHeight(vertex.x, -vertex.y);

        posAttribute.setZ(i, vertex.z);
    }

    groundGeometry.computeVertexNormals();

    const groundMaterial = new THREE.MeshStandardMaterial({
        color: 0x223322, // Slightly darker green/grey
        roughness: 0.9,
        metalness: 0.1,
        // flatShading: true // Optional: for low poly look
    });

    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2; // Flat on ground
    ground.receiveShadow = true;
    scene.add(ground);
}

// ===== Create Stone Ring =====
function createStoneRing() {
    const stoneCount = 12;
    const radius = 1.5;

    for (let i = 0; i < stoneCount; i++) {
        const angle = (i / stoneCount) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const stoneGeometry = new THREE.DodecahedronGeometry(0.3, 0);
        const stoneMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.95,
            metalness: 0.05,
            emissive: 0x000000,
            emissiveIntensity: 0.8
        });
        const stone = new THREE.Mesh(stoneGeometry, stoneMaterial);
        stone.position.set(x, 0.15, z);
        stone.rotation.set(
            Math.random() * 0.5,
            Math.random() * Math.PI * 2,
            Math.random() * 0.5
        );
        stone.castShadow = true;
        stone.receiveShadow = true;
        scene.add(stone);

        // Tag stone for clicking
        stone.userData = { type: 'firepit' };
        firepitStones.push(stone);
    }

    // Create invisible sphere for unified click detection
    const hitSphere = new THREE.Mesh(
        new THREE.SphereGeometry(2, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, visible: false })
    );
    hitSphere.position.set(0, 0.5, 0);
    hitSphere.userData = { type: 'firepit-hitbox' };
    scene.add(hitSphere);
}

// ===== Create Trees =====
function createTrees() {
    const treeCount = 150; // Dense forest

    for (let i = 0; i < treeCount; i++) {
        // Random position logic covering a larger area
        const angle = Math.random() * Math.PI * 2;
        const radius = 8 + Math.random() * 80; // 8 to 88 units away
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        // Get height from terrain function
        const y = getTerrainHeight(x, z);

        // Random scale
        const scale = 0.8 + Math.random() * 0.8;

        const treeGroup = new THREE.Group();
        treeGroup.position.set(x, y, z);
        treeGroup.scale.setScalar(scale);

        // Trunk - Tapered
        // TopRad: 0.2, BotRad: 0.4, Height: 3
        const trunkGeometry = new THREE.CylinderGeometry(0.2, 0.4, 3, 7);
        const trunkMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a3a2a,
            roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);

        // Procedural Foliage (Spheres)
        const foliageColor = new THREE.Color().setHSL(0.3, 0.5 + Math.random() * 0.2, 0.15 + Math.random() * 0.1);
        const foliageMaterial = new THREE.MeshStandardMaterial({
            color: foliageColor,
            roughness: 0.8
        });

        // Main Canopy
        const mainGeo = new THREE.DodecahedronGeometry(1.5, 0);
        const mainLeaf = new THREE.Mesh(mainGeo, foliageMaterial);
        mainLeaf.position.y = 3.2;
        mainLeaf.castShadow = true;
        mainLeaf.receiveShadow = true;
        treeGroup.add(mainLeaf);

        // Sub Canopies (2-4 random lumps)
        const lumps = 2 + Math.floor(Math.random() * 3);
        for (let j = 0; j < lumps; j++) {
            const subGeo = new THREE.DodecahedronGeometry(0.8 + Math.random() * 0.6, 0);
            const subLeaf = new THREE.Mesh(subGeo, foliageMaterial);

            // Offset around the top
            const subAngle = Math.random() * Math.PI * 2;
            const subRadius = 0.6 + Math.random() * 0.7;
            const subH = 2.0 + Math.random() * 1.5; // Overlapping trunk/main

            subLeaf.position.set(
                Math.cos(subAngle) * subRadius,
                subH,
                Math.sin(subAngle) * subRadius
            );

            subLeaf.castShadow = true;
            subLeaf.receiveShadow = true;
            treeGroup.add(subLeaf);
        }

        scene.add(treeGroup);
    }
}

// ===== Create Mountains =====
function createMountains() {
    const mountainCount = 24;

    for (let i = 0; i < mountainCount; i++) {
        const theta = (i / mountainCount) * Math.PI * 2;
        const radius = 150 + Math.random() * 30; // Much further

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        // Giant cones
        const height = 80 + Math.random() * 60;
        const width = 60 + Math.random() * 30;

        const geometry = new THREE.ConeGeometry(width, height, 5); // Low poly
        const material = new THREE.MeshBasicMaterial({
            color: 0x030308, // Very dark, almost black blue for silhouette
        });

        const mountain = new THREE.Mesh(geometry, material);
        mountain.position.set(x, height / 2 - 10, z); // Lower them slightly to feel rooted

        // Rotate randomly for variety
        mountain.rotation.y = Math.random() * Math.PI;

        scene.add(mountain);
    }
}

// ===== Create Stars =====
function createStars() {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 2000;
    const positions = new Float32Array(starCount * 3);

    const radius = 500; // Sky dome distance

    for (let i = 0; i < starCount * 3; i += 3) {
        // Spherical distribution
        const theta = 2 * Math.PI * Math.random();
        const phi = Math.acos(2 * Math.random() - 1);

        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        // Only keep upper hemisphere (sky) + slightly below horizon
        if (y < -50) {
            i -= 3; // Retry
            continue;
        }

        positions[i] = x;
        positions[i + 1] = y;
        positions[i + 2] = z;
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true,
        opacity: 0.8
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
}

// ===== Create Moon =====
function createMoon() {
    const radius = 400; // Between mountains (150) and stars (500)
    const theta = Math.PI * 0.25; // Corner angle
    const phi = Math.PI * 0.3;    // Higher altitude

    const x = radius * Math.sin(phi) * Math.cos(theta);
    const y = radius * Math.cos(phi); // 400 * cos(0.4PI) approx 123 high
    const z = radius * Math.sin(phi) * Math.sin(theta);

    const geometry = new THREE.SphereGeometry(20, 32, 32);
    const material = new THREE.MeshBasicMaterial({
        color: 0xffffdd, // Pale yellow
    });

    const moon = new THREE.Mesh(geometry, material);
    moon.position.set(x, y, z); // Natural position
    scene.add(moon);

    // Update Directional Light to align with Moon
    const light = scene.getObjectByName("MoonLight");
    if (light) {
        light.position.copy(moon.position);
    }
}

// ===== Create Ground Logs (Collectible) =====
function createGroundLogs() {
    const logCount = 15;

    for (let i = 0; i < logCount; i++) {
        // Random position logic
        const angle = Math.random() * Math.PI * 2;
        const radius = 4 + Math.random() * 16; // 4 to 20 units away
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;

        const logGroup = new THREE.Group();

        const logGeometry = new THREE.CylinderGeometry(0.25, 0.25, 1.8, 8); // Bigger logs
        const logMaterial = new THREE.MeshStandardMaterial({
            color: 0x5a3a1a,
            roughness: 0.9,
            emissive: 0x000000, // Prepare for glow
            emissiveIntensity: 0.8
        });
        const log = new THREE.Mesh(logGeometry, logMaterial);
        log.rotation.z = Math.PI / 2;
        log.rotation.y = Math.random() * Math.PI; // Random rotation on ground
        log.castShadow = true;

        logGroup.add(log);
        logGroup.position.set(x, 0.15, z);

        // Tag for raycaster - IMPORTANT: Tag the MESH, or traverse group
        // Simplest is to tag the mesh with reference to the group if needed
        log.userData = { type: 'collectible-log', parentGroup: logGroup };
        logGroup.userData = { type: 'collectible-log-group' };

        groundLogs.push(logGroup);
        scene.add(logGroup);
    }
}

// ===== Add Log to Fire =====
function addLogToFire() {
    if (gameState.logs <= 0) return;

    const logGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
    const logMaterial = new THREE.MeshStandardMaterial({
        color: 0x5a3a1a,
        roughness: 0.9
    });
    const log = new THREE.Mesh(logGeometry, logMaterial);

    const angle = (logs.length / 6) * Math.PI * 2;
    const radius = 0.3;
    log.position.set(
        Math.cos(angle) * radius,
        0.2 + logs.length * 0.15,
        Math.sin(angle) * radius
    );
    log.rotation.z = Math.PI / 2 + angle;
    log.castShadow = true;

    logs.push(log);
    scene.add(log);

    gameState.logs--;
    gameState.logsInFire++;
    updateUI();
}

// ===== Light Fire =====
function lightFire() {
    if (gameState.isLit) return;
    if (gameState.logsInFire < 2) {
        console.log("Need at least 2 logs to start fire!");
        return;
    }

    gameState.isLit = true;
    gameState.fireIntensity = 30;
    updateUI();
}

// ===== Create Fire Particle =====
function createFireParticle() {
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 0.4, 0.1),
        transparent: true,
        opacity: 1
    });
    const particle = new THREE.Mesh(geometry, material);

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.3;
    particle.position.set(
        Math.cos(angle) * radius,
        0.2,
        Math.sin(angle) * radius
    );

    particle.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.005, // Reduced spread
            Math.random() * 0.015 + 0.005, // Much slower rise (was 0.01-0.04 -> 0.005-0.02)
            (Math.random() - 0.5) * 0.005
        ),
        life: 1.0,
        maxLife: Math.random() * 0.5 + 0.5,
        phase: Math.random() * Math.PI * 2
    };

    scene.add(particle);
    fireParticles.push(particle);
}

// ===== Create Smoke Particle =====
function createSmokeParticle() {
    const geometry = new THREE.SphereGeometry(0.15, 8, 8);
    const material = new THREE.MeshBasicMaterial({
        color: 0x555555,
        transparent: true,
        opacity: 0.3
    });
    const particle = new THREE.Mesh(geometry, material);

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.2;
    particle.position.set(
        Math.cos(angle) * radius,
        0.5,
        Math.sin(angle) * radius
    );

    particle.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.003,
            Math.random() * 0.008 + 0.005, // Lazy smoke
            (Math.random() - 0.5) * 0.003
        ),
        life: 1.0,
        phase: Math.random() * Math.PI * 2
    };

    scene.add(particle);
    smokeParticles.push(particle);
}

// ===== Create Ember Particle =====
function createEmberParticle() {
    const geometry = new THREE.SphereGeometry(0.03, 6, 6);
    const material = new THREE.MeshBasicMaterial({
        color: new THREE.Color(1, 0.5, 0),
        transparent: true,
        opacity: 1
    });
    const particle = new THREE.Mesh(geometry, material);

    const angle = Math.random() * Math.PI * 2;
    const radius = Math.random() * 0.4;
    particle.position.set(
        Math.cos(angle) * radius,
        0.3,
        Math.sin(angle) * radius
    );

    particle.userData = {
        velocity: new THREE.Vector3(
            (Math.random() - 0.5) * 0.005,
            Math.random() * 0.01 + 0.005,
            (Math.random() - 0.5) * 0.005
        ),
        life: 1.0,
        phase: Math.random() * Math.PI * 2
    };

    scene.add(particle);
    emberParticles.push(particle);
}

// ===== Update Particles =====
function updateParticles() {
    const time = Date.now() * 0.002;

    // Update fire particles
    for (let i = fireParticles.length - 1; i >= 0; i--) {
        const particle = fireParticles[i];
        particle.position.add(particle.userData.velocity);

        particle.position.x += Math.sin(time + particle.userData.phase) * 0.002;
        particle.position.z += Math.cos(time + particle.userData.phase) * 0.002;

        particle.userData.life -= 0.005; // Slower decay (was 0.01)

        const life = particle.userData.life;
        if (life > 0.7) {
            particle.material.color.setRGB(1, 0.4, 0.1);
        } else if (life > 0.4) {
            particle.material.color.setRGB(1, 0.6, 0.2);
        } else if (life > 0.2) {
            particle.material.color.setRGB(1, 0.8, 0.4);
        } else {
            particle.material.color.setRGB(1, 1, 0.8);
        }

        particle.material.opacity = life;
        particle.scale.setScalar(1 + (1 - life) * 0.5);

        if (particle.userData.life <= 0) {
            scene.remove(particle);
            fireParticles.splice(i, 1);
        }
    }

    // Update smoke particles
    for (let i = smokeParticles.length - 1; i >= 0; i--) {
        const particle = smokeParticles[i];
        particle.position.add(particle.userData.velocity);

        particle.position.x += Math.sin(time * 0.5 + particle.userData.phase) * 0.003;

        particle.userData.life -= 0.003; // Even slower smoke decay
        particle.material.opacity = particle.userData.life * 0.3;
        particle.scale.setScalar(1 + (1 - particle.userData.life) * 2);

        if (particle.userData.life <= 0) {
            scene.remove(particle);
            smokeParticles.splice(i, 1);
        }
    }

    // Update ember particles
    for (let i = emberParticles.length - 1; i >= 0; i--) {
        const particle = emberParticles[i];
        particle.position.add(particle.userData.velocity);

        particle.position.x += Math.sin(time * 2 + particle.userData.phase) * 0.004;

        particle.userData.life -= 0.004;
        particle.material.opacity = particle.userData.life;

        if (particle.userData.life <= 0) {
            scene.remove(particle);
            emberParticles.splice(i, 1);
        }
    }
}

// ===== Update UI =====
function updateUI() {
    document.getElementById('log-count').textContent = gameState.logs;
    document.getElementById('kindling-count').textContent = gameState.kindling;

    const fireMeter = document.getElementById('fire-meter-fill');
    fireMeter.style.width = gameState.fireIntensity + '%';

    const fireState = document.getElementById('fire-state');
    if (!gameState.isLit) {
        fireState.textContent = gameState.logsInFire > 0 ? 'Ready to Light' : 'Not Started';
    } else if (gameState.fireIntensity > 70) {
        fireState.textContent = 'Roaring Fire! 🔥';
    } else if (gameState.fireIntensity > 40) {
        fireState.textContent = 'Burning Steady';
    } else if (gameState.fireIntensity > 10) {
        fireState.textContent = 'Smoldering';
    } else {
        fireState.textContent = 'Dying Out...';
    }
}

// ===== Window Resize =====
function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
}

// ===== Input Handling =====
function onKeyDown(event) {
    switch (event.key.toLowerCase()) {
        case 'w': playerInput.w = true; break;
        case 'a': playerInput.a = true; break;
        case 's': playerInput.s = true; break;
        case 'd': playerInput.d = true; break;
    }
}

function onKeyUp(event) {
    switch (event.key.toLowerCase()) {
        case 'w': playerInput.w = false; break;
        case 'a': playerInput.a = false; break;
        case 's': playerInput.s = false; break;
        case 'd': playerInput.d = false; break;
    }
}

// ===== Mouse Input Handling =====
function onMouseDown(event) {
    if (event.button === 2) { // Right click
        cameraState.isDragging = true;
        document.body.requestPointerLock();
    }
}

function onMouseUp(event) {
    if (event.button === 2) {
        cameraState.isDragging = false;
        document.exitPointerLock();
    }
}

function onMouseMove(event) {
    if (cameraState.isDragging) {
        const sensitivity = 0.005;
        cameraState.angleX -= event.movementX * sensitivity;
        cameraState.angleY += event.movementY * sensitivity;

        // Clamp vertical angle to avoid weirdness
        // Min -0.8 (looking up from ground), Max 1.4 (high angle)
        cameraState.angleY = Math.max(-0.8, Math.min(1.4, cameraState.angleY));
        return;
    }

    // Hover Logic
    const rect = renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    // Intersect with scene children
    // We filter specifically for objects that are logs
    const intersects = raycaster.intersectObjects(scene.children, true);

    let foundLog = null;
    let foundFirepit = null;

    for (let hit of intersects) {
        if (hit.object.userData && hit.object.userData.type === 'collectible-log') {
            foundLog = hit.object;
            break;
        }
        if (hit.object.userData && hit.object.userData.type === 'firepit-hitbox') {
            foundFirepit = hit.object;
        }
    }

    if (foundLog) {
        if (hoveredLog !== foundLog) {
            // Unhighlight previous
            if (hoveredLog) hoveredLog.material.emissive.setHex(0x000000);

            // Highlight new
            hoveredLog = foundLog;
            hoveredLog.material.emissive.setHex(0x884400); // Warm glow
            document.body.style.cursor = 'pointer';
        }
        // Clear firepit if hovering log
        if (hoveredFirepit) {
            firepitStones.forEach(stone => stone.material.emissive.setHex(0x000000));
            hoveredFirepit = null;
        }
    } else if (foundFirepit) {
        // Handle firepit hover - highlight ALL stones
        if (hoveredFirepit !== foundFirepit) {
            if (hoveredFirepit) {
                // Clear previous - turn off all stones
                firepitStones.forEach(stone => stone.material.emissive.setHex(0x000000));
            }
            hoveredFirepit = foundFirepit;
            // Highlight all stones
            firepitStones.forEach(stone => stone.material.emissive.setHex(0xff4400));
            document.body.style.cursor = 'pointer';
        }
        // Clear log hover
        if (hoveredLog) {
            hoveredLog.material.emissive.setHex(0x000000);
            hoveredLog = null;
        }
    } else {
        if (hoveredLog) {
            hoveredLog.material.emissive.setHex(0x000000);
            hoveredLog = null;
        }
        if (hoveredFirepit) {
            // Clear all stone highlights
            firepitStones.forEach(stone => stone.material.emissive.setHex(0x000000));
            hoveredFirepit = null;
        }
        document.body.style.cursor = 'default';
    }
}

// ===== Interaction =====
function onCanvasClick(event) {
    // If we have a hovered log, collect it
    if (hoveredLog) {
        const logGroup = hoveredLog.userData.parentGroup;

        scene.remove(logGroup);
        // Remove from array logic if needed, but for now visual removal is key

        gameState.logs++;
        updateUI();

        hoveredLog = null;
        document.body.style.cursor = 'default';

        return; // Handled
    }

    // If we have a hovered firepit, add log to fire
    if (hoveredFirepit) {
        if (gameState.logs > 0) {
            gameState.logs--;
            gameState.logsInFire++;

            // Create visual log in fire
            const logGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1, 8);
            const logMaterial = new THREE.MeshStandardMaterial({
                color: 0x5a3a1a,
                roughness: 0.9
            });
            const log = new THREE.Mesh(logGeometry, logMaterial);
            const angle = (logs.length / 6) * Math.PI * 2;
            const radius = 0.3;
            log.position.set(
                Math.cos(angle) * radius,
                0.2 + logs.length * 0.15,
                Math.sin(angle) * radius
            );
            log.rotation.z = Math.PI / 2 + angle;
            log.castShadow = true;
            logs.push(log);
            scene.add(log);

            // Auto-ignite if we have more than 2 logs
            if (gameState.logsInFire > 2 && !gameState.isLit) {
                gameState.isLit = true;
                gameState.fireIntensity = 50;
            } else if (gameState.isLit) {
                // Boost existing fire
                gameState.fireIntensity += 20;
                if (gameState.fireIntensity > 100) gameState.fireIntensity = 100;
            }

            updateUI();
        }
        return;
    }
}


// ===== Animation Loop =====
function animate() {
    requestAnimationFrame(animate);

    // Update character
    updatePlayer();

    // Generate particles if fire is lit
    if (gameState.isLit && gameState.fireIntensity > 0) {
        // Fire particles
        if (Math.random() < 0.3) {
            createFireParticle();
        }

        // Smoke particles
        if (Math.random() < 0.15) {
            createSmokeParticle();
        }

        // Ember particles
        if (Math.random() < 0.1) {
            createEmberParticle();
        }

        // Update fire light with dynamic flicker
        const time = Date.now() * 0.005;
        const flicker = Math.sin(time * 3) * 0.15 + (Math.random() - 0.5) * 0.3 + 1.0;

        // Base intensity ramps up with fire intensity 
        // Max intensity around 100
        const baseIntensity = (gameState.fireIntensity / 100) * 100;

        fireLight.intensity = Math.max(0, baseIntensity * flicker);
        fireLight.distance = 25 + (gameState.fireIntensity / 100) * 100; // Wide reach

        // Decrease fire intensity over time
        gameState.fireIntensity -= 0.005; // 4x slower burn

        // Log consumption logic
        // Intensity 100 = 5 logs (approx 20 per log)
        if (logs.length > 0) {
            const maxLogsSupported = Math.ceil(gameState.fireIntensity / 20);
            if (logs.length > maxLogsSupported) {
                const burntLog = logs.pop(); // Remove from top
                scene.remove(burntLog);
                gameState.logsInFire = logs.length;
            }
        }
        if (gameState.fireIntensity <= 0) {
            gameState.fireIntensity = 0;
            gameState.isLit = false;
            updateUI();
        }

        // Update UI periodically
        if (Math.random() < 0.05) {
            updateUI();
        }
    }

    // Update particles
    updateParticles();

    // Render scene with bloom
    composer.render();
}

// ===== Start Game =====
init();
updateUI();
