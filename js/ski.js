var renderer, scene, camera;
var clock = new THREE.Clock();

const CARRILES = [-4, 0, 4]; 
var carrilActual = 1;        
var pos_jugador = new THREE.Vector3(0, 0, 0);
var jugador = null;
var suelo = null;

var mixer;
var animaciones = {};
var accionActual = null;
var teclas = { izquierda: false, derecha: false };

function curvaPista(z) {
  let factorDificultad = 1 + Math.abs(z) * 0.00015;
  let curvaBase = Math.sin(z * 0.012) * 14 + Math.sin(z * 0.028) * 7 + Math.cos(z * 0.006) * 4;
  return curvaBase * Math.min(factorDificultad, 1.6);
}
function crearTexturaPosteSlalom(colorFranja) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ff0000';
  ctx.fillRect(0, 0, 64, 256);
  ctx.fillStyle = colorFranja; 
  for (let y = 0; y < 256; y += 64) {
    ctx.fillRect(0, y, 64, 32);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 2);
  return texture;
}
let velocidad_avance = 20; 
const velocidad_maxima = 45; 
const rapidez_cambio_carril = 22;

var en_salto_rampa = false; 
var timer_aterrizaje = 0;
const gravedad = -30;
const impulso_salto = 12.5;
var velocidad_vertical = 0;
var en_suelo = true;
var agachado = false;
var buffer_salto = 0;             
const DURACION_BUFFER = 0.15; 

const inclinacion_maxima = THREE.MathUtils.degToRad(16);
const rapidez_inclinacion = 14;
let inclinacion_actual = 0;
var escala_y_actual = 1;
const rapidez_agachado = 18;
var objetosPista = [];
var z_generacion = 0;
const distancia_generacion = 300; 
let separacion_filas = 40;
const separacion_minima = 15;
var ultimoCarrilLibre = 1;

var geoBonus = new THREE.OctahedronGeometry(0.8);
var matBonus; 
var matInvisible = new THREE.MeshBasicMaterial({ visible: false });


var geoPoste = new THREE.CylinderGeometry(0.2, 0.2, 5, 8);
var matPoste; 
var geoRampa = new THREE.BoxGeometry(2.5, 1.2, 8);
var matRampa = new THREE.MeshPhongMaterial({ color: 0xff0000 });
var geoRoca = new THREE.DodecahedronGeometry(1.8);
var matRoca;

var geoTronco = new THREE.CylinderGeometry(0.5, 0.5, 3, 8);
var matTronco; 

var geoBonus = new THREE.OctahedronGeometry(0.8);
var matBonus; 
const paso_linea = 10;
const geoLineaDivisoria = new THREE.BoxGeometry(0.2, 0.02, paso_linea);
const geoLineaBorde = new THREE.BoxGeometry(0.35, 0.02, paso_linea);
const matLineaRoja = new THREE.MeshBasicMaterial({ color: 0xee1122 });
const perfilGrada = new THREE.Shape();
perfilGrada.moveTo(0, 0);
perfilGrada.lineTo(0, 5);
perfilGrada.lineTo(1.5, 5);
perfilGrada.lineTo(1.5, 3.5);
perfilGrada.lineTo(3, 3.5);
perfilGrada.lineTo(3, 2);
perfilGrada.lineTo(4.5, 2);
perfilGrada.lineTo(4.5, 0);
perfilGrada.closePath();
const geoGrada = new THREE.ExtrudeGeometry(perfilGrada, {
  depth: 3.0, 
  steps: 1,
  bevelEnabled: false
});
geoGrada.center();
const matGradaGrisMetalico = new THREE.MeshStandardMaterial({ 
  color: 0x888888,
  metalness: 0.85,
  roughness: 0.35
});
var juego_activo = false;
var juego_iniciado = false;
var en_animacion_muerte = false;
var puntuacion = 0;
var mejor_puntuacion = localStorage.getItem('ski_highscore') || 0;
var tiempo_carrera = 0;
var objectsToCheck = []; 
const raycaster = new THREE.Raycaster();
var uiElement = null;
var focoJugador = null;
var menuElement = null;
var btnIniciar = null;
var textoMenu = null;
var textoRecord = null;
document.addEventListener('keydown', (event) => {
    if (!juego_activo || en_animacion_muerte) return;
    switch (event.code) {
        case 'ArrowLeft':
        case 'KeyA':
          teclas.izquierda = true;
          if (carrilActual > 0) {
            carrilActual--;
            if (en_suelo) agachado = false; 
          }
          break;
        case 'ArrowRight':
        case 'KeyD':
          teclas.derecha = true;
          if (carrilActual < 2) {
            carrilActual++;
            if (en_suelo) agachado = false; 
          }
          break;
        case 'ArrowDown':
    case 'KeyS':
      if (en_suelo) {
        agachado = true;
      }
      break;
    case 'Space':
    case 'ArrowUp':
    case 'KeyW':
      event.preventDefault(); 
      agachado = false;
      buffer_salto = DURACION_BUFFER;
      break;
  }});

