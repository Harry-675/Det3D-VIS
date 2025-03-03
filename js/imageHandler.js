import { showProjectedImage } from './projectionHandler.js';
import { projectBoxesToImages, getBoxesVisibility } from './boxHandler.js';

let currentScale = 1;
let isDragging = false;
let startX, startY, translateX = 0, translateY = 0;

// 实现对象池避免频繁创建临时对象
const vectorPool = {
    vectors: [],
    getVector: function() {
        if (this.vectors.length > 0) {
            return this.vectors.pop();
        }
        return new THREE.Vector3();
    },
    releaseVector: function(vector) {
        this.vectors.push(vector);
    }
};

export function initImageViewer() {
    setupImageViewerEvents();
}

function setupImageViewerEvents() {
    const viewer = document.getElementById('imageViewer');
    const closeButton = document.getElementById('closeButton');
    
    closeButton.onclick = () => {
        viewer.style.display = 'none';
        removeViewerEvents();
    };
}

export function loadImages(frame) {
    const imagePanel = document.getElementById('imagePanel');
    imagePanel.innerHTML = '';
    
    // 相机ID列表，直接匹配JSON数据中的键
    const cameraIds = ['cam_1', 'cam_2', 'cam_3'];
    
    // 记录加载的图像数量，用于调试
    let loadedImages = 0;
    
    cameraIds.forEach(camId => {
        if (frame[camId]) {
            const img = document.createElement('img');
            img.src = frame[camId];
            img.alt = `Camera ${camId.replace('cam_', '')}`;
            img.className = 'camera-image';
            img.setAttribute('data-cam-id', camId);
            img.setAttribute('data-original-src', frame[camId]);
            
            // 设置图像样式
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.marginBottom = '10px';
            img.style.display = 'block';
            
            // 图像加载成功时记录
            img.onload = () => {
                loadedImages++;
                console.log(`图像加载完成(${loadedImages}): ${camId}`);
            };
            
            // 图像加载失败时的处理
            img.onerror = () => {
                console.error(`图像加载失败: ${camId}，路径: ${frame[camId]}`);
            };
            
            // 点击图像时放大显示
            img.addEventListener('click', function() {
                showEnlargedImage(this);
            });
            
            imagePanel.appendChild(img);
        } else {
            console.warn(`未找到相机图像: ${camId}`);
        }
    });
}

export function showImage(src, camId) {
    const viewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImage');
    
    resetViewerState();
    
    // 保存原始图像路径
    viewerImg.setAttribute('data-original-src', src);
    viewerImg.setAttribute('data-cam-id', camId);
    
    // 根据投影状态设置图像
    const projectionToggle = document.getElementById('projectionToggle');
    if (projectionToggle.checked) {
        showProjectedImage(viewerImg, camId);
    } else {
        viewerImg.src = src;
    }
    
    viewerImg.style.transform = `translate(-50%, -50%) scale(${currentScale})`;
    viewer.style.display = 'block';
    
    setupViewerEvents();
}

function resetViewerState() {
    currentScale = 1;
    translateX = 0;
    translateY = 0;
}

function setupViewerEvents() {
    const viewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImage');
    
    viewer.addEventListener('wheel', handleWheel);
    viewerImg.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', stopDrag);
}

function removeViewerEvents() {
    const viewer = document.getElementById('imageViewer');
    const viewerImg = document.getElementById('viewerImage');
    
    viewer.removeEventListener('wheel', handleWheel);
    viewerImg.removeEventListener('mousedown', startDrag);
    document.removeEventListener('mousemove', drag);
    document.removeEventListener('mouseup', stopDrag);
}

