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
    
    // 检查标注数据是否存在
    if (!labels || labels.length === 0) {
        console.log('没有标注数据，跳过创建3D边界框');
        return;
    }

    // 为每个标注创建3D边界框
    labels.forEach(label => {
        const { psr, obj_type, obj_id } = label;
        if (!psr) {
            console.warn('标注数据缺少psr字段:', label);
            return; // 跳过此标注
        }

        const { position, scale, rotation } = psr;
        
        // 验证必要的字段
        if (!position || !scale || !rotation) {
            console.warn('标注数据缺少必要字段:', psr);
            return; // 跳过此标注
        }

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
    return new Promise(async (resolve, reject) => {
        try {
            console.log(`开始处理包围盒投影, 图像ID: ${specificImageElement ? specificImageElement.id : '所有图像'}, 缩放: ${scale}`);

            // 如果框被设置为不可见，则直接返回
            if (!boxesVisible) {
                console.log('包围盒设置为不可见，跳过投影');
                resolve();
                return;
            }

            // 检查是否有边界框
            if (!boxes || boxes.length === 0) {
                console.log('没有边界框可投影');
                resolve();
                return;
            }

            console.log(`当前有 ${boxes.length} 个边界框`);

            const calibData = getCalibData();
            if (!calibData) {
                console.error('无法获取标定数据');
                reject(new Error('无法获取标定数据'));
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
                        specificImageElement.setAttribute('data-cam-id', camId);
                        console.log(`为图像添加缺失的data-cam-id: ${camId}`);
                    }
                }

                if (!camId) {
                    console.error('图像缺少相机ID标识', { img: specificImageElement });
                    reject(new Error('图像缺少相机ID标识'));
                    return;
                }

                const calib = calibData[camId];
                if (!calib) {
                    console.error(`找不到相机ID: ${camId} 的标定数据`);
                    reject(new Error(`找不到相机ID: ${camId} 的标定数据`));
                    return;
                }

                console.log(`使用相机ID: ${camId} 的标定数据`);

                // 检查是否是放大图像
                const isEnlargedImage = specificImageElement.id === 'enlargedImg';
                console.log(`是否是放大图像: ${isEnlargedImage}`);

                // 获取开关状态
                let boxToggle;
                if (isEnlargedImage) {
                    // 对于放大图像，使用放大视图专用开关
                    boxToggle = document.getElementById('viewerBoxToggle');
                    console.log('使用放大视图专用包围盒开关:', boxToggle ? boxToggle.checked : 'not found');
                } else {
                    // 对于普通图像，使用主开关
                    boxToggle = document.getElementById('boxToggle');
                }

                // 只有当开关打开时才处理，无论是放大图像还是普通图像
                if (boxToggle && boxToggle.checked) {
                    // 根据图像类型选择不同的处理方式
                    if (isEnlargedImage) {
                        try {
                            // 使用专门处理放大图像的函数
                            await handleEnlargedImage(specificImageElement, scale);
                            console.log('已应用3D框投影到放大图像');
                            resolve();
                        } catch (err) {
                            console.error('处理放大图像时出错:', err);
                            reject(err);
                        }
                    } else {
                        // 普通图像处理
                        try {
                            await processImage(specificImageElement, calib, camId, scale);
                            console.log('已应用包围盒投影到普通图像');
                            resolve();
                        } catch (err) {
                            console.error('处理图像时出错:', err);
                            reject(err);
                        }
                    }
                } else {
                    console.log('包围盒开关关闭，跳过投影');
                    resolve();
                }

                return;
            }

            // 否则处理所有图像
            let processedImages = 0;
            const promises = [];

            document.querySelectorAll('#imagePanel img').forEach((img, index) => {
                let camId = img.getAttribute('data-cam-id');

                // 如果没有data-cam-id属性，尝试从索引设置一个
                if (!camId) {
                    camId = `cam_${index + 1}`;
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

                // 传递缩放比例并收集Promise
                promises.push(processImage(img, calib, camId, scale));
                processedImages++;
            });

            // 等待所有处理完成
            Promise.all(promises)
                .then(() => {
                    console.log(`处理了 ${processedImages} 个图像的包围盒投影`);
                    resolve();
                })
                .catch(err => {
                    console.error('处理图像包围盒投影时出错:', err);
                    reject(err);
                });

        } catch (err) {
            console.error('包围盒投影过程中出错:', err);
            reject(err);
        }
    });
}

