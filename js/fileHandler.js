import { loadPointCloud } from './pointCloudHandler.js';
import { loadImages } from './imageHandler.js';
import { updateFrameNavigation } from './frameNavigation.js';
import { createBoxesFromLabels, projectBoxesToImages } from './boxHandler.js';

let jsonFiles = [];
let currentFileIndex = 0;
let calibData = {};
let labelData = null;

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

        // 加载相机配置文件
        if (data.frame.config) {
            await loadCalibrationFiles(data.frame);
        }
        
        // 加载标注文件
        if (data.frame.label) {
            await loadLabelFile(data.frame.label);
        }
        
        loadImages(data.frame);
        if (data.frame.undistort_lidar_path) {
            const pcdPath = data.frame.lidar_path;
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

// 解析相机配置文件的函数
function parseCalibrationConfig(configText) {
    const cameras = {};

    // 匹配所有的相机配置块
    const configBlocks = configText.match(/config\s*\{[\s\S]*?\}/g);

    if (configBlocks) {
        configBlocks.forEach(block => {
            // 提取相机ID
            const cameraDevMatch = block.match(/camera_dev:\s*"([^"]+)"/);
            if (cameraDevMatch) {
                const cameraId = cameraDevMatch[1];

                // 提取外参
                const extrinsicMatch = block.match(/extrinsic\s*\{[\s\S]*?sensor_to_cam\s*\{[\s\S]*?position\s*\{[\s\S]*?x:\s*([\d.-]+)[\s\S]*?y:\s*([\d.-]+)[\s\S]*?z:\s*([\d.-]+)[\s\S]*?orientation\s*\{[\s\S]*?qx:\s*([\d.-]+)[\s\S]*?qy:\s*([\d.-]+)[\s\S]*?qz:\s*([\d.-]+)[\s\S]*?qw:\s*([\d.-]+)/);

                // 提取内参
                const intrinsicMatch = block.match(/intrinsic\s*\{[\s\S]*?img_width:\s*(\d+)[\s\S]*?img_height:\s*(\d+)[\s\S]*?f_x:\s*([\d.]+)[\s\S]*?f_y:\s*([\d.]+)[\s\S]*?o_x:\s*([\d.]+)[\s\S]*?o_y:\s*([\d.]+)/);

                if (extrinsicMatch && intrinsicMatch) {
                    // 解析位置和方向
                    const position = {
                        x: parseFloat(extrinsicMatch[1]),
                        y: parseFloat(extrinsicMatch[2]),
                        z: parseFloat(extrinsicMatch[3])
                    };

                    const orientation = {
                        x: parseFloat(extrinsicMatch[4]), // qx
                        y: parseFloat(extrinsicMatch[5]), // qy
                        z: parseFloat(extrinsicMatch[6]), // qz
                        w: parseFloat(extrinsicMatch[7])  // qw
                    };

                    // 解析内参
                    const width = parseInt(intrinsicMatch[1]);
                    const height = parseInt(intrinsicMatch[2]);
                    const fx = parseFloat(intrinsicMatch[3]);
                    const fy = parseFloat(intrinsicMatch[4]);
                    const cx = parseFloat(intrinsicMatch[5]);
                    const cy = parseFloat(intrinsicMatch[6]);

                    // 创建相机配置对象
                    cameras[cameraId] = {
                        extrinsic: {
                            position: position,
                            orientation: orientation
                        },
                        intrinsic: {
                            width: width,
                            height: height,
                            fx: fx,
                            fy: fy,
                            cx: cx,
                            cy: cy
                        }
                    };
                }
            }
        });
    }

    return cameras;
}

async function loadLabelFile(labelPath) {
    try {
        console.log('正在加载标注文件:', labelPath);
        const labelUrl = getFileUrl(labelPath);
        console.log('标注文件URL:', labelUrl);
        const response = await fetch(labelUrl);
        
        if (!response.ok) {
            throw new Error(`标注文件加载失败: ${response.status} ${response.statusText}`);
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
        console.error('标注文件加载错误:', error);
        labelData = null;
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
