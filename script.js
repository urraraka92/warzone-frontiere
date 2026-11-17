import * as THREE from 'three';

const canvas = document.getElementById('battlefield');
const startScreen = document.getElementById('start-screen');
const startButton = document.getElementById('start-button');
const toast = document.getElementById('toast');
const gameOverPanel = document.getElementById('game-over');
const endKicker = document.getElementById('end-kicker');
const endTitle = document.getElementById('end-title');
const endCopy = document.getElementById('end-copy');

const feed = document.getElementById('feed');
const clock = document.getElementById('clock');
const baseStatusEl = document.getElementById('base-status');
const enemyCountEl = document.getElementById('enemy-count');
const captureValueEl = document.getElementById('capture-value');
const captureMeterEl = document.getElementById('capture-meter');
const healthValueEl = document.getElementById('health-value');
const healthMeterEl = document.getElementById('health-meter');
const speedValueEl = document.getElementById('speed-value');
const altitudeValueEl = document.getElementById('altitude-value');
const vehicleNameEl = document.getElementById('vehicle-name');
const vehicleRoleEl = document.getElementById('vehicle-role');
const weaponNameEl = document.getElementById('weapon-name');
const deployLabelEl = document.getElementById('deploy-label');
const deployIconEl = document.getElementById('deploy-icon');
const vehicleButtons = [...document.querySelectorAll('.vehicle-choice')];
const deployButton = document.getElementById('deploy-button');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setClearColor(0x0d1a16, 1);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9ab4a0, 26, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 10, 18);
scene.add(camera);

