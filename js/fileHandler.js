import { loadPointCloud } from './pointCloudHandler.js';
import { loadImages } from './imageHandler.js';
import { updateFrameNavigation } from './frameNavigation.js';
import { createBoxesFromLabels, projectBoxesToImages } from './boxHandler.js';

// 因为THREE.js是通过script标签全局引入的，所以在这里声明它
/* global THREE */

let jsonFiles = [];
let currentFileIndex = 0;
let calibData = {};
let labelData = null;

// 添加一个在浏览器环境中拼接路径的函数
function joinPaths(basePath, relativePath) {
    let result;
    // 确保路径之间只有一个斜杠
    if (basePath.endsWith('/') && relativePath.startsWith('/')) {
        result = basePath + relativePath.substring(1);
    } else if (!basePath.endsWith('/') && !relativePath.startsWith('/')) {
        result = basePath + '/' + relativePath;
    } else {
        result = basePath + relativePath;
    }
    console.log(`路径拼接: ${basePath} + ${relativePath} = ${result}`);
    return result;
}

export function handleFileSelect(event) {
    const file = event.target.files[0];
    loadJsonFile(file);
}

export function handleDirectorySelect(event) {
    if (!event.target.webkitdirectory) {
        alert('请选择一个目录');
        return;
    }

    jsonFiles = Array.from(event.target.files)
        .filter(file => file.name.endsWith('.json'))
        .sort((a, b) => a.name.localeCompare(b.name));
    
    if (jsonFiles.length > 0) {
        currentFileIndex = 0;
        loadJsonFile(jsonFiles[currentFileIndex]);
        updateFrameNavigation();
    } else {
        alert('所选目录中没有找到JSON文件');
    }
}

export async function loadJsonFile(file, index = null) {
    if (index !== null) {
        currentFileIndex = index;
    }
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        const data = JSON.parse(e.target.result);
        const frame = data.frame;

        console.log('加载JSON文件:', file.name);
        console.log('JSON内容:', frame);

        // 如果存在parent_dir，拼接完整路径
        if (frame.parent_dir) {
            console.log('检测到parent_dir:', frame.parent_dir);
            const parentDir = frame.parent_dir;

            // 拼接配置路径
            if (frame.config) {
                frame.config = joinPaths(parentDir, frame.config);
            }

            // 拼接点云路径
            if (frame.lidar_path) {
                frame.lidar_path = joinPaths(parentDir, frame.lidar_path);
            }

            // 拼接无畸变点云路径
            if (frame.undistort_lidar_path) {
                frame.undistort_lidar_path = joinPaths(parentDir, frame.undistort_lidar_path);
            }

            // 拼接标注文件路径
            if (frame.label) {
                frame.label = joinPaths(parentDir, frame.label);
            }

            // 拼接相机图像路径
            const cameraKeys = [
                'camera_1', 'camera_2', 'camera_3', 'camera_4', 'camera_5', 'camera_6',
                'panoramic_1', 'panoramic_2', 'panoramic_3', 'panoramic_4',
                'traffic_2'
            ];

            cameraKeys.forEach(key => {
                if (frame[key]) {
                    frame[key] = joinPaths(parentDir, frame[key]);
                }
            });

            // 处理分割结果图像路径
            if (frame.seg_result) {
                for (const [camKey, segPath] of Object.entries(frame.seg_result)) {
                    frame.seg_result[camKey] = joinPaths(parentDir, segPath);
                }
            }

            console.log('拼接路径后的frame:', frame);
        } else {
            console.log('未检测到parent_dir，不进行路径拼接');
        }

        // 加载相机配置文件
        if (frame.config) {
            await loadCalibrationFiles(frame);
        }
        
        // 加载标注文件（允许不存在）
        if (frame.label) {
            try {
                await loadLabelFile(frame.label);
            } catch (error) {
                console.warn('标注文件不存在或加载失败，继续处理其他内容:', error);
                // 重置标注数据
                labelData = null;
            }
        } else {
            console.log('未提供标注文件路径，将使用空标注数据');
            labelData = null;
        }
        
        loadImages(frame);
        if (frame.undistort_lidar_path) {
            const pcdPath = frame.lidar_path;
            loadPointCloud(pcdPath);
        }
        updateCurrentFileName(file.name);
    };
    reader.readAsText(file);
}

