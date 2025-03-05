import { showProjectedImage } from './projectionHandler.js';
import { projectBoxesToImages, getBoxesVisibility } from './boxHandler.js';
import { getFileUrl } from './fileHandler.js';

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
    // 确保主开关有正确的初始状态
    const mainProjectionToggle = document.getElementById('projectionToggle');
    const mainBoxToggle = document.getElementById('boxToggle');

    if (mainProjectionToggle) {
        mainProjectionToggle.checked = false; // 点云投影默认关闭
    }

    if (mainBoxToggle) {
        mainBoxToggle.checked = true; // 3D框默认打开
    }

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
    
    // 定义所有可能的相机ID
    const cameraPrefixes = ['camera_', 'panoramic_', 'traffic_'];
    const allCameras = [];

    // 收集所有可用的相机和它们的图像路径
    for (const key in frame) {
        for (const prefix of cameraPrefixes) {
            if (key.startsWith(prefix) && frame[key]) {
                const cameraNumber = key.replace(prefix, '');
                // 使用服务器URL
                const imageUrl = getFileUrl(frame[key]);
                allCameras.push({
                    id: key,
                    src: imageUrl,
                    originalPath: frame[key],
                    displayName: `${prefix.replace('_', ' ')}${cameraNumber}`
                });
            }
        }
    }

    console.log(`找到 ${allCameras.length} 个相机图像`, allCameras);
    
    // 记录加载的图像数量，用于调试
    let loadedImages = 0;
    
    // 创建相机图像容器
    allCameras.forEach(camera => {
        if (camera.src) {
            // 创建相机视图容器
            const cameraContainer = document.createElement('div');
            cameraContainer.className = 'camera-container';

            // 创建相机标题
            const cameraTitle = document.createElement('div');
            cameraTitle.className = 'camera-title';
            cameraTitle.textContent = camera.displayName;
            cameraContainer.appendChild(cameraTitle);

    // 创建图像元素
            const img = document.createElement('img');
            img.src = camera.src;
            img.alt = camera.displayName;
            img.className = 'camera-image';
            img.setAttribute('data-cam-id', camera.id);
            img.setAttribute('data-original-src', camera.src);
            img.setAttribute('data-original-path', camera.originalPath);
            
            // 设置图像样式
            img.style.width = '100%';
            img.style.height = 'auto';
            img.style.marginBottom = '0px';
            img.style.display = 'block';
            
            // 图像加载成功时记录
            img.onload = () => {
                loadedImages++;
                console.log(`图像加载完成(${loadedImages}/${allCameras.length}): ${camera.id}`);
            };
            
            // 图像加载失败时的处理
            img.onerror = () => {
                console.error(`图像加载失败: ${camera.id}，路径: ${camera.src}`);
                console.error(`原始路径: ${camera.originalPath}`);
                img.src = 'data:image/svg+xml;charset=UTF-8,%3Csvg%20width%3D%22318%22%20height%3D%22180%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20318%20180%22%20preserveAspectRatio%3D%22none%22%3E%3Cdefs%3E%3Cstyle%20type%3D%22text%2Fcss%22%3E%23holder_158bd1d28ef%20text%20%7B%20fill%3A%23868e96%3Bfont-weight%3Abold%3Bfont-family%3AArial%2C%20Helvetica%2C%20Open%20Sans%2C%20sans-serif%2C%20monospace%3Bfont-size%3A16pt%20%7D%20%3C%2Fstyle%3E%3C%2Fdefs%3E%3Cg%20id%3D%22holder_158bd1d28ef%22%3E%3Crect%20width%3D%22318%22%20height%3D%22180%22%20fill%3D%22%23777%22%3E%3C%2Frect%3E%3Cg%3E%3Ctext%20x%3D%22129.359375%22%20y%3D%2297.35%22%3E%E5%9B%BE%E5%83%8F%E5%8A%A0%E8%BD%BD%E5%A4%B1%E8%B4%A5%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fg%3E%3C%2Fsvg%3E';
            };
            
            // 点击图像时放大显示
            img.addEventListener('click', function() {
                showEnlargedImage(this);
            });
            
            cameraContainer.appendChild(img);
            imagePanel.appendChild(cameraContainer);
        }
    });

    // 如果没有找到任何图像，显示提示信息
    if (allCameras.length === 0) {
        const noImagesMsg = document.createElement('div');
        noImagesMsg.textContent = '未找到任何相机图像';
        noImagesMsg.style.color = 'white';
        noImagesMsg.style.padding = '20px';
        noImagesMsg.style.textAlign = 'center';
        imagePanel.appendChild(noImagesMsg);
    }
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
        
        // 创建控制面板
        const controlsContainer = document.createElement('div');
        controlsContainer.style.position = 'absolute';
        controlsContainer.style.top = '10px';
        controlsContainer.style.right = '10px';
        controlsContainer.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        controlsContainer.style.padding = '12px 15px';
        controlsContainer.style.borderRadius = '5px';
        controlsContainer.style.zIndex = '1000';
        controlsContainer.style.display = 'flex';
        controlsContainer.style.flexDirection = 'column';
        controlsContainer.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.3)';

        // 添加统一的开关样式
        const toggleStyles = document.createElement('style');
        toggleStyles.id = 'enlarged-toggle-style';
        toggleStyles.textContent = `
        /* 开关容器 */
        .viewer-toggle-container {
            display: flex;
            align-items: center;
            margin-right: 15px;
            margin-bottom: 10px;
            user-select: none;
        }

        /* 开关标签 */
        .viewer-toggle-label {
            margin-left: 10px;
            font-size: 13px;
            color: #f0f0f0;
            cursor: pointer;
            transition: color 0.3s;
            font-weight: 500;
            letter-spacing: 0.5px;
        }

        /* 开关样式 */
        .viewer-toggle {
            position: relative;
            display: inline-block;
            width: 38px;
            height: 19px;
        }

        .viewer-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .viewer-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .3s;
            border-radius: 19px;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);
        }

        .viewer-slider:before {
            position: absolute;
            content: "";
            height: 15px;
            width: 15px;
            left: 2px;
            bottom: 2px;
            background-color: white;
            transition: .3s;
            border-radius: 50%;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }

        input:checked + .viewer-slider {
            background-color: #2196F3;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 5px rgba(33, 150, 243, 0.7);
        }

        /* 点云投影开关特殊样式 */
        input#viewerProjectionToggle:checked + .viewer-slider {
            background-color: #2196F3;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 5px rgba(33, 150, 243, 0.7);
        }

        /* 3D框开关特殊样式 */
        input#viewerBoxToggle:checked + .viewer-slider {
            background-color: #2196F3;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3), 0 0 5px rgba(33, 150, 243, 0.7);
        }

        input:checked + .viewer-slider:before {
            transform: translateX(19px);
        }

        /* 标签颜色 */
        input:checked ~ .viewer-toggle-label {
            color: #2196F3;
            text-shadow: 0 0 2px rgba(33, 150, 243, 0.4);
        }
        `;

        // 添加样式到文档头
        if (!document.getElementById('enlarged-toggle-style')) {
            document.head.appendChild(toggleStyles);
        }

        // 创建标题
        const controlsTitle = document.createElement('div');
        controlsTitle.textContent = '显示控制';
        controlsTitle.style.color = '#fff';
        controlsTitle.style.fontWeight = 'bold';
        controlsTitle.style.marginBottom = '12px';
        controlsTitle.style.fontSize = '14px';
        controlsTitle.style.textAlign = 'center';
        controlsTitle.style.letterSpacing = '1px';
        controlsTitle.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
        controlsTitle.style.borderBottom = '1px solid rgba(255, 255, 255, 0.2)';
        controlsTitle.style.paddingBottom = '8px';
        controlsContainer.appendChild(controlsTitle);

        // 创建放大视图专用的投影开关
        const projectionToggleContainer = document.createElement('div');
        projectionToggleContainer.className = 'viewer-toggle-container';
        projectionToggleContainer.style.width = '100%';

        // 创建投影开关
        const projectionToggleLabel = document.createElement('label');
        projectionToggleLabel.className = 'viewer-toggle';

        // 创建input
        const projectionToggle = document.createElement('input');
        projectionToggle.type = 'checkbox';
        projectionToggle.id = 'viewerProjectionToggle';
        projectionToggle.checked = false;

        // 创建slider
        const projectionSlider = document.createElement('span');
        projectionSlider.className = 'viewer-slider';

        // 组装投影开关
        projectionToggleLabel.appendChild(projectionToggle);
        projectionToggleLabel.appendChild(projectionSlider);

        // 创建开关文本
        const projectionToggleText = document.createElement('span');
        projectionToggleText.className = 'viewer-toggle-label';
        projectionToggleText.textContent = '点云投影';

        // 组装投影开关容器
        projectionToggleContainer.appendChild(projectionToggleLabel);
        projectionToggleContainer.appendChild(projectionToggleText);
        controlsContainer.appendChild(projectionToggleContainer);

        // 创建放大视图专用的3D框开关
        const boxToggleContainer = document.createElement('div');
        boxToggleContainer.className = 'viewer-toggle-container';
        boxToggleContainer.style.width = '100%';

        // 创建3D框开关
        const boxToggleLabel = document.createElement('label');
        boxToggleLabel.className = 'viewer-toggle';

        // 创建input
        const boxToggle = document.createElement('input');
        boxToggle.type = 'checkbox';
        boxToggle.id = 'viewerBoxToggle';
        boxToggle.checked = false;

        // 创建slider
        const boxSlider = document.createElement('span');
        boxSlider.className = 'viewer-slider';

        // 组装3D框开关
        boxToggleLabel.appendChild(boxToggle);
        boxToggleLabel.appendChild(boxSlider);

        // 创建开关文本
        const boxToggleText = document.createElement('span');
        boxToggleText.className = 'viewer-toggle-label';
        boxToggleText.textContent = '3D框投影';

        // 组装3D框开关容器
        boxToggleContainer.appendChild(boxToggleLabel);
        boxToggleContainer.appendChild(boxToggleText);
        controlsContainer.appendChild(boxToggleContainer);

        console.log('放大视图开关状态:', {
            projection: projectionToggle.checked,
            box: boxToggle.checked
        });
        
        // 记录投影状态，避免重复处理
        let projectionApplied = false;

        // 创建处理队列，确保按顺序应用投影
        const processQueue = async () => {
            if (projectionApplied) return; // 避免重复处理
            projectionApplied = true;

            try {
                console.log('开始处理放大图像队列');
                console.log('开关状态:', {
                    '点云投影': projectionToggle.checked,
                    '3D框': boxToggle.checked
                });

                // 无论如何先重置图像到原始状态
                enlargedImg.src = originalSrc;

                // 等待图像加载完成
                await new Promise(resolve => {
                    if (enlargedImg.complete) {
                        resolve();
                    } else {
                        enlargedImg.onload = () => resolve();
                    }
                });

                // 设置图像为可见
                enlargedImg.style.opacity = '1';

                // 移除处理指示器
                const processingIndicator = document.getElementById('processingIndicator');
                if (processingIndicator && processingIndicator.parentNode) {
                    processingIndicator.parentNode.removeChild(processingIndicator);
                }

                if (projectionToggle.checked) {
                    console.log('正在应用点云投影...');
                    try {
                        const projectionModule = await import('./projectionHandler.js');

                        // 应用点云投影，始终跳过自动绘制框，因为我们会在下一步独立控制
                        const result = await projectionModule.showProjectedImage(enlargedImg, camId, true, true);

                        if (result) {
                            console.log('点云投影成功完成');
                            // 添加绿色边框表示成功
                            enlargedImg.style.border = '2px solid #4CAF50';
                            setTimeout(() => {
                                enlargedImg.style.border = 'none';
                            }, 1000);
                        } else {
                            console.warn('点云投影未能成功应用');
                            // 添加黄色边框表示警告
                            enlargedImg.style.border = '2px solid #FFC107';
                            setTimeout(() => {
                                enlargedImg.style.border = 'none';
                            }, 1000);

                            // 显示错误提示
                            const errorMsg = document.createElement('div');
                            errorMsg.textContent = '点云投影未能正确应用';
                            errorMsg.style.position = 'absolute';
                            errorMsg.style.bottom = '20px';
                            errorMsg.style.left = '50%';
                            errorMsg.style.transform = 'translateX(-50%)';
                            errorMsg.style.color = '#FFC107';
                            errorMsg.style.fontSize = '14px';
                            errorMsg.style.padding = '5px 10px';
                            errorMsg.style.background = 'rgba(0,0,0,0.7)';
                            errorMsg.style.borderRadius = '3px';
                            errorMsg.style.zIndex = '1000';
                            enlargedPanel.appendChild(errorMsg);

                            setTimeout(() => {
                                if (errorMsg.parentNode) {
                                    enlargedPanel.removeChild(errorMsg);
                                }
                            }, 3000);
                        }
                    } catch (err) {
                        console.error('应用点云投影时出错:', err);
                        // 显示错误消息
                        const errorMsg = document.createElement('div');
                        errorMsg.textContent = `投影错误: ${err.message || '未知错误'}`;
                        errorMsg.style.position = 'absolute';
                        errorMsg.style.top = '10px';
                        errorMsg.style.left = '50%';
                        errorMsg.style.transform = 'translateX(-50%)';
                        errorMsg.style.color = '#F44336';
                        errorMsg.style.fontSize = '14px';
                        errorMsg.style.padding = '5px 10px';
                        errorMsg.style.background = 'rgba(0,0,0,0.7)';
                        errorMsg.style.borderRadius = '3px';
                        errorMsg.style.zIndex = '1000';
                        enlargedPanel.appendChild(errorMsg);

                        setTimeout(() => {
                            if (errorMsg.parentNode) {
                                enlargedPanel.removeChild(errorMsg);
                            }
                        }, 3000);
                    }
                }

                // 独立应用3D框投影（如果开关打开）
                if (boxToggle.checked) {
                    console.log('正在应用3D框投影...');
                    try {
                        const boxModule = await import('./boxHandler.js');

                        // 使用优化后的放大图像处理
                        const result = await boxModule.handleEnlargedImage(enlargedImg, 2.0);

                        if (result) {
                            console.log('3D框投影成功应用到放大图像');
                            // 添加视觉反馈
                            enlargedImg.classList.add('has-boxes');
                        } else {
                            console.warn('3D框投影无效，可能没有可见的框');
                        }
                    } catch (err) {
                        console.error('应用3D框投影时出错:', err);
                    }
                }

                console.log('放大图像处理完成');
            } catch (err) {
                console.error('处理放大图像出错:', err);
            // 出错时确保显示原始图像
                enlargedImg.src = originalSrc;
                enlargedImg.style.opacity = '1';
            } finally {
                projectionApplied = false; // 重置状态，允许再次处理
            }
        };

        // 设置图像源并立即显示
        enlargedImg.src = originalSrc;
        
        // 图像加载完成后的处理
        enlargedImg.onload = function () {
            // 立即显示原始图像
            enlargedImg.style.opacity = '1';

            // 如果开关已打开，异步处理投影
            if (projectionToggle.checked || boxToggle.checked) {
                setTimeout(() => processQueue(), 100);
            }
        };

        // 组装面板
        enlargedPanel.appendChild(closeBtn);
        enlargedPanel.appendChild(enlargedImg);
        enlargedPanel.appendChild(controlsContainer);
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
            console.log('放大视图点云投影开关切换:', projectionToggle.checked);

            // 在开关状态变化时添加明显的视觉反馈
            if (projectionToggle.checked) {
                // 添加视觉反馈
                const processingIndicator = document.createElement('div');
                processingIndicator.textContent = '正在处理点云...';
                processingIndicator.style.position = 'absolute';
                processingIndicator.style.top = '50%';
                processingIndicator.style.left = '50%';
                processingIndicator.style.transform = 'translate(-50%, -50%)';
                processingIndicator.style.background = 'rgba(0,0,0,0.8)';
                processingIndicator.style.color = '#2196F3';
                processingIndicator.style.padding = '10px 20px';
                processingIndicator.style.borderRadius = '5px';
                processingIndicator.style.fontWeight = 'bold';
                processingIndicator.style.zIndex = '1000';
                processingIndicator.id = 'processingIndicator';
                enlargedPanel.appendChild(processingIndicator);
            }

            processQueue();
        };
        
        // 添加包围盒开关事件监听
        const handleBoxToggle = async () => {
            console.log('放大视图包围盒开关切换:', boxToggle.checked);
            processQueue();
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