const ambientLight = new THREE.HemisphereLight(0xb9d3c0, 0x20271d, 1.3);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xf8d7a2, 1.2);
sunLight.position.set(18, 28, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -60;
sunLight.shadow.camera.right = 60;
sunLight.shadow.camera.top = 60;
sunLight.shadow.camera.bottom = -60;
scene.add(sunLight);

const clockState = { elapsed: 0, minute: 42, hour: 6 };
const keys = {};
const projectiles = [];
const worldActors = [];
let isStarted = false;
let missionState = 'active';
let activeVehicle = 'tank';
let lastTime = 0;

const player = {
  mesh: null,
  type: 'tank',
  health: 100,
  alive: true,
  heading: 0,
  altitude: 18,
  moveSpeed: 0,
  fireCooldown: 0,
  targetVehicle: 'tank',
  position: new THREE.Vector3(-18, 1.2, 8),
};

const playerVisuals = {
  tank: null,
  plane: null,
  soldier: null,
};

const mission = {
  enemyCapture: 0,
  enemyBaseHealth: 100,
  alliedBaseHealth: 100,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function setFeed(label) {
  const timeText = `${String(clockState.hour).padStart(2, '0')}:${String(clockState.minute).padStart(2, '0')}`;
  feed.innerHTML = `<span class="feed-time">${timeText}</span><span>${label}</span>`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => toast.classList.remove('visible'), 1700);
}

function setClock() {
  const timeText = `${String(clockState.hour).padStart(2, '0')}:${String(clockState.minute).padStart(2, '0')}`;
  clock.textContent = timeText;
}

function updateHUD() {
  const t = player.type;
  if (t === 'tank') {
    vehicleNameEl.textContent = 'M1A2 ABRAMS';
    vehicleRoleEl.textContent = 'CHAR DE COMBAT · ALPHA 01';
    weaponNameEl.textContent = 'CANON 120 MM';
  } else if (t === 'plane') {
    vehicleNameEl.textContent = 'P-51 MUSTANG';
    vehicleRoleEl.textContent = 'AVION DE SUPPORT · BATAILLON 3';
    weaponNameEl.textContent = 'MITRAILLEUSES 12,7 MM';
  } else {
    vehicleNameEl.textContent = 'INFANTERIE';
    vehicleRoleEl.textContent = 'SOLDAT DE FRONT · ÉQUIPE CHARLIE';
    weaponNameEl.textContent = 'FUSIL DE PRÉCISION';
  }

  healthValueEl.textContent = `${Math.round(player.health)}%`;
  healthMeterEl.style.width = `${Math.max(0, player.health)}%`;
  speedValueEl.textContent = String(Math.round(Math.abs(player.moveSpeed) * 8)).padStart(2, '0');
  altitudeValueEl.textContent = String(Math.round(player.altitude)).padStart(3, '0');

  const capturePercent = Math.round(mission.enemyCapture);
  captureValueEl.textContent = `${capturePercent}%`;
  captureMeterEl.style.width = `${capturePercent}%`;

  const enemyAlive = worldActors.filter((actor) => actor.team === 'enemy' && actor.alive).length;
  enemyCountEl.textContent = String(enemyAlive);

  const baseState = mission.enemyCapture >= 100 ? 'CAPTURÉE' : 'À CAPTURER';
  baseStatusEl.textContent = baseState;
  if (mission.enemyCapture >= 100) {
    baseStatusEl.style.color = '#f6cf67';
  }

  const healthColor = player.health > 60 ? '#7fe7a1' : player.health > 30 ? '#f7c76c' : '#ff7d7d';
  healthMeterEl.style.background = `linear-gradient(90deg, ${healthColor}, #f9f0bf)`;
}

function updateVehicleSelection() {
  vehicleButtons.forEach((button) => {
    const isSelected = button.dataset.vehicle === activeVehicle;
    button.classList.toggle('selected', isSelected);
  });
}

function setVehicle(mode) {
  activeVehicle = mode;
  updateVehicleSelection();

  if (mode === 'tank') {
    player.type = 'tank';
    player.altitude = 0;
    if (player.mesh) {
      player.mesh.position.y = 1.2;
    }
  } else if (mode === 'plane') {
    player.type = 'plane';
    player.altitude = clamp(player.altitude || 18, 10, 35);
  } else {
    player.type = 'soldier';
    player.altitude = 0;
  }

  if (player.mesh) {
    player.mesh.visible = true;
  }

  updateHUD();
}

function createTerrain() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({
      color: 0x53694e,
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.position.y = -1;
  scene.add(ground);

  const path = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.12, 120),
    new THREE.MeshStandardMaterial({ color: 0x685b3d, roughness: 1 }),
  );
  path.position.set(0, -0.35, 0);
  path.rotation.y = Math.PI / 16;
  path.receiveShadow = true;
  scene.add(path);

  for (let i = 0; i < 18; i += 1) {
    const trench = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.7, 10 + Math.random() * 12),
      new THREE.MeshStandardMaterial({ color: 0x384b2a, roughness: 1 }),
    );
    trench.position.set(-40 + i * 5, -0.4, -24 + (i % 4) * 18);
    trench.rotation.y = (Math.random() - 0.5) * 0.8;
    trench.receiveShadow = true;
    scene.add(trench);
  }

  for (let i = 0; i < 24; i += 1) {
    const post = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, 1.8, 5),
      new THREE.MeshStandardMaterial({ color: 0x8a7a5c }),
    );
    post.position.set(-52 + i * 4.5, 0.9, 34 + (i % 5) * 2);
    post.castShadow = true;
    scene.add(post);
  }

  const fogLine = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 18),
    new THREE.MeshBasicMaterial({ color: 0x8ea693, transparent: true, opacity: 0.08 }),
  );
  fogLine.rotation.x = -Math.PI / 2;
  fogLine.position.y = 0.05;
  fogLine.position.z = -52;
  scene.add(fogLine);
}

function createBase(position, team) {
  const group = new THREE.Group();
  const baseColor = team === 'allied' ? 0x74b985 : 0xd26464;
  const wallMaterial = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0.1 });
  const foundation = new THREE.Mesh(new THREE.BoxGeometry(12, 3, 10), wallMaterial);
  foundation.position.y = 1.5;
  foundation.castShadow = true;
  foundation.receiveShadow = true;
  group.add(foundation);

  const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.2, 12, 10), wallMaterial);
  tower.position.y = 7;
  tower.castShadow = true;
  group.add(tower);

  const flagPole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.06, 5.4, 5),
    new THREE.MeshStandardMaterial({ color: 0xece7d2 }),
  );
  flagPole.position.set(3.2, 8, 0);
  group.add(flagPole);

  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.4, 0.08),
    new THREE.MeshStandardMaterial({ color: team === 'allied' ? 0x7cd5a6 : 0xff6d6d });
  );
  flag.position.set(4.6, 9.4, 0);
  group.add(flag);

  group.position.copy(position);
  scene.add(group);

  return { group, team, position: group.position.clone(), health: team === 'allied' ? 100 : 100 };
}