document.addEventListener('keyup', (event) => {
  switch (event.code) {
    case 'ArrowLeft':
    case 'KeyA':
      teclas.izquierda = false;
      break;
    case 'ArrowRight':
    case 'KeyD':
      teclas.derecha = false;
      break;
    case 'ArrowDown':
    case 'KeyS':
      agachado = false;
      break;
  }
});

function procesarSalto(delta) {
  if (buffer_salto > 0) {
    buffer_salto -= delta;

    var objetivo_actual_x = curvaPista(pos_jugador.z) + CARRILES[carrilActual];
    var enTransicion = Math.abs(pos_jugador.x - objetivo_actual_x) > 0.4;
    if (en_suelo && !enTransicion) {
      agachado = false;
      velocidad_vertical = impulso_salto;
      en_suelo = false;
      buffer_salto = 0; 
    }
  }
}

function initUI() {
  uiElement = document.createElement('div');
  uiElement.style.position = 'absolute';
  uiElement.style.top = '20px';
  uiElement.style.left = '20px';
  uiElement.style.color = '#FFF';
  uiElement.style.fontSize = '24px';
  uiElement.style.fontFamily = 'monospace';
  uiElement.style.fontWeight = 'bold';
  uiElement.style.textShadow = "2px 2px 3px #000";
  document.body.appendChild(uiElement);
  menuElement = document.createElement('div');
  menuElement.style.position = 'absolute';
  menuElement.style.top = '0';
  menuElement.style.left = '0';
  menuElement.style.width = '100%';
  menuElement.style.height = '100%';
  menuElement.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  menuElement.style.display = 'flex';
  menuElement.style.flexDirection = 'column';
  menuElement.style.justifyContent = 'center';
  menuElement.style.alignItems = 'center';
  menuElement.style.color = 'white';
  menuElement.style.fontFamily = 'monospace';
  menuElement.style.zIndex = '10';

  textoMenu = document.createElement('h1');
  textoMenu.innerHTML = 'CARGANDO RECURSOS...';
  menuElement.appendChild(textoMenu);

  textoRecord = document.createElement('h2');
  textoRecord.innerHTML = `Mejor Puntuación: ${Math.floor(mejor_puntuacion)}`;
  menuElement.appendChild(textoRecord);

  btnIniciar = document.createElement('button');
  btnIniciar.innerHTML = 'ESPERANDO...';
  btnIniciar.style.padding = '15px 30px';
  btnIniciar.style.fontSize = '24px';
  btnIniciar.style.cursor = 'not-allowed';
  btnIniciar.style.backgroundColor = '#555';
  btnIniciar.style.color = 'white';
  btnIniciar.style.border = 'none';
  btnIniciar.style.borderRadius = '8px';
  btnIniciar.disabled = true;
  
  btnIniciar.addEventListener('click', iniciarPartida);
  menuElement.appendChild(btnIniciar);
  
  document.body.appendChild(menuElement);
}

function iniciarPartida() {
  menuElement.style.display = 'none';
  juego_activo = true;
  juego_iniciado = true;
  puntuacion = 0;
  tiempo_carrera = 0;
  carrilActual = 1;
  pos_jugador.set(0, 0, 0);
  velocidad_vertical = 0;
  en_suelo = true;
  agachado = false;
  en_salto_rampa = false;
  timer_aterrizaje = 0;
  buffer_salto = 0;
  velocidad_avance = 20;
  z_generacion = 0;
  ultimoCarrilLibre = 1;
  for (let i = 0; i < objetosPista.length; i++) {
    scene.remove(objetosPista[i].mesh);
  }
  objetosPista = [];
  objectsToCheck = [];
  updateGestorPista();
  if (animaciones['esqui']) cambiarAnimacion('esqui');
  if (suelo) suelo.position.set(0, 0, 0);
}

