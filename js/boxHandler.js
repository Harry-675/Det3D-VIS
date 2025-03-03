import { getScene } from './scene.js';
import { getCalibData } from './fileHandler.js';

let boxes = [];
const BOX_COLORS = {
    'Car': 0x2ca02c,      // 绿色
    'Bus': 0xff7f0e,      // 橙色
    'Truck': 0xd62728,    // 红色
    'Pedestrian': 0x1f77b4, // 蓝色
    'Rider': 0x9467bd,    // 紫色
    'Motor': 0x8c564b,    // 棕色
    'default': 0xe377c2   // 粉色（默认）
};

// 添加一个全局变量来存储框的可见性状态
let boxesVisible = true;

export function createBoxesFromLabels(labels) {
    const scene = getScene();
    
    // 清除旧的边界框
    clearBoxes(scene);
    
    // 为每个标注创建3D边界框
    labels.forEach(label => {
        const { psr, obj_type, obj_id } = label;
        const { position, scale, rotation } = psr;
        
        // 创建边界框几何体
        const boxGeometry = new THREE.BoxGeometry(scale.x, scale.y, scale.z);
        
        // 创建边框线框几何体
        const edgesGeometry = new THREE.EdgesGeometry(boxGeometry);
        
        // 边框材质
        const color = BOX_COLORS[obj_type] || BOX_COLORS.default;
        const lineMaterial = new THREE.LineBasicMaterial({ 
            color: color,
            linewidth: 2
        });
        
        // 创建线框
        const wireframe = new THREE.LineSegments(edgesGeometry, lineMaterial);
        
        // 设置位置
        wireframe.position.set(position.x, position.y, position.z);
        
        // 设置旋转（Euler角，顺序为XYZ）
        wireframe.rotation.set(rotation.x, rotation.y, rotation.z);
        
        // 关键修改：确保设置完整的 userData
        wireframe.userData = { 
            isSelectable: true,  // 添加此标志使对象可选中
            objectId: obj_id, 
            objectType: obj_type,
            dimensions: { x: scale.x, y: scale.y, z: scale.z },
            // 添加以下属性，确保详情面板可以正确显示
            position: {
                x: position.x,
                y: position.y,
                z: position.z
            },
            rotation: {
                x: rotation.x,
                y: rotation.y,
                z: rotation.z
            },
            size: {
                width: scale.x,
                height: scale.y,
                depth: scale.z
            }
        };
        console.log(wireframe);
        
        // 添加到场景
        scene.add(wireframe);
        
        // 记录到数组中便于后续管理
        boxes.push(wireframe);
        
        // 添加标签文本
        addLabel(scene, position, scale, obj_type, obj_id, color);
    });
    
    console.log(`已创建 ${boxes.length} 个边界框`);
}

function addLabel(scene, position, scale, type, id, color) {
    // 创建标签精灵
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    
    // 绘制标签
    context.font = '24px Arial';
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
    context.fillText(`${type} ${id}`, 10, 40);
    
    // 创建纹理
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ 
        map: texture,
        transparent: true
    });
    
    const sprite = new THREE.Sprite(spriteMaterial);
    
    // 设置位置，稍微向上偏移，使标签位于框的上方
    sprite.position.set(position.x, position.y, position.z + scale.z/2 + 1);
    
    // 调整大小
    sprite.scale.set(5, 1.25, 1);
    
    scene.add(sprite);
    boxes.push(sprite); // 也添加到数组中便于管理
}

function clearBoxes(scene) {
    // 从场景中移除所有边界框
    boxes.forEach(box => {
        scene.remove(box);
    });
    
    // 清空数组
    boxes = [];
}

