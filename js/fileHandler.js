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
        await loadCalibrationFiles(data.frame);
        
        // 加载标注文件
        if (data.frame.label) {
            await loadLabelFile(data.frame.label);
        }
        
        loadImages(data.frame);
        loadPointCloud(data.frame.pcd);
        updateCurrentFileName(file.name);
    };
    reader.readAsText(file);
}

async function loadCalibrationFiles(frame) {
    calibData = {};
    const calibFiles = ['calib1', 'calib2', 'calib3'];
    
    console.log('开始加载标定文件', {
        'frame': Object.keys(frame),
        'calibFiles': calibFiles
    });
    
    for (let i = 0; i < calibFiles.length; i++) {
        const calibFile = frame[calibFiles[i]];
        if (calibFile) {
            try {
                console.log(`加载标定文件: ${calibFiles[i]}`);
                const response = await fetch(calibFile);
                const data = await response.json();
                
                const camId = `cam_${i+1}`;
                calibData[camId] = {
                    extrinsic: new THREE.Matrix4().fromArray(data.extrinsic),
                    intrinsic: new THREE.Matrix3().fromArray(data.intrinsic)
                };
                
                console.log(`标定文件 ${calibFiles[i]} 加载成功，对应相机 ${camId}`);
            } catch (error) {
                console.error(`加载标定文件失败: ${calibFiles[i]}`, error);
            }
        }
    }
    
    console.log('所有标定文件加载完成', {
        'availableCameras': Object.keys(calibData)
    });
}

async function loadLabelFile(labelPath) {
    try {
        console.log('正在加载标注文件:', labelPath);
        const response = await fetch(labelPath);
        
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
    document.querySelectorAll('#imagePanel img').forEach((img, index) => {
        const camId = `cam_${index+1}`;
        img.setAttribute('data-cam-id', camId);
        if (!img.getAttribute('data-original-src')) {
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