// 优化图像处理函数
function processImage(img, calib, camId, scale = 1) {
    return new Promise((resolve, reject) => {
        try {
            console.log(`开始处理图像包围盒, ID: ${img.id}, camId: ${camId}, scale: ${scale}`);

            // 检查是否有边界框
            if (!boxes || boxes.length === 0) {
                console.log('没有边界框可投影');
                resolve();
                return;
            }

            // 创建用于绘制的canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 如果图像已经有内容（比如点云投影），先保存当前图像
            const currentImage = new Image();
            currentImage.src = img.src;

            // 获取原始图像源
            const originalSrc = img.getAttribute('data-original-src');
            if (!originalSrc) {
                console.error('图像没有data-original-src属性', { img });
                reject(new Error('图像没有data-original-src属性'));
                return;
            }

            console.log(`图像当前源: ${img.src}, 原始源: ${originalSrc}`);

            // 设置超时，防止图像加载失败导致Promise永远不解析
            const timeout = setTimeout(() => {
                console.warn('图像加载超时，使用当前图像继续处理');
                processImageWithCanvas(img, currentImage, canvas, ctx, calib, camId, scale, resolve, reject);
            }, 3000);

            currentImage.onload = () => {
                clearTimeout(timeout);
                processImageWithCanvas(img, currentImage, canvas, ctx, calib, camId, scale, resolve, reject);
            };

            currentImage.onerror = (err) => {
                clearTimeout(timeout);
                console.error("加载当前图像时出错:", err);

                // 如果当前图像加载失败，尝试使用原始图像
                const fallbackImage = new Image();
                fallbackImage.src = originalSrc;

                fallbackImage.onload = () => {
                    console.log('使用原始图像作为备用');
                    processImageWithCanvas(img, fallbackImage, canvas, ctx, calib, camId, scale, resolve, reject);
                };

                fallbackImage.onerror = (fallbackErr) => {
                    console.error("加载原始图像也失败:", fallbackErr);
                    reject(new Error('无法加载图像'));
                };
            };
        } catch (err) {
            console.error("处理图像时出错:", err);
            reject(err);
        }
    });
}

// 辅助函数，处理图像和canvas
function processImageWithCanvas(img, sourceImage, canvas, ctx, calib, camId, scale, resolve, reject) {
    try {
        console.log(`处理图像Canvas, 图像ID: ${img.id}, camId: ${camId}, scale: ${scale}`);
        console.log('原始图像尺寸:', {
            width: sourceImage.naturalWidth,
            height: sourceImage.naturalHeight
        });

        // 设置canvas大小与原始图像相同
        canvas.width = sourceImage.naturalWidth;
        canvas.height = sourceImage.naturalHeight;

        // 确保标定数据包含图像尺寸
        if (!calib.width || !calib.height) {
            calib.width = sourceImage.naturalWidth;
            calib.height = sourceImage.naturalHeight;
            console.log(`为标定数据设置图像尺寸: ${calib.width}x${calib.height}`);
        }

        console.log(`Canvas尺寸: ${canvas.width}x${canvas.height}`);

        // 绘制原始图像到canvas
        ctx.drawImage(sourceImage, 0, 0);

        // 跟踪成功投影的框数量
        let projectedBoxCount = 0;

        // 投影每个框到图像
        boxes.forEach(box => {
            if (projectBoxToImage(box, calib, canvas, ctx, scale)) {
                projectedBoxCount++;
            }
        });

        console.log(`成功投影了 ${projectedBoxCount}/${boxes.length} 个框到图像`);

        // 如果有成功投影的框，更新图像
        if (projectedBoxCount > 0) {
            // 将canvas内容转换为图像数据
            const dataURL = canvas.toDataURL('image/png');

            // 更新图像源
            img.src = dataURL;

            // 添加指示器，表明已应用了框投影（但不添加边框）
            img.classList.add('has-boxes-projection');

            console.log('已更新图像源为包含框投影的Canvas');
        } else {
            console.warn('没有框被成功投影，保持原图像不变');
        }

        resolve(projectedBoxCount > 0);
    } catch (err) {
        console.error("处理canvas时出错:", err);
        reject(err);
    }
}