// 修改 toggleBoxes 函数来控制两种显示
export function toggleBoxes(e) {
    boxesVisible = e ? e.target.checked : !boxesVisible;
    
    // 控制3D框可见性
    boxes.forEach(box => {
        box.visible = boxesVisible;
    });
    
    console.log(`切换边界框显示: ${boxesVisible ? '显示' : '隐藏'}`);
    
    // 控制图像投影框 - 根据当前状态重新渲染或清除所有框
    if (boxesVisible) {
        projectBoxesToImages(); // 处理小图
        
        // 单独处理放大图像（如果存在）
        const enlargedImg = document.getElementById('enlargedImage');
        if (enlargedImg) {
            console.log('发现放大图像，准备重新投影');
            setTimeout(() => handleEnlargedImage(enlargedImg), 100);
        }
    } else {
        clearProjectedBoxes();
    }
}

// 添加一个函数来清除图像上的投影框
function clearProjectedBoxes() {
    // 获取所有相机图像
    document.querySelectorAll('#imagePanel img').forEach(img => {
        // 获取原始图像源
        const originalSrc = img.getAttribute('data-original-src');
        if (originalSrc) {
            // 恢复原始图像
            img.src = originalSrc;
        }
    });
    
    // 同样处理大图像面板
    const enlargedImg = document.getElementById('enlargedImage');
    if (enlargedImg) {
        const originalSrc = enlargedImg.getAttribute('data-original-src');
        if (originalSrc) {
            enlargedImg.src = originalSrc;
        }
    }
}

// 修复 projectBoxesToImages 函数
export function projectBoxesToImages(specificImageElement = null, scale = 1) {
    // 如果框被设置为不可见，则直接返回
    if (!boxesVisible) return;
    
    try {
        const calibData = getCalibData();
        if (!calibData) {
            console.error('无法获取标定数据');
            return;
        }
        
        console.log('可用标定数据:', {
            'keys': Object.keys(calibData),
            'boxCount': boxes.length,
            'scale': scale
        });
        
        // 如果提供了特定图像，只处理该图像
        if (specificImageElement) {
            let camId = specificImageElement.getAttribute('data-cam-id');
            
            // 如果没有data-cam-id属性，尝试从alt获取
            if (!camId && specificImageElement.alt) {
                const match = specificImageElement.alt.match(/Camera (\d+)/);
                if (match) {
                    camId = `cam_${match[1]}`;
                    // 补充属性
                    specificImageElement.setAttribute('data-cam-id', camId);
                    console.log(`为图像添加缺失的data-cam-id: ${camId}`);
                }
            }
            
            if (!camId) {
                console.error('无法确定图像的相机ID', { 
                    element: specificImageElement.id,
                    alt: specificImageElement.alt
                });
                return;
            }
            
            const calib = calibData[camId];
            if (!calib) {
                console.error(`找不到相机 ${camId} 的标定数据`, { 
                    availableData: Object.keys(calibData)
                });
                return;
            }
            
            // 确保原始图像源
            if (!specificImageElement.getAttribute('data-original-src')) {
                specificImageElement.setAttribute('data-original-src', specificImageElement.src);
                console.log(`为图像添加缺失的原始源`);
            }
            
            // 传递缩放比例
            processImage(specificImageElement, calib, camId, scale);
            return;
        }
        
        // 否则处理所有图像
        let processedImages = 0;
        document.querySelectorAll('#imagePanel img').forEach((img, index) => {
            let camId = img.getAttribute('data-cam-id');
            
            // 如果没有data-cam-id属性，尝试从索引设置一个
            if (!camId) {
                camId = `cam_${index+1}`;
                img.setAttribute('data-cam-id', camId);
                console.log(`为图像添加缺失的data-cam-id: ${camId}`);
            }
            
            // 确保原始图像源
            if (!img.getAttribute('data-original-src')) {
                img.setAttribute('data-original-src', img.src);
                console.log(`为图像添加缺失的原始源`);
            }
            
            const calib = calibData[camId];
            if (!calib) {
                console.warn(`找不到相机 ${camId} 的标定数据`, {
                    availableData: Object.keys(calibData)
                });
                return;
            }
            
            // 传递缩放比例
            processImage(img, calib, camId, scale);
            processedImages++;
        });
        
        console.log(`共处理了${processedImages}个图像的投影，缩放比例: ${scale}`);
    } catch (err) {
        console.error("投影边界框时出错:", err);
    }
}