function handleWheel(e) {
    e.preventDefault();
    const delta = e.deltaY * -0.01;
    const newScale = Math.max(0.1, Math.min(5, currentScale + delta));
    currentScale = newScale;
    
    const viewerImg = document.getElementById('viewerImage');
    viewerImg.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${currentScale})`;
}

function startDrag(e) {
    isDragging = true;
    startX = e.clientX - translateX;
    startY = e.clientY - translateY;
}

function drag(e) {
    if (!isDragging) return;
    
    translateX = e.clientX - startX;
    translateY = e.clientY - startY;
    
    const viewerImg = document.getElementById('viewerImage');
    viewerImg.style.transform = `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px)) scale(${currentScale})`;
}

function stopDrag() {
    isDragging = false;
}

function showEnlargedImage(imgElement) {
    try {
        console.log('放大图像显示');
        
        // 获取或创建放大图像面板
        let enlargedPanel = document.getElementById('enlargedImagePanel');
        
        // 如果已存在面板，先移除它
        if (enlargedPanel) {
            document.body.removeChild(enlargedPanel);
        }
        
        // 创建新的面板
        enlargedPanel = document.createElement('div');
        enlargedPanel.id = 'enlargedImagePanel';
        enlargedPanel.className = 'enlarged-image-panel';
        
        // 添加关闭按钮
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.className = 'close-btn';
        closeBtn.onclick = function() {
            enlargedPanel.style.display = 'none';
            setTimeout(() => {
                if (enlargedPanel.parentNode) {
                    document.body.removeChild(enlargedPanel);
                }
            }, 300);
        };
        
        // 创建图像元素
        const enlargedImg = document.createElement('img');
        enlargedImg.id = 'enlargedImage';
        enlargedImg.className = 'enlarged-image';
        
        // 获取原始图像属性
        const camId = imgElement.getAttribute('data-cam-id');
        const originalSrc = imgElement.getAttribute('data-original-src');
        
        if (!camId || !originalSrc) {
            console.error('放大图像缺少必要属性', { camId, originalSrc });
            return;
        }
        
        // 设置放大图像属性 - 确保属性正确传递
        enlargedImg.alt = imgElement.alt;
        enlargedImg.setAttribute('data-cam-id', camId);
        enlargedImg.setAttribute('data-original-src', originalSrc);
        
        // 添加加载指示
        enlargedImg.style.opacity = '0';
        enlargedImg.style.transition = 'opacity 0.3s ease';
        
        // 获取投影开关状态
        const projectionToggle = document.getElementById('projectionToggle');
        const boxToggle = document.getElementById('boxToggle');
        
        // 记录投影状态，避免重复处理
        let projectionApplied = false;

        // 图像加载完成后的处理
        enlargedImg.onload = async function () {
            if (projectionApplied) return; // 避免重复处理
            projectionApplied = true;

            enlargedImg.style.opacity = '1';
            
            try {
                // 根据开关状态决定是否显示投影
                if (projectionToggle.checked) {
                    // 从projectionHandler导入并调用函数
                    const projectionModule = await import('./projectionHandler.js');
                    await new Promise(resolve => {
                        // 确保图像完全加载
                        if (enlargedImg.complete) {
                            projectionModule.showProjectedImage(enlargedImg, camId);
                            resolve();
                        } else {
                            enlargedImg.onload = () => {
                                projectionModule.showProjectedImage(enlargedImg, camId);
                                resolve();
                            };
                        }
                    });
                } else if (boxToggle.checked) {
                    // 如果只显示3D框，使用原始图像后应用框
                    const boxModule = await import('./boxHandler.js');
                    boxModule.projectBoxesToImages(enlargedImg, 2.0);
                }
            } catch (err) {
                console.error('处理放大图像投影时出错:', err);
                // 出错时显示原始图像
                enlargedImg.src = originalSrc;
            }
        };
        
        // 设置图像源
        enlargedImg.src = originalSrc;
        
        // 组装面板
        enlargedPanel.appendChild(closeBtn);
        enlargedPanel.appendChild(enlargedImg);
        document.body.appendChild(enlargedPanel);
        
        // 显示面板（使用延迟以确保过渡效果）
        requestAnimationFrame(() => {
            enlargedPanel.style.display = 'flex';
        });
        
        // 添加键盘事件监听
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeBtn.click();
                document.removeEventListener('keydown', handleKeyDown);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        
        // 添加投影开关事件监听
        const handleProjectionToggle = async () => {
            try {
                // 重置处理状态
                projectionApplied = false;

                if (projectionToggle.checked) {
                    const projectionModule = await import('./projectionHandler.js');
                    await new Promise(resolve => {
                        // 确保图像完全加载
                        if (enlargedImg.complete) {
                            projectionModule.showProjectedImage(enlargedImg, camId);
                            resolve();
                        } else {
                            enlargedImg.onload = () => {
                                projectionModule.showProjectedImage(enlargedImg, camId);
                                resolve();
                            };
                        }
                    });
                } else {
                    enlargedImg.src = originalSrc;
                    if (boxToggle.checked) {
                        // 等待图像加载后应用框
                        await new Promise(resolve => {
                            enlargedImg.onload = async () => {
                                const boxModule = await import('./boxHandler.js');
                                boxModule.projectBoxesToImages(enlargedImg, 2.0);
                                resolve();
                            };
                        });
                    }
                }
            } catch (err) {
                console.error('切换投影时出错:', err);
                // 出错时恢复原始图像
                enlargedImg.src = originalSrc;
            }
        };
        
        const handleBoxToggle = async () => {
            if (!projectionToggle.checked) {
                try {
                    if (boxToggle.checked) {
                        enlargedImg.src = originalSrc;
                        // 等待图像加载后应用框
                        await new Promise(resolve => {
                            enlargedImg.onload = async () => {
                                const boxModule = await import('./boxHandler.js');
                                boxModule.projectBoxesToImages(enlargedImg, 2.0);
                                resolve();
                            };
                        });
                    } else {
                        enlargedImg.src = originalSrc;
                    }
                } catch (err) {
                    console.error('切换框显示时出错:', err);
                // 出错时恢复原始图像
                    enlargedImg.src = originalSrc;
                }
            }
        };
        
        // 添加开关事件监听
        projectionToggle.addEventListener('change', handleProjectionToggle);
        boxToggle.addEventListener('change', handleBoxToggle);
        
        // 在关闭面板时移除事件监听
        const cleanup = () => {
            projectionToggle.removeEventListener('change', handleProjectionToggle);
            boxToggle.removeEventListener('change', handleBoxToggle);
        };
        
        closeBtn.addEventListener('click', cleanup);
        
    } catch (err) {
        console.error('显示放大图像时出错', err);
    }
}

// 优化图像处理
// function optimizedImageProcessing(imageData) {
//     // 使用对象池
//     const vec = vectorPool.getVector();
    
//     // 处理图像
//     // ...
    
//     // 处理完成后归还对象
//     vectorPool.releaseVector(vec);
// }