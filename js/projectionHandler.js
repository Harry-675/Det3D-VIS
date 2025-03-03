import { getPointCloud } from './pointCloudHandler.js';
import { getCalibData } from './fileHandler.js';
import { hsvToRgb } from './utils.js';

let projectionEnabled = false;
let lastProjectionTime = 0;
let projectionStartTime = 0;

export function toggleProjection(e) {
    projectionEnabled = e.target.checked;
    if (projectionEnabled) {
        updateProjection();
    } else {
        resetProjection();
    }
}

export function updateProjection() {
    // 记录开始时间
    projectionStartTime = performance.now();
    
    const pointCloud = getPointCloud();
    const calibData = getCalibData();
    
    if (!pointCloud || !calibData) return;
    
    const positions = pointCloud.geometry.attributes.position.array;

    const promises = [];
    
    Object.entries(calibData).forEach(([camId, calib]) => {
        const img = document.querySelector(`#imagePanel img[data-cam-id="${camId}"]`);
        
        if (!img) {
            console.error(`找不到对应 ${camId} 的图像元素`);
            return;
        }
        
        const originalSrc = img.getAttribute('data-original-src');
        
        const promise = new Promise((resolve) => {
            const tempImg = new Image();
            tempImg.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = tempImg.naturalWidth;
                canvas.height = tempImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0);
                
                projectPointsToImage(positions, calib, canvas, ctx);
                
                // 将Canvas的内容设置为img的src
                img.src = canvas.toDataURL();
                resolve();
            };
            tempImg.src = originalSrc;
        });
        
        promises.push(promise);
    });
    
    // 等待所有投影完成
    Promise.all(promises).then(() => {
        // 计算并记录总处理时间
        const endTime = performance.now();
        const totalTime = endTime - projectionStartTime;
        lastProjectionTime = totalTime;
    });
}

export function showProjectedImage(viewerImg, camId) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const originalSrc = viewerImg.src;
    const tempImg = new Image();

    // 获取控制开关状态
    const isEnlargedView = viewerImg.id === 'viewerImage';
    const projectionToggle = isEnlargedView ? 
        document.getElementById('viewerProjectionToggle') : 
        document.getElementById('projectionToggle');
    const boxToggle = isEnlargedView ? 
        document.getElementById('viewerBoxToggle') : 
        document.getElementById('boxToggle');

    tempImg.onload = () => {
        canvas.width = tempImg.naturalWidth;
        canvas.height = tempImg.naturalHeight;
        
        // 绘制原始图像
        ctx.drawImage(tempImg, 0, 0);
        
        // 如果点云投影开关打开，添加点云投影
        if (projectionToggle && projectionToggle.checked) {
            const positions = pointCloud.geometry.attributes.position.array;
            projectPointsToImage(positions, calibData[camId], canvas, ctx);
        }
        
        // 更新图像
        viewerImg.src = canvas.toDataURL();
        
        // 如果3D框开关打开，等待图像加载完成后添加框投影
        if (boxToggle && boxToggle.checked) {
            viewerImg.onload = () => {
                import('./boxHandler.js').then(module => {
                    module.projectBoxesToImages(viewerImg, 2.0);
                });
            };
        }
    };
    tempImg.src = originalSrc;
}

function projectPointsToImage(positions, calib, canvas, ctx) {
    let minZ = Infinity, maxZ = -Infinity;
    
    // 首先计算所有可见点的Z值范围
    for (let i = 0; i < positions.length; i += 3) {
        const point = new THREE.Vector4(
            positions[i],
            positions[i + 1],
            positions[i + 2],
            1
        );
        
        const pointCam = point.applyMatrix4(calib.extrinsic);
        
        if (pointCam.z > 0) {
            minZ = Math.min(minZ, pointCam.z);
            maxZ = Math.max(maxZ, pointCam.z);
        }
    }
    
    // 使用视锥体剔除优化
    const culledPoints = [];
    for (let i = 0; i < positions.length; i += 3) {
        const point = new THREE.Vector4(
            positions[i],
            positions[i + 1],
            positions[i + 2],
            1
        );
        
        const pointCam = point.applyMatrix4(calib.extrinsic);
        
        // 简单视锥体剔除：只保留Z值为正的点
        if (pointCam.z > 0) {
            culledPoints.push({
                position: [positions[i], positions[i+1], positions[i+2]],
                pointCam: pointCam
            });
        }
    }
    
    // 投影剔除后的点云
    for (const point of culledPoints) {
        const pointCam = point.pointCam;
        
        const normalizedZ = (pointCam.z - minZ) / (maxZ - minZ || 1);
        const hue = 360 * (1 - normalizedZ);
        const rgb = hsvToRgb(hue, 1.0, 1.0);
        
        const x = (calib.intrinsic.elements[0] * pointCam.x + 
                  calib.intrinsic.elements[1] * pointCam.y + 
                  calib.intrinsic.elements[2] * pointCam.z) / pointCam.z;
                  
        const y = (calib.intrinsic.elements[3] * pointCam.x + 
                  calib.intrinsic.elements[4] * pointCam.y + 
                  calib.intrinsic.elements[5] * pointCam.z) / pointCam.z;
        
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
            ctx.beginPath();
            ctx.arc(x, y, 2, 0, 2 * Math.PI);
            ctx.fillStyle = `rgb(${rgb.r * 255}, ${rgb.g * 255}, ${rgb.b * 255})`;
            ctx.fill();
        }
    }
}

function resetProjection() {
    const imagePanel = document.getElementById('imagePanel');
    const images = imagePanel.getElementsByTagName('img');
    Array.from(images).forEach(img => {
        const originalSrc = img.getAttribute('data-original-src');
        if (originalSrc) {
            img.src = originalSrc;
        }
    });
}