// 优化图像处理函数
function processImage(img, calib, camId, scale = 1) {
    try {
        // 创建用于绘制的canvas
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 如果图像已经有内容（比如点云投影），先保存当前图像
        const currentImage = new Image();
        currentImage.src = img.src;
        
        // 加载原始图像
        const originalSrc = img.getAttribute('data-original-src');
        if (!originalSrc) {
            console.error('图像没有data-original-src属性', { img });
            return;
        }
        
        currentImage.onload = () => {
            try {
                // 设置canvas尺寸与图像相同
                canvas.width = currentImage.width;
                canvas.height = currentImage.height;
                
                // 绘制当前图像（可能包含点云投影）
                ctx.drawImage(currentImage, 0, 0);
                
                // 投影每个边界框
                let boxesProjected = 0;
                boxes.forEach(box => {
                    if (box.type === 'Sprite') return; // 跳过标签精灵
                    
                    try {
                        const result = projectBoxToImage(box, calib, canvas, ctx, scale);
                        if (result) boxesProjected++;
                    } catch (e) {
                        console.error('投影边界框时出错:', e);
                    }
                });
                
                console.log(`已将 ${boxesProjected} 个边界框投影到相机 ${camId}, 缩放比例: ${scale}`);
                
                // 更新图像
                img.src = canvas.toDataURL();
            } catch (err) {
                console.error("处理图像投影时出错:", err);
                // 出错时恢复原始图像
                img.src = originalSrc;
            }
        };
        
        currentImage.onerror = (err) => {
            console.error("加载当前图像时出错:", err);
            img.src = originalSrc; // 确保有图像显示
        };
    } catch (err) {
        console.error("处理图像时出错:", err);
    }
}

