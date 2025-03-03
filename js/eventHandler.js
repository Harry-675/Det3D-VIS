import { handleFileSelect, handleDirectorySelect } from './fileHandler.js';
import { loadPreviousFrame, loadNextFrame } from './frameNavigation.js';
import { toggleProjection } from './projectionHandler.js';
import { toggleBoxes } from './boxHandler.js';
import { initObjectDetailPanel, initObjectInteraction } from './objectInteraction.js';
import { showObjectDetails } from './objectDetailPanel.js';

function setupEventListeners() {
    document.getElementById('fileInput').addEventListener('change', handleFileSelect);
    document.getElementById('directoryInput').addEventListener('change', handleDirectorySelect);
    document.getElementById('prevFrame').addEventListener('click', loadPreviousFrame);
    document.getElementById('nextFrame').addEventListener('click', loadNextFrame);
    
    const projectionToggle = document.getElementById('projectionToggle');
    projectionToggle.addEventListener('change', toggleProjection);
    
    const boxToggle = document.getElementById('boxToggle');
    boxToggle.addEventListener('change', toggleBoxes);
    
    // 暂时注释这部分，等基础功能正常后再解决
    // 初始化目标详情面板和交互
    // initObjectDetailPanel();
    // initObjectInteraction();
}

function handleImageZoom(newScale) {
    // 更新图像缩放比例
    imageScale = newScale;
    
    // 触发3D盒子重新投影
    updateBoxProjections(imageScale);
}

// 修改函数定义，使其接收必要参数
function initEventListeners(renderer, camera, scene) {
    // 现有代码...
    
    // 修改：传递 renderer 参数给 handleObjectClick
    renderer.domElement.addEventListener('click', (event) => 
        handleObjectClick(event, renderer, camera, scene), false);
    
    // 现有代码...
}

// 修改handleObjectClick函数，添加renderer参数
function handleObjectClick(event, renderer, camera, scene) {
    // 射线检测，获取点击的对象
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    
    // 使用传入的 renderer 访问 domElement
    const rect = renderer.domElement.getBoundingClientRect();
    
    // 修正鼠标位置计算方式
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    raycaster.setFromCamera(mouse, camera);
    
    // 获取射线与对象的交点
    const intersects = raycaster.intersectObjects(scene.children, true);
    
    console.log('射线检测结果:', intersects.length);
    
    if (intersects.length > 0) {
        // 找到第一个点击的有效目标对象
        let targetObject = null;
        for (let i = 0; i < intersects.length; i++) {
            console.log('检查对象:', intersects[i].object);
            console.log('userData:', intersects[i].object.userData);
            
            if (intersects[i].object.userData && intersects[i].object.userData.isSelectable) {
                targetObject = intersects[i].object;
                console.log('找到可选中对象:', targetObject);
                break;
            }
        }
        
        if (targetObject) {
            // 如果找到目标对象，显示详情
            console.log('显示目标详情:', targetObject.userData);
            showObjectDetails(targetObject);
        } else {
            console.log('未找到可选中对象');
        }
    }
}

// 末尾只保留一处导出
export { setupEventListeners, initEventListeners }; 