function makeVehicleMesh(kind) {
  const group = new THREE.Group();

  if (kind === 'tank') {
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.5, 1.5, 2.4),
      new THREE.MeshStandardMaterial({ color: 0x7dd39d, metalness: 0.3, roughness: 0.7 }),
    );
    body.castShadow = true;
    group.add(body);

    const turret = new THREE.Mesh(
      new THREE.CylinderGeometry(0.72, 0.9, 1.2, 12),
      new THREE.MeshStandardMaterial({ color: 0x4ea76b, metalness: 0.2, roughness: 0.75 }),
    );
    turret.rotation.z = Math.PI / 2;
    turret.position.set(1.4, 0.9, 0);
    turret.castShadow = true;
    group.add(turret);

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
    for (let i = 0; i < 4; i += 1) {
      const wheel = new THREE.Mesh(wheelGeo, new THREE.MeshStandardMaterial({ color: 0x242b2b, roughness: 0.8 }));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(-1.3 + i * 1.8, -0.8, 1.1);
      group.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.z = -1.1;
      group.add(wheel2);
    }
  } else if (kind === 'plane') {
    const fuselage = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.7, 5.2, 6, 12),
      new THREE.MeshStandardMaterial({ color: 0x88c1a2, metalness: 0.45, roughness: 0.4 }),
    );
    fuselage.rotation.z = Math.PI / 2;
    fuselage.castShadow = true;
    group.add(fuselage);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(6, 0.18, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x1f2b29, roughness: 0.8 }),
    );
    wing.position.set(0, 0.25, 0);
    wing.castShadow = true;
    group.add(wing);

    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.12, 0.9),
      new THREE.MeshStandardMaterial({ color: 0x1f2b29, roughness: 0.8 }),
    );
    tail.position.set(-2.8, 0.4, 0);
    group.add(tail);
  } else {
    const torso = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.45, 1.5, 4, 10),
      new THREE.MeshStandardMaterial({ color: 0x8ec7a8, roughness: 0.9 }),
    );
    torso.position.y = 1.2;
    torso.castShadow = true;
    group.add(torso);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xedcda4, roughness: 0.8 }),
    );
    head.position.y = 2.2;
    head.castShadow = true;
    group.add(head);
  }

  return group;
}

function createActor(team, type, position, hp) {
  const mesh = makeVehicleMesh(type === 'soldier' ? 'soldier' : type);
  mesh.position.copy(position);
  mesh.visible = true;
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  scene.add(mesh);

  const actor = {
    team,
    type,
    mesh,
    alive: true,
    health: hp,
    cooldown: 0,
    speed: type === 'soldier' ? 5.5 : type === 'tank' ? 9 : 12,
    damage: type === 'soldier' ? 12 : type === 'tank' ? 16 : 10,
    target: null,
    aimHeading: 0,
    vision: type === 'plane' ? 32 : 20,
    attackRange: type === 'plane' ? 26 : type === 'tank' ? 20 : 15,
  };

  worldActors.push(actor);
  return actor;
}

function createEnemySquad() {
  const enemyPositions = [
    new THREE.Vector3(26, 0, 16),
    new THREE.Vector3(36, 0, 28),
    new THREE.Vector3(20, 0, 32),
    new THREE.Vector3(42, 0, 16),
    new THREE.Vector3(34, 0, 8),
    new THREE.Vector3(48, 0, 26),
  ];

  enemyPositions.forEach((pos, index) => {
    const team = index % 3 === 0 ? 'neutral' : 'enemy';
    const actor = createActor(team, 'soldier', pos, team === 'enemy' ? 70 : 50);
    actor.speed = team === 'enemy' ? 4.6 : 4.2;
    actor.attackRange = 18;
  });
}