function projectBoxToImage(box, calib, canvas, ctx, scale = 1) {
    console.log(`投影框: ${box.userData.objectType || 'unknown'}, ID: ${box.userData.objectId || 'unknown'}`, {
        'canvas': `${canvas.width}x${canvas.height}`,
        'calib': calib ? '有效' : '无效',
        'scale': scale
    });
    
    // 获取边界框的尺寸信息
    const dimensions = box.userData.dimensions;
    if (!dimensions) {
        console.warn('边界框没有尺寸信息', {box: box.userData});
        return false;
    }
    
    // 边界框的半尺寸
    const halfSize = {
        x: dimensions.x / 2,
        y: dimensions.y / 2,
        z: dimensions.z / 2
    };
    
    // 在局部坐标系中的8个顶点
    const localVertices = [
        new THREE.Vector3(-halfSize.x, -halfSize.y, -halfSize.z),
        new THREE.Vector3(-halfSize.x, -halfSize.y, halfSize.z),
        new THREE.Vector3(-halfSize.x, halfSize.y, -halfSize.z),
        new THREE.Vector3(-halfSize.x, halfSize.y, halfSize.z),
        new THREE.Vector3(halfSize.x, -halfSize.y, -halfSize.z),
        new THREE.Vector3(halfSize.x, -halfSize.y, halfSize.z),
        new THREE.Vector3(halfSize.x, halfSize.y, -halfSize.z),
        new THREE.Vector3(halfSize.x, halfSize.y, halfSize.z)
    ];
    
    // 创建一个矩阵来表示盒子的变换
    const boxMatrix = new THREE.Matrix4();
    boxMatrix.makeRotationFromEuler(new THREE.Euler(
        box.rotation.x, 
        box.rotation.y, 
        box.rotation.z
    ));
    boxMatrix.setPosition(box.position);
    
    // 变换到世界坐标
    const worldVertices = localVertices.map(vertex => {
        const worldVertex = vertex.clone();
        worldVertex.applyMatrix4(boxMatrix);
        return worldVertex;
    });
    
    // 投影到图像平面
    const imagePoints = worldVertices.map(vertex => {
        // 变换到相机坐标系
        const camPoint = vertex.clone().applyMatrix4(calib.extrinsic);
        
        // 如果在相机后方，则跳过
        if (camPoint.z <= 0) return null;
        
        // 投影到图像平面 - 使用标准的针孔相机模型
        const unscaledX = (calib.intrinsic.elements[0] * camPoint.x + 
                calib.intrinsic.elements[1] * camPoint.y + 
                calib.intrinsic.elements[2] * camPoint.z) / camPoint.z;
                
        const unscaledY = (calib.intrinsic.elements[3] * camPoint.x + 
                calib.intrinsic.elements[4] * camPoint.y + 
                calib.intrinsic.elements[5] * camPoint.z) / camPoint.z;
        
        // 应用缩放 - 适应不同的视图大小
        let x = unscaledX;
        let y = unscaledY;

        if (scale !== 1) {
            // 对于放大的图像，我们需要相应地缩放投影点
            // 注意：这里假设图像中心不变，只是放大了
            x = x * scale;
            y = y * scale;
        }
        
        // 检查是否在图像范围内
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            return { x, y };
        }
        
        return null;
    });
    
    // 如果有足够的点在图像平面上，绘制边界框
    const visiblePoints = imagePoints.filter(p => p !== null);
    if (visiblePoints.length < 2) {
        return false;
    }
    
    // 获取颜色
    const color = box.material.color;
    const strokeStyle = `rgb(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)})`;
    
    // 设置绘图样式
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = Math.max(1, 2 * scale * 0.5); // 线宽也随缩放变化，但不要太粗
    
    // 绘制连接线 - 底部矩形
    drawLine(ctx, imagePoints[0], imagePoints[1]);
    drawLine(ctx, imagePoints[1], imagePoints[5]);
    drawLine(ctx, imagePoints[5], imagePoints[4]);
    drawLine(ctx, imagePoints[4], imagePoints[0]);
    
    // 顶部矩形
    drawLine(ctx, imagePoints[2], imagePoints[3]);
    drawLine(ctx, imagePoints[3], imagePoints[7]);
    drawLine(ctx, imagePoints[7], imagePoints[6]);
    drawLine(ctx, imagePoints[6], imagePoints[2]);
    
    // 连接顶部和底部
    drawLine(ctx, imagePoints[0], imagePoints[2]);
    drawLine(ctx, imagePoints[1], imagePoints[3]);
    drawLine(ctx, imagePoints[5], imagePoints[7]);
    drawLine(ctx, imagePoints[4], imagePoints[6]);
    
    // 添加文本标签
    if (box.userData && box.userData.objectType) {
        const labelText = `${box.userData.objectType} ${box.userData.objectId || ''}`;
        
        // 找出最上方的顶点
        if (visiblePoints.length > 0) {
            const topPoint = visiblePoints.reduce((min, p) => p.y < min.y ? p : min, visiblePoints[0]);
            
            // 设置文本样式
            const fontSize = Math.max(10, Math.round(14 * scale * 0.7)); // 字体大小随缩放变化
            ctx.font = `${fontSize}px Arial`;
            ctx.fillStyle = strokeStyle;
            ctx.fillText(labelText, topPoint.x, topPoint.y - 5 * scale);
        }
    }
    
    return true;
}

function drawLine(ctx, p1, p2) {
    if (!p1 || !p2) return;
    
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

// 添加一个专门处理放大图像的函数
function handleEnlargedImage(enlargedImg, scale = 2.0) {
    console.log('专门处理放大图像', {
        'id': enlargedImg.id,
        'data-cam-id': enlargedImg.getAttribute('data-cam-id'),
        'hasOriginalSrc': !!enlargedImg.getAttribute('data-original-src'),
        'scale': scale
    });
    
    // 使用通用函数投影，传递缩放比例
    projectBoxesToImages(enlargedImg, scale);
}

// 导出状态获取函数
export function getBoxesVisibility() {
    return boxesVisible;
}
 