function projectBoxToImage(box, calib, canvas, ctx, scale = 1) {
    try {
        console.log(`投影框: ${box.userData.objectType || 'unknown'}, ID: ${box.userData.objectId || 'unknown'}`, {
            'canvas': `${canvas.width}x${canvas.height}`,
            'calib': calib ? '有效' : '无效',
            'scale': scale
        });

        // 获取边界框的尺寸信息
        const dimensions = box.userData.dimensions;
        if (!dimensions) {
            console.warn('边界框没有尺寸信息', { box: box.userData });
            return false;
        }

        // 确保标定数据包含图像尺寸
        if (!calib.width || !calib.height) {
            // 使用canvas尺寸作为默认值
            calib.width = canvas.width;
            calib.height = canvas.height;
            console.warn('标定数据缺少尺寸信息，使用画布尺寸:', calib.width, calib.height);
        }

        // 计算图像缩放比例
        const imgScaleX = canvas.width / calib.width;
        const imgScaleY = canvas.height / calib.height;
        const imgScaled = imgScaleX !== 1 || imgScaleY !== 1;

        if (imgScaled) {
            console.log('检测到图像尺寸调整，缩放比例:', imgScaleX, imgScaleY);
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

        // 提取和应用内参矩阵
        let fx, fy, cx, cy;

        if (calib.intrinsic && calib.intrinsic.elements) {
            fx = calib.intrinsic.elements[0];
            fy = calib.intrinsic.elements[4];
            cx = calib.intrinsic.elements[2];
            cy = calib.intrinsic.elements[5];
        } else {
            console.error('内参矩阵无效');
            return false;
        }

        // 调整内参以适应图像尺寸变化
        if (imgScaled) {
            fx *= imgScaleX;
            fy *= imgScaleY;
            cx *= imgScaleX;
            cy *= imgScaleY;
            console.log('调整后的内参:', { fx, fy, cx, cy });
        }

        // 投影到图像平面
        const imagePoints = worldVertices.map(vertex => {
            // 变换到相机坐标系
            const camPoint = vertex.clone().applyMatrix4(calib.extrinsic);

            // 如果在相机后方，则跳过
            if (camPoint.z <= 0) return null;

            // 投影到图像平面 - 使用简化的投影模型
            const x = fx * (camPoint.x / camPoint.z) + cx;
            const y = fy * (camPoint.y / camPoint.z) + cy;

            // 检查是否在图像范围内
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                return { x, y };
            }

            return null;
        });

        // 如果有足够的点在图像平面上，绘制边界框
        const visiblePoints = imagePoints.filter(p => p !== null);
        if (visiblePoints.length < 2) {
            console.warn('框不可见，可见点数:', visiblePoints.length);
            return false;
        }

        // 提取3D框真实颜色
        let boxColor;

        if (box.material && box.material.color) {
            // 从THREE.js材质中提取颜色
            const color = box.material.color;
            boxColor = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`;
        } else if (box.userData.objectColor) {
            // 从用户数据中获取颜色
            boxColor = box.userData.objectColor;
        } else {
            // 使用默认颜色
            boxColor = box.userData.objectType === 'Car' ? '#FF5722' :
                box.userData.objectType === 'Pedestrian' ? '#4CAF50' :
                    box.userData.objectType === 'Cyclist' ? '#2196F3' : '#FFC107';
        }

        // 绘制框的线条，连接顶点形成立方体
        const edges = [
            [0, 1], [1, 3], [3, 2], [2, 0], // 底面
            [4, 5], [5, 7], [7, 6], [6, 4], // 顶面
            [0, 4], [1, 5], [2, 6], [3, 7]  // 连接底面和顶面的边
        ];

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = Math.max(1, scale * 0.75); // 减小线宽，使线条更细

        let visibleEdgeCount = 0;

        for (const [i, j] of edges) {
            const p1 = imagePoints[i];
            const p2 = imagePoints[j];

            if (p1 && p2) {
                drawLine(ctx, p1, p2);
                visibleEdgeCount++;
            }
        }

        // 标记物体ID和类型
        if (visibleEdgeCount > 0) {
            // 找到所有可见点的中心
            const centerX = visiblePoints.reduce((sum, p) => sum + p.x, 0) / visiblePoints.length;
            const centerY = visiblePoints.reduce((sum, p) => sum + p.y, 0) / visiblePoints.length;

            // 绘制标签
            ctx.fillStyle = boxColor;
            ctx.font = `${Math.max(10, scale * 11)}px Arial`;
            ctx.textAlign = 'center';

            // 绘制物体类型和ID
            const label = `${box.userData.objectType || 'Unknown'} ${box.userData.objectId || ''}`;
            ctx.fillText(label, centerX, centerY);
        }

        return visibleEdgeCount > 0;
    } catch (error) {
        console.error('投影3D框时出错:', error);
        return false;
    }
}

function drawLine(ctx, p1, p2) {
    if (!p1 || !p2) return;
    
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.stroke();
}

// 添加一个专门处理放大图像的函数
export function handleEnlargedImage(enlargedImg, scale = 2.0) {
    return new Promise(async (resolve, reject) => {
        try {
            console.log('处理放大图像3D框投影', {
                'id': enlargedImg.id,
                'data-cam-id': enlargedImg.getAttribute('data-cam-id'),
                'hasOriginalSrc': !!enlargedImg.getAttribute('data-original-src'),
                'naturalSize': `${enlargedImg.naturalWidth}x${enlargedImg.naturalHeight}`,
                'displaySize': `${enlargedImg.width || enlargedImg.clientWidth}x${enlargedImg.height || enlargedImg.clientHeight}`,
                'scale': scale
            });

            const camId = enlargedImg.getAttribute('data-cam-id');
            if (!camId) {
                console.warn('放大图像缺少相机ID，不应用3D框投影');
                // 不再抛出错误，而是直接返回
                resolve(false);
                return;
            }

            const calibData = getCalibData();
            if (!calibData || !calibData[camId]) {
                console.warn(`找不到相机标定数据 ${camId}，不应用3D框投影`);
                // 不再抛出错误，而是直接返回
                resolve(false);
                return;
            }

            const calib = calibData[camId];

            // 确保标定数据包含图像尺寸
            if (!calib.width || !calib.height) {
                calib.width = enlargedImg.naturalWidth;
                calib.height = enlargedImg.naturalHeight;
                console.log(`为放大图像设置标定数据尺寸: ${calib.width}x${calib.height}`);
            }

            // 创建临时画布和上下文
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 加载当前图像内容（可能已包含点云投影）
            const currentImage = new Image();
            currentImage.crossOrigin = 'anonymous';

            // 设置超时
            const timeout = setTimeout(() => {
                console.warn('放大图像加载超时，不应用3D框投影');
                // 不再抛出错误，而是直接返回
                resolve(false);
                clearTimeout(timeout);
            }, 3000);

            currentImage.onload = () => {
                clearTimeout(timeout);

                try {
                    // 设置画布大小与当前图像相同
                    canvas.width = currentImage.naturalWidth;
                    canvas.height = currentImage.naturalHeight;

                    // 绘制当前图像到画布
                    ctx.drawImage(currentImage, 0, 0);

                    console.log('放大图像尺寸:', {
                        naturalWidth: currentImage.naturalWidth,
                        naturalHeight: currentImage.naturalHeight,
                        canvasWidth: canvas.width,
                        canvasHeight: canvas.height
                    });

                    // 检查是否有包围盒
                    if (!boxes || boxes.length === 0) {
                        console.warn('没有可用的3D包围盒数据，不应用投影');
                        resolve(false);
                        return;
                    }

                    // 投影每个框到画布上
                    let boxesProjected = 0;
                    boxes.forEach(box => {
                        if (projectBoxToImage(box, calib, canvas, ctx, scale)) {
                            boxesProjected++;
                        }
                    });

                    console.log(`成功投影 ${boxesProjected}/${boxes.length} 个3D框到放大图像`);

                    if (boxesProjected > 0) {
                        // 将画布内容转换为图像数据
                        const dataURL = canvas.toDataURL('image/png');

                        // 更新图像源
                        enlargedImg.src = dataURL;

                        // 添加类以标记已应用投影（不添加边框）
                        enlargedImg.classList.add('has-boxes-projection');
                        console.log('已更新放大图像源为包含3D框投影的画布');

                        resolve(true);
                    } else {
                        console.warn('没有3D框成功投影到放大图像');
                        resolve(false);
                    }
                } catch (error) {
                    console.error('投影3D框到放大图像时出错:', error);
                    // 不再抛出错误，而是返回失败结果
                    resolve(false);
                }
            };

            currentImage.onerror = (err) => {
                clearTimeout(timeout);
                console.error('加载放大图像失败:', err);
                // 不再抛出错误，而是返回失败结果
                resolve(false);
            };

            // 开始加载当前图像
            currentImage.src = enlargedImg.src;

        } catch (error) {
            console.error('处理放大图像3D框投影时出错:', error);
            // 不再抛出错误，而是返回失败结果
            resolve(false);
        }
    });
}

// 导出状态获取函数
export function getBoxesVisibility() {
    return boxesVisible;
}
 