function createFriendlySquad() {
  const alliedPositions = [
    new THREE.Vector3(-30, 0, -12),
    new THREE.Vector3(-34, 0, -22),
    new THREE.Vector3(-24, 0, -20),
    new THREE.Vector3(-18, 0, -8),
    new THREE.Vector3(-40, 0, -28),
  ];

  alliedPositions.forEach((pos) => {
    createActor('allied', 'soldier', pos, 75);
  });
}

function makePlayerVehicle() {
  const vehicleGroup = makeVehicleMesh('tank');
  vehicleGroup.position.copy(player.position);
  vehicleGroup.position.y = 1.2;
  scene.add(vehicleGroup);
  playerVisuals.tank = vehicleGroup;

  const planeGroup = makeVehicleMesh('plane');
  planeGroup.position.copy(player.position);
  planeGroup.position.y = 10;
  scene.add(planeGroup);
  playerVisuals.plane = planeGroup;

  const soldierGroup = makeVehicleMesh('soldier');
  soldierGroup.position.copy(player.position);
  soldierGroup.position.y = 0;
  scene.add(soldierGroup);
  playerVisuals.soldier = soldierGroup;

  player.mesh = playerVisuals.tank;
  player.mesh.visible = true;
}

const alliedBase = createBase(new THREE.Vector3(-36, 0, -18), 'allied');
const enemyBase = createBase(new THREE.Vector3(36, 0, 20), 'enemy');
createFriendlySquad();
createEnemySquad();
makePlayerVehicle();

function findClosestOpponent(actor) {
  let best = null;
  let bestDistance = Infinity;

  for (const other of worldActors) {
    if (!other.alive || other.team === actor.team) continue;
    if (actor.team === 'neutral' && (other.team === 'neutral' || other.team === 'allied')) {
      continue;
    }
    const dx = other.mesh.position.x - actor.mesh.position.x;
    const dz = other.mesh.position.z - actor.mesh.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = other;
    }
  }

  if (actor.team === 'enemy') {
    const playerDist = actor.mesh.position.distanceTo(player.mesh.position);
    if (playerDist < bestDistance) {
      best = { mesh: player.mesh, team: 'allied', alive: true, health: player.health, damage: 12 };
      bestDistance = playerDist;
    }
  }

  return best;
}

function spawnProjectile(team, origin, direction, damage, speed = 50) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 10, 10),
    new THREE.MeshStandardMaterial({ color: team === 'allied' ? 0x8fe1ff : team === 'enemy' ? 0xff7b7b : 0xf2d15f, emissive: team === 'allied' ? 0x2e6d7a : 0x6b1d1d, emissiveIntensity: 0.5 }),
  );
  mesh.position.copy(origin);
  scene.add(mesh);

  projectiles.push({
    mesh,
    velocity: direction.clone().normalize().multiplyScalar(speed),
    team,
    damage,
    life: 2.2,
  });
}

function damageActor(actor, amount) {
  if (!actor || !actor.alive) return;
  actor.health -= amount;
  if (actor.health <= 0) {
    actor.alive = false;
    actor.mesh.visible = false;
    if (actor.team === 'enemy' || actor.team === 'neutral') {
      setFeed('ennemi neutralisé');
    }
  }
}

function damagePlayer(amount) {
  if (!player.alive) return;
  player.health = clamp(player.health - amount, 0, 100);
  if (player.health <= 0) {
    player.alive = false;
    missionState = 'defeat';
    endKicker.textContent = 'MISSION TERMINÉE';
    endTitle.innerHTML = 'ZONE<br /><em>PERDUE</em>';
    endCopy.textContent = 'Votre escouade a été anéantie. Reprenez le terrain et tenez la ligne de front.';
    gameOverPanel.classList.add('visible');
    setFeed('votre unité est hors de combat');
  }
}