function terminarJuego() {
  if (en_animacion_muerte) return;
  
  en_animacion_muerte = true;
  velocidad_avance = 0;
  velocidad_vertical = 0;
  if (!en_suelo) {
    pos_jugador.y = 0;
    en_suelo = true;
  }
  cambiarAnimacion('caida', 0.2);
  if (puntuacion > mejor_puntuacion) {
    mejor_puntuacion = puntuacion;
    localStorage.setItem('ski_highscore', mejor_puntuacion);
    textoRecord.innerHTML = `Mejor Puntuación: ${Math.floor(mejor_puntuacion)} (¡NUEVO RÉCORD!)`;
    textoRecord.style.color = '#FFD700';
  } else {
    textoRecord.innerHTML = `Mejor Puntuación: ${Math.floor(mejor_puntuacion)}`;
    textoRecord.style.color = 'white';
  }
  setTimeout(() => {
    juego_activo = false;
    juego_iniciado = false;
    en_animacion_muerte = false;
    textoMenu.innerHTML = '¡JUEGO TERMINADO!';
    btnIniciar.innerHTML = 'REINTENTAR';
    menuElement.style.display = 'flex';
  }, 2500); 
}

function cargarAnimacion(loader, ruta, nombre, loop = true) {
  loader.load(ruta, (animObject) => {
    const action = mixer.clipAction(animObject.animations[0]);
    if (!loop) {
      action.setLoop(THREE.LoopOnce);
      action.clampWhenFinished = true;
    }
    animaciones[nombre] = action;
    if (nombre === 'esqui' && !accionActual) {
      accionActual = action;
      accionActual.play();
    }
  });
}

function cambiarAnimacion(nombre, duracionTransicion = 0.2) {
  if (!mixer || !animaciones[nombre] || accionActual === animaciones[nombre]) return;
  
  const nuevaAccion = animaciones[nombre];
  if (nombre === 'salto' || nombre === 'salto_extremo') {
      nuevaAccion.setEffectiveTimeScale(1.5); 
  } else {
      nuevaAccion.setEffectiveTimeScale(1.0);
  }

  accionActual.fadeOut(duracionTransicion);
  nuevaAccion.reset().fadeIn(duracionTransicion).play();
  accionActual = nuevaAccion;
}

