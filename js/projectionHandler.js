import { getPointCloud } from './pointCloudHandler.js';
import { getCalibData } from './fileHandler.js';
import { hsvToRgb } from './utils.js';

let projectionEnabled = false;
let lastProjectionTime = 0;
let projectionStartTime = 0;

// 计算图像的缩放因子
function getScaleFactor(canvas, imgElement) {
    if (!canvas || !imgElement) return 1.0;

    // 如果图像还没有完全加载，返回默认值
    if (!imgElement.naturalWidth || !imgElement.naturalHeight) return 1.0;

    // 计算图像原始尺寸与显示尺寸的比例
    const displayWidth = imgElement.width || imgElement.clientWidth;
    const displayHeight = imgElement.height || imgElement.clientHeight;

    if (!displayWidth || !displayHeight) return 1.0;

    // 为了调试目的，记录尺寸信息
    console.log('缩放计算详情:', {
        canvas: `${canvas.width}x${canvas.height}`,
        naturalSize: `${imgElement.naturalWidth}x${imgElement.naturalHeight}`,
        displaySize: `${displayWidth}x${displayHeight}`,
        widthRatio: canvas.width / displayWidth,
        heightRatio: canvas.height / displayHeight
    });

    // 返回适当的缩放因子
    return Math.max(0.5, Math.max(canvas.width / displayWidth, canvas.height / displayHeight));
}

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
    
    if (!pointCloud || !calibData) {
        console.error('无法更新投影：缺少点云或标定数据');
        return;
    }

    const promises = [];
    
    Object.entries(calibData).forEach(([camId, calib]) => {
        const img = document.querySelector(`#imagePanel img[data-cam-id="${camId}"]`);
        
        if (!img) {
            console.error(`找不到对应 ${camId} 的图像元素`);
            return;
        }
        
        // 确保标定数据包含图像尺寸信息
        if (!calib.width || !calib.height) {
            if (img.naturalWidth && img.naturalHeight) {
                calib.width = img.naturalWidth;
                calib.height = img.naturalHeight;
                console.log(`为相机 ${camId} 设置图像尺寸:`, calib.width, calib.height);
            } else {
                console.warn(`相机 ${camId} 缺少图像尺寸信息，可能导致投影不准确`);
                // 使用默认值或当前显示尺寸
                calib.width = img.width || 1280;
                calib.height = img.height || 720;
            }
        }

        const originalSrc = img.getAttribute('data-original-src');
        
        const promise = new Promise(async (resolve) => {
            const tempImg = new Image();
            tempImg.onload = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = tempImg.naturalWidth;
                canvas.height = tempImg.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(tempImg, 0, 0);
                
                // 计算比例因子
                let scale = 1.0;
                try {
                    scale = getScaleFactor(canvas, img);
                    console.log(`相机 ${camId} 使用比例因子: ${scale}`);
                } catch (scaleError) {
                    console.warn(`计算比例因子时出错 (${camId}):`, scaleError);
                }
                
                // 打印图像信息以便调试
                console.log(`相机 ${camId} 图像信息:`, {
                    naturalSize: `${tempImg.naturalWidth}x${tempImg.naturalHeight}`,
                    displaySize: `${img.width || img.clientWidth}x${img.height || img.clientHeight}`,
                    canvasSize: `${canvas.width}x${canvas.height}`
                });

                // 使用投影函数
                const result = await projectPointsToImage(camId, canvas, ctx, scale, true);

                if (result) {
                    // 如果投影成功，将Canvas的内容设置为img的src
                    const dataUrl = canvas.toDataURL('image/png');
                    img.src = dataUrl;
                    console.log(`相机 ${camId} 点云投影成功应用`);

                    // 为缩略图添加指示器，表明已应用了点云投影
                    img.classList.add('has-projection');
                    img.style.border = '2px solid #2196F3';
                } else {
                    console.error(`相机 ${camId} 点云投影失败`);
                    img.src = originalSrc; // 恢复原始图像
                    img.classList.remove('has-projection');
                    img.style.border = ''; // 移除边框
                }
                resolve();
            };
            tempImg.onerror = () => {
                console.error(`加载图像失败: ${originalSrc}`);
                img.classList.remove('has-projection');
                img.style.border = ''; // 移除边框
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
        console.log(`点云投影完成，总耗时: ${totalTime.toFixed(2)}ms`);
    });
}

export async function showProjectedImage(viewerImg, camId, skipBoxes = false, debug = false) {
    if (!viewerImg || !camId) {
        console.error('显示投影图像：缺少必要参数', { viewerImg, camId });
        return false;
    }

    // 记录开始投影时间
    const startTime = performance.now();
    console.log(`[开始点云投影] 相机ID: ${camId}, 跳过框: ${skipBoxes}, 调试模式: ${debug}`);

    // 显示图像元素信息，便于调试
    console.log('图像元素信息:', {
        id: viewerImg.id,
        width: viewerImg.width,
        height: viewerImg.height,
        naturalWidth: viewerImg.naturalWidth,
        naturalHeight: viewerImg.naturalHeight,
        complete: viewerImg.complete
    });

    // 如果没有原始图像源，保存当前图像作为原始图像
    const originalSrc = viewerImg.getAttribute('data-original-src') || viewerImg.src;
    if (!viewerImg.hasAttribute('data-original-src')) {
        viewerImg.setAttribute('data-original-src', originalSrc);
        console.log('已保存原始图像源:', originalSrc);
    }

    // 清晰记录画布重置状态
    console.log('重置画布状态');
    try {
        // 使用Promise包装异步操作
        return await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                console.warn('点云投影操作超时');
                resolve(false);
            }, 10000);

    // 创建临时图像加载原始图像
            const tempImg = new Image();
            tempImg.crossOrigin = 'Anonymous';

            tempImg.onload = async () => {
                clearTimeout(timeout);
                console.log('原始图像加载成功，尺寸:', tempImg.width, 'x', tempImg.height);

                try {
                    // 准备Canvas绘制点云
                    const canvas = document.createElement('canvas');
                    canvas.width = tempImg.width;
                    canvas.height = tempImg.height;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        console.error('无法获取2D绘图上下文');
                        viewerImg.src = originalSrc;
                        resolve(false);
                        return;
                    }

                    // 绘制原始图像
                    ctx.drawImage(tempImg, 0, 0);
                    console.log('原始图像已绘制到Canvas');

                    // 获取比例因子
                    let scale = 1.0;
                    try {
                        scale = getScaleFactor(canvas, viewerImg);
                        console.log('使用比例因子:', scale);
                    } catch (scaleError) {
                        console.warn('计算比例因子时出错:', scaleError);
                        scale = 1.0; // 使用默认值
                    }

                    // 投影点云到图像
                    console.log('开始投影点云');
                    const hasPoints = await projectPointsToImage(camId, canvas, ctx, scale, debug);

                    if (hasPoints) {
                        console.log('点云投影成功，将Canvas内容设置为图像源');
                        // 将Canvas内容设置为图像源
                        viewerImg.src = canvas.toDataURL('image/png');

                        // 在调试模式下记录图像尺寸
                        if (debug) {
                            console.log('投影后图像尺寸:', viewerImg.width, 'x', viewerImg.height);
                            console.log('Canvas尺寸:', canvas.width, 'x', canvas.height);
                        }

                        // 如果需要显示包围盒，等待图像加载并应用包围盒
                        if (boxToggle.checked && !skipBoxes) {
                            // 设置超时，防止图像加载失败导致Promise永远不解析
                            const boxTimeout = setTimeout(() => {
                                console.warn('包围盒应用超时');
                                const endTime = performance.now();
                                console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms (包含超时)。结果: 部分成功`);
                                resolve(true);
                            }, 3000);

                            viewerImg.onload = () => {
                                clearTimeout(boxTimeout);
                                console.log('投影图像加载完成，准备应用包围盒');
                                import('./boxHandler.js').then(module => {
                                    module.projectBoxesToImages(viewerImg, scale)
                                        .then(() => {
                                            console.log('包围盒应用完成');
                                            const endTime = performance.now();
                                            console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 完全成功`);
                                            resolve(true);
                                        })
                                        .catch(err => {
                                            console.error('应用包围盒投影时出错:', err);
                                            const endTime = performance.now();
                                            console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 部分成功 (包围盒失败)`);
                                            resolve(true); // 即使出错也继续
                                        });
                                }).catch(err => {
                                    console.error('导入boxHandler模块时出错:', err);
                                    const endTime = performance.now();
                                    console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 部分成功 (导入失败)`);
                                    resolve(true);
                                });
                            };
                        } else {
                            // 如果跳过包围盒处理或不需要显示包围盒，直接解析Promise
                            if (skipBoxes) {
                                console.log('跳过包围盒自动应用，将在后续手动应用');
                            } else if (!boxToggle.checked) {
                                console.log('包围盒显示已禁用');
                            }
                            const endTime = performance.now();
                            console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 成功 (无包围盒)`);
                            resolve(true);
                        }
                    } else {
                        console.error('点云投影失败，无可见点');
                        viewerImg.src = originalSrc;
                        const endTime = performance.now();
                        console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 失败 (无可见点)`);
                        resolve(false);
                    }
                } catch (error) {
                    console.error('处理点云投影时出错:', error);
                    viewerImg.src = originalSrc;
                    const endTime = performance.now();
                    console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 失败 (发生错误)`);
                    reject(error);
                }
            };

            // 处理加载错误
            tempImg.onerror = (error) => {
                clearTimeout(timeout);
                console.error('加载原始图像失败:', originalSrc);
                viewerImg.src = originalSrc;
                const endTime = performance.now();
                console.log(`[点云投影完成] 耗时: ${(endTime - startTime).toFixed(2)}ms。结果: 失败 (图像加载错误)`);
                reject(error);
            };

            // 开始加载图像
            tempImg.src = originalSrc;
        });
    } catch (error) {
        console.error('投影图像处理异常:', error);
        return false;
    }
}

async function projectPointsToImage(camId, canvas, ctx, scale = 1.0, debug = false) {
    try {
        console.log(`开始投影点云到图像，相机ID: ${camId}, 缩放: ${scale}`);

        // 确保scale是一个有效的数字
        if (isNaN(scale) || scale <= 0) {
            console.warn('检测到无效的缩放因子，使用默认值 1.0');
            scale = 1.0;
        }

        // 获取点云和标定数据
        const pointCloud = getPointCloud();
        const calibData = getCalibData();

        if (!pointCloud || !calibData || !calibData[camId]) {
            console.error('缺少点云或标定数据', { hasPointCloud: !!pointCloud, hasCalibData: !!calibData, hasCamCalib: calibData && !!calibData[camId] });
            return false;
        }

        const calib = calibData[camId];
        const positions = pointCloud.geometry.attributes.position.array;

        // 检查标定数据是否完整
        if (!calib || !calib.extrinsic) {
            console.error('标定数据不完整', calib);
            return false;
        }

        // 确保canvas和ctx有效
        if (!canvas || !ctx) {
            console.error('Canvas或上下文无效');
            return false;
        }

        console.log(`Canvas尺寸: ${canvas.width}x${canvas.height}, 点云大小: ${positions.length / 3}点`);

        // 提取相机内参 - 尝试多种可能的格式
        let fx, fy, cx, cy;

        // 打印标定数据关键信息以便调试
        if (debug) {
            console.log('标定数据关键信息:', {
                hasIntrinsic: !!calib.intrinsic,
                hasP: !!calib.P,
                hasK: !!calib.K,
                hasExtrinsic: !!calib.extrinsic
            });
        }

        if (calib.intrinsic && calib.intrinsic.elements) {
            // 如果是矩阵格式
            fx = calib.intrinsic.elements[0];
            fy = calib.intrinsic.elements[4];
            cx = calib.intrinsic.elements[2];
            cy = calib.intrinsic.elements[5];
            console.log('从矩阵提取内参:', { fx, fy, cx, cy });
        } else if (calib.fx !== undefined && calib.fy !== undefined && calib.cx !== undefined && calib.cy !== undefined) {
            // 如果是直接属性
            fx = calib.fx;
            fy = calib.fy;
            cx = calib.cx;
            cy = calib.cy;
            console.log('从属性提取内参');
        } else if (calib.P && calib.P.length >= 12) {
            // 如果是投影矩阵P
            fx = calib.P[0];
            fy = calib.P[5];
            cx = calib.P[2];
            cy = calib.P[6];
            console.log('从P矩阵提取内参');
        } else if (calib.K && calib.K.length >= 9) {
            // 如果是内参矩阵K
            fx = calib.K[0];
            fy = calib.K[4];
            cx = calib.K[2];
            cy = calib.K[5];
            console.log('从K矩阵提取内参');
        } else {
            // 如果找不到内参，使用默认值
            console.warn('无法找到相机内参，使用默认值');
            fx = 1000;
            fy = 1000;
            cx = canvas.width / 2;
            cy = canvas.height / 2;
        }

        if (!fx || !fy || cx === undefined || cy === undefined) {
            console.error('相机内参不完整或无效', { fx, fy, cx, cy });
            // 使用默认值
            fx = 1000;
            fy = 1000;
            cx = canvas.width / 2;
            cy = canvas.height / 2;
        }

        // 调整相机内参以适应画布大小
        // 当图像被缩放后显示时，内参也需要缩放
        const imgScaleX = canvas.width / calib.width;
        const imgScaleY = canvas.height / calib.height;

        if (imgScaleX !== 1 || imgScaleY !== 1) {
            console.log('调整内参以适应画布大小，缩放比例:', imgScaleX, imgScaleY);
            fx *= imgScaleX;
            fy *= imgScaleY;
            cx *= imgScaleX;
            cy *= imgScaleY;
        }

        console.log('调整后的相机内参:', { fx, fy, cx, cy });

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

        if (minZ === Infinity || maxZ === -Infinity) {
            console.error('没有可见的点云点');
            return false;
        }

        console.log(`点云深度范围: ${minZ.toFixed(2)} - ${maxZ.toFixed(2)}`);

        // 使用视锥体剔除优化
        const culledPoints = [];
        for (let i = 0; i < positions.length; i += 3) {
            const point = new THREE.Vector4(
                positions[i],
                positions[i + 1],
                positions[i + 2],
                1
            );

            // 将点从世界坐标转换到相机坐标
            const pointCam = point.applyMatrix4(calib.extrinsic);

            // 只处理相机前方的点
            if (pointCam.z <= 0) continue;

            // 将点从相机坐标投影到图像平面
            const x = (pointCam.x / pointCam.z) * fx + cx;
            const y = (pointCam.y / pointCam.z) * fy + cy;

            // 检查点是否在画布范围内
            if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
                // 计算深度颜色（从红到蓝的渐变）
                const depth = (pointCam.z - minZ) / (maxZ - minZ);
                const r = Math.floor(255 * (1 - depth));
                const g = 0;
                const b = Math.floor(255 * depth);

                culledPoints.push({
                    x: x,
                    y: y,
                    color: `rgb(${r}, ${g}, ${b})`,
                    depth: pointCam.z
                });
            }
        }

        console.log(`投影后可见点数: ${culledPoints.length}`);

        if (culledPoints.length === 0) {
            console.error('投影后没有可见点');
            return false;
        }

        // 按深度排序点，确保远处的点先绘制
        culledPoints.sort((a, b) => b.depth - a.depth);

        // 绘制点云，使用更明显的颜色和大小
        const pointSize = Math.max(2, Math.min(4, scale)); // 限制点大小在合理范围内

        // 保存当前状态
        ctx.save();

        // 清晰地标记这是点云投影
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '14px Arial';
        ctx.fillText(`点云投影 - ${culledPoints.length}个点`, 10, 20);

        // 设置全局Alpha以增强对比度
        ctx.globalAlpha = 0.9;
        
        // 添加透明度混合模式，使点云效果更明显
        ctx.globalCompositeOperation = 'lighter';

        console.log('开始绘制点云，点数:', culledPoints.length);
        for (const point of culledPoints) {
            ctx.fillStyle = point.color;
            ctx.beginPath();
            ctx.arc(point.x, point.y, pointSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // 恢复画布状态
        ctx.restore();

        console.log(`点云投影完成，绘制了 ${culledPoints.length} 个点`);
        return true;
    } catch (error) {
        console.error('投影点云时出错:', error);
        return false;
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