async function loadCalibrationFiles(frame) {
    calibData = {};
    
    console.log('开始加载相机配置文件', {
        'frame': Object.keys(frame),
    });
    
    if (frame.config) {
        try {
            console.log(`加载相机配置文件: ${frame.config}`);
            const configPath = frame.config + '/cameras.cfg';
            const configUrl = getFileUrl(configPath);
            console.log(`配置文件URL: ${configUrl}`);
            const response = await fetch(configUrl);

            if (!response.ok) {
                throw new Error(`配置文件加载失败: ${response.status} ${response.statusText}`);
            }

            const configText = await response.text();

            // 解析相机配置文件
            const cameras = parseCalibrationConfig(configText);

            for (const [cameraId, cameraConfig] of Object.entries(cameras)) {
                calibData[cameraId] = cameraConfig;
                console.log(`相机配置加载成功：${cameraId}`);
            }
        } catch (error) {
            console.error(`加载相机配置文件失败`, error);
        }
    }

    console.log('所有相机配置加载完成', {
        'availableCameras': Object.keys(calibData)
    });
}

// 修改原来的函数，移除编码处理
function parseCalibrationConfig(configText) {
    console.log('解析相机配置...');
    const cameras = {};

    // 使用正则表达式匹配所有配置块
    const configBlocks = configText.match(/config\s*\{[\s\S]*?\}(?=\s*config|\s*$)/g);

    if (configBlocks) {
        console.log('找到相机配置块，数量:', configBlocks.length);

        configBlocks.forEach((block, index) => {
            console.log(`开始处理第 ${index + 1} 个配置块`);

            // 提取相机ID
            const cameraDevMatch = block.match(/camera_dev:\s*"([^"]+)"/);
            if (!cameraDevMatch) {
                console.warn(`在配置块 ${index + 1} 中未找到相机ID`);
                return;
            }

            const cameraId = cameraDevMatch[1];
            console.log(`找到相机ID: ${cameraId}`);

            try {
                // 提取内参参数
                const intrinsic = {};

                // 基础内参
                const imgWidthMatch = block.match(/img_width:\s*(\d+)/);
                const imgHeightMatch = block.match(/img_height:\s*(\d+)/);
                const fxMatch = block.match(/f_x:\s*([\d.]+)/);
                const fyMatch = block.match(/f_y:\s*([\d.]+)/);
                const oxMatch = block.match(/o_x:\s*([\d.]+)/);
                const oyMatch = block.match(/o_y:\s*([\d.]+)/);
                const modelTypeMatch = block.match(/model_type:\s*(\w+)/);

                if (!imgWidthMatch || !imgHeightMatch || !fxMatch || !fyMatch || !oxMatch || !oyMatch) {
                    console.warn(`相机 ${cameraId} 缺少基本内参参数`);
                    return;
                }

                intrinsic.img_width = parseInt(imgWidthMatch[1]);
                intrinsic.img_height = parseInt(imgHeightMatch[1]);
                intrinsic.f_x = parseFloat(fxMatch[1]);
                intrinsic.f_y = parseFloat(fyMatch[1]);
                intrinsic.o_x = parseFloat(oxMatch[1]);
                intrinsic.o_y = parseFloat(oyMatch[1]);

                // 可选的model_type
                if (modelTypeMatch) {
                    intrinsic.model_type = modelTypeMatch[1];
                } else {
                    intrinsic.model_type = "PINHOLE"; // 默认值
                }

                // 畸变参数（可选）
                const k1Match = block.match(/k_1:\s*([\d.-]+)/);
                const k2Match = block.match(/k_2:\s*([\d.-]+)/);
                const k3Match = block.match(/k_3:\s*([\d.-]+)/);
                const k4Match = block.match(/k_4:\s*([\d.-]+)/);

                intrinsic.k_1 = k1Match ? parseFloat(k1Match[1]) : 0.0;
                intrinsic.k_2 = k2Match ? parseFloat(k2Match[1]) : 0.0;
                intrinsic.k_3 = k3Match ? parseFloat(k3Match[1]) : 0.0;
                intrinsic.k_4 = k4Match ? parseFloat(k4Match[1]) : 0.0;

                console.log(`相机 ${cameraId} 的内参提取成功:`, intrinsic);

                // 提取外参
                const posXMatch = block.match(/position\s*\{[^}]*x:\s*([\d.-]+)/);
                const posYMatch = block.match(/position\s*\{[^}]*y:\s*([\d.-]+)/);
                const posZMatch = block.match(/position\s*\{[^}]*z:\s*([\d.-]+)/);
                const qxMatch = block.match(/orientation\s*\{[^}]*qx:\s*([\d.-]+)/);
                const qyMatch = block.match(/orientation\s*\{[^}]*qy:\s*([\d.-]+)/);
                const qzMatch = block.match(/orientation\s*\{[^}]*qz:\s*([\d.-]+)/);
                const qwMatch = block.match(/orientation\s*\{[^}]*qw:\s*([\d.-]+)/);

                if (!posXMatch || !posYMatch || !posZMatch || !qxMatch || !qyMatch || !qzMatch || !qwMatch) {
                    console.warn(`相机 ${cameraId} 缺少外参参数`);
                    return;
                }

                const position = {
                    x: parseFloat(posXMatch[1]),
                    y: parseFloat(posYMatch[1]),
                    z: parseFloat(posZMatch[1])
                };

                const orientation = {
                    qx: parseFloat(qxMatch[1]),
                    qy: parseFloat(qyMatch[1]),
                    qz: parseFloat(qzMatch[1]),
                    qw: parseFloat(qwMatch[1])
                };

                console.log(`相机 ${cameraId} 的外参提取成功:`, { position, orientation });

                // 提取安装角度误差（可选）
                const installErrorX = block.match(/install_angle_error\s*\{[^}]*x:\s*([\d.-]+)/);
                const installErrorY = block.match(/install_angle_error\s*\{[^}]*y:\s*([\d.-]+)/);
                const installErrorZ = block.match(/install_angle_error\s*\{[^}]*z:\s*([\d.-]+)/);

                const installAngleError = {
                    x: installErrorX ? parseFloat(installErrorX[1]) : 0.0,
                    y: installErrorY ? parseFloat(installErrorY[1]) : 0.0,
                    z: installErrorZ ? parseFloat(installErrorZ[1]) : 0.0
                };

                console.log(`相机 ${cameraId} 的安装角度误差:`, installAngleError);

                // 使用THREE.js创建变换矩阵
                console.log(`开始为相机 ${cameraId} 创建变换矩阵`);
                const position3D = new THREE.Vector3(position.x, position.y, position.z);
                const quaternion = new THREE.Quaternion(
                    orientation.qx,
                    orientation.qy,
                    orientation.qz,
                    orientation.qw
                );

                // 创建变换矩阵（从激光雷达坐标系到相机坐标系）
                const matrix = new THREE.Matrix4();
                matrix.compose(position3D, quaternion, new THREE.Vector3(1, 1, 1));
                console.log(`相机 ${cameraId} 变换矩阵创建完成`);

                // 计算逆矩阵（从相机坐标系到激光雷达坐标系）
                console.log(`计算相机 ${cameraId} 的逆变换矩阵`);
                const inverseMatrix = new THREE.Matrix4().copy(matrix).invert();

                // 从逆矩阵中提取位置和旋转信息
                const inversePosition = new THREE.Vector3();
                const inverseQuaternion = new THREE.Quaternion();
                const inverseScale = new THREE.Vector3();

                inverseMatrix.decompose(inversePosition, inverseQuaternion, inverseScale);
                console.log(`相机 ${cameraId} 逆变换矩阵分解完成`);

                // 创建相机配置对象
                cameras[cameraId] = {
                    intrinsic: {
                        img_width: intrinsic.img_width,
                        img_height: intrinsic.img_height,
                        f_x: intrinsic.f_x,
                        f_y: intrinsic.f_y,
                        o_x: intrinsic.o_x,
                        o_y: intrinsic.o_y,
                        k_1: intrinsic.k_1,
                        k_2: intrinsic.k_2,
                        k_3: intrinsic.k_3,
                        k_4: intrinsic.k_4,
                        model_type: intrinsic.model_type
                    },
                    extrinsic: {
                        // 使用求逆后的位置和方向
                        position: {
                            x: inversePosition.x,
                            y: inversePosition.y,
                            z: inversePosition.z
                        },
                        orientation: {
                            x: inverseQuaternion.x,
                            y: inverseQuaternion.y,
                            z: inverseQuaternion.z,
                            w: inverseQuaternion.w
                        },
                        // 保存原始数据
                        sensor_to_cam: {
                            position: position,
                            orientation: {
                                x: orientation.qx,
                                y: orientation.qy,
                                z: orientation.qz,
                                w: orientation.qw
                            }
                        },
                        // 添加变换矩阵
                        matrix: matrix,
                        inverseMatrix: inverseMatrix
                    },
                    install_angle_error: installAngleError,
                    // 为与现有代码兼容，添加顶层属性
                    width: intrinsic.img_width,
                    height: intrinsic.img_height,
                    fx: intrinsic.f_x,
                    fy: intrinsic.f_y,
                    cx: intrinsic.o_x,
                    cy: intrinsic.o_y,
                    extrinsic: inverseMatrix // 使用求逆后的矩阵
                };

                console.log(`相机 ${cameraId} 配置对象创建完成`);

            } catch (error) {
                console.error(`处理相机 ${cameraId} 配置时出错:`, error);
            }
        });

        console.log('所有相机配置块处理完成，成功解析的相机:', Object.keys(cameras));
    } else {
        console.warn('未找到相机配置块，请检查配置文件格式是否正确');
    }

    return cameras;
}