function init() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputEncoding = THREE.sRGBEncoding;

  renderer.setClearColor(new THREE.Color(0x87CEEB)); 
  
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  document.body.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  const colorNiebla = 0xcbd1d6; 
  scene.fog = new THREE.FogExp2(colorNiebla, 0.0022);
  
  renderer.setClearColor(new THREE.Color(colorNiebla));

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1500);
  const ambientLight = new THREE.AmbientLight(0x404040, 0.7); 
  scene.add(ambientLight);
  const directionalLight = new THREE.DirectionalLight(0xffeedd, 1.2);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.camera.left = -100;
  directionalLight.shadow.camera.right = 100;
  directionalLight.shadow.camera.top = 100;
  directionalLight.shadow.camera.bottom = -100;
  scene.add(directionalLight);
  focoJugador = new THREE.SpotLight(0xffffff, 1.0);
  focoJugador.position.set(0, 10, 0); 
  focoJugador.angle = Math.PI / 5;
  focoJugador.penumbra = 1.0;
  focoJugador.distance = 150;
  focoJugador.castShadow = true;
  focoJugador.shadow.mapSize.width = 1024;
  focoJugador.shadow.mapSize.height = 1024;
  scene.add(focoJugador);
  scene.add(focoJugador.target);
  const manager = new THREE.LoadingManager();
  
  manager.onLoad = function () {
    textoMenu.innerHTML = 'SKI DOWNHILL 3D';
    btnIniciar.innerHTML = 'JUGAR';
    btnIniciar.style.backgroundColor = '#0055ff';
    btnIniciar.style.cursor = 'pointer';
    btnIniciar.disabled = false;
  };

  manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    textoMenu.innerHTML = `CARGANDO... ${Math.floor((itemsLoaded / itemsTotal) * 100)}%`;
  };
  const textureLoader = new THREE.TextureLoader(manager);
  const texRoca = textureLoader.load(
    'images/Rock058_1K-JPG_Color.jpg',
    undefined, undefined,
    function() {
      matRoca.map = textureLoader.load('Rock058_1K-JPG_Color.jpg');
      matRoca.needsUpdate = true;
    }
  );
  
  const texTronco = textureLoader.load(
    'images/Bark014_1K-JPG_Color.jpg',
    undefined, undefined,
    function() {
      matTronco.map = textureLoader.load('Bark014_1K-JPG_Color.jpg');
      matTronco.needsUpdate = true;
    }
  );
  const texPlasticoRoughness = textureLoader.load('images/Plastic008_1K-JPG_Roughness.jpg');
  const texPlasticoNormal = textureLoader.load('images/Plastic008_1K-JPG_NormalGL.jpg');
  texPlasticoRoughness.wrapS = texPlasticoRoughness.wrapT = THREE.RepeatWrapping;
  texPlasticoNormal.wrapS = texPlasticoNormal.wrapT = THREE.RepeatWrapping;
  texPlasticoRoughness.repeat.set(1, 4);
  texPlasticoNormal.repeat.set(1, 4);
  const texPoste = crearTexturaPosteSlalom('#0055ff');
  matPoste = new THREE.MeshStandardMaterial({ 
    map: texPoste,
    roughnessMap: texPlasticoRoughness,
    normalMap: texPlasticoNormal,
    roughness: 0.3,
    metalness: 0.1
  });
  matRoca = new THREE.MeshLambertMaterial({ map: texRoca, color: 0xaaaaaa }); 
  matTronco = new THREE.MeshPhongMaterial({ map: texTronco, specular: 0x333333, shininess: 20 }); 
  matBonus = new THREE.MeshPhongMaterial({ color: 0xFFD700, shininess: 90 });
  const rgbeLoader = (typeof THREE.RGBELoader !== 'undefined') 
    ? new THREE.RGBELoader(manager) 
    : (typeof RGBELoader !== 'undefined' ? new RGBELoader(manager) : null);

  if (rgbeLoader) {
    const aplicarHDR = function(texturaHDR) {
      texturaHDR.mapping = THREE.EquirectangularReflectionMapping;
      scene.background = texturaHDR; 
      if (matBonus) {
        matBonus.envMap = texturaHDR;
        matBonus.needsUpdate = true;
      }
    };

    rgbeLoader.load(
      'images/stierberg_sunrise_4k.hdr',
      aplicarHDR,
      undefined,
      function() {
        rgbeLoader.load('stierberg_sunrise_4k.hdr', aplicarHDR);
      }
    );
  }
  const texNieve = textureLoader.load(
    'images/Snow008A_1k-JPG_Color.jpg',
    undefined,
    undefined,
    function() {
      suelo.material.map = textureLoader.load('Snow008A_1k-JPG_Color.jpg');
      suelo.material.needsUpdate = true;
    }
  );
  
  texNieve.wrapS = THREE.RepeatWrapping;  
  texNieve.wrapT = THREE.RepeatWrapping;  
  texNieve.repeat.set(200, 120);
  
  const materialSuelo = new THREE.MeshStandardMaterial({ 
    map: texNieve,
    roughness: 0.9,
    metalness: 0.05
  });
  suelo = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), materialSuelo); 
  suelo.rotation.x = -Math.PI / 2;
  suelo.receiveShadow = true; 
  scene.add(suelo);
  jugador = new THREE.Group();
  scene.add(jugador);
  const fbxLoader = new THREE.FBXLoader(manager);
fbxLoader.load('models/Catwalk Idle 01.fbx', (object) => {
  object.scale.set(0.02, 0.02, 0.02);    
  object.position.y = -0.85; 
  object.traverse(function (child) {
    if (child.isLight || child.isCamera) {
      child.visible = false;
      if (child.isLight) child.intensity = 0;
    }

    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      if (child.material) {
        const materiales = Array.isArray(child.material) ? child.material : [child.material];
        materiales.forEach(mat => {
          if (mat.map) {
            mat.map.encoding = THREE.sRGBEncoding;
          }
          if (mat.isMeshStandardMaterial) {
            mat.roughness = 0.8; 
            mat.metalness = 0.1;
          }
          mat.needsUpdate = true;
        }); 
      }
    }
  });

  jugador.add(object);
  mixer = new THREE.AnimationMixer(object);
  if (object.animations && object.animations.length > 0) {
      const action = mixer.clipAction(object.animations[0]);
      animaciones['esqui'] = action;
      accionActual = action;
      accionActual.play();
  }
  cargarAnimacion(fbxLoader, 'models/Jump.fbx', 'salto', false);
  cargarAnimacion(fbxLoader, 'models/groin.fbx', 'agachado');
  cargarAnimacion(fbxLoader, 'models/Jumping.fbx', 'salto_extremo', false);
  cargarAnimacion(fbxLoader, 'models/falling_idle.fbx', 'caida_libre', true);
  cargarAnimacion(fbxLoader, 'models/Landing.fbx', 'aterrizaje_rampa', false);
  cargarAnimacion(fbxLoader, 'models/knock-down.fbx', 'caida', false);
  });
  window.addEventListener('resize', onWindowResize);
  initUI();
  updateGestorPista();
}

function onWindowResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function updateCamera(delta) {
  camera.position.set(pos_jugador.x, pos_jugador.y + 8, pos_jugador.z + 15);

  var x_adelante = curvaPista(pos_jugador.z - 25) + CARRILES[carrilActual];
  var objetivo_camara = new THREE.Vector3(x_adelante, pos_jugador.y - 3, pos_jugador.z - 25);
  camera.lookAt(objetivo_camara);

  var fov_objetivo = agachado ? 88 : 60;
  camera.fov += (fov_objetivo - camera.fov) * 8 * delta;
  camera.updateProjectionMatrix();
}
function generarTramo(z) {
  const carrilesLineas = [-6, -2, 2, 6];

  for (let subZ = z; subZ > z - separacion_filas; subZ -= paso_linea) {
    let z1 = subZ;
    let z2 = subZ - paso_linea;
    let cx1 = curvaPista(z1);
    let cx2 = curvaPista(z2);

    for (let l = 0; l < carrilesLineas.length; l++) {
      let offset = carrilesLineas[l];
      let x1 = cx1 + offset;
      let x2 = cx2 + offset;

      let dx = x2 - x1;
      let dz = z2 - z1;
      let angulo = Math.atan2(dx, dz);

      let geo = (Math.abs(offset) === 6) ? geoLineaBorde : geoLineaDivisoria;
      let lineaMesh = new THREE.Mesh(geo, matLineaRoja);
      lineaMesh.position.set((x1 + x2) / 2, 0.02, (z1 + z2) / 2);
      lineaMesh.rotation.y = angulo;
      
      scene.add(lineaMesh);
      objetosPista.push({ mesh: lineaMesh, tipo: 'linea' });
    }
    let índiceTramo = Math.round(Math.abs(z1) / paso_linea);
    if (índiceTramo % 2 === 0) {
      for (let i = 0; i < 5; i++) {
        let zSub = z1 - (i * 3.2); 
        let xSub = curvaPista(zSub);
        let xAdelante = curvaPista(zSub - 2);
        let anguloSub = Math.atan2(xAdelante - xSub, -2);
        let gradaIzq = new THREE.Mesh(geoGrada, matGradaGrisMetalico);
        gradaIzq.position.set(xSub - 22, 2.5, zSub);
        gradaIzq.rotation.y = anguloSub + Math.PI;
        gradaIzq.castShadow = true;
        gradaIzq.receiveShadow = true;
        scene.add(gradaIzq);
        objetosPista.push({ mesh: gradaIzq, tipo: 'visual' });
        let gradaDer = new THREE.Mesh(geoGrada, matGradaGrisMetalico);
        gradaDer.position.set(xSub + 22, 2.5, zSub);
        gradaDer.rotation.y = anguloSub;
        gradaDer.castShadow = true;
        gradaDer.receiveShadow = true;
        scene.add(gradaDer);
        objetosPista.push({ mesh: gradaDer, tipo: 'visual' });
      }
    }
  }
  if (z <= -40) {
    var rand = Math.random();
    var tipo = rand < 0.4 ? 0 : (rand < 0.65 ? 1 : (rand < 0.90 ? 2 : 3)); 
    var opcionesCarril = [0, 1, 2].filter(c => c !== ultimoCarrilLibre);
    var carrilLibre = opcionesCarril[Math.floor(Math.random() * opcionesCarril.length)];
    if ((tipo === 2 || tipo === 3) && Math.random() > 0.4) {
      carrilLibre = ultimoCarrilLibre;
    }
    
    ultimoCarrilLibre = carrilLibre;
    var xCentro = curvaPista(z);

    if (tipo === 0) {
      var xIzq = xCentro + CARRILES[carrilLibre] - 1.5;
      var xDer = xCentro + CARRILES[carrilLibre] + 1.5;
      
      var posteIzq = new THREE.Mesh(geoPoste, matPoste);
      posteIzq.position.set(xIzq, 2.5, z);
      posteIzq.castShadow = true;
      posteIzq.receiveShadow = true;
      scene.add(posteIzq);
      objetosPista.push({ mesh: posteIzq, tipo: 'visual' });

      var posteDer = new THREE.Mesh(geoPoste, matPoste);
      posteDer.position.set(xDer, 2.5, z);
      posteDer.castShadow = true;
      posteDer.receiveShadow = true;
      scene.add(posteDer);
      objetosPista.push({ mesh: posteDer, tipo: 'visual' });

      for (var i = 0; i < 3; i++) {
        if (i !== carrilLibre) {
          var barrera = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 0.5), new THREE.MeshBasicMaterial({visible: false}));
          barrera.position.set(xCentro + CARRILES[i], 1.5, z);
          barrera.userData = { tipo: 'obstaculo' };
          scene.add(barrera);
          objetosPista.push({ mesh: barrera, tipo: 'obstaculo' });
          objectsToCheck.push(barrera);
        }
      }

      } else if (tipo === 1) {
      let generarDosRocas = Math.random() < 0.5;
      let carrilesOcupables = [0, 1, 2].filter(c => c !== carrilLibre);
      if (!generarDosRocas) {
        let carrilElegido = carrilesOcupables[Math.floor(Math.random() * carrilesOcupables.length)];
        carrilesOcupables = [carrilElegido];
      }
      for (var j = 0; j < carrilesOcupables.length; j++) {
        var carrilActualRoca = carrilesOcupables[j];
        
        var roca = new THREE.Mesh(geoRoca, matRoca);
        roca.position.set(xCentro + CARRILES[carrilActualRoca], 0.6, z);
        roca.userData = { tipo: 'obstaculo' };
        roca.castShadow = true;
        roca.receiveShadow = true;
        scene.add(roca);
        objetosPista.push({ mesh: roca, tipo: 'obstaculo' });
        objectsToCheck.push(roca);
        if (Math.random() < 0.10) {
          var rampa = new THREE.Mesh(geoRampa, matRampa);
          let zRampa = z - 12;
          let xRampaCentro = curvaPista(zRampa);
          
          rampa.position.set(xRampaCentro + CARRILES[carrilActualRoca], 0.2, zRampa);
          
          let xAdelanteRampa = curvaPista(zRampa - 2);
          let anguloRampaY = Math.atan2(xAdelanteRampa - xRampaCentro, -2);
          
          rampa.rotation.order = 'YXZ'; 
          rampa.rotation.y = anguloRampaY;
          rampa.rotation.x = -Math.PI / 15; 
          
          rampa.userData = { tipo: 'rampa' };
          rampa.castShadow = true;
          rampa.receiveShadow = true;
          scene.add(rampa);
          objetosPista.push({ mesh: rampa, tipo: 'rampa' });
          objectsToCheck.push(rampa);
        }
      }

      } else if (tipo === 2) {
      let randomTroncos = Math.random();
      let numTroncos = 1;
      if (randomTroncos > 0.85) {
        numTroncos = 3;
      } else if (randomTroncos > 0.50) {
        numTroncos = 2;
      }
      let carrilesDisponibles = [0, 1, 2];
      for (let i = carrilesDisponibles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [carrilesDisponibles[i], carrilesDisponibles[j]] = [carrilesDisponibles[j], carrilesDisponibles[i]];
      }
      let carrilesOcupables = carrilesDisponibles.slice(0, numTroncos);
      for (let j = 0; j < carrilesOcupables.length; j++) {
        let carrilActualTronco = carrilesOcupables[j];
        
        var tronco = new THREE.Mesh(geoTronco, matTronco);
        tronco.rotation.z = Math.PI / 2;
        tronco.position.set(xCentro + CARRILES[carrilActualTronco], 0.5, z);
        tronco.userData = { tipo: 'obstaculo_salto' };
        tronco.castShadow = true;
        tronco.receiveShadow = true;
        scene.add(tronco);
        objetosPista.push({ mesh: tronco, tipo: 'obstaculo' });
        objectsToCheck.push(tronco);
      }

    } else if (tipo === 3) {
      var bonusHitbox = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), matInvisible);
      bonusHitbox.position.set(xCentro + CARRILES[carrilLibre], 1.5, z);
      bonusHitbox.userData = { tipo: 'bonus' };
      scene.add(bonusHitbox);
      var bonusVisual = new THREE.Mesh(geoBonus, matBonus);
      bonusVisual.position.set(0, 0, 0); 
      bonusVisual.castShadow = true;
      bonusVisual.receiveShadow = true;
      bonusHitbox.add(bonusVisual);
      objetosPista.push({ mesh: bonusHitbox, tipo: 'bonus' });
      objectsToCheck.push(bonusHitbox);
    }
  }
}

