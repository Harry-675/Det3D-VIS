import { getScene, getCamera } from './scene.js';

// 射线投射器和鼠标向量
let raycaster, mouse;

// 创建并初始化目标详情面板
export function initObjectDetailPanel() {
    // 检查是否已存在
    if (document.getElementById('objectDetailPanel')) {
        return;
    }
    
    // 创建详情面板
    const detailPanel = document.createElement('div');
    detailPanel.id = 'objectDetailPanel';
    detailPanel.className = 'object-detail-panel';
    detailPanel.style.display = 'none';
    
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'X';
    closeBtn.className = 'close-btn';
    closeBtn.addEventListener('click', () => {
        detailPanel.style.display = 'none';
    });
    
    // 创建标题
    const title = document.createElement('h3');
    title.id = 'objectDetailTitle';
    title.textContent = '目标详情';
    
    // 创建内容容器
    const content = document.createElement('div');
    content.id = 'objectDetailContent';
    
    // 组装面板
    detailPanel.appendChild(closeBtn);
    detailPanel.appendChild(title);
    detailPanel.appendChild(content);
    
    // 添加到文档
    document.body.appendChild(detailPanel);
    
    console.log('目标详情面板已初始化');
}

// 初始化射线投射器
export function initObjectInteraction() {
    // 初始化射线投射器和鼠标向量
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();
    
    // 添加点击事件监听器
    const container = document.getElementById('sceneContainer');
    if (container) {
        container.addEventListener('click', onSceneClick);
        console.log('对象交互系统已初始化');
    } else {
        console.error('无法找到场景容器元素');
    }
}

// 场景点击处理
function onSceneClick(event) {
    try {
        // 获取场景容器
        const container = document.getElementById('sceneContainer');
        const rect = container.getBoundingClientRect();
        
        // 计算鼠标在归一化设备坐标中的位置
        // (-1 到 +1)
        mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;
        
        // 更新射线投射器
        const camera = getCamera();
        const scene = getScene();
        
        raycaster.setFromCamera(mouse, camera);
        
        // 获取与射线相交的对象
        const intersects = raycaster.intersectObjects(scene.children, true);
        
        if (intersects.length > 0) {
            // 查找第一个有效的目标对象
            for (let i = 0; i < intersects.length; i++) {
                const object = findParentWithUserData(intersects[i].object);
                
                if (object && object.userData && object.userData.objectId) {
                    console.log('点击了目标对象:', {
                        type: object.userData.objectType,
                        id: object.userData.objectId
                    });
                    
                    // 显示目标详情
                    showObjectDetail(object);
                    return;
                }
            }
        }
    } catch (err) {
        console.error('处理场景点击事件时出错:', err);
    }
}

// 查找具有userData的父对象
function findParentWithUserData(object) {
    let current = object;
    
    // 向上遍历对象层次结构，直到找到具有userData.objectId的对象
    while (current) {
        if (current.userData && current.userData.objectId) {
            return current;
        }
        current = current.parent;
    }
    
    return null;
}

// 显示目标详情
function showObjectDetail(object) {
    try {
        const panel = document.getElementById('objectDetailPanel');
        const content = document.getElementById('objectDetailContent');
        
        if (!panel || !content) {
            console.error('找不到详情面板元素');
            return;
        }
        
        // 获取对象数据
        const userData = object.userData;
        const objectType = userData.objectType || '未知类型';
        const objectId = userData.objectId || '未知ID';
        
        // 获取位置和尺寸信息
        const position = object.position;
        const dimensions = userData.dimensions || { x: 0, y: 0, z: 0 };
        
        // 更新标题
        document.getElementById('objectDetailTitle').textContent = `${objectType} (ID: ${objectId})`;
        
        // 格式化详情内容
        content.innerHTML = `
            <table class="detail-table">
                <tr>
                    <th>属性</th>
                    <th>值</th>
                </tr>
                <tr>
                    <td>类别</td>
                    <td>${objectType}</td>
                </tr>
                <tr>
                    <td>ID</td>
                    <td>${objectId}</td>
                </tr>
                <tr>
                    <td>位置</td>
                    <td>X: ${position.x.toFixed(2)}, Y: ${position.y.toFixed(2)}, Z: ${position.z.toFixed(2)}</td>
                </tr>
                <tr>
                    <td>尺寸</td>
                    <td>长: ${dimensions.x.toFixed(2)}, 宽: ${dimensions.y.toFixed(2)}, 高: ${dimensions.z.toFixed(2)}</td>
                </tr>
            </table>
        `;
        
        // 显示面板
        panel.style.display = 'block';
        
        console.log('显示目标详情:', {
            type: objectType,
            id: objectId,
            position: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
        });
    } catch (err) {
        console.error('显示目标详情时出错:', err);
    }
}
