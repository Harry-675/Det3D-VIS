import { hsvToRgb } from './utils.js';
import { getScene, getCamera, getControls } from './scene.js';

let pointCloud;

export function loadPointCloud(pcdPath) {
    const loader = new THREE.PCDLoader();  // 使用全局 THREE
    const scene = getScene();
    const camera = getCamera();    
    loader.load(
        pcdPath,
        function(points) {
            if (pointCloud) {
                scene.remove(pointCloud);
            }
            
            updatePointCloudColors(points);
            pointCloud = points;
            scene.add(points);
            camera.position.set(
                0,
                0,
                100
            );
            
            // 添加距离圆圈
            const box = new THREE.Box3().setFromObject(points);
            const size = box.getSize(new THREE.Vector3());
            drawRangeCircles(scene, size);
        },
        function(xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function(error) {
            console.error('Error loading point cloud:', error);
            console.log('Attempted to load:', pcdPath);
        }
    );
}

function updatePointCloudColors(points) {
    const positions = points.geometry.attributes.position.array;
    const colors = new Float32Array(positions.length);
    
    const [minZ, maxZ] = findZRange(positions);
    
    for(let i = 0; i < positions.length; i += 3) {
        const z = positions[i + 2];
        const normalizedZ = (z - minZ) / (maxZ - minZ);
        const hue = 360 * (1 - normalizedZ);
        const rgb = hsvToRgb(hue, 1.0, 1.0);
        
        colors[i] = rgb.r;
        colors[i + 1] = rgb.g;
        colors[i + 2] = rgb.b;
    }
    
    points.geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    // 增大点的大小，使其更加可见
    points.material = new THREE.PointsMaterial({
        size: 0.15, // 进一步增大点的尺寸
        vertexColors: true,
        sizeAttenuation: true
    });
}

function findZRange(positions) {
    let minZ = Infinity;
    let maxZ = -Infinity;
    for(let i = 2; i < positions.length; i += 3) {
        minZ = Math.min(minZ, positions[i]);
        maxZ = Math.max(maxZ, positions[i]);
    }
    return [minZ, maxZ];
}

function drawRangeCircles(scene, size) {
    console.log('绘制距离圆圈');
    
    // 使用LineBasicMaterial替代MeshBasicMaterial，并设置透明度和细线
    const circleMaterial = new THREE.LineBasicMaterial({ 
        color: 0xcccccc,  
        transparent: true,
        opacity: 0.3,     
        linewidth: 1      
    });

    // 创建文字材质
    const textMaterial = new THREE.LineBasicMaterial({
        color: 0xcccccc,
        transparent: true,
        opacity: 0.5
    });

    const maxRadius = Math.min(200, Math.max(size.x / 2, size.y / 2)); // 限制最大半径为200米
    const step = 20;
    for (let r = step; r <= maxRadius; r += step) {
        // 绘制圆圈
        const points = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                r * Math.cos(theta),
                r * Math.sin(theta),
                0
            ));
        }
        
        const circleGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const circle = new THREE.LineLoop(circleGeometry, circleMaterial);
        scene.add(circle);

        // 添加距离标注
        const loader = new THREE.FontLoader();
        loader.load('https://threejs.org/examples/fonts/helvetiker_regular.typeface.json', function(font) {
            const textGeometry = new THREE.TextGeometry(`${r}m`, {
                font: font,
                size: 2,
                height: 0.1
            });
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);
            // 将文字放置在Y轴正方向上
            textMesh.position.set(0, r + 2, 0);
            scene.add(textMesh);
        });
    }
}

export function getPointCloud() {
    return pointCloud;
}