// 修改loadLabelFile函数，优化错误处理
async function loadLabelFile(labelPath) {
    try {
        console.log('正在加载标注文件:', labelPath);
        const labelUrl = getFileUrl(labelPath);
        console.log('标注文件URL:', labelUrl);
        const response = await fetch(labelUrl);
        
        if (!response.ok) {
            console.warn(`标注文件不存在或无法访问: ${response.status} ${response.statusText}`);
            labelData = null;
            return; // 提前返回，不抛出错误
        }
        
        labelData = await response.json();
        console.log('成功加载标注文件，包含', labelData.length, '个对象');
        
        // 打印标定数据的相机ID，便于调试
        console.log('当前可用标定数据:', Object.keys(calibData));
        
        // 创建3D包围盒
        createBoxesFromLabels(labelData);
        
        // 先给图像添加必要的属性，然后再投影
        setupImageAttributes();
        
        // 延迟投影以确保图像已加载
        setTimeout(() => {
            projectBoxesToImages();
        }, 500);
    } catch (error) {
        console.error('标注文件加载或解析错误:', error);
        labelData = null;
        // 不再抛出错误，而是继续处理
    }
}

// 为所有图像元素添加必要的属性
function setupImageAttributes() {
    document.querySelectorAll('#imagePanel img').forEach((img) => {
        const camId = img.getAttribute('data-cam-id');
        if (camId && !img.getAttribute('data-original-src')) {
            img.setAttribute('data-original-src', img.src);
        }
        console.log(`设置图像属性: ${img.alt} -> ${camId}`);
    });
}

function updateCurrentFileName(filename) {
    document.getElementById('currentFile').textContent = 
        `${filename} (${currentFileIndex + 1}/${jsonFiles.length})`;
}

export function getCalibData() {
    return calibData;
}

export function getLabelData() {
    return labelData;
}

export function getCurrentFileIndex() {
    return currentFileIndex;
}

export function getJsonFiles() {
    return jsonFiles;
}

export function setCurrentFileIndex(index) {
    if (index >= 0 && index < jsonFiles.length) {
        currentFileIndex = index;
        loadJsonFile(jsonFiles[index], index);
    }
}

// 获取本地文件的URL (通过服务器)
export function getFileUrl(path) {
    if (!path) return null;
    // 检查是否已经是URL格式
    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }
    // 使用本地服务器API转换路径
    return `http://localhost:3000/file?path=${encodeURIComponent(path)}`;
}