function updateGestorPista() {
  while (z_generacion > pos_jugador.z - distancia_generacion) {
    generarTramo(z_generacion);
    z_generacion -= separacion_filas;
  }
  for (var i = objetosPista.length - 1; i >= 0; i--) {
    var obj = objetosPista[i];
    if (obj.mesh.position.z > pos_jugador.z + 30) {
      scene.remove(obj.mesh);
      objectsToCheck = objectsToCheck.filter(o => o !== obj.mesh);
      objetosPista.splice(i, 1);
    }
  }

  for (var i = 0; i < objetosPista.length; i++) {
    let obj = objetosPista[i].mesh;
    let tipo = objetosPista[i].tipo;
    if (tipo === 'bonus' && obj.userData.tipo === 'bonus' && obj.children.length > 0) {
      let visual = obj.children[0];
      visual.rotation.y += 0.05;
      visual.rotation.x += 0.02;
    } 
    else if (tipo === 'bonus' && obj.userData.tipo === 'consumiendo' && obj.children.length > 0) {
      let visual = obj.children[0];
      visual.position.y += 0.3;
      visual.rotation.y += 0.2;
      visual.scale.multiplyScalar(0.8);
      
      if (visual.scale.x < 0.1) {
        scene.remove(obj);
        objetosPista.splice(i, 1);
        i--;
      }
    }
  }
}

