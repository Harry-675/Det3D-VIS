import { showObjectDetail, showObjectDetails } from './objectDetailPanel.js';;
import { initEventListeners } from './eventHandler.js';

// 使用全局的 THREE 对象，因为是通过 script 标签引入的
let scene, camera, renderer, controls;
let raycaster, mouse;

export function initScene(container) {
    // 创建场景
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // 创建相机 - 修改初始视角
    camera = new THREE.PerspectiveCamera(60, (window.innerWidth * 0.65) / window.innerHeight, 0.1, 1000);
    
    // 修改相机设置，使X轴朝上
    camera.position.set(0, 0, 50);
    camera.up.set(1, 0, 0);
    camera.lookAt(0, 0, 0);
    
    // 创建渲染器
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth * 0.65, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    // 添加控制器
    initControls();
    
    // 添加坐标轴辅助 - 增大尺寸使其更清晰
    const axesHelper = new THREE.AxesHelper(15);
    scene.add(axesHelper);

    // 监听窗口大小变化
    window.addEventListener('resize', onWindowResize, false);

    // 初始化事件监听器，并传递必要参数
    initEventListeners(renderer, camera, scene);

    return { scene, camera, renderer, controls };
}

function initControls() {
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    
    // 将 screenSpacePanning 设置为 true，确保平移在屏幕平面上进行
    controls.screenSpacePanning = true;
    
    controls.minDistance = 1;
    controls.maxDistance = 500;
    
    controls.mouseButtons = {
        LEFT: THREE.MOUSE.ROTATE,
        MIDDLE: THREE.MOUSE.DOLLY,
        RIGHT: THREE.MOUSE.PAN
    };
    
    setupControlsEvents();
}

function setupControlsEvents() {
    let isPanning = false;
    let previousMousePosition = {
        x: 0,
        y: 0
    };
    
    // 按下鼠标时检查修饰键
    renderer.domElement.addEventListener('mousedown', function(event) {
        if ((event.metaKey || event.ctrlKey) && event.button === 0) {
            isPanning = true;
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            // 禁用 OrbitControls 默认的旋转
            controls.enabled = false;
        }
    });
    
    // 鼠标移动时自定义平移
    renderer.domElement.addEventListener('mousemove', function(event) {
        if (isPanning) {
            const deltaMove = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y
            };
            
            // 计算平移速度因子（基于当前相机距离）
            const panSpeed = 0.01 * camera.position.distanceTo(controls.target);
            
            // 获取相机的右方向向量和上方向向量
            const right = new THREE.Vector3();
            const up = new THREE.Vector3(0, 1, 0); // 直接使用世界坐标的Y轴
            camera.getWorldDirection(right);
            right.cross(camera.up).normalize();
            
            // 沿右方向和上方向平移相机和控制点
            camera.position.addScaledVector(right, -deltaMove.x * panSpeed);
            camera.position.addScaledVector(up, deltaMove.y * panSpeed);
            controls.target.addScaledVector(right, -deltaMove.x * panSpeed);
            controls.target.addScaledVector(up, deltaMove.y * panSpeed);
            
            // 更新上一次的鼠标位置
            previousMousePosition = {
                x: event.clientX,
                y: event.clientY
            };
            
            // 强制更新控制器
            controls.update();
        }
    });
    
    // 鼠标释放或离开窗口时结束平移
    const endPanning = function() {
        if (isPanning) {
            isPanning = false;
            controls.enabled = true;
        }
    };
    
    window.addEventListener('mouseup', endPanning);
    renderer.domElement.addEventListener('mouseleave', endPanning);
    
    // 修饰键释放
    window.addEventListener('keyup', function(event) {
        if (event.key === 'Control' || event.key === 'Meta') {
            endPanning();
        }
    });
    
    // 处理窗口失焦情况
    window.addEventListener('blur', endPanning);
}

function onWindowResize() {
    camera.aspect = (window.innerWidth * 0.65) / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth * 0.65, window.innerHeight);
}

export function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

export function getScene() {
    return scene;
}

export function getCamera() {
    return camera;
}

export function getControls() {
    return controls;
}

export function initRaycaster() {
    // 初始化射线投射器和鼠标向量
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // 添加点击事件监听器
    const container = document.getElementById('sceneContainer');
    container.addEventListener('click', onSceneClick);
    
}

function onSceneClick(event) {
    try {
        // 获取场景容器
        const container = document.getElementById('sceneContainer');
        const rect = container.getBoundingClientRect();
        
        // 计算鼠标在归一化设备坐标中的位置
        // (-1 到 +1)
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        // 更新射线投射器
        raycaster.setFromCamera(mouse, camera);
        
        // 获取与射线相交的对象
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0) {
            // 查找第一个有效的目标对象
            for (let i = 0; i < intersects.length; i++) {
                const object = findParentWithUserData(intersects[i].object);
                
                if (object && object.userData && 
                   (object.userData.objectId || object.userData.id)) {
                    console.log('点击了目标对象', object.userData);
                    
                    // 显示目标详情
                    showObjectDetails(object);
                    return;
                }
            }
        }
    } catch (err) {
        console.error('处理场景点击事件时出错', err);
    }
}

// 查找具有userData的父对象
function findParentWithUserData(object) {
    let current = object;
    
    // 向上遍历对象层次结构，直到找到具有userData.objectId的对象
    while (current) {
        if (current.userData && current.userData.objectId) {
            return current;
        }
        current = current.parent;
    }
    
    return null;
}

// 如果需要，添加全局访问方法
window.showObjectDetails = showObjectDetails;
