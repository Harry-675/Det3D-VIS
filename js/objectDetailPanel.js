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

// 显示目标详情
export function showObjectDetail(object) {
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
        
        console.log('显示目标详情', {
            type: objectType,
            id: objectId,
            position: `(${position.x.toFixed(2)}, ${position.y.toFixed(2)}, ${position.z.toFixed(2)})`
        });
    } catch (err) {
        console.error('显示目标详情时出错', err);
    }
}

// 显示对象详情的函数
function showObjectDetails(object) {
    console.log('开始显示对象详情:', object);
    
    // 获取对象数据（假设存储在userData中）
    const objectData = object.userData;
    console.log('对象数据:', objectData);
    
    // 获取详情面板元素
    let detailPanel = document.getElementById('objectDetailPanel');
    
    // 如果面板不存在，创建面板
    if (!detailPanel) {
        console.log('创建详情面板');
        createDetailPanel();
        detailPanel = document.getElementById('objectDetailPanel');
    }
    
    // 更新面板内容
    updateDetailPanel(objectData);
    
    // 确保面板可见
    if (detailPanel) {
        detailPanel.style.display = 'block';
        console.log('面板已设为可见');
    } else {
        console.error('找不到详情面板元素');
    }
}

// 创建详情面板DOM元素
function createDetailPanel() {
    console.log('开始创建详情面板DOM');
    
    const panel = document.createElement('div');
    panel.id = 'objectDetailPanel';
    panel.className = 'detail-panel';
    panel.style.position = 'absolute';
    panel.style.top = '20px';
    panel.style.right = '20px';
    panel.style.width = '300px';
    panel.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    panel.style.color = 'white';
    panel.style.borderRadius = '5px';
    panel.style.padding = '10px';
    panel.style.zIndex = '1000';
    panel.style.boxShadow = '0 0 10px rgba(0, 0, 0, 0.5)';
    
    // 创建基本结构
    panel.innerHTML = `
        <div class="panel-header" style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #444;padding-bottom:5px;margin-bottom:10px;">
            <h3 style="margin:0;">目标详情</h3>
            <button id="closeDetailPanel" style="background:none;border:none;color:white;font-size:16px;cursor:pointer;">X</button>
        </div>
        <div class="panel-content">
            <div class="detail-item" style="margin-bottom:8px;">
                <span class="label" style="font-weight:bold;display:inline-block;width:60px;">ID:</span>
                <span id="object-id" class="value" style="font-family:monospace;"></span>
            </div>
            <div class="detail-item" style="margin-bottom:8px;">
                <span class="label" style="font-weight:bold;display:inline-block;width:60px;">位置:</span>
                <span id="object-position" class="value" style="font-family:monospace;"></span>
            </div>
            <div class="detail-item" style="margin-bottom:8px;">
                <span class="label" style="font-weight:bold;display:inline-block;width:60px;">朝向:</span>
                <span id="object-rotation" class="value" style="font-family:monospace;"></span>
            </div>
            <div class="detail-item" style="margin-bottom:8px;">
                <span class="label" style="font-weight:bold;display:inline-block;width:60px;">尺寸:</span>
                <span id="object-size" class="value" style="font-family:monospace;"></span>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    console.log('详情面板已添加到文档');
    
    // 添加关闭按钮事件
    document.getElementById('closeDetailPanel').addEventListener('click', () => {
        document.getElementById('objectDetailPanel').style.display = 'none';
        console.log('点击关闭按钮');
    });
}

// 更新详情面板内容
function updateDetailPanel(data) {
    console.log('更新面板内容:', data);
    
    // 处理ID - 兼容两种可能的格式
    document.getElementById('object-id').textContent = data.id || data.objectId || '未知';
    
    // 格式化位置数据
    if (data.position) {
        const pos = data.position;
        document.getElementById('object-position').textContent = 
            `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`;
    } else {
        // 如果没有position属性，但可能直接在对象上有坐标
        const pos = { 
            x: data.x || 0, 
            y: data.y || 0, 
            z: data.z || 0 
        };
        document.getElementById('object-position').textContent = 
            `X: ${pos.x.toFixed(2)}, Y: ${pos.y.toFixed(2)}, Z: ${pos.z.toFixed(2)}`;
    }
    
    // 格式化朝向数据（欧拉角，单位为度）
    if (data.rotation) {
        const rot = data.rotation;
        document.getElementById('object-rotation').textContent = 
            `X: ${THREE.MathUtils.radToDeg(rot.x).toFixed(2)}°, Y: ${THREE.MathUtils.radToDeg(rot.y).toFixed(2)}°, Z: ${THREE.MathUtils.radToDeg(rot.z).toFixed(2)}°`;
    } else {
        document.getElementById('object-rotation').textContent = '未知';
    }
    
    // 格式化尺寸数据 - 兼容多种可能的格式
    if (data.size) {
        const size = data.size;
        document.getElementById('object-size').textContent = 
            `宽: ${size.width.toFixed(2)}, 高: ${size.height.toFixed(2)}, 长: ${size.depth.toFixed(2)}`;
    } else if (data.dimensions) {
        const dim = data.dimensions;
        document.getElementById('object-size').textContent = 
            `宽: ${dim.x.toFixed(2)}, 高: ${dim.y.toFixed(2)}, 长: ${dim.z.toFixed(2)}`;
    } else {
        document.getElementById('object-size').textContent = '未知';
    }
}

// 导出函数
export { showObjectDetails }; 