function updateActors(delta) {
  const actors = [...worldActors];
  for (const actor of actors) {
    if (!actor.alive) continue;
    actor.cooldown = Math.max(0, actor.cooldown - delta);

    const target = findClosestOpponent(actor);
    if (!target || !target.alive) {
      continue;
    }

    const toTarget = new THREE.Vector3().subVectors(target.mesh.position, actor.mesh.position);
    const distance = toTarget.length();
    const desiredDir = toTarget.clone().normalize();

    if (distance > actor.attackRange * 0.7) {
      actor.mesh.position.addScaledVector(desiredDir, actor.speed * delta * 0.6);
      actor.mesh.lookAt(target.mesh.position.x, actor.mesh.position.y + 1.2, target.mesh.position.z);
    }

    if (distance < actor.attackRange && actor.cooldown <= 0) {
      const shotOrigin = actor.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      const dir = desiredDir.clone();
      const damage = actor.damage;
      spawnProjectile(actor.team, shotOrigin, dir, damage, actor.team === 'allied' ? 46 : 42);
      actor.cooldown = actor.team === 'enemy' ? 1.1 : 1.3;
    }
  }
}

function firePlayerShot() {
  if (!isStarted || missionState !== 'active' || !player.alive) return;
  if (player.fireCooldown > 0) return;

  let direction = new THREE.Vector3(0, 0, -1);
  let origin = player.mesh.position.clone();

  if (player.type === 'tank') {
    direction.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    origin = player.mesh.position.clone().add(new THREE.Vector3(0, 1.3, 0));
  } else if (player.type === 'plane') {
    direction.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    origin = player.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
  } else {
    direction.set(Math.sin(player.heading), 0, Math.cos(player.heading));
    origin = player.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
  }

  spawnProjectile('allied', origin, direction, player.type === 'tank' ? 20 : 14, 58);
  player.fireCooldown = player.type === 'tank' ? 0.68 : 0.42;
  showToast(player.type === 'tank' ? 'Tir de char' : 'Tir de support');
}