function update() {
  if (!juego_activo || !juego_iniciado) return;

  var delta = Math.min(clock.getDelta(), 0.05);
  if (!en_animacion_muerte) {
    velocidad_avance = Math.min(velocidad_maxima, 20 + Math.log1p(tiempo_carrera) * 3.5);
    separacion_filas = Math.max(separacion_minima, 40 - Math.log1p(tiempo_carrera) * 3.0);

    var velocidad_actual = agachado ? velocidad_avance * 1.5 : velocidad_avance;
    if (en_salto_rampa) velocidad_actual = velocidad_avance * 3; 

    pos_jugador.z -= velocidad_actual * delta;

    var objetivo_x = curvaPista(pos_jugador.z) + CARRILES[carrilActual];
    var factor = 1 - Math.exp(-rapidez_cambio_carril * delta);
    var delta_x = objetivo_x - pos_jugador.x;
    pos_jugador.x += delta_x * factor;

    var x_adelante = curvaPista(pos_jugador.z - 2) + CARRILES[carrilActual];
    var angulo_curva = Math.atan2(x_adelante - pos_jugador.x, -2);
    jugador.rotation.y = angulo_curva;

    var inclinacion_objetivo = 0;
    
    var limite_inclinacion = agachado ? inclinacion_maxima * 0.10 : inclinacion_maxima;

    if (delta_x > 0.1) inclinacion_objetivo = -limite_inclinacion;
    else if (delta_x < -0.1) inclinacion_objetivo = limite_inclinacion;
    
    var factor_inclinacion = 1 - Math.exp(-rapidez_inclinacion * delta);
    inclinacion_actual += (inclinacion_objetivo - inclinacion_actual) * factor_inclinacion;
    jugador.rotation.z = inclinacion_actual;

    procesarSalto(delta);
    
    tiempo_carrera += delta;
    var multiplicador = 1;
    if (en_salto_rampa) {
      multiplicador = 3;
    } else if (agachado) {
      multiplicador = 2;
    }
    puntuacion += delta * 10 * multiplicador;
  }

  procesarSalto(delta);

  if (!en_suelo) {
    velocidad_vertical += gravedad * delta;
    pos_jugador.y += velocidad_vertical * delta;
    if (pos_jugador.y <= 0) {
      pos_jugador.y = 0;
      velocidad_vertical = 0;
      en_suelo = true;
      if (en_salto_rampa) {
          timer_aterrizaje = 0.6;
      }
      en_salto_rampa = false;
    }
  }

  var escala_objetivo = agachado ? 0.5 : 1.0;
  var factor_escala = 1 - Math.exp(-rapidez_agachado * delta);
  escala_y_actual += (escala_objetivo - escala_y_actual) * factor_escala;
  jugador.scale.y = escala_y_actual;
  jugador.position.set(pos_jugador.x, pos_jugador.y + escala_y_actual, pos_jugador.z);
  if (jugador.children.length > 0) {
      var modeloVisual = jugador.children[0];
      modeloVisual.scale.y = 0.02 / escala_y_actual; 
      modeloVisual.position.y = -escala_y_actual + 0.15; 
      
      // Solo forzamos los 90 grados si la pirueta ('salto_extremo') se está reproduciendo
      if (accionActual === animaciones['salto_extremo']) {
          modeloVisual.rotation.y = +Math.PI / 2; 
      } else if (agachado) {
          modeloVisual.rotation.y = THREE.MathUtils.degToRad(25);
      } else {
          modeloVisual.rotation.y = 0; // Vuelve a postura recta para 'caida_libre' y 'aterrizaje'
      }
  }
  if (timer_aterrizaje > 0) {
      timer_aterrizaje -= delta;
  }
  if (mixer) {
    if (en_animacion_muerte) {
    } else if (!en_suelo) {
      if (en_salto_rampa) {
        
        // Si está cayendo y se acerca al suelo (ej. altura < 3.5), anticipamos el aterrizaje
        if (pos_jugador.y < 3.5 && velocidad_vertical < 0) {
            cambiarAnimacion('aterrizaje_rampa', 0.2);
        } else {
            var animSaltoExtremo = animaciones['salto_extremo'];
            // Si la pirueta termina, pasamos a la nueva animación de caída libre
            if (animSaltoExtremo && animSaltoExtremo.time >= animSaltoExtremo.getClip().duration - 0.1) {
                cambiarAnimacion('caida_libre', 0.2);
            } else {
                cambiarAnimacion('salto_extremo', 0.2);
            }
        }
        
      } else {
        cambiarAnimacion('salto', 0.2);
      }
    } else if (timer_aterrizaje > 0) {
      cambiarAnimacion('aterrizaje_rampa', 0.1);
    } else if (agachado) {
      cambiarAnimacion('agachado', 0.2);
    } else if (teclas.derecha && delta_x > 0.1) {     
      cambiarAnimacion('derecha', 0.3);
    } else if (teclas.izquierda && delta_x < -0.1) {  
      cambiarAnimacion('izquierda', 0.3);
    } else {
      if (animaciones['esqui']) {
          cambiarAnimacion('esqui', 0.3);
      } else if (animaciones['Idle']) {
          cambiarAnimacion('Idle', 0.3);
      } 
    }
    mixer.update(delta);
  }

  focoJugador.position.set(pos_jugador.x, pos_jugador.y + 10, pos_jugador.z + 5);
  focoJugador.target.position.set(x_adelante, 0, pos_jugador.z - 40);
  var origenRayo = pos_jugador.clone();
  origenRayo.y += 0.3; 
  var direccionRayo = new THREE.Vector3(x_adelante - pos_jugador.x, 0, -2).normalize();
  raycaster.set(origenRayo, direccionRayo);

  var intersects = raycaster.intersectObjects(objectsToCheck, true);
  if (!en_animacion_muerte && intersects.length > 0 && intersects[0].distance <= (velocidad_actual * delta + 1.2)) {
    var objHit = intersects[0].object;
    var tipoCol = objHit.userData.tipo;

    if (tipoCol === 'obstaculo') {
      terminarJuego();
    } else if (tipoCol === 'obstaculo_salto') {
      if (pos_jugador.y < 0.6) { 
        terminarJuego();
      }
    } else if (tipoCol === 'bonus') {
      objectsToCheck = objectsToCheck.filter(o => o !== objHit);
      objHit.userData.tipo = 'consumiendo'; 
      
      puntuacion += 50;
      
    } else if (tipoCol === 'rampa') {
      scene.remove(objHit);
      objectsToCheck = objectsToCheck.filter(o => o !== objHit);
      objHit.position.y = -100; 
      agachado = false;
      en_suelo = false;
      en_salto_rampa = true;
      velocidad_vertical = impulso_salto * 3;
      buffer_salto = 0; 
    }
    
  }

tiempo_carrera += delta;
  var multiplicador = 1;
  if (en_salto_rampa) {
    multiplicador = 3;
  } else if (agachado) {
    multiplicador = 2;
  }
  uiElement.innerHTML = `Tiempo: ${tiempo_carrera.toFixed(1)}s<br>Puntos: ${Math.floor(puntuacion)} (x${multiplicador})`;
  if (!juego_activo) {
    uiElement.innerHTML += `<br><span style="color:red">¡JUEGO TERMINADO!</span>`;
  }
  if (suelo.position.z > pos_jugador.z + 500) {
     suelo.position.z = pos_jugador.z - 500;
  }
  suelo.position.x = curvaPista(suelo.position.z);
  updateGestorPista();
  updateCamera(delta);
}

function render() {
  requestAnimationFrame(render);
  update();
  renderer.render(scene, camera);
}

init();
render();