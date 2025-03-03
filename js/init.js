import { initScene, animate } from './scene.js';
import { initImageViewer } from './imageHandler.js';
import { setupEventListeners } from './eventHandler.js';

export function init() {
    // 初始化场景并保存到全局变量
    window.sceneObjects = initScene(document.getElementById('pointCloudPanel'));
    initImageViewer();
    setupEventListeners();
    animate();
}