function updateProjectiles(delta) {
  for (let i = projectiles.length - 1; i >= 0; i -= 1) {
    const projectile = projectiles[i];
    projectile.mesh.position.addScaledVector(projectile.velocity, delta);
    projectile.life -= delta;

    if (projectile.life <= 0) {
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    if (projectile.mesh.position.length() > 220) {
      scene.remove(projectile.mesh);
      projectiles.splice(i, 1);
      continue;
    }

    if (projectile.team === 'allied') {
      const enemyDist = projectile.mesh.position.distanceTo(enemyBase.group.position);
      if (enemyDist < 8) {
        mission.enemyCapture = clamp(mission.enemyCapture + 7, 0, 100);
        mission.enemyBaseHealth = clamp(mission.enemyBaseHealth - 10, 0, 100);
        if (mission.enemyCapture >= 100) {
          setFeed('base ennemie capturée');
          missionState = 'victory';
          endKicker.textContent = 'MISSION RÉUSSIE';
          endTitle.innerHTML = 'SECTEUR<br /><em>SÉCURISÉ</em>';
          endCopy.textContent = 'La base adverse est tombée. La ligne de front est désormais sous votre contrôle.';
          gameOverPanel.classList.add('visible');
        }
        scene.remove(projectile.mesh);
        projectiles.splice(i, 1);
        continue;
      }
    }

    if (projectile.team === 'enemy' || projectile.team === 'neutral') {
      const alliedDist = projectile.mesh.position.distanceTo(alliedBase.group.position);
      if (alliedDist < 8) {
        mission.alliedBaseHealth = clamp(mission.alliedBaseHealth - 6, 0, 100);
        mission.enemyCapture = clamp(mission.enemyCapture - 2, 0, 100);
        if (mission.alliedBaseHealth <= 0) {
          missionState = 'defeat';
          endKicker.textContent = 'MISSION TERMINÉE';
          endTitle.innerHTML = 'BASE<br /><em>DÉFENDUE</em>';
          endCopy.textContent = 'La base alliée a été détruite. La mission est perdue.';
          gameOverPanel.classList.add('visible');
        }
        scene.remove(projectile.mesh);
        projectiles.splice(i, 1);
        continue;
      }
    }

    for (const actor of worldActors) {
      if (!actor.alive || actor.team === projectile.team) continue;
      if (projectile.mesh.position.distanceTo(actor.mesh.position) < 1.3) {
        damageActor(actor, projectile.damage);
        scene.remove(projectile.mesh);
        projectiles.splice(i, 1);
        break;
      }
    }
  }
}

function updatePlayer(delta) {
  if (!player.alive) return;

  player.fireCooldown = Math.max(0, player.fireCooldown - delta);
  const move = new THREE.Vector3();

  if (keys['w']) move.z -= 1;
  if (keys['s']) move.z += 1;
  if (keys['a']) move.x -= 1;
  if (keys['d']) move.x += 1;

  if (move.lengthSq() > 0) {
    move.normalize();
  }

  const forward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
  const strafe = new THREE.Vector3(Math.cos(player.heading), 0, -Math.sin(player.heading));

  if (player.type === 'tank' || player.type === 'soldier') {
    const nextX = player.mesh.position.x + (move.x * strafe.x + move.z * forward.x) * 9 * delta;
    const nextZ = player.mesh.position.z + (move.x * strafe.z + move.z * forward.z) * 9 * delta;
    player.mesh.position.x = clamp(nextX, -55, 55);
    player.mesh.position.z = clamp(nextZ, -55, 55);

    if (move.lengthSq() > 0) {
      const desiredHeading = Math.atan2(move.x, move.z);
      player.heading = desiredHeading;
    }

    player.moveSpeed = move.length() * 9;
    player.mesh.rotation.y = player.heading;
    player.mesh.position.y = player.type === 'tank' ? 1.2 : 0.2;
    player.altitude = 0;
  }

  if (player.type === 'plane') {
    player.moveSpeed = 0;
    if (keys['w']) {
      player.moveSpeed += 14;
    }
    if (keys['s']) {
      player.moveSpeed -= 8;
    }
    if (keys['a']) {
      player.heading += 1.6 * delta;
    }
    if (keys['d']) {
      player.heading -= 1.6 * delta;
    }
    if (keys['q']) {
      player.altitude = clamp(player.altitude - 18 * delta, 8, 38);
    }
    if (keys['e']) {
      player.altitude = clamp(player.altitude + 18 * delta, 8, 38);
    }

    const pForward = new THREE.Vector3(Math.sin(player.heading), 0, Math.cos(player.heading));
    player.mesh.position.addScaledVector(pForward, player.moveSpeed * delta);
    player.mesh.position.x = clamp(player.mesh.position.x, -58, 58);
    player.mesh.position.z = clamp(player.mesh.position.z, -58, 58);
    player.mesh.position.y = player.altitude;
    player.mesh.rotation.y = player.heading;
    player.mesh.rotation.z = -Math.sin(player.heading) * 0.18;
    player.moveSpeed = Math.abs(player.moveSpeed);
  }

  const targetPosition = player.mesh.position.clone();
  const desiredCamera = targetPosition.clone().add(new THREE.Vector3(0, player.type === 'plane' ? 18 : 9, player.type === 'plane' ? 18 : 14));
  camera.position.lerp(desiredCamera, 0.08);
  const lookAtTarget = targetPosition.clone().add(new THREE.Vector3(0, 2, 0));
  camera.lookAt(lookAtTarget);

  if (player.mesh.position.distanceTo(enemyBase.group.position) < 12) {
    mission.enemyCapture = clamp(mission.enemyCapture + 0.6 * delta, 0, 100);
  }

  player.mesh.visible = true;
  if (player.mesh === playerVisuals.tank) {
    playerVisuals.plane.visible = false;
    playerVisuals.soldier.visible = false;
  } else if (player.mesh === playerVisuals.plane) {
    playerVisuals.tank.visible = false;
    playerVisuals.soldier.visible = false;
  } else {
    playerVisuals.tank.visible = false;
    playerVisuals.plane.visible = false;
  }
}

function switchVehicle(mode) {
  if (!isStarted) return;
  if (mode === 'tank') {
    player.type = 'tank';
    activeVehicle = 'tank';
    player.mesh = playerVisuals.tank;
    player.mesh.visible = true;
    player.position.copy(player.mesh.position);
  } else if (mode === 'plane') {
    player.type = 'plane';
    activeVehicle = 'plane';
    player.mesh = playerVisuals.plane;
    player.mesh.visible = true;
    player.position.copy(player.mesh.position);
  }

  updateVehicleSelection();
  updateHUD();
}

function toggleDeployment() {
  if (!isStarted) return;

  if (player.type === 'tank' || player.type === 'plane') {
    player.mesh = playerVisuals.soldier;
    player.type = 'soldier';
    deployLabelEl.textContent = 'REMONTER';
    deployIconEl.textContent = '↗';
    player.mesh.position.copy(playerVisuals.tank.position.clone());
    player.mesh.visible = true;
  } else {
    activeVehicle = player.targetVehicle || 'tank';
    player.mesh = playerVisuals[activeVehicle];
    player.type = activeVehicle;
    deployLabelEl.textContent = 'SORTIR';
    deployIconEl.textContent = '↘';
  }

  updateHUD();
}

function syncDeploymentButton() {
  if (player.type === 'soldier') {
    deployLabelEl.textContent = 'REMONTER';
    deployIconEl.textContent = '↗';
  } else {
    deployLabelEl.textContent = 'SORTIR';
    deployIconEl.textContent = '↘';
  }
}

function updateMissionState() {
  const enemyAlive = worldActors.filter((actor) => actor.team === 'enemy' && actor.alive).length;
  enemyCountEl.textContent = String(enemyAlive);
  if (enemyAlive <= 0 && mission.enemyCapture < 100) {
    mission.enemyCapture = clamp(mission.enemyCapture + 32, 0, 100);
  }

  if (mission.enemyCapture >= 100 && missionState === 'active') {
    missionState = 'victory';
    endKicker.textContent = 'MISSION RÉUSSIE';
    endTitle.innerHTML = 'SECTEUR<br /><em>SÉCURISÉ</em>';
    endCopy.textContent = 'Les forces ennemies sont éliminées et la base est désormais sous contrôle.';
    gameOverPanel.classList.add('visible');
  }
}

function startGame() {
  isStarted = true;
  startScreen.classList.add('hidden');
  setFeed('mission active');
  showToast('opération lancée');
  setVehicle('tank');
  syncDeploymentButton();
}

function animate(now) {
  const delta = Math.min((now - lastTime) / 1000 || 0.016, 0.033);
  lastTime = now;

  if (isStarted) {
    if (missionState === 'active') {
      clockState.minute = (clockState.minute + Math.floor(delta * 6)) % 60;
      clockState.hour = 6 + Math.floor((clockState.minute + 1) / 60);
      setClock();

      updatePlayer(delta);
      updateActors(delta);
      updateProjectiles(delta);
      updateMissionState();
      updateHUD();
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = true;

  if (key === ' ') {
    firePlayerShot();
  }

  if (key === 'f') {
    const nextMode = activeVehicle === 'tank' ? 'plane' : 'tank';
    setVehicle(nextMode);
  }

  if (key === '1') {
    setVehicle('tank');
  }

  if (key === '2') {
    setVehicle('plane');
  }

  if (key === 'e') {
    toggleDeployment();
  }
});

document.addEventListener('keyup', (event) => {
  const key = event.key.toLowerCase();
  keys[key] = false;
});

canvas.addEventListener('pointerdown', () => {
  firePlayerShot();
});

vehicleButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const choice = button.dataset.vehicle;
    if (choice === 'tank' || choice === 'plane') {
      setVehicle(choice);
    }
  });
});

deployButton.addEventListener('click', () => {
  toggleDeployment();
  syncDeploymentButton();
});

startButton.addEventListener('click', startGame);

setVehicle('tank');
updateHUD();
setFeed('unités amies déployées sur le secteur');
setClock();
requestAnimationFrame